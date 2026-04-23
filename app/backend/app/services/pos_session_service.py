"""
POS session lifecycle service.

Covers open / close / re-open / list / detail for pos.session records.

Enriches session records with the (id, name) tuples frontend components expect
for `config_id` and `user_id`, plus rolled-up `order_count` / `total_amount`
from pos.order.
"""
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import select, update as sql_update

from app.core.model_registry import get_model_class
from app.services.base import (
    async_create,
    async_get,
    async_search_read,
    async_update,
    get_session as _get_db_session,
)


SESSION_FIELDS = [
    "id", "name", "config_id", "user_id", "company_id", "state",
    "start_at", "stop_at",
    "cash_register_balance_start", "cash_register_balance_end_real",
    "cash_register_balance_end", "cash_control", "rescue",
    "sequence_number", "login_number",
    "opening_notes", "closing_notes",
]

ORDER_SUMMARY_FIELDS = ["id", "amount_total", "state", "date_order", "name", "partner_id"]


# ─── enrichment helpers ──────────────────────────────────────────────────────

async def _fetch_name_map(model: str, ids: list[int], name_field: str = "name") -> dict[int, str]:
    """Fetch a {id: name} map for the given model+ids. Safe on missing models."""
    if not ids or get_model_class(model) is None:
        return {}
    result = await async_search_read(
        model,
        [["id", "in", list(set(ids))]],
        ["id", name_field],
        limit=len(set(ids)),
    )
    return {r["id"]: (r.get(name_field) or "") for r in result["records"]}


async def _enrich_session(record: dict, config_names: dict[int, str] | None = None,
                          user_names: dict[int, str] | None = None) -> dict:
    """Convert raw config_id / user_id FK ints into [id, name] tuples."""
    cfg_id = record.get("config_id")
    if isinstance(cfg_id, int):
        name = (config_names or {}).get(cfg_id)
        if name is None:
            name = (await _fetch_name_map("pos.config", [cfg_id])).get(cfg_id, "")
        record["config_id"] = [cfg_id, name]

    uid_val = record.get("user_id")
    if isinstance(uid_val, int):
        name = (user_names or {}).get(uid_val)
        if name is None:
            name = (await _fetch_name_map("res.users", [uid_val], "login")).get(uid_val, "")
        record["user_id"] = [uid_val, name]

    return record


# ─── list / detail ───────────────────────────────────────────────────────────

