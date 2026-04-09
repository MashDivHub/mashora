"""
Shared async service base for SQLAlchemy-powered services.

Provides common CRUD patterns that replace mashora_env() calls:
- async_search_read: search + count + read
- async_get: get single record by ID
- async_create: create record
- async_update: update record
- async_delete: delete record
- async_count: count matching records
- async_action: state transition helper

All functions work with SQLAlchemy async sessions and the model registry.
"""
import logging
from datetime import date, datetime
from typing import Any, Optional, Type

from sqlalchemy import and_, func, select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.domain_parser import parse_domain
from app.core.model_registry import get_model_class
from app.db.base import Base
from app.db.session import _get_session_factory
from app.services.bus_events import notify_record_change

_logger = logging.getLogger(__name__)


class RecordNotFoundError(Exception):
    """Raised when a record does not exist."""
    def __init__(self, model: str, record_id: int):
        self.model = model
        self.record_id = record_id
        super().__init__(f"Record {model}({record_id}) does not exist.")


def _to_dict(record, fields: Optional[list[str]] = None) -> dict[str, Any]:
    """Convert a SQLAlchemy model instance to a dict, handling JSONB translation fields."""
    from sqlalchemy import inspect as sa_inspect
    mapper = sa_inspect(type(record))
    result: dict[str, Any] = {}

    for col_attr in mapper.column_attrs:
        col_name = col_attr.key
        if fields and col_name not in fields and col_name != "id":
            continue
        val = getattr(record, col_name, None)

        # Handle JSONB translation fields → extract display value
        if isinstance(val, dict) and not col_name.endswith("_distribution") and not col_name.endswith("_data") and not col_name.endswith("_properties") and not col_name.endswith("_definition"):
            if "en_US" in val:
                val = val["en_US"]
            elif val:
                val = next(iter(val.values()))
            else:
                val = ""

        # Handle date/datetime serialization
        if isinstance(val, datetime):
            val = val.isoformat()
        elif isinstance(val, date):
            val = val.isoformat()

        result[col_name] = val

    return result


def _records_to_list(records, fields: Optional[list[str]] = None) -> list[dict[str, Any]]:
    """Convert a list of SQLAlchemy records to dicts."""
    return [_to_dict(r, fields) for r in records]


async def get_session() -> AsyncSession:
    """Get a new async session with auto-commit/rollback."""
    factory = _get_session_factory()
    session = factory()
    return session


async def async_search_read(
    model: str,
    domain: list | None = None,
    fields: Optional[list[str]] = None,
    offset: int = 0,
    limit: int = 40,
    order: Optional[str] = None,
) -> dict[str, Any]:
    """Search records with domain filter, return {records, total}."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return {"records": [], "total": 0}

    async with await get_session() as session:
        where = parse_domain(model_cls, domain or [])

        # Count
        count_q = select(func.count(model_cls.id)).where(where)
        total = (await session.execute(count_q)).scalar() or 0

        # Query
        query = select(model_cls).where(where)
        query = _apply_order(query, model_cls, order)
        query = query.offset(offset).limit(limit)

        result = await session.execute(query)
        records = result.scalars().all()
        return {"records": _records_to_list(records, fields), "total": total}


async def async_count(
    model: str,
    domain: list | None = None,
) -> int:
    """Count records matching domain."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return 0

    async with await get_session() as session:
        where = parse_domain(model_cls, domain or [])
        q = select(func.count(model_cls.id)).where(where)
        return (await session.execute(q)).scalar() or 0


async def async_get(
    model: str,
    record_id: int,
    fields: Optional[list[str]] = None,
) -> Optional[dict[str, Any]]:
    """Get a single record by ID."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return None

    async with await get_session() as session:
        record = await session.get(model_cls, record_id)
        if record is None:
            return None
        return _to_dict(record, fields)


async def async_get_or_raise(
    model: str,
    record_id: int,
    fields: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Get a single record or raise RecordNotFoundError."""
    result = await async_get(model, record_id, fields)
    if result is None:
        raise RecordNotFoundError(model, record_id)
    return result


