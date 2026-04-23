"""
Point-of-Sale service: configs, payment methods, categories, dashboard.

Handles CRUD for pos.config (with m2m payment_method_ids), pos.payment.method
and pos.category, plus a small dashboard aggregation used by the POS dashboard
page. Uses the generic async_* helpers from app.services.base where possible
and drops down to raw SQL only for the pos_config_payment_method_rel m2m join
(not expressible via async_* helpers).
"""
from __future__ import annotations

import datetime as _dt
import logging
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import delete as sa_delete, insert as sa_insert, select

from app.core.model_registry import get_model_class
from app.db.session import _get_session_factory
from app.services.base import (
    async_count,
    async_create,
    async_delete,
    async_get,
    async_search_read,
    async_sum,
    async_update,
    RecordNotFoundError,
)

_logger = logging.getLogger(__name__)


# ============================================
# Field lists
# ============================================

POS_CONFIG_FIELDS = [
    "id", "name", "active", "company_id", "currency_id",
    "warehouse_id", "journal_id", "pricelist_id",
    "module_pos_restaurant", "iface_tax_included", "iface_tipproduct",
    "iface_print_auto", "iface_cashdrawer", "cash_rounding",
    "limit_categories",
]

POS_PAYMENT_METHOD_FIELDS = [
    "id", "name", "active", "is_cash_count", "journal_id",
    "use_payment_terminal", "split_transactions", "sequence",
]

POS_CATEGORY_FIELDS = [
    "id", "name", "parent_id", "sequence", "color",
]


# ============================================
# m2m helpers (pos_config_payment_method_rel)
# ============================================

async def _get_payment_method_ids(config_id: int) -> list[int]:
    """Fetch payment_method_ids linked to a pos.config via the m2m join."""
    from app.models.secondary.pos_payment_method import (
        pos_config_payment_method_rel as rel,
    )
    factory = _get_session_factory()
    async with factory() as session:
        q = select(rel.c.payment_method_id).where(rel.c.config_id == config_id)
        result = await session.execute(q)
        return [row[0] for row in result.all()]


async def _set_payment_method_ids(config_id: int, method_ids: list[int]) -> None:
    """Replace m2m entries for a pos.config — delete-then-insert."""
    from app.models.secondary.pos_payment_method import (
        pos_config_payment_method_rel as rel,
    )
    factory = _get_session_factory()
    async with factory() as session:
        await session.execute(sa_delete(rel).where(rel.c.config_id == config_id))
        if method_ids:
            await session.execute(
                sa_insert(rel),
                [{"config_id": config_id, "payment_method_id": mid} for mid in method_ids],
            )
        await session.commit()


# ============================================
# POS Config
# ============================================

async def list_pos_configs(uid: int = 1, ctx: Optional[dict] = None) -> dict[str, Any]:
    if get_model_class("pos.config") is None:
        return {"records": [], "total": 0}
    result = await async_search_read(
        "pos.config", [], POS_CONFIG_FIELDS, limit=1000, order="name asc"
    )
    records = result["records"]
    for cfg in records:
        cid = cfg["id"]
        cfg["session_count"] = await async_count(
            "pos.session", [["config_id", "=", cid]]
        )
        open_ids = await _first_open_session_id(cid)
        cfg["open_session"] = open_ids  # int|None
        cfg["payment_method_ids"] = await _get_payment_method_ids(cid)
    return {"records": records, "total": len(records)}


async def _first_open_session_id(config_id: int) -> Optional[int]:
    if get_model_class("pos.session") is None:
        return None
    res = await async_search_read(
        "pos.session",
        [
            ["config_id", "=", config_id],
            ["state", "in", ["opening_control", "opened"]],
        ],
        ["id"],
        limit=1,
        order="id desc",
    )
    recs = res.get("records") or []
    return recs[0]["id"] if recs else None


