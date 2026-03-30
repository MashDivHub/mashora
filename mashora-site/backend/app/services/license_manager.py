import secrets
from datetime import datetime, timezone, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import License


class LicenseManager:
    @staticmethod
    async def create_license(
        db: AsyncSession,
        org_id: UUID,
        plan: str,
        max_users: int = 5,
        max_apps: int = 10,
    ) -> License:
        now = datetime.now(timezone.utc)
        valid_until = now + timedelta(days=365) if plan != "free" else None

        license_ = License(
            org_id=org_id,
            license_key=secrets.token_hex(32),
            plan=plan,
            max_users=max_users,
            max_apps=max_apps,
            valid_from=now,
            valid_until=valid_until,
            status="active",
        )
        db.add(license_)
        await db.flush()
        return license_

    @staticmethod
    async def validate_license(db: AsyncSession, license_key: str) -> dict:
        result = await db.execute(
            select(License).where(License.license_key == license_key)
        )
        license_ = result.scalar_one_or_none()

        if license_ is None:
            return {"valid": False, "plan": None, "features": None, "message": "License not found"}

        if license_.status != "active":
            return {
                "valid": False,
                "plan": license_.plan,
                "features": license_.features,
                "message": f"License is {license_.status}",
            }

        now = datetime.now(timezone.utc)
        if license_.valid_until is not None and license_.valid_until < now:
            return {
                "valid": False,
                "plan": license_.plan,
                "features": license_.features,
                "message": "License has expired",
            }

        return {
            "valid": True,
            "plan": license_.plan,
            "features": license_.features,
            "message": "License is valid",
        }

    @staticmethod
    async def get_org_licenses(db: AsyncSession, org_id: UUID) -> list[License]:
        result = await db.execute(
            select(License).where(License.org_id == org_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def revoke_license(db: AsyncSession, license_id: UUID) -> License:
        result = await db.execute(
            select(License).where(License.id == license_id)
        )
        license_ = result.scalar_one_or_none()
        if license_ is None:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")

        license_.status = "revoked"
        await db.flush()
        return license_
