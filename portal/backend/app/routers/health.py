from fastapi import APIRouter
from sqlalchemy import text

from app.database import async_session
from app.schemas.common import HealthCheck

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthCheck)
async def health_check() -> HealthCheck:
    db_status = "ok"
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"error: {exc}"

    return HealthCheck(
        status="ok" if db_status == "ok" else "degraded",
        database=db_status,
        redis="ok",
        version="1.0.0",
    )
