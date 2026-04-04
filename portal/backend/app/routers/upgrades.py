from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Tenant, User
from app.models.upgrade import Upgrade
from app.schemas.upgrade import AvailableUpgrade, UpgradeCreate, UpgradeResponse
from app.services.upgrade_engine import UpgradeEngine

router = APIRouter(prefix="/upgrades", tags=["upgrades"])


@router.get("/available", response_model=AvailableUpgrade)
async def check_available_upgrade(
    tenant_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AvailableUpgrade:
    # Verify tenant belongs to user's org
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id, Tenant.org_id == current_user.org_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    try:
        info = await UpgradeEngine.get_available_upgrade(db, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return AvailableUpgrade(**info)


@router.post("", response_model=UpgradeResponse, status_code=status.HTTP_201_CREATED)
async def start_upgrade(
    body: UpgradeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UpgradeResponse:
    # Verify tenant ownership
    result = await db.execute(
        select(Tenant).where(Tenant.id == body.tenant_id, Tenant.org_id == current_user.org_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant not found or not owned by you")

    try:
        upgrade = await UpgradeEngine.create_upgrade(db, body.tenant_id, body.to_version)
        upgrade = await UpgradeEngine.start_upgrade(db, upgrade.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    await db.commit()
    await db.refresh(upgrade)
    return UpgradeResponse.model_validate(upgrade)


@router.get("/{upgrade_id}/status", response_model=UpgradeResponse)
async def get_upgrade_status(
    upgrade_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UpgradeResponse:
    result = await db.execute(select(Upgrade).where(Upgrade.id == upgrade_id))
    upgrade = result.scalar_one_or_none()
    if upgrade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upgrade not found")

    # Verify the upgrade's tenant belongs to user's org
    result2 = await db.execute(
        select(Tenant).where(Tenant.id == upgrade.tenant_id, Tenant.org_id == current_user.org_id)
    )
    if result2.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return UpgradeResponse.model_validate(upgrade)


@router.get("", response_model=list[UpgradeResponse])
async def list_upgrades(
    tenant_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UpgradeResponse]:
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id, Tenant.org_id == current_user.org_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    upgrades = await UpgradeEngine.list_upgrades(db, tenant_id)
    return [UpgradeResponse.model_validate(u) for u in upgrades]
