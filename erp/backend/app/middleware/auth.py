"""
JWT Authentication middleware for the ERP API.

Authenticates against Mashora's res.users table via the ORM adapter.
Creates JWT tokens with user context (uid, company_id, allowed_company_ids).
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.core.orm_adapter import mashora_env

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


def authenticate_user(login: str, password: str) -> Optional[dict[str, Any]]:
    """
    Authenticate a user against Mashora's res.users table.
    Returns user data dict or None if authentication fails.
    """
    with mashora_env(uid=1, su=True) as env:
        User = env['res.users']
        users = User.search([('login', '=', login)], limit=1)
        if not users:
            return None

        user = users[0]
        # Mashora stores passwords via passlib (pbkdf2_sha512)
        try:
            env.cr.execute(
                "SELECT COALESCE(password, '') FROM res_users WHERE id=%s",
                (user.id,)
            )
            stored_hash = env.cr.fetchone()[0]
            if not stored_hash or not pwd_context.verify(password, stored_hash):
                return None
        except Exception:
            _logger.exception("Password verification failed for user %s", login)
            return None

        # Read user data
        user_data = user.read([
            'name', 'login', 'email', 'lang', 'tz',
            'company_id', 'company_ids',
        ])[0]

        return {
            "uid": user.id,
            "name": user_data.get("name", ""),
            "login": user_data.get("login", ""),
            "email": user_data.get("email", ""),
            "lang": user_data.get("lang", "en_US"),
            "tz": user_data.get("tz", "UTC"),
            "company_id": user_data.get("company_id", [False, ""])[0] if user_data.get("company_id") else None,
            "company_name": user_data.get("company_id", [False, ""])[1] if user_data.get("company_id") else None,
            "company_ids": user_data.get("company_ids", []),
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
        """Build Mashora-compatible context dict."""
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
    try:
        return await get_current_user(token)
    except HTTPException:
        return None
