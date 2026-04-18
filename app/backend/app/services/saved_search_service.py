"""Saved searches (ir.filters) — store domain+groupby+sort JSON per model."""
import json
from typing import Any, Optional

from sqlalchemy import select, delete, update

from app.services.base import get_session
from app.models.base.ir_filters import IrFilters


def _deserialize(value: str, default) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


async def list_saved_searches(model: str) -> list[dict]:
    async with await get_session() as session:
        q = (
            select(IrFilters)
            .where(
                IrFilters.model_id == model,
                IrFilters.active.isnot(False),
            )
            .order_by(IrFilters.is_default.desc().nulls_last(), IrFilters.name.asc())
        )
        rows = (await session.execute(q)).scalars().all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "is_default": bool(r.is_default),
                "domain": _deserialize(r.domain, []),
                "context": _deserialize(r.context, {}),
            }
            for r in rows
        ]


async def create_saved_search(
    model: str,
    name: str,
    domain: list,
    context: dict,
    is_default: bool = False,
) -> dict:
    async with await get_session() as session:
        # If is_default, unset any other default for this model first
        if is_default:
            await session.execute(
                update(IrFilters)
                .where(IrFilters.model_id == model, IrFilters.is_default.is_(True))
                .values(is_default=False)
            )
        row = IrFilters(
            name=name,
            model_id=model,
            domain=json.dumps(domain or []),
            context=json.dumps(context or {}),
            sort="[]",
            is_default=is_default,
            active=True,
        )
        session.add(row)
        await session.flush()
        await session.commit()
        return {
            "id": row.id,
            "name": row.name,
            "is_default": bool(row.is_default),
            "domain": domain or [],
            "context": context or {},
        }


async def delete_saved_search(filter_id: int) -> None:
    async with await get_session() as session:
        await session.execute(delete(IrFilters).where(IrFilters.id == filter_id))
        await session.commit()


async def set_default_saved_search(filter_id: int) -> None:
    async with await get_session() as session:
        row = (
            await session.execute(select(IrFilters).where(IrFilters.id == filter_id))
        ).scalar_one_or_none()
        if not row:
            return
        await session.execute(
            update(IrFilters)
            .where(IrFilters.model_id == row.model_id, IrFilters.id != filter_id, IrFilters.is_default.is_(True))
            .values(is_default=False)
        )
        await session.execute(
            update(IrFilters).where(IrFilters.id == filter_id).values(is_default=True)
        )
        await session.commit()
