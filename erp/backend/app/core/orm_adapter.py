"""
Mashora ORM Adapter for FastAPI.

Wraps the Mashora ORM (Environment, Registry, Cursor) to be safely callable
from FastAPI's async context via asyncio.to_thread().

Architecture:
    FastAPI async handler
      → asyncio.to_thread(orm_call)
        → MashoraEnv context manager
          → acquires cursor from connection pool
          → creates Environment(cr, uid, context)
          → executes ORM operations
          → commits or rolls back
          → releases cursor back to pool

Key design decisions:
    - Each request gets its own cursor and transaction (no sharing)
    - The Mashora Registry is loaded once at startup and cached per-database
    - ORM calls run in a ThreadPoolExecutor to avoid blocking the async event loop
    - Cursor lifecycle is strictly managed via context manager
"""
import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from functools import lru_cache
from typing import Any, Generator

_logger = logging.getLogger(__name__)

# Thread pool for ORM operations — sized to match connection pool
_orm_executor: ThreadPoolExecutor | None = None
_initialized = False
_init_lock = threading.Lock()


def _get_executor() -> ThreadPoolExecutor:
    global _orm_executor
    if _orm_executor is None:
        from app.config import get_settings
        settings = get_settings()
        _orm_executor = ThreadPoolExecutor(
            max_workers=settings.orm_thread_pool_size,
            thread_name_prefix="mashora-orm",
        )
    return _orm_executor


def init_mashora(
    db_name: Optional[str] = None,
    db_host: Optional[str] = None,
    db_port: Optional[int] = None,
    db_user: Optional[str] = None,
    db_password: Optional[str] = None,
    db_maxconn: Optional[int] = None,
    addons_path: Optional[str] = None,
) -> None:
    """
    Initialize the Mashora framework.

    Must be called once at FastAPI startup (in the lifespan handler).
    Sets up Mashora's config, connection pool, and pre-loads the Registry.
    """
    global _initialized
    if _initialized:
        return

    with _init_lock:
        if _initialized:
            return

        from app.config import get_settings
        settings = get_settings()

        # Ensure Mashora is importable
        settings.setup_mashora_path()

        # Configure Mashora's internal config before any other import
        from mashora.tools import config as mashora_config

        # Set database parameters in Mashora's config
        _db_name = db_name or settings.mashora_db_name
        _addons_path = addons_path or settings.get_addons_path()

        mashora_config['db_host'] = db_host or settings.mashora_db_host
        mashora_config['db_port'] = db_port or settings.mashora_db_port
        mashora_config['db_user'] = db_user or settings.mashora_db_user
        mashora_config['db_password'] = db_password or settings.mashora_db_password
        mashora_config['db_name'] = _db_name
        mashora_config['db_maxconn'] = db_maxconn or settings.mashora_db_maxconn
        mashora_config['addons_path'] = _addons_path
        mashora_config['db_app_name'] = 'mashora-erp-api'

        _logger.info(
            "Initializing Mashora ORM: db=%s, host=%s, port=%s, addons=%s",
            _db_name,
            mashora_config['db_host'],
            mashora_config['db_port'],
            _addons_path,
        )

        # Pre-load the Registry (this triggers module loading)
        from mashora.orm.registry import Registry
        _logger.info("Loading Mashora Registry for database '%s'...", _db_name)
        registry = Registry(_db_name)
        _logger.info(
            "Registry loaded: %d models available",
            len(registry),
        )

        _initialized = True


def get_db_connection():
    """Get a Mashora database connection from the pool."""
    from app.config import get_settings
    from mashora import sql_db

    settings = get_settings()
    return sql_db.db_connect(settings.mashora_db_name)


@contextmanager
def mashora_env(
    uid: int = 1,
    context: Optional[dict] = None,
    su: bool = False,
) -> Generator:
    """
    Context manager that provides a Mashora Environment.

    Creates a fresh cursor, builds an Environment, and handles
    commit/rollback and cursor cleanup.

    Usage:
        with mashora_env(uid=2, context={'lang': 'en_US'}) as env:
            partners = env['res.partner'].search([])
            data = partners.read(['name', 'email'])

    Args:
        uid: User ID to run as (default: 1 = admin / SUPERUSER)
        context: Optional context dict (lang, tz, allowed_company_ids, etc.)
        su: Whether to run in superuser mode

    Yields:
        mashora.orm.environments.Environment
    """
    from mashora.orm.environments import Environment
    from mashora.orm.utils import SUPERUSER_ID

    ctx = context or {}
    connection = get_db_connection()
    cr = connection.cursor()

    try:
        env = Environment(cr, uid, ctx, su=su)
        yield env
        # If we reach here without exception, commit
        cr.commit()
    except Exception:
        cr.rollback()
        raise
    finally:
        cr.close()


