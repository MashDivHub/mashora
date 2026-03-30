from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Tenant, User
from app.schemas.tenant import TenantCreate, TenantList, TenantResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=TenantList)
async def list_tenants(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantList:
    from sqlalchemy import select, func

    result = await db.execute(
        select(Tenant).where(Tenant.org_id == current_user.org_id)
    )
    tenants = result.scalars().all()
    return TenantList(
        tenants=[TenantResponse.model_validate(t) for t in tenants],
        total=len(tenants),
    )


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantResponse:
    from app.services.tenant_provisioner import TenantProvisioner

    tenant = await TenantProvisioner.create_tenant(db, current_user.org_id, body.db_name, body.subdomain)
    return TenantResponse.model_validate(tenant)


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantResponse:
    from uuid import UUID
    from sqlalchemy import select

    result = await db.execute(
        select(Tenant).where(
            Tenant.id == UUID(tenant_id),
            Tenant.org_id == current_user.org_id,
        )
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return TenantResponse.model_validate(tenant)


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    from uuid import UUID
    from sqlalchemy import select

    result = await db.execute(
        select(Tenant).where(
            Tenant.id == UUID(tenant_id),
            Tenant.org_id == current_user.org_id,
        )
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    await db.delete(tenant)