async def get_pos_config(config_id: int) -> dict[str, Any]:
    if get_model_class("pos.config") is None:
        raise HTTPException(status_code=404, detail="Config not found")
    data = await async_get("pos.config", config_id, POS_CONFIG_FIELDS)
    if data is None:
        raise HTTPException(status_code=404, detail="Config not found")
    data["payment_method_ids"] = await _get_payment_method_ids(config_id)
    data["session_count"] = await async_count(
        "pos.session", [["config_id", "=", config_id]]
    )
    data["open_session"] = await _first_open_session_id(config_id)
    return data


async def create_pos_config(data: dict, uid: int = 1) -> dict[str, Any]:
    if get_model_class("pos.config") is None:
        raise HTTPException(status_code=400, detail="POS module not installed")
    payment_method_ids = data.pop("payment_method_ids", None)
    vals = {k: v for k, v in data.items() if k in set(POS_CONFIG_FIELDS) and k != "id"}
    if not vals.get("name"):
        raise HTTPException(status_code=400, detail="Name is required")
    created = await async_create("pos.config", vals, uid=uid, fields=POS_CONFIG_FIELDS)
    if payment_method_ids is not None:
        await _set_payment_method_ids(created["id"], list(payment_method_ids or []))
    return {"id": created["id"]}


async def update_pos_config(config_id: int, data: dict, uid: int = 1) -> dict[str, Any]:
    if get_model_class("pos.config") is None:
        raise HTTPException(status_code=404, detail="Config not found")
    payment_method_ids = data.pop("payment_method_ids", None)
    vals = {k: v for k, v in data.items() if k in set(POS_CONFIG_FIELDS) and k != "id"}
    try:
        if vals:
            await async_update(
                "pos.config", config_id, vals, uid=uid, fields=POS_CONFIG_FIELDS
            )
    except RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Config not found")
    if payment_method_ids is not None:
        await _set_payment_method_ids(config_id, list(payment_method_ids or []))
    return {"id": config_id}


async def delete_pos_config(config_id: int) -> dict[str, Any]:
    if get_model_class("pos.config") is None:
        raise HTTPException(status_code=404, detail="Config not found")
    sess_count = await async_count("pos.session", [["config_id", "=", config_id]])
    if sess_count > 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete config with sessions"
        )
    try:
        await async_update("pos.config", config_id, {"active": False})
    except RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"id": config_id, "archived": True}


# ============================================
# POS dashboard
# ============================================

async def get_pos_dashboard() -> dict[str, Any]:
    if get_model_class("pos.session") is None:
        return {
            "open_sessions": 0,
            "closed_today": 0,
            "orders_today": 0,
            "revenue_today": 0.0,
        }
    today_start = _dt.datetime.utcnow().replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    open_sessions = await async_count(
        "pos.session", [["state", "in", ["opened", "opening_control"]]]
    )
    closed_today = await async_count(
        "pos.session",
        [["state", "=", "closed"], ["stop_at", ">=", today_start]],
    )
    if get_model_class("pos.order") is None:
        return {
            "open_sessions": open_sessions,
            "closed_today": closed_today,
            "orders_today": 0,
            "revenue_today": 0.0,
        }
    orders_today = await async_count(
        "pos.order",
        [["date_order", ">=", today_start], ["state", "in", ["paid", "done", "invoiced"]]],
    )
    revenue_today = await async_sum(
        "pos.order",
        "amount_total",
        [["date_order", ">=", today_start], ["state", "in", ["paid", "done", "invoiced"]]],
    )
    return {
        "open_sessions": open_sessions,
        "closed_today": closed_today,
        "orders_today": orders_today,
        "revenue_today": float(revenue_today or 0.0),
    }


# ============================================
# Payment methods
# ============================================

async def list_payment_methods(active_only: bool = True) -> dict[str, Any]:
    if get_model_class("pos.payment.method") is None:
        return {"records": [], "total": 0}
    domain: list = []
    if active_only:
        domain.append(["active", "=", True])
    return await async_search_read(
        "pos.payment.method",
        domain,
        POS_PAYMENT_METHOD_FIELDS,
        limit=1000,
        order="sequence asc, name asc",
    )


