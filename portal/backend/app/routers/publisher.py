import hashlib
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Addon, AddonVersion, TenantAddon, User
from app.schemas.addon import AddonCreate, AddonResponse, AddonVersionCreate, AddonVersionResponse
from app.services.minio_service import MinioService

router = APIRouter(prefix="/publisher", tags=["publisher"])


def _addon_response(addon: Addon) -> AddonResponse:
    return AddonResponse(
        id=addon.id,
        technical_name=addon.technical_name,
        display_name=addon.display_name,
        summary=addon.summary,
        author_name=addon.author.name if addon.author else None,
        category=addon.category,
        version=addon.version,
        price_cents=addon.price_cents,
        currency=addon.currency,
        icon_url=addon.icon_url,
        download_count=addon.download_count,
        rating_avg=addon.rating_avg,
        rating_count=addon.rating_count,
        status=addon.status,
        created_at=addon.created_at,
    )


@router.post("/addons", response_model=AddonResponse, status_code=status.HTTP_201_CREATED)
async def submit_addon(
    body: AddonCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check uniqueness
    result = await db.execute(
        select(Addon).where(Addon.technical_name == body.technical_name)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Addon with this technical name already exists")

    addon = Addon(
        technical_name=body.technical_name,
        display_name=body.display_name,
        summary=body.summary,
        description=body.description,
        category=body.category,
        price_cents=body.price_cents,
        currency=body.currency,
        author_id=current_user.org_id,
        status="pending",
    )
    db.add(addon)
    await db.flush()
    await db.refresh(addon, attribute_names=["author"])
    return _addon_response(addon)


@router.get("/addons", response_model=list[AddonResponse])
async def list_publisher_addons(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Addon).where(Addon.author_id == current_user.org_id).options(selectinload(Addon.author))
    )
    addons = result.scalars().all()
    return [_addon_response(a) for a in addons]


@router.post(
    "/addons/{technical_name}/versions",
    response_model=AddonVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_version(
    technical_name: str,
    version: str = Form(...),
    changelog: str = Form(""),
    mashora_version_compat: str = Form("19.0"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find addon and verify ownership
    result = await db.execute(
        select(Addon).where(
            Addon.technical_name == technical_name,
            Addon.author_id == current_user.org_id,
        )
    )
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found or not owned by you")

    # Read file
    file_data = await file.read()
    file_hash = hashlib.sha256(file_data).hexdigest()

    # Upload to MinIO
    try:
        file_path = await MinioService.upload_addon(
            technical_name, version, file_data, file.filename or f"{technical_name}-{version}.zip"
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to upload to storage: {e}")

    # Create version record
    addon_version = AddonVersion(
        addon_id=addon.id,
        version=version,
        changelog=changelog,
        file_path=file_path,
        file_hash=file_hash,
        file_size=len(file_data),
        mashora_version_compat=mashora_version_compat,
        published_at=datetime.now(timezone.utc),
    )
    db.add(addon_version)

    # Update addon version
    addon.version = version
    await db.flush()

    return AddonVersionResponse.model_validate(addon_version)


@router.get("/addons/{technical_name}/analytics")
async def addon_analytics(
    technical_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Addon).where(
            Addon.technical_name == technical_name,
            Addon.author_id == current_user.org_id,
        )
    )
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found or not owned by you")

    # Count installs
    result = await db.execute(
        select(func.count()).select_from(TenantAddon).where(TenantAddon.addon_id == addon.id)
    )
    install_count = result.scalar() or 0

    # Count versions
    result = await db.execute(
        select(func.count()).select_from(AddonVersion).where(AddonVersion.addon_id == addon.id)
    )
    versions_count = result.scalar() or 0

    return {
        "technical_name": addon.technical_name,
        "download_count": addon.download_count,
        "rating_avg": float(addon.rating_avg or 0),
        "rating_count": addon.rating_count,
        "install_count": install_count,
        "versions_count": versions_count,
    }


@router.delete("/addons/{technical_name}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(
    technical_name: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Addon).where(
            Addon.technical_name == technical_name,
            Addon.author_id == current_user.org_id,
        )
    )
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found or not owned by you")

    result = await db.execute(
        select(AddonVersion).where(
            AddonVersion.id == UUID(version_id),
            AddonVersion.addon_id == addon.id,
        )
    )
    ver = result.scalar_one_or_none()
    if ver is None:
        raise HTTPException(status_code=404, detail="Version not found")

    # Delete from MinIO
    try:
        await MinioService.delete_addon(ver.file_path)
    except Exception:
        pass  # Storage cleanup is best-effort

    await db.delete(ver)