async def async_create(
    model: str,
    vals: dict[str, Any],
    uid: int = 1,
    fields: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Create a record and return its data."""
    model_cls = get_model_class(model)
    if model_cls is None:
        raise ValueError(f"Unknown model: {model}")

    async with await get_session() as session:
        from sqlalchemy import inspect as sa_inspect
        mapper = sa_inspect(model_cls)
        valid_cols = {c.key for c in mapper.column_attrs}

        clean = {k: v for k, v in vals.items() if k in valid_cols and k != "id" and v is not None}
        clean["create_uid"] = uid
        clean["write_uid"] = uid

        record = model_cls(**clean)
        session.add(record)
        await session.flush()
        await session.refresh(record)
        data = _to_dict(record, fields)
        await session.commit()
        await notify_record_change(model, data["id"], "create", uid=uid)
        return data


async def async_update(
    model: str,
    record_id: int,
    vals: dict[str, Any],
    uid: int = 1,
    fields: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Update a record and return its updated data."""
    model_cls = get_model_class(model)
    if model_cls is None:
        raise ValueError(f"Unknown model: {model}")

    async with await get_session() as session:
        record = await session.get(model_cls, record_id)
        if record is None:
            raise RecordNotFoundError(model, record_id)

        from sqlalchemy import inspect as sa_inspect
        mapper = sa_inspect(model_cls)
        valid_cols = {c.key for c in mapper.column_attrs}

        for k, v in vals.items():
            if k in valid_cols and k != "id" and v is not None:
                setattr(record, k, v)

        record.write_uid = uid
        await session.flush()
        await session.refresh(record)
        data = _to_dict(record, fields)
        await session.commit()
        await notify_record_change(model, record_id, "update", uid=uid, changed_fields=list(vals.keys()))
        return data


async def async_delete(
    model: str,
    record_id: int,
) -> bool:
    """Delete a record."""
    model_cls = get_model_class(model)
    if model_cls is None:
        raise ValueError(f"Unknown model: {model}")

    async with await get_session() as session:
        record = await session.get(model_cls, record_id)
        if record is None:
            raise RecordNotFoundError(model, record_id)
        await session.delete(record)
        await session.commit()
        await notify_record_change(model, record_id, "delete")
        return True


async def async_action(
    model: str,
    record_id: int,
    state_field: str,
    new_state: str,
    extra_vals: Optional[dict] = None,
    uid: int = 1,
    fields: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Perform a state transition on a record (e.g., draft → confirmed)."""
    vals = {state_field: new_state}
    if extra_vals:
        vals.update(extra_vals)
    return await async_update(model, record_id, vals, uid=uid, fields=fields)


async def async_search_ids(
    model: str,
    domain: list | None = None,
    limit: int = 1000,
    order: Optional[str] = None,
) -> list[int]:
    """Search and return just IDs."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return []

    async with await get_session() as session:
        where = parse_domain(model_cls, domain or [])
        query = select(model_cls.id).where(where)
        query = _apply_order(query, model_cls, order)
        query = query.limit(limit)
        result = await session.execute(query)
        return [row[0] for row in result.all()]


async def async_sum(
    model: str,
    field: str,
    domain: list | None = None,
) -> float:
    """Sum a numeric field across matching records."""
    model_cls = get_model_class(model)
    if model_cls is None:
        return 0.0

    col = getattr(model_cls, field, None)
    if col is None:
        return 0.0

    async with await get_session() as session:
        where = parse_domain(model_cls, domain or [])
        q = select(func.coalesce(func.sum(col), 0)).where(where)
        result = (await session.execute(q)).scalar()
        return float(result or 0)


async def async_read_group(
    model: str,
    domain: list | None = None,
    fields: list[str] | None = None,
    groupby: list[str] | None = None,
    order: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Group-by aggregation."""
    model_cls = get_model_class(model)
    if not model_cls or not groupby:
        return []

    async with await get_session() as session:
        where = parse_domain(model_cls, domain or [])
        group_cols = [getattr(model_cls, gb) for gb in groupby if hasattr(model_cls, gb)]
        if not group_cols:
            return []

        agg_cols = [func.count(model_cls.id).label("__count")]
        for f in (fields or []):
            fname = f.split(":")[0] if ":" in f else f
            agg = f.split(":")[1] if ":" in f else "sum"
            col = getattr(model_cls, fname, None)
            if col is None or fname in groupby:
                continue
            agg_func = {"sum": func.sum, "avg": func.avg, "min": func.min, "max": func.max, "count": func.count}.get(agg, func.sum)
            agg_cols.append(agg_func(col).label(fname))

        query = select(*group_cols, *agg_cols).select_from(model_cls).where(where).group_by(*group_cols)
        if limit:
            query = query.limit(limit)

        result = await session.execute(query)
        groups = []
        for row in result.all():
            d = row._asdict()
            group = {gb: d.get(gb) for gb in groupby}
            group[f"{groupby[0]}_count"] = d.get("__count", 0)
            for k, v in d.items():
                if k not in groupby and k != "__count":
                    group[k] = float(v) if v is not None else 0
            groups.append(group)
        return groups


async def async_get_related(
    model: str,
    record_id: int,
    relation_field: str,
    related_model: str,
    fields: Optional[list[str]] = None,
    order: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Get related records (e.g., order lines for an order)."""
    model_cls = get_model_class(related_model)
    if model_cls is None:
        return []

    fk_col = getattr(model_cls, relation_field, None)
    if fk_col is None:
        return []

    async with await get_session() as session:
        query = select(model_cls).where(fk_col == record_id)
        query = _apply_order(query, model_cls, order)
        result = await session.execute(query)
        records = result.scalars().all()
        return _records_to_list(records, fields)


def _apply_order(query, model_cls, order: Optional[str]):
    """Apply order string to a query."""
    if not order:
        return query.order_by(model_cls.id.desc())

    for part in order.split(","):
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
    return query


def _first_of_month() -> str:
    """Get first day of current month as ISO string."""
    return date.today().replace(day=1).isoformat()


def _today() -> str:
    """Get today's date as ISO string."""
    return date.today().isoformat()
