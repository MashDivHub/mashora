from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import License, Subscription, User
from app.schemas.subscription import (
    CheckoutResponse,
    PlanInfo,
    PortalResponse,
    SubscriptionCreate,
    SubscriptionResponse,
)
from app.services.plans import PLANS, get_plan
from app.services.stripe_service import StripeService
from app.config import get_settings

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/plans", response_model=list[PlanInfo])
async def list_plans() -> list[PlanInfo]:
    """Return all available subscription plans. No auth required."""
    return [
        PlanInfo(
            slug=slug,
            name=config["name"],
            price_cents=config["price_cents"],
            max_users=config["max_users"],
            max_apps=config["max_apps"],
            features=config["features"],
        )
        for slug, config in PLANS.items()
    ]


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout(
    body: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    """Create a Stripe checkout session for the authenticated user's org."""
    plan_config = get_plan(body.plan)
    if plan_config is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown plan: {body.plan}",
        )

    settings = get_settings()

    if not settings.stripe_secret_key:
        now = datetime.now(timezone.utc)
        period_end = now + timedelta(days=30)

        result = await db.execute(
            select(Subscription)
            .where(Subscription.org_id == current_user.org_id)
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        subscription = result.scalar_one_or_none()

        if subscription is None:
            subscription = Subscription(
                org_id=current_user.org_id,
                plan=body.plan,
                amount_cents=plan_config["price_cents"],
                currency="usd",
                interval="month",
                status="active",
                current_period_start=now,
                current_period_end=period_end,
            )
            db.add(subscription)
        else:
            subscription.plan = body.plan
            subscription.amount_cents = plan_config["price_cents"]
            subscription.currency = "usd"
            subscription.interval = "month"
            subscription.status = "active"
            subscription.current_period_start = now
            subscription.current_period_end = period_end

        license_result = await db.execute(
            select(License)
            .where(License.org_id == current_user.org_id)
            .order_by(License.created_at.desc())
            .limit(1)
        )
        license_ = license_result.scalar_one_or_none()
        if license_ is None:
            license_ = License(
                org_id=current_user.org_id,
                license_key=f"mock-{current_user.org_id.hex[:24]}",
                plan=body.plan,
                max_users=plan_config["max_users"],
                max_apps=plan_config["max_apps"],
                features=plan_config["features"],
                valid_from=now,
                status="active",
            )
            db.add(license_)
        else:
            license_.plan = body.plan
            license_.max_users = plan_config["max_users"]
            license_.max_apps = plan_config["max_apps"]
            license_.features = plan_config["features"]
            license_.status = "active"

        await db.flush()
        return CheckoutResponse(checkout_url=body.success_url)

    try:
        checkout_url = await StripeService.create_checkout_session(
            org_id=str(current_user.org_id),
            plan=body.plan,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return CheckoutResponse(checkout_url=checkout_url)


@router.get("", response_model=list[SubscriptionResponse])
@router.get("/", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SubscriptionResponse]:
    """List all subscriptions for the authenticated user's org."""
    result = await db.execute(
        select(Subscription).where(Subscription.org_id == current_user.org_id)
    )
    subscriptions = list(result.scalars().all())
    return [SubscriptionResponse.model_validate(sub) for sub in subscriptions]


@router.post("/portal", response_model=PortalResponse)
async def create_portal_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PortalResponse:
    """Return a Stripe billing portal URL for the authenticated user's org."""
    settings = get_settings()
    if not settings.stripe_secret_key:
        return PortalResponse(
            portal_url=f"{settings.public_web_url}/dashboard/billing?mock_portal=true"
        )

    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.org_id == current_user.org_id,
            Subscription.stripe_customer_id.is_not(None),
        )
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    subscription = result.scalar_one_or_none()

    if subscription is None or subscription.stripe_customer_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active Stripe subscription found for this organization",
        )

    try:
        portal_url = await StripeService.create_customer_portal_session(
            stripe_customer_id=subscription.stripe_customer_id,
            return_url=f"{settings.public_web_url}/dashboard/billing",
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return PortalResponse(portal_url=portal_url)


@router.delete("/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_subscription(
    subscription_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Cancel a subscription. Scoped to the authenticated user's org."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.org_id == current_user.org_id,
        )
    )
    subscription = result.scalar_one_or_none()

    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    if subscription.stripe_subscription_id:
        try:
            await StripeService.cancel_subscription(subscription.stripe_subscription_id)
        except (ValueError, RuntimeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

    subscription.status = "cancelled"
    await db.flush()
