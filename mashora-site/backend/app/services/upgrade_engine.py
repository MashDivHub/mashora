from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.upgrade import Upgrade

LATEST_VERSION = "19.1"


class UpgradeEngine:

    @staticmethod
    async def create_upgrade(db: AsyncSession, tenant_id: UUID, to_version: str) -> Upgrade:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant is None:
            raise ValueError(f"Tenant {tenant_id} not found")

        upgrade = Upgrade(
            tenant_id=tenant_id,
            from_version=tenant.mashora_version,
            to_version=to_version,
            status="pending",
        )
        db.add(upgrade)
        await db.flush()
        return upgrade

    @staticmethod
    async def start_upgrade(db: AsyncSession, upgrade_id: UUID) -> Upgrade:
        result = await db.execute(select(Upgrade).where(Upgrade.id == upgrade_id))
        upgrade = result.scalar_one_or_none()
        if upgrade is None:
            raise ValueError(f"Upgrade {upgrade_id} not found")

        upgrade.status = "in_progress"
        upgrade.started_at = datetime.now(timezone.utc)
        upgrade.log = (
            f"[{datetime.now(timezone.utc).isoformat()}] Starting upgrade from "
            f"{upgrade.from_version} to {upgrade.to_version}\n"
            f"[{datetime.now(timezone.utc).isoformat()}] Step 1: Creating database backup\n"
            f"[{datetime.now(timezone.utc).isoformat()}] Step 2: Applying schema migrations\n"
            f"[{datetime.now(timezone.utc).isoformat()}] Step 3: Running post-upgrade scripts\n"
        )
        await db.flush()
        return upgrade

    @staticmethod
    async def complete_upgrade(
        db: AsyncSession, upgrade_id: UUID, success: bool, log: str
    ) -> Upgrade:
        result = await db.execute(select(Upgrade).where(Upgrade.id == upgrade_id))
        upgrade = result.scalar_one_or_none()
        if upgrade is None:
            raise ValueError(f"Upgrade {upgrade_id} not found")

        upgrade.completed_at = datetime.now(timezone.utc)
        upgrade.status = "completed" if success else "failed"
        existing_log = upgrade.log or ""
        upgrade.log = existing_log + log

        if success:
            result2 = await db.execute(select(Tenant).where(Tenant.id == upgrade.tenant_id))
            tenant = result2.scalar_one_or_none()
            if tenant is not None:
                tenant.mashora_version = upgrade.to_version

        await db.flush()
        return upgrade

    @staticmethod
    async def get_available_upgrade(db: AsyncSession, tenant_id: UUID) -> dict:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant is None:
            raise ValueError(f"Tenant {tenant_id} not found")

        current = tenant.mashora_version
        available = current != LATEST_VERSION if current else True
        return {
            "current_version": current,
            "latest_version": LATEST_VERSION,
            "available": available,
        }

    @staticmethod
    async def list_upgrades(db: AsyncSession, tenant_id: UUID) -> list:
        result = await db.execute(
            select(Upgrade)
            .where(Upgrade.tenant_id == tenant_id)
            .order_by(Upgrade.created_at.desc())
        )
        return list(result.scalars().all())
