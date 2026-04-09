"""
Mashora ORM Adapter v2 — SQLAlchemy 2.0 async implementation.

Drop-in replacement for orm_adapter.py. Same API surface, but uses
SQLAlchemy async sessions instead of the old Mashora ORM.

Architecture:
    FastAPI async handler
      → async SQLAlchemy session (from connection pool)
        → SQLAlchemy query builder
          → asyncpg driver
            → PostgreSQL

No more ThreadPoolExecutor, no more asyncio.to_thread() — fully async.
"""
import logging
from typing import Any, Optional

from sqlalchemy import delete as sa_delete, func, select, text, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_parser import parse_domain
from app.core.model_registry import get_fields_info, get_model_class
from app.db.session import _get_session_factory

from app.services.base import RecordNotFoundError  # noqa: F401 — re-export for backward compat

_logger = logging.getLogger(__name__)


async def _get_session() -> AsyncSession:
    """Get a new async session for standalone operations."""
    factory = _get_session_factory()
    return factory()


def _record_to_dict(record, fields: Optional[list[str]] = None) -> dict[str, Any]:
    """Convert a SQLAlchemy model instance to a dict."""
    from sqlalchemy import inspect as sa_inspect
    mapper = sa_inspect(type(record))

    result: dict[str, Any] = {"id": record.id}

    for col_attr in mapper.column_attrs:
        col_name = col_attr.key
        if fields and col_name not in fields and col_name != "id":
            continue
        val = getattr(record, col_name, None)

        # Handle JSONB fields — extract display value
        if isinstance(val, dict):
            # Mashora stores translated text as {"en_US": "value", "fr_FR": "valeur"}
            # Return the first available value or the dict itself
            if "en_US" in val:
                val = val["en_US"]
            elif val:
                val = next(iter(val.values()))
            else:
                val = ""

        result[col_name] = val

    # Handle Many2one FK fields — return [id, display_name] tuples
    for col_name in list(result.keys()):
        if col_name.endswith("_id") and isinstance(result[col_name], int):
            # Keep as-is for now; frontend expects [id, name] for m2o
            # but many services just use the raw id
            pass

    return result


