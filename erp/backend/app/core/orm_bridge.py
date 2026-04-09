"""
ORM Bridge — Feature-flagged switch between old Mashora ORM and new SQLAlchemy adapter.

Set USE_NEW_ORM=true in .env to use the SQLAlchemy adapter.
Set USE_NEW_ORM=false (default) to use the legacy Mashora ORM adapter.

This bridge provides the same API as orm_adapter.py so all routers
and services can import from here and be unaware of which backend is active.
"""
import logging
import os
from typing import Any, Optional

_logger = logging.getLogger(__name__)

USE_NEW_ORM = os.environ.get("USE_NEW_ORM", "false").lower() in ("true", "1", "yes")


if USE_NEW_ORM:
    _logger.info("ORM Bridge: Using NEW SQLAlchemy adapter")
    from app.core.orm_adapter_v2 import (
        search_read,
        read_record,
        create_record,
        write_record,
        delete_record,
        read_group,
        default_get,
        name_search,
        get_fields_metadata,
        call_method,
        RecordNotFoundError as MissingError,
    )

    async def orm_call(func, *args, **kwargs) -> Any:
        """In v2, functions are already async — just await them."""
        return await func(*args, **kwargs)

    async def init_orm() -> None:
        """Initialize the SQLAlchemy engine and model registry."""
        from app.db.engine import get_engine
        from app.core.model_registry import rebuild_registry
        import app.models  # noqa: F401 — register all models
        get_engine()
        rebuild_registry()
        _logger.info("SQLAlchemy ORM initialized")

    async def shutdown_orm() -> None:
        """Shutdown the SQLAlchemy engine."""
        from app.db.engine import dispose_engine
        await dispose_engine()

else:
    _logger.info("ORM Bridge: Using LEGACY Mashora ORM adapter")
    from app.core.orm_adapter import (
        search_read,
        read_record,
        create_record,
        write_record,
        delete_record,
        read_group,
        default_get,
        name_search,
        get_fields_metadata,
        call_method,
        orm_call,
        init_mashora,
        shutdown as _shutdown_mashora,
    )

    class MissingError(Exception):
        pass

    async def init_orm() -> None:
        init_mashora()

    async def shutdown_orm() -> None:
        _shutdown_mashora()
