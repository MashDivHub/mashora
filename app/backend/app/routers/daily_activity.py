"""Daily operations dashboard endpoint."""
from fastapi import APIRouter, Depends, Query

from app.middleware.auth import get_optional_user, CurrentUser
from app.services.daily_activity_service import get_daily_activity

router = APIRouter(prefix="/daily-activity", tags=["daily-activity"])


@router.get("")
async def get_daily_activity_endpoint(
    day: str | None = Query(default=None, description="YYYY-MM-DD, defaults to today"),
    days: int = Query(default=1, ge=1, le=365, description="Number of days ending on `day`"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    return await get_daily_activity(day=day, days=days)
