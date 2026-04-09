"""
Health check endpoints.
"""
from fastapi import APIRouter

from app.services.base import async_count

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Basic health check — no ORM dependency."""
    return {"status": "ok"}


@router.get("/health/orm")
async def orm_health_check():
    """Deep health check — verifies SQLAlchemy connection and database."""
    user_count = await async_count("res.users")
    return {
        "status": "healthy",
        "user_count": user_count,
    }