async def orm_call(func, *args, **kwargs) -> Any:
    """
    Run a synchronous ORM function in the thread pool.

    Wraps any callable in asyncio.to_thread() using the dedicated
    ORM thread pool executor.

    Usage:
        result = await orm_call(my_orm_function, arg1, arg2)
    """
    loop = asyncio.get_event_loop()
    executor = _get_executor()
    return await loop.run_in_executor(executor, lambda: func(*args, **kwargs))


# --- High-level ORM operations ---
# These are the building blocks for REST API endpoints.
# Each function opens its own cursor/environment and handles the full lifecycle.


def search_read(
    model: str,
    domain: list | None = None,
    fields: Optional[list[str]] = None,
    offset: int = 0,
    limit: Optional[int] = None,
    order: Optional[str] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """
    Search records and read their field values.

    Returns:
        {
            "records": [{"id": 1, "name": "Foo", ...}, ...],
            "total": 42
        }
    """
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]

        d = domain or []
        total = Model.search_count(d)

        kwargs: dict[str, Any] = {"offset": offset}
        if limit is not None:
            kwargs["limit"] = limit
        if order:
            kwargs["order"] = order

        records = Model.search(d, **kwargs)

        if fields:
            data = records.read(fields)
        else:
            data = records.read()

        return {"records": data, "total": total}


def read_record(
    model: str,
    record_id: int,
    fields: Optional[list[str]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict[str, Any]]:
    """Read a single record by ID."""
    with mashora_env(uid=uid, context=context) as env:
        record = env[model].browse(record_id)
        if not record.exists():
            return None
        data = record.read(fields or [])[0]
        return data


def create_record(
    model: str,
    vals: dict[str, Any],
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """Create a new record and return its data."""
    with mashora_env(uid=uid, context=context) as env:
        record = env[model].create(vals)
        return record.read()[0]


def write_record(
    model: str,
    record_id: int,
    vals: dict[str, Any],
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """Update a record and return its updated data."""
    with mashora_env(uid=uid, context=context) as env:
        record = env[model].browse(record_id)
        if not record.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Record {model}({record_id}) does not exist.")
        record.write(vals)
        return record.read()[0]


def delete_record(
    model: str,
    record_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> bool:
    """Delete a record. Returns True if successful."""
    with mashora_env(uid=uid, context=context) as env:
        record = env[model].browse(record_id)
        if not record.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Record {model}({record_id}) does not exist.")
        record.unlink()
        return True


def call_method(
    model: str,
    record_ids: list[int],
    method: str,
    args: list | None = None,
    kwargs: Optional[dict] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Any:
    """
    Call an arbitrary method on a recordset.

    This is the escape hatch for business logic methods like
    action_confirm(), action_post(), etc.
    """
    with mashora_env(uid=uid, context=context) as env:
        records = env[model].browse(record_ids)
        method_func = getattr(records, method)
        result = method_func(*(args or []), **(kwargs or {}))

        # Try to serialize the result
        if hasattr(result, 'read'):
            # Result is a recordset — return its data
            return result.read()
        if isinstance(result, dict):
            return result
        if result is None or isinstance(result, (bool, int, float, str, list)):
            return result
        # Last resort: stringify
        return str(result)


def get_fields_metadata(
    model: str,
    attributes: Optional[list[str]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """
    Get field definitions for a model.

    Returns a dict of field_name → field_metadata.
    """
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        return Model.fields_get(attributes=attributes)


def shutdown() -> None:
    """Shutdown the ORM adapter. Call on FastAPI shutdown."""
    global _orm_executor, _initialized
    if _orm_executor:
        _orm_executor.shutdown(wait=True)
        _orm_executor = None
    _initialized = False
    _logger.info("Mashora ORM adapter shut down.")
