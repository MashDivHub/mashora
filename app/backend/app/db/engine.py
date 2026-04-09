"""
Async SQLAlchemy engine and connection pool.

Replaces Mashora's sql_db connection pool with SQLAlchemy's built-in
async pool backed by asyncpg.
"""
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    create_async_engine,
)

_logger = logging.getLogger(__name__)
_engine: Optional[AsyncEngine] = None


def get_engine() -> AsyncEngine:
    """Get or create the async SQLAlchemy engine (singleton)."""
    global _engine
    if _engine is None:
        from app.config import get_settings
        settings = get_settings()

        url = (
            f"postgresql+asyncpg://{settings.mashora_db_user}"
            f":{settings.mashora_db_password}"
            f"@{settings.mashora_db_host}"
            f":{settings.mashora_db_port}"
            f"/{settings.mashora_db_name}"
        )

        _engine = create_async_engine(
            url,
            pool_size=settings.mashora_db_maxconn,
            max_overflow=4,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=settings.debug,
        )
        _logger.info(
            "SQLAlchemy async engine created: db=%s, pool_size=%d",
            settings.mashora_db_name,
            settings.mashora_db_maxconn,
        )

    return _engine


async def dispose_engine() -> None:
    """Dispose the engine and close all connections. Call on shutdown."""
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _logger.info("SQLAlchemy engine disposed.")
