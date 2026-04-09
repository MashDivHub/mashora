"""
Calendar sync service — Google & Microsoft calendar integration.

Phase 1: OAuth flow + basic event import
Phase 2: Bidirectional sync with conflict resolution
"""
import logging
from datetime import datetime
from typing import Optional

from app.config import get_settings
from app.services.base import async_search_read, async_create, async_update, async_get, get_session

_logger = logging.getLogger(__name__)


async def get_provider_config(user_id: int, provider: str) -> Optional[dict]:
    """Get the calendar provider config for a user."""
    result = await async_search_read(
        "calendar.provider.config",
        domain=[["user_id", "=", user_id], ["provider", "=", provider]],
        limit=1,
    )
    records = result.get("records", [])
    return records[0] if records else None


async def save_oauth_tokens(
    user_id: int,
    provider: str,
    access_token: str,
    refresh_token: str,
    token_expiry: Optional[datetime] = None,
) -> dict:
    """Store OAuth tokens after successful authorization."""
    config = await get_provider_config(user_id, provider)
    vals = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expiry": token_expiry.isoformat() if token_expiry else None,
        "active": True,
    }
    if config:
        return await async_update("calendar.provider.config", config["id"], vals, uid=user_id)
    else:
        vals.update({"user_id": user_id, "provider": provider})
        return await async_create("calendar.provider.config", vals, uid=user_id)


async def get_sync_status(user_id: int) -> dict:
    """Get sync status for all providers for a user."""
    result = await async_search_read(
        "calendar.provider.config",
        domain=[["user_id", "=", user_id]],
        limit=10,
    )

    providers = {}
    for config in result.get("records", []):
        providers[config["provider"]] = {
            "active": config.get("active", False),
            "last_sync": config.get("last_sync"),
            "sync_direction": config.get("sync_direction", "import"),
        }

    settings = get_settings()
    return {
        "google": {
            "configured": bool(settings.google_calendar_client_id),
            "connected": providers.get("google", {}).get("active", False),
            "last_sync": providers.get("google", {}).get("last_sync"),
        },
        "microsoft": {
            "configured": bool(settings.microsoft_calendar_client_id),
            "connected": providers.get("microsoft", {}).get("active", False),
            "last_sync": providers.get("microsoft", {}).get("last_sync"),
        },
    }


async def disconnect_provider(user_id: int, provider: str) -> bool:
    """Disconnect a calendar provider."""
    config = await get_provider_config(user_id, provider)
    if config:
        await async_update(
            "calendar.provider.config",
            config["id"],
            {"active": False, "access_token": None, "refresh_token": None},
            uid=user_id,
        )
        return True
    return False


def get_google_auth_url(user_id: int, redirect_uri: str) -> Optional[str]:
    """Generate Google OAuth2 authorization URL."""
    settings = get_settings()
    if not settings.google_calendar_client_id:
        return None

    params = {
        "client_id": settings.google_calendar_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar",
        "access_type": "offline",
        "prompt": "consent",
        "state": str(user_id),
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def get_microsoft_auth_url(user_id: int, redirect_uri: str) -> Optional[str]:
    """Generate Microsoft OAuth2 authorization URL."""
    settings = get_settings()
    if not settings.microsoft_calendar_client_id:
        return None

    tenant = settings.microsoft_calendar_tenant_id
    params = {
        "client_id": settings.microsoft_calendar_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "Calendars.ReadWrite offline_access",
        "state": str(user_id),
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{query}"
