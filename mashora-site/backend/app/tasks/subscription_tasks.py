import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.tasks import celery_app

logger = logging.getLogger(__name__)


def _get_sync_session():
    """Return a synchronous SQLAlchemy session for use inside Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import get_settings

    settings = get_settings()
    # Convert async URL to sync URL for use in Celery worker context.
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    engine = create_engine(sync_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()


@celery_app.task
def check_overdue_subscriptions() -> None:
    """Check for subscriptions past_due > 15 days and suspend their tenants."""
    from app.models import License, Organization, Subscription, Tenant

    session = _get_sync_session()
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=15)

        # Find subscriptions that are past_due and whose period ended > 15 days ago.
        overdue = (
            session.execute(
                select(Subscription)
                .where(
                    Subscription.status == "past_due",
                    Subscription.current_period_end <= cutoff,
                )
                .options(selectinload(Subscription.organization))
            )
            .scalars()
            .all()
        )

        for sub in overdue:
            org = sub.organization
            if org is None:
                continue

            logger.info(
                "Suspending org %s (sub %s) — past_due since %s",
                org.id,
                sub.id,
                sub.current_period_end,
            )

            # Suspend all tenants for this org.
            session.execute(
                update(Tenant)
                .where(Tenant.org_id == org.id)
                .values(status="suspended")
            )

            # Mark subscription as cancelled.
            sub.status = "cancelled"

            # Downgrade the active license to free.
            active_license = (
                session.execute(
                    select(License)
                    .where(
                        License.org_id == org.id,
                        License.status == "active",
                    )
                    .order_by(License.valid_from.desc())
                    .limit(1)
                )
                .scalar_one_or_none()
            )
            if active_license is not None:
                active_license.plan = "free"
                active_license.max_users = 5
                active_license.max_apps = 1

            # Send suspension email via notification task.
            from app.tasks.notifications import send_suspended_email
            send_suspended_email.delay(org.email, org.name)

        session.commit()
        logger.info("check_overdue_subscriptions: processed %d overdue subscriptions", len(overdue))
    except Exception:
        session.rollback()
        logger.exception("check_overdue_subscriptions failed")
        raise
    finally:
        session.close()


@celery_app.task
def send_payment_reminders() -> None:
    """Send payment failed reminders at day 1, 7, and 14."""
    from app.models import Organization, Subscription

    session = _get_sync_session()
    try:
        now = datetime.now(timezone.utc)

        past_due_subs = (
            session.execute(
                select(Subscription)
                .where(Subscription.status == "past_due")
                .options(selectinload(Subscription.organization))
            )
            .scalars()
            .all()
        )

        for sub in past_due_subs:
            org = sub.organization
            if org is None or sub.current_period_end is None:
                continue

            days_overdue = (now - sub.current_period_end).days

            # Send reminders at day 1, 7, and 14 only (exact day windows).
            if days_overdue not in (1, 7, 14):
                continue

            days_remaining = max(0, 15 - days_overdue)
            retry_date = (sub.current_period_end + timedelta(days=15)).strftime("%B %d, %Y")

            logger.info(
                "Sending payment reminder to org %s — day %d overdue",
                org.id,
                days_overdue,
            )

            from app.tasks.notifications import send_payment_failed_email, send_suspension_warning_email

            send_payment_failed_email.delay(org.email, org.name, retry_date)

            if days_remaining > 0:
                send_suspension_warning_email.delay(org.email, org.name, days_remaining)

        logger.info("send_payment_reminders: checked %d past_due subscriptions", len(past_due_subs))
    except Exception:
        logger.exception("send_payment_reminders failed")
        raise
    finally:
        session.close()
