"""
Health check endpoints.

Verifies the Mashora ORM connection and Registry are operational.
"""
from fastapi import APIRouter

from app.core.orm_adapter import orm_call, mashora_env

router = APIRouter(tags=["health"])


def _check_orm_health() -> dict:
    """Run a simple ORM query to verify the connection."""
    with mashora_env(uid=1, su=True) as env:
        # Count users as a basic sanity check
        user_count = env['res.users'].search_count([])
        model_count = len(env.registry)
        db_name = env.cr.dbname
        return {
            "status": "healthy",
            "database": db_name,
            "models_loaded": model_count,
            "user_count": user_count,
        }


@router.get("/health")
async def health_check():
    """Basic health check — no ORM dependency."""
    return {"status": "ok"}


@router.get("/health/orm")
async def orm_health_check():
    """
    Deep health check — verifies ORM connection, Registry, and database.

    This endpoint proves the core hypothesis of Phase 0.0:
    that Mashora's ORM can run inside FastAPI via asyncio.to_thread().
    """
    result = await orm_call(_check_orm_health)
    return result