async def list_sessions(
    config_id: int | None = None,
    state: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """List POS sessions with optional config/state filters, enriched with order counts."""
    if get_model_class("pos.session") is None:
        return {"records": [], "total": 0, "warning": "point_of_sale module not installed"}

    domain: list[Any] = []
    if config_id:
        domain.append(["config_id", "=", config_id])
    if state:
        domain.append(["state", "=", state])

    result = await async_search_read(
        "pos.session", domain, SESSION_FIELDS,
        offset=offset, limit=limit,
        order="start_at desc, id desc",
    )

    records = result.get("records", [])
    if not records:
        return result

    # Batch-load config + user display names.
    config_ids = [r["config_id"] for r in records if isinstance(r.get("config_id"), int)]
    user_ids = [r["user_id"] for r in records if isinstance(r.get("user_id"), int)]
    config_names = await _fetch_name_map("pos.config", config_ids)
    user_names = await _fetch_name_map("res.users", user_ids, "login")

    # Enrich + batch order counts per session.
    session_ids = [r["id"] for r in records]
    order_counts: dict[int, int] = {sid: 0 for sid in session_ids}
    order_totals: dict[int, float] = {sid: 0.0 for sid in session_ids}

    if get_model_class("pos.order") is not None and session_ids:
        orders = await async_search_read(
            "pos.order",
            [["session_id", "in", session_ids]],
            ["id", "session_id", "amount_total", "state"],
            limit=100000,
        )
        for o in orders.get("records", []):
            sid = o.get("session_id")
            if isinstance(sid, list):
                sid = sid[0]
            if sid in order_counts:
                order_counts[sid] += 1
                if o.get("state") in ("paid", "done", "invoiced"):
                    order_totals[sid] += float(o.get("amount_total") or 0)

    enriched = []
    for r in records:
        await _enrich_session(r, config_names, user_names)
        sid = r["id"]
        r["order_count"] = order_counts.get(sid, 0)
        r["total_amount"] = order_totals.get(sid, 0.0)
        enriched.append(r)

    return {"records": enriched, "total": result.get("total", 0)}


async def get_session_detail(session_id: int) -> dict | None:
    """Fetch a single POS session with order-count / total-amount rollups."""
    if get_model_class("pos.session") is None:
        return None
    session = await async_get("pos.session", session_id, SESSION_FIELDS)
    if session is None:
        return None

    await _enrich_session(session)

    session["order_count"] = 0
    session["total_amount"] = 0.0
    session["orders"] = []

    if get_model_class("pos.order") is not None:
        orders_result = await async_search_read(
            "pos.order",
            [["session_id", "=", session_id]],
            ORDER_SUMMARY_FIELDS,
            limit=10000,
            order="date_order desc, id desc",
        )
        records = orders_result.get("records", [])
        session["order_count"] = len(records)
        session["total_amount"] = sum(
            float(o.get("amount_total") or 0)
            for o in records
            if o.get("state") in ("paid", "done", "invoiced")
        )
        session["orders"] = records[:50]

    return session


# Alias matching the spec's naming.
get_session = get_session_detail


# ─── low-level mutation helpers ──────────────────────────────────────────────

async def create_pos_session(data: dict, uid: int = 1) -> int:
    """Create a pos.session row and return its new id."""
    created = await async_create("pos.session", vals=data, uid=uid, fields=["id"])
    return int(created["id"])


async def update_session(session_id: int, data: dict, uid: int = 1) -> dict:
    """Low-level partial update on pos.session."""
    return await async_update("pos.session", session_id, vals=data, uid=uid, fields=SESSION_FIELDS)


async def update_session_state(session_id: int, state: str, uid: int = 1) -> dict | None:
    """Flip state and return the enriched detail."""
    if get_model_class("pos.session") is None:
        raise HTTPException(500, "point_of_sale module not installed")
    existing = await async_get("pos.session", session_id, ["id", "state"])
    if existing is None:
        raise HTTPException(404, "Session not found")
    await update_session(session_id, {"state": state}, uid=uid)
    return await get_session_detail(session_id)


# ─── lifecycle ───────────────────────────────────────────────────────────────

async def _next_session_name() -> str:
    """Produce POS/YYYY/MM/DD/NNNN with a 4-digit counter scoped to today."""
    today = datetime.utcnow()
    prefix = today.strftime("POS/%Y/%m/%d")

    count = 0
    if get_model_class("pos.session") is not None:
        async with await _get_db_session() as session:
            from app.models.secondary.pos_session import PosSession
            from sqlalchemy import func
            stmt = (
                select(func.count(PosSession.id))
                .where(PosSession.name.like(f"{prefix}/%"))
            )
            count = (await session.execute(stmt)).scalar() or 0

    return f"{prefix}/{count + 1:04d}"


async def open_session(
    config_id: int,
    uid: int,
    opening_cash: float = 0.0,
    opening_notes: str = "",
) -> dict:
    """Open a brand new POS session for the given register config."""
    if get_model_class("pos.session") is None:
        raise HTTPException(500, "point_of_sale module not installed")

    # Refuse if an open session already exists for this register.
    existing = await async_search_read(
        "pos.session",
        [["config_id", "=", config_id], ["state", "in", ["opening_control", "opened"]]],
        ["id"],
        limit=1,
    )
    if existing.get("records"):
        raise HTTPException(400, "A session is already open for this register")

    name = await _next_session_name()
    vals = {
        "name": name,
        "config_id": config_id,
        "user_id": uid,
        "state": "opened",
        "start_at": datetime.utcnow(),
        "cash_register_balance_start": opening_cash,
        "opening_notes": opening_notes or "",
        "sequence_number": 1,
        "login_number": 1,
    }
    new_id = await create_pos_session(vals, uid=uid)
    detail = await get_session_detail(new_id)
    if detail is None:
        raise HTTPException(500, "Session created but could not be read back")
    return detail


async def close_session(
    session_id: int,
    closing_cash: float,
    closing_notes: str = "",
    uid: int = 1,
) -> dict:
    """Close an open POS session."""
    if get_model_class("pos.session") is None:
        raise HTTPException(500, "point_of_sale module not installed")

    session = await async_get("pos.session", session_id, ["id", "state"])
    if session is None:
        raise HTTPException(404, "Session not found")
    if session.get("state") == "closed":
        raise HTTPException(400, "Session already closed")

    await update_session(
        session_id,
        {
            "state": "closed",
            "stop_at": datetime.utcnow(),
            "cash_register_balance_end_real": closing_cash,
            "cash_register_balance_end": closing_cash,
            "closing_notes": closing_notes or "",
        },
        uid=uid,
    )
    detail = await get_session_detail(session_id)
    if detail is None:
        raise HTTPException(500, "Session closed but could not be read back")
    return detail
