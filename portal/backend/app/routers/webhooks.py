from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.database import async_session
from app.models import License, Subscription
from app.services.plans import get_plan, get_plan_limits
from app.services.stripe_service import StripeService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request) -> dict:
    """Handle incoming Stripe webhook events.

    Signature verification is performed by StripeService.handle_webhook.
    No authentication token required — Stripe signs the payload instead.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = await StripeService.handle_webhook(payload, sig_header)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    event_type: str = event.get("type", "")
    event_data: dict = event.get("data", {}).get("object", {})

    async with async_session() as db:
        try:
            if event_type == "checkout.session.completed":
                await _handle_checkout_completed(db, event_data)
            elif event_type == "invoice.paid":
                await _handle_invoice_paid(db, event_data)
            elif event_type == "invoice.payment_failed":
                await _handle_invoice_payment_failed(db, event_data)
            elif event_type == "customer.subscription.deleted":
                await _handle_subscription_deleted(db, event_data)

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    return {"received": True}


# ---------------------------------------------------------------------------
# Private event handlers
# ---------------------------------------------------------------------------

async def _handle_checkout_completed(db, session_obj: dict) -> None:
    """Create a Subscription record and update the matching License plan."""
    metadata: dict = session_obj.get("metadata", {})
    org_id: str | None = metadata.get("org_id")
    plan_name: str | None = metadata.get("plan")

    if not org_id or not plan_name:
        return

    plan_config = get_plan(plan_name)
    if plan_config is None:
        return

    stripe_subscription_id: str | None = session_obj.get("subscription")
    stripe_customer_id: str | None = session_obj.get("customer")

    # Avoid duplicate subscriptions for the same Stripe subscription ID
    if stripe_subscription_id:
        existing = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_subscription_id
            )
        )
        if existing.scalar_one_or_none() is not None:
            return

    import uuid as _uuid
    subscription = Subscription(
        org_id=_uuid.UUID(org_id),
        stripe_customer_id=stripe_customer_id,
        stripe_subscription_id=stripe_subscription_id,
        plan=plan_name,
        amount_cents=plan_config["price_cents"],
        currency="usd",
        interval="month",
        status="active",
    )
    db.add(subscription)
    await db.flush()

    # Update the most recent active license for this org to the new plan
    max_users, max_apps = get_plan_limits(plan_name)
    license_result = await db.execute(
        select(License)
        .where(License.org_id == _uuid.UUID(org_id), License.status == "active")
        .order_by(License.created_at.desc())
        .limit(1)
    )
    license_ = license_result.scalar_one_or_none()
    if license_ is not None:
        license_.plan = plan_name
        license_.max_users = max_users if max_users != -1 else 999999
        license_.max_apps = max_apps if max_apps != -1 else 999999
        license_.features = plan_config["features"]


async def _handle_invoice_paid(db, invoice_obj: dict) -> None:
    """Mark subscription active and refresh period dates on successful payment."""
    stripe_subscription_id: str | None = invoice_obj.get("subscription")
    if not stripe_subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        return

    subscription.status = "active"

    period_start = invoice_obj.get("period_start")
    period_end = invoice_obj.get("period_end")
    if period_start:
        subscription.current_period_start = datetime.fromtimestamp(
            period_start, tz=timezone.utc
        )
    if period_end:
        subscription.current_period_end = datetime.fromtimestamp(
            period_end, tz=timezone.utc
        )

    await db.flush()


async def _handle_invoice_payment_failed(db, invoice_obj: dict) -> None:
    """Mark subscription as past_due when a payment fails."""
    stripe_subscription_id: str | None = invoice_obj.get("subscription")
    if not stripe_subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        return

    subscription.status = "past_due"
    await db.flush()

    # Update matching license to reflect grace period
    if subscription.org_id:
        license_result = await db.execute(
            select(License)
            .where(
                License.org_id == subscription.org_id,
                License.status == "active",
            )
            .order_by(License.created_at.desc())
            .limit(1)
        )
        license_ = license_result.scalar_one_or_none()
        if license_ is not None:
            existing_features = dict(license_.features or {})
            existing_features["grace_period"] = True
            license_.features = existing_features


async def _handle_subscription_deleted(db, subscription_obj: dict) -> None:
    """Cancel subscription record and downgrade org license to free."""
    stripe_subscription_id: str | None = subscription_obj.get("id")
    if not stripe_subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        return

    subscription.status = "cancelled"
    await db.flush()

    # Downgrade the matching license to the free plan
    import uuid as _uuid
    free_plan = get_plan("free")
    if free_plan is None or subscription.org_id is None:
        return

    max_users, max_apps = get_plan_limits("free")
    license_result = await db.execute(
        select(License)
        .where(
            License.org_id == subscription.org_id,
            License.status == "active",
        )
        .order_by(License.created_at.desc())
        .limit(1)
    )
    license_ = license_result.scalar_one_or_none()
    if license_ is not None:
        license_.plan = "free"
        license_.max_users = max_users
        license_.max_apps = max_apps
        license_.features = free_plan["features"]
    await db.flush()
