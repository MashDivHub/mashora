from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import Addon, AddonReview, AddonVersion, Tenant, TenantAddon, User
from app.schemas.addon import (
    AddonDetail,
    AddonList,
    AddonResponse,
    AddonReviewCreate,
    AddonReviewResponse,
    AddonVersionResponse,
    InstallAddonRequest,
)

router = APIRouter(prefix="/addons", tags=["addons"])


@router.get("", response_model=AddonList)
async def browse_addons(
    q: str | None = Query(None),
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("download_count"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Addon).where(Addon.status == "published")

    if q:
        query = query.where(
            or_(
                Addon.technical_name.ilike(f"%{q}%"),
                Addon.display_name.ilike(f"%{q}%"),
                Addon.summary.ilike(f"%{q}%"),
            )
        )
    if category:
        query = query.where(Addon.category == category)

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    sort_col = getattr(Addon, sort_by, Addon.download_count)
    query = query.order_by(sort_col.desc())

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    addons = result.scalars().all()

    return AddonList(
        addons=[AddonResponse.model_validate(a) for a in addons],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{technical_name}", response_model=AddonDetail)
async def get_addon(technical_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Addon)
        .where(Addon.technical_name == technical_name)
        .options(selectinload(Addon.versions))
    )
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")

    versions = [AddonVersionResponse.model_validate(v) for v in addon.versions]
    data = AddonResponse.model_validate(addon).model_dump()
    data["description"] = addon.description
    data["mashora_version_min"] = addon.mashora_version_min
    data["versions"] = versions
    return AddonDetail(**data)


@router.post("/{technical_name}/install")
async def install_addon(
    technical_name: str,
    body: InstallAddonRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find addon
    result = await db.execute(select(Addon).where(Addon.technical_name == technical_name))
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")

    # Verify tenant belongs to user's org
    result = await db.execute(
        select(Tenant).where(Tenant.id == body.tenant_id, Tenant.org_id == current_user.org_id)
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=403, detail="Tenant not found or not owned by you")

    # Get latest version if not specified
    version_id = body.version_id
    if version_id is None:
        result = await db.execute(
            select(AddonVersion)
            .where(AddonVersion.addon_id == addon.id)
            .order_by(AddonVersion.published_at.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()
        if latest is None:
            raise HTTPException(status_code=400, detail="No versions available")
        version_id = latest.id

    # Check if already installed
    result = await db.execute(
        select(TenantAddon).where(
            TenantAddon.tenant_id == body.tenant_id, TenantAddon.addon_id == addon.id
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Addon already installed on this tenant")

    # Install
    ta = TenantAddon(tenant_id=body.tenant_id, addon_id=addon.id, addon_version_id=version_id)
    db.add(ta)
    addon.download_count += 1
    await db.flush()

    return {"message": "Addon installed successfully"}


@router.post("/{technical_name}/review", response_model=AddonReviewResponse)
async def review_addon(
    technical_name: str,
    body: AddonReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Addon).where(Addon.technical_name == technical_name))
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")

    # Upsert review
    result = await db.execute(
        select(AddonReview).where(
            AddonReview.addon_id == addon.id, AddonReview.user_id == current_user.id
        )
    )
    review = result.scalar_one_or_none()
    if review:
        review.rating = body.rating
        review.comment = body.comment
    else:
        review = AddonReview(
            addon_id=addon.id, user_id=current_user.id, rating=body.rating, comment=body.comment
        )
        db.add(review)

    await db.flush()

    # Recalculate average
    result = await db.execute(
        select(func.avg(AddonReview.rating), func.count()).where(
            AddonReview.addon_id == addon.id
        )
    )
    avg, count = result.one()
    addon.rating_avg = float(avg or 0)
    addon.rating_count = count
    await db.flush()

    return AddonReviewResponse(
        id=review.id,
        user_id=review.user_id,
        user_email=current_user.email,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


@router.get("/{technical_name}/reviews", response_model=list[AddonReviewResponse])
async def list_reviews(technical_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Addon).where(Addon.technical_name == technical_name))
    addon = result.scalar_one_or_none()
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")

    result = await db.execute(
        select(AddonReview, User.email)
        .join(User, AddonReview.user_id == User.id)
        .where(AddonReview.addon_id == addon.id)
        .order_by(AddonReview.created_at.desc())
    )
    rows = result.all()
    return [
        AddonReviewResponse(
            id=r.AddonReview.id,
            user_id=r.AddonReview.user_id,
            user_email=r.email,
            rating=r.AddonReview.rating,
            comment=r.AddonReview.comment,
            created_at=r.AddonReview.created_at,
        )
        for r in rows
    ]
