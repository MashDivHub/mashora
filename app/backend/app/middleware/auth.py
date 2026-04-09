"""
JWT Authentication middleware for the ERP API.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

_logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)
pwd_context = CryptContext(schemes=["pbkdf2_sha512", "bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def authenticate_user(login: str, password: str) -> Optional[dict[str, Any]]:
    """Authenticate a user against res_users table via SQLAlchemy."""
    from sqlalchemy import select, text
    from app.db.session import _get_session_factory
    from app.core.model_registry import get_model_class

    UserCls = get_model_class("res.users")
    if UserCls is None:
        return None

    factory = _get_session_factory()
    async with factory() as session:
        query = select(UserCls).where(UserCls.login == login).limit(1)
        result = await session.execute(query)
        user = result.scalar_one_or_none()
        if not user:
            return None

        pw_result = await session.execute(
            text("SELECT COALESCE(password, '') FROM res_users WHERE id = :uid"),
            {"uid": user.id},
        )
        stored_hash = pw_result.scalar() or ""
        if not stored_hash or not pwd_context.verify(password, stored_hash):
            return None

        # Resolve name/email from linked partner
        user_name = ""
        user_email = ""
        partner_id = getattr(user, "partner_id", None)
        if partner_id:
            PartnerCls = get_model_class("res.partner")
            if PartnerCls:
                partner = await session.get(PartnerCls, partner_id)
                if partner:
                    pname = getattr(partner, "name", "")
                    user_name = pname.get("en_US", str(pname)) if isinstance(pname, dict) else str(pname or "")
                    user_email = getattr(partner, "email", "") or ""

        company_name = ""
        if user.company_id:
            CompanyCls = get_model_class("res.company")
            if CompanyCls:
                company = await session.get(CompanyCls, user.company_id)
                if company:
                    cname = getattr(company, "name", "")
                    company_name = cname.get("en_US", "") if isinstance(cname, dict) else str(cname)

        return {
            "uid": user.id,
            "name": user_name,
            "login": getattr(user, "login", ""),
            "email": user_email,
            "lang": getattr(user, "lang", "en_US") or "en_US",
            "tz": getattr(user, "tz", "UTC") or "UTC",
            "company_id": user.company_id,
            "company_name": company_name,
            "company_ids": [user.company_id] if user.company_id else [],
        }


class CurrentUser:
    """Resolved user context from JWT token."""
    def __init__(self, uid: int, company_id: Optional[int], company_ids: list[int], lang: str, tz: str):
        self.uid = uid
        self.company_id = company_id
        self.company_ids = company_ids
        self.lang = lang
        self.tz = tz

    def get_context(self) -> dict:
        ctx: dict[str, Any] = {"lang": self.lang, "tz": self.tz}
        if self.company_ids:
            ctx["allowed_company_ids"] = self.company_ids
        return ctx


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> CurrentUser:
    """FastAPI dependency: extract current user from JWT."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    return CurrentUser(
        uid=payload.get("sub", 1),
        company_id=payload.get("company_id"),
        company_ids=payload.get("company_ids", []),
        lang=payload.get("lang", "en_US"),
        tz=payload.get("tz", "UTC"),
    )


async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme)) -> CurrentUser | None:
    """Optional auth — returns None if no token provided."""
    if not token:
        return None
    return await get_current_user(token)
