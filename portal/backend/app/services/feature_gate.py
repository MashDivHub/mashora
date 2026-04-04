from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import License, Tenant, User
from app.services.plans import PLANS, get_plan_limits


class FeatureGate:
    @staticmethod
    async def check_user_limit(db: AsyncSession, org_id: UUID) -> bool:
        """Return True if the org can add more users based on their active plan."""
        license_ = await FeatureGate._get_active_license(db, org_id)
        if license_ is None:
            return False

        max_users, _ = get_plan_limits(license_.plan)
        if max_users == -1:
            return True

        current_users = await FeatureGate._count_org_users(db, org_id)
        return current_users < max_users

    @staticmethod
    async def check_app_limit(db: AsyncSession, org_id: UUID) -> bool:
        """Return True if the org can install more apps based on their active plan."""
        license_ = await FeatureGate._get_active_license(db, org_id)
        if license_ is None:
            return False

        _, max_apps = get_plan_limits(license_.plan)
        if max_apps == -1:
            return True

        current_apps = await FeatureGate._count_org_apps(db, org_id)
        return current_apps < max_apps

    @staticmethod
    async def get_org_limits(db: AsyncSession, org_id: UUID) -> dict:
        """Return current limits and usage for an org."""
        license_ = await FeatureGate._get_active_license(db, org_id)

        if license_ is None:
            return {
                "plan": None,
                "max_users": 0,
                "current_users": 0,
                "max_apps": 0,
                "current_apps": 0,
                "features": {},
            }

        max_users, max_apps = get_plan_limits(license_.plan)
        current_users = await FeatureGate._count_org_users(db, org_id)
        current_apps = await FeatureGate._count_org_apps(db, org_id)
        plan_data = PLANS.get(license_.plan, {})

        return {
            "plan": license_.plan,
            "max_users": max_users,
            "current_users": current_users,
            "max_apps": max_apps,
            "current_apps": current_apps,
            "features": plan_data.get("features", {}),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _get_active_license(db: AsyncSession, org_id: UUID) -> License | None:
        result = await db.execute(
            select(License)
            .where(License.org_id == org_id, License.status == "active")
            .order_by(License.valid_from.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def _count_org_users(db: AsyncSession, org_id: UUID) -> int:
        result = await db.execute(
            select(func.count()).select_from(User).where(User.org_id == org_id)
        )
        return result.scalar_one()

    @staticmethod
    async def _count_org_apps(db: AsyncSession, org_id: UUID) -> int:
        # Apps are proxied through tenants; each active tenant represents
        # one installed app environment for the org.
        result = await db.execute(
            select(func.count())
            .select_from(Tenant)
            .where(Tenant.org_id == org_id, Tenant.status == "active")
        )
        return result.scalar_one()
