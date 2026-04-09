"""Calendar sync OAuth and status endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request

from app.middleware.auth import get_current_user, CurrentUser
from app.services.calendar_sync_service import (
    get_sync_status,
    get_google_auth_url,
    get_microsoft_auth_url,
    disconnect_provider,
)

router = APIRouter(prefix="/calendar-sync", tags=["calendar-sync"])


@router.get("/status")
async def sync_status(user: CurrentUser = Depends(get_current_user)):
    """Get calendar sync status for current user."""
    return await get_sync_status(user.uid)


@router.get("/google/auth-url")
async def google_auth(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    """Get Google OAuth2 authorization URL."""
    redirect_uri = str(request.base_url) + "api/v1/calendar-sync/google/callback"
    url = get_google_auth_url(user.uid, redirect_uri)
    if not url:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in .env",
        )
    return {"auth_url": url}


@router.get("/microsoft/auth-url")
async def microsoft_auth(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    """Get Microsoft OAuth2 authorization URL."""
    redirect_uri = str(request.base_url) + "api/v1/calendar-sync/microsoft/callback"
    url = get_microsoft_auth_url(user.uid, redirect_uri)
    if not url:
        raise HTTPException(
            status_code=400,
            detail="Microsoft Calendar not configured. Set MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_CLIENT_SECRET in .env",
        )
    return {"auth_url": url}


@router.post("/disconnect/{provider}")
async def disconnect(
    provider: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Disconnect a calendar provider."""
    if provider not in ("google", "microsoft"):
        raise HTTPException(status_code=400, detail="Invalid provider")
    success = await disconnect_provider(user.uid, provider)
    return {"disconnected": success}
