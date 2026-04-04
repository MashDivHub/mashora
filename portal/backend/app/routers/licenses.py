from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import User
from app.schemas.license import LicenseCreate, LicenseResponse, LicenseValidation
from app.services.license_manager import LicenseManager

router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.post("/", response_model=LicenseResponse, status_code=status.HTTP_201_CREATED)
async def create_license(
    body: LicenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LicenseResponse:
    license_ = await LicenseManager.create_license(
        db=db,
        org_id=current_user.org_id,
        plan=body.plan,
        max_users=body.max_users,
        max_apps=body.max_apps,
    )
    await db.commit()
    await db.refresh(license_)
    return LicenseResponse.model_validate(license_)


@router.get("/", response_model=list[LicenseResponse])
async def list_licenses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LicenseResponse]:
    licenses = await LicenseManager.get_org_licenses(db=db, org_id=current_user.org_id)
    return [LicenseResponse.model_validate(lic) for lic in licenses]


@router.get("/{license_key}/validate", response_model=LicenseValidation)
async def validate_license(
    license_key: str,
    db: AsyncSession = Depends(get_db),
) -> LicenseValidation:
    result = await LicenseManager.validate_license(db=db, license_key=license_key)
    return LicenseValidation(**result)


@router.patch("/{license_id}", response_model=LicenseResponse)
async def revoke_license(
    license_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LicenseResponse:
    # Scope check: ensure license belongs to current user's org
    from sqlalchemy import select
    from app.models import License

    result = await db.execute(
        select(License).where(License.id == license_id, License.org_id == current_user.org_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")

    license_ = await LicenseManager.revoke_license(db=db, license_id=license_id)
    await db.commit()
    await db.refresh(license_)
    return LicenseResponse.model_validate(license_)
