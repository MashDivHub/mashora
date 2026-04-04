import re
import secrets
from datetime import datetime, timezone
from uuid import UUID

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import License, Organization, User


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    slug = slug.strip("-")
    return slug


class AuthService:
    @staticmethod
    async def register(
        db: AsyncSession,
        email: str,
        password: str,
        org_name: str,
    ) -> tuple[User, Organization]:
        base_slug = _slugify(org_name)

        # Ensure slug uniqueness by appending a short random suffix when needed
        slug = base_slug
        result = await db.execute(select(Organization).where(Organization.slug == slug))
        if result.scalar_one_or_none() is not None:
            slug = f"{base_slug}-{secrets.token_hex(3)}"

        org = Organization(
            name=org_name,
            slug=slug,
            email=email,
            status="active",
        )
        db.add(org)
        await db.flush()  # populate org.id without committing

        password_hash = _hash_password(password)
        user = User(
            org_id=org.id,
            email=email,
            password_hash=password_hash,
            role="owner",
        )
        db.add(user)

        license_ = License(
            org_id=org.id,
            license_key=secrets.token_hex(32),
            plan="free",
            max_users=5,
            max_apps=1,
            valid_from=datetime.now(timezone.utc),
            status="active",
        )
        db.add(license_)

        await db.flush()
        return user, org

    @staticmethod
    async def authenticate(
        db: AsyncSession,
        email: str,
        password: str,
    ) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            return None
        if not _verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