async def get_payment_method(pm_id: int) -> dict[str, Any]:
    if get_model_class("pos.payment.method") is None:
        raise HTTPException(status_code=404, detail="Payment method not found")
    data = await async_get("pos.payment.method", pm_id, POS_PAYMENT_METHOD_FIELDS)
    if data is None:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return data


async def create_payment_method(data: dict, uid: int = 1) -> dict[str, Any]:
    if get_model_class("pos.payment.method") is None:
        raise HTTPException(status_code=400, detail="POS module not installed")
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Name is required")
    vals = {k: v for k, v in data.items() if k in set(POS_PAYMENT_METHOD_FIELDS) and k != "id"}
    created = await async_create(
        "pos.payment.method", vals, uid=uid, fields=POS_PAYMENT_METHOD_FIELDS
    )
    return {"id": created["id"]}


async def update_payment_method(pm_id: int, data: dict, uid: int = 1) -> dict[str, Any]:
    if get_model_class("pos.payment.method") is None:
        raise HTTPException(status_code=404, detail="Payment method not found")
    vals = {k: v for k, v in data.items() if k in set(POS_PAYMENT_METHOD_FIELDS) and k != "id"}
    try:
        await async_update(
            "pos.payment.method", pm_id, vals, uid=uid, fields=POS_PAYMENT_METHOD_FIELDS
        )
    except RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"id": pm_id}


async def delete_payment_method(pm_id: int) -> dict[str, Any]:
    """Soft-delete (archive) if referenced by pos.payment, hard-delete otherwise."""
    if get_model_class("pos.payment.method") is None:
        raise HTTPException(status_code=404, detail="Payment method not found")
    referenced = 0
    if get_model_class("pos.payment") is not None:
        referenced = await async_count(
            "pos.payment", [["payment_method_id", "=", pm_id]]
        )
    try:
        if referenced > 0:
            await async_update("pos.payment.method", pm_id, {"active": False})
            return {"id": pm_id, "archived": True}
        await async_delete("pos.payment.method", pm_id)
        return {"id": pm_id, "deleted": True}
    except RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Payment method not found")


# ============================================
# POS categories
# ============================================

async def list_pos_categories() -> dict[str, Any]:
    if get_model_class("pos.category") is None:
        return {"records": [], "total": 0}
    return await async_search_read(
        "pos.category",
        [],
        POS_CATEGORY_FIELDS,
        limit=2000,
        order="sequence asc, name asc",
    )


async def get_pos_category(cat_id: int) -> dict[str, Any]:
    if get_model_class("pos.category") is None:
        raise HTTPException(status_code=404, detail="Category not found")
    data = await async_get("pos.category", cat_id, POS_CATEGORY_FIELDS)
    if data is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return data


async def create_pos_category(data: dict, uid: int = 1) -> dict[str, Any]:
    if get_model_class("pos.category") is None:
        raise HTTPException(status_code=400, detail="POS module not installed")
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Name is required")
    vals = {k: v for k, v in data.items() if k in set(POS_CATEGORY_FIELDS) and k != "id"}
    created = await async_create(
        "pos.category", vals, uid=uid, fields=POS_CATEGORY_FIELDS
    )
    return {"id": created["id"]}


async def update_pos_category(cat_id: int, data: dict, uid: int = 1) -> dict[str, Any]:
    if get_model_class("pos.category") is None:
        raise HTTPException(status_code=404, detail="Category not found")
    vals = {k: v for k, v in data.items() if k in set(POS_CATEGORY_FIELDS) and k != "id"}
    try:
        await async_update(
            "pos.category", cat_id, vals, uid=uid, fields=POS_CATEGORY_FIELDS
        )
    except RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"id": cat_id}


async def delete_pos_category(cat_id: int) -> dict[str, Any]:
    if get_model_class("pos.category") is None:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        await async_delete("pos.category", cat_id)
    except RecordNotFoundError:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"id": cat_id, "deleted": True}