async def search_read(
    model: str,
    domain: list | None = None,
    fields: Optional[list[str]] = None,
    offset: int = 0,
    limit: Optional[int] = None,
    order: Optional[str] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """Search records and read their field values."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return {"records": [], "total": 0}

    async with await _get_session() as session:
        # Build base query
        where_clause = parse_domain(model_cls, domain or [])

        # Count total
        count_q = select(func.count(model_cls.id)).where(where_clause)
        total_result = await session.execute(count_q)
        total = total_result.scalar() or 0

        # Build select query
        query = select(model_cls).where(where_clause)

        # Apply ordering
        if order:
            for part in order.split(","):
                part = part.strip()
                if not part:
                    continue
                tokens = part.split()
                col_name = tokens[0]
                col = getattr(model_cls, col_name, None)
                if col is not None:
                    if len(tokens) > 1 and tokens[1].upper() == "DESC":
                        query = query.order_by(col.desc())
                    else:
                        query = query.order_by(col.asc())
        else:
            query = query.order_by(model_cls.id.desc())

        # Apply offset/limit
        query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)

        result = await session.execute(query)
        records = result.scalars().all()

        data = [_record_to_dict(r, fields) for r in records]
        return {"records": data, "total": total}


async def read_record(
    model: str,
    record_id: int,
    fields: Optional[list[str]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict[str, Any]]:
    """Read a single record by ID."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return None

    async with await _get_session() as session:
        record = await session.get(model_cls, record_id)
        if record is None:
            return None
        return _record_to_dict(record, fields)


async def create_record(
    model: str,
    vals: dict[str, Any],
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """Create a new record and return its data."""
    model_cls = get_model_class(model)
    if model_cls is None:
        raise ValueError(f"Unknown model: {model}")

    async with await _get_session() as session:
        # Filter vals to only include valid columns
        from sqlalchemy import inspect as sa_inspect
        mapper = sa_inspect(model_cls)
        valid_cols = {c.key for c in mapper.column_attrs}

        clean_vals = {}
        for k, v in vals.items():
            if k in valid_cols and k != "id":
                clean_vals[k] = v

        # Set audit fields
        clean_vals["create_uid"] = uid
        clean_vals["write_uid"] = uid

        record = model_cls(**clean_vals)
        session.add(record)
        await session.flush()
        await session.refresh(record)
        data = _record_to_dict(record)
        await session.commit()
        return data


async def write_record(
    model: str,
    record_id: int,
    vals: dict[str, Any],
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """Update a record and return its updated data."""
    model_cls = get_model_class(model)
    if model_cls is None:
        raise ValueError(f"Unknown model: {model}")

    async with await _get_session() as session:
        record = await session.get(model_cls, record_id)
        if record is None:
            raise RecordNotFoundError(model, record_id)

        # Filter vals to valid columns
        from sqlalchemy import inspect as sa_inspect
        mapper = sa_inspect(model_cls)
        valid_cols = {c.key for c in mapper.column_attrs}

        for k, v in vals.items():
            if k in valid_cols and k != "id":
                setattr(record, k, v)

        # Update audit
        record.write_uid = uid

        await session.flush()
        await session.refresh(record)
        data = _record_to_dict(record)
        await session.commit()
        return data


async def delete_record(
    model: str,
    record_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> bool:
    """Delete a record. Returns True if successful."""
    model_cls = get_model_class(model)
    if model_cls is None:
        raise ValueError(f"Unknown model: {model}")

    async with await _get_session() as session:
        record = await session.get(model_cls, record_id)
        if record is None:
            raise RecordNotFoundError(model, record_id)
        await session.delete(record)
        await session.commit()
        return True


async def read_group(
    model: str,
    domain: list | None = None,
    fields: list[str] | None = None,
    groupby: list[str] | None = None,
    orderby: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    lazy: bool = True,
    uid: int = 1,
    context: Optional[dict] = None,
) -> list[dict[str, Any]]:
    """Perform read_group aggregation on a model."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return []

    if not groupby:
        return []

    async with await _get_session() as session:
        where_clause = parse_domain(model_cls, domain or [])

        # Build group columns
        group_cols = []
        for gb in groupby:
            col = getattr(model_cls, gb, None)
            if col is not None:
                group_cols.append(col)

        if not group_cols:
            return []

        # Build aggregation columns
        agg_cols = [func.count(model_cls.id).label("__count")]
        for f in (fields or []):
            # Handle aggregation notation like "amount_total:sum"
            if ":" in f:
                fname, agg = f.split(":", 1)
            else:
                fname, agg = f, None

            col = getattr(model_cls, fname, None)
            if col is None or fname in groupby:
                continue

            if agg == "sum" or agg is None:
                agg_cols.append(func.sum(col).label(fname))
            elif agg == "avg":
                agg_cols.append(func.avg(col).label(fname))
            elif agg == "min":
                agg_cols.append(func.min(col).label(fname))
            elif agg == "max":
                agg_cols.append(func.max(col).label(fname))
            elif agg == "count":
                agg_cols.append(func.count(col).label(fname))

        query = (
            select(*group_cols, *agg_cols)
            .select_from(model_cls)
            .where(where_clause)
            .group_by(*group_cols)
        )

        if orderby:
            for part in orderby.split(","):
                part = part.strip()
                if not part:
                    continue
                tokens = part.split()
                col = getattr(model_cls, tokens[0], None)
                if col is not None:
                    if len(tokens) > 1 and tokens[1].upper() == "DESC":
                        query = query.order_by(col.desc())
                    else:
                        query = query.order_by(col.asc())

        query = query.offset(offset)
        if limit:
            query = query.limit(limit)

        result = await session.execute(query)
        rows = result.all()

        groups = []
        for row in rows:
            group = {}
            row_dict = row._asdict()
            for gb in groupby:
                val = row_dict.get(gb)
                group[gb] = val
            group["__domain"] = domain or []
            group[f"{groupby[0]}_count"] = row_dict.get("__count", 0)
            # Add aggregated fields
            for key, val in row_dict.items():
                if key not in groupby and key != "__count":
                    group[key] = float(val) if val is not None else 0
            groups.append(group)

        return groups


async def default_get(
    model: str,
    fields_list: Optional[list[str]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """Get default values for a new record."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return {}

    from sqlalchemy import inspect as sa_inspect
    mapper = sa_inspect(model_cls)
    defaults = {}

    for col_attr in mapper.column_attrs:
        col_name = col_attr.key
        if fields_list and col_name not in fields_list:
            continue
        if col_name in ("id", "create_uid", "create_date", "write_uid", "write_date"):
            continue

        col = col_attr.columns[0]
        if col.default is not None:
            if col.default.is_scalar:
                defaults[col_name] = col.default.arg
            elif col.default.is_callable:
                defaults[col_name] = col.default.arg(None)
        elif col.server_default is not None:
            # Server defaults are SQL expressions — try to extract literal value
            sd = str(col.server_default.arg) if hasattr(col.server_default, 'arg') else None
            if sd == "true":
                defaults[col_name] = True
            elif sd == "false":
                defaults[col_name] = False
        elif col.nullable:
            defaults[col_name] = None if not col_name.endswith("_id") else False

    return defaults


async def name_search(
    model: str,
    name: str = "",
    domain: list | None = None,
    operator: str = "ilike",
    limit: int = 8,
    uid: int = 1,
    context: Optional[dict] = None,
) -> list[dict[str, Any]]:
    """Search records by display name (for Many2one autocomplete)."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return []

    async with await _get_session() as session:
        where_clause = parse_domain(model_cls, domain or [])

        # Find the display name field (usually 'name', sometimes 'display_name')
        name_col = getattr(model_cls, "name", None)
        display_col = getattr(model_cls, "display_name", None)
        search_col = display_col if display_col is not None else name_col

        if search_col is not None and name:
            search_val = f"%{name}%" if "%" not in name else name
            name_filter = search_col.ilike(search_val)
            where_clause = where_clause & name_filter if where_clause is not None else name_filter

        query = select(model_cls).where(where_clause).limit(limit)
        result = await session.execute(query)
        records = result.scalars().all()

        results = []
        for r in records:
            display = getattr(r, "display_name", None) or getattr(r, "name", None) or str(r.id)
            # Handle JSONB name fields
            if isinstance(display, dict):
                display = display.get("en_US", next(iter(display.values()), str(r.id)))
            results.append({"id": r.id, "display_name": str(display)})

        return results


async def get_fields_metadata(
    model: str,
    attributes: Optional[list[str]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """Get field definitions for a model."""
    return get_fields_info(model, attributes)


async def call_method(
    model: str,
    record_ids: list[int],
    method: str,
    args: list | None = None,
    kwargs: Optional[dict] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Any:
    """
    Call a business logic method on records.

    In the SQLAlchemy adapter, business logic methods are defined as
    classmethods or static methods on the model class, or as service
    functions imported by the model.
    """
    model_cls = get_model_class(model)
    if model_cls is None:
        raise ValueError(f"Unknown model: {model}")

    # Security: block private and dangerous methods
    if method.startswith("_"):
        raise ValueError(f"Cannot call private method '{method}'")

    BLOCKED = frozenset({
        "unlink", "write", "create", "search", "browse", "sudo",
        "with_user", "with_env", "with_context", "with_company",
    })
    if method in BLOCKED:
        raise ValueError(f"Method '{method}' is not allowed via generic call endpoint")

    # Check if the model class has this method
    method_func = getattr(model_cls, method, None)
    if method_func is None or not callable(method_func):
        raise ValueError(f"Method '{method}' does not exist on {model}")

    async with await _get_session() as session:
        if record_ids:
            # Load records
            records = []
            for rid in record_ids:
                r = await session.get(model_cls, rid)
                if r is not None:
                    records.append(r)
        else:
            records = []

        # Call the method
        result = method_func(records, session=session, uid=uid, **(kwargs or {}))

        # Handle async methods
        import asyncio
        if asyncio.iscoroutine(result):
            result = await result

        await session.commit()

        # Serialize result
        if isinstance(result, list) and result and hasattr(result[0], "id"):
            return [_record_to_dict(r) for r in result]
        if hasattr(result, "id"):
            return _record_to_dict(result)
        return result
