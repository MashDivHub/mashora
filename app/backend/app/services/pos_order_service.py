"""
POS order lifecycle service.

Handles creating orders from the terminal (lines + payments in one shot),
plus state transitions (cancel, void, invoice, delete).

Reads use `async_search_read` / `async_get` from `app.services.base`.
Writes use raw SQLAlchemy via `AsyncSession` (see `website_service.set_blog_post_cover_image`).
"""
import json
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import insert as sql_insert, update as sql_update, delete as sql_delete, select

from app.services.base import async_get, async_search_read, get_session

_logger = logging.getLogger(__name__)


ORDER_FIELDS = [
    "id", "name", "pos_reference", "session_id", "config_id", "user_id",
    "partner_id", "date_order", "state", "amount_total", "amount_tax",
    "amount_paid", "amount_return", "note", "table_id", "customer_count",
    "tracking_number",
]

ORDER_LINE_FIELDS = [
    "id", "order_id", "product_id", "name", "qty", "price_unit",
    "price_subtotal", "price_subtotal_incl", "discount", "note", "sequence",
]

PAYMENT_FIELDS = [
    "id", "pos_order_id", "payment_method_id", "amount", "payment_date",
    "card_type", "transaction_id",
]


# ────────────────────────────────────────────────────────────────────
# Reads
# ────────────────────────────────────────────────────────────────────

async def list_orders(
    session_id: Optional[int] = None,
    config_id: Optional[int] = None,
    state: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """List POS orders, optionally filtered by session/config/state."""
    domain: list[Any] = []
    if session_id:
        domain.append(["session_id", "=", session_id])
    if config_id:
        domain.append(["config_id", "=", config_id])
    if state:
        domain.append(["state", "=", state])
    return await async_search_read(
        "pos.order", domain, ORDER_FIELDS,
        offset=offset, limit=limit, order="date_order desc, id desc",
    )


async def get_order(order_id: int) -> Optional[dict]:
    """Get an order with its lines and payments joined."""
    order = await async_get("pos.order", order_id)
    if order is None:
        return None

    lines = await async_search_read(
        "pos.order.line",
        [["order_id", "=", order_id]],
        ORDER_LINE_FIELDS,
        limit=1000, order="sequence, id",
    )
    payments = await async_search_read(
        "pos.payment",
        [["pos_order_id", "=", order_id]],
        PAYMENT_FIELDS,
        limit=100, order="id",
    )
    order["lines"] = lines["records"]
    order["payments"] = payments["records"]
    return order


# ────────────────────────────────────────────────────────────────────
# Create (submit from terminal)
# ────────────────────────────────────────────────────────────────────

async def create_order(session_id: int, uid: int, data: dict) -> dict:
    """
    Create a POS order with lines and payments in a single transaction-ish flow.

    data: {
        lines: [{product_id, name, qty, price_unit, discount?, tax_ids?, note?}],
        payments: [{payment_method_id, amount, card_type?, transaction_id?}],
        partner_id?, table_id?, customer_count?, note?, pos_reference?, tracking_number?
    }
    """
    session = await async_get("pos.session", session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    if session.get("state") not in ("opened", "opening_control"):
        raise HTTPException(400, f"Session state is {session.get('state')}, cannot create order")

    def _unref(val: Any) -> Any:
        """Unwrap an m2o [id, name] tuple if needed."""
        if isinstance(val, (list, tuple)) and val:
            return val[0]
        return val

    config_id = _unref(session.get("config_id"))
    user_id = _unref(session.get("user_id"))
    company_id = _unref(session.get("company_id"))

    lines_in = data.get("lines") or []
    if not lines_in:
        raise HTTPException(400, "At least one line is required")

    # Compute totals (no tax engine in this scope)
    subtotal = sum(
        float(l.get("qty", 0)) * float(l.get("price_unit", 0))
        * (1 - (float(l.get("discount", 0)) / 100))
        for l in lines_in
    )
    tax_total = 0.0
    total = subtotal + tax_total
    payments_in = data.get("payments") or []
    paid = sum(float(p.get("amount", 0)) for p in payments_in)
    change = max(0.0, paid - total)

    # Sequential name using session.sequence_number (falls back to 1)
    seq = int(session.get("sequence_number") or 1)
    name = f"Order {seq:05d}"

    order_vals = {
        "name": name,
        "pos_reference": data.get("pos_reference"),
        "session_id": session_id,
        "config_id": config_id,
        "user_id": user_id,
        "partner_id": data.get("partner_id"),
        "company_id": company_id,
        "date_order": datetime.utcnow(),
        "state": "paid" if paid + 1e-6 >= total else "draft",
        "amount_total": total,
        "amount_tax": tax_total,
        "amount_paid": paid,
        "amount_return": change,
        "note": data.get("note"),
        "table_id": data.get("table_id"),
        "customer_count": int(data.get("customer_count", 1) or 1),
        "tracking_number": data.get("tracking_number"),
    }

    order_id = await _insert_order(order_vals, uid=uid)

    for idx, line in enumerate(lines_in):
        qty = float(line.get("qty", 1) or 1)
        pu = float(line.get("price_unit", 0) or 0)
        disc = float(line.get("discount", 0) or 0)
        ps = qty * pu * (1 - disc / 100)
        await _insert_order_line({
            "order_id": order_id,
            "product_id": line["product_id"],
            "name": line.get("name", "") or "",
            "qty": qty,
            "price_unit": pu,
            "price_subtotal": ps,
            "price_subtotal_incl": ps,  # no tax applied in this scope
            "discount": disc,
            "tax_ids_json": json.dumps(line.get("tax_ids")) if line.get("tax_ids") else None,
            "note": line.get("note"),
            "sequence": idx * 10,
        })

    for p in payments_in:
        await _insert_payment({
            "pos_order_id": order_id,
            "payment_method_id": p["payment_method_id"],
            "amount": float(p.get("amount", 0) or 0),
            "payment_date": datetime.utcnow(),
            "card_type": p.get("card_type"),
            "transaction_id": p.get("transaction_id"),
        })

    await _increment_session_seq(session_id)

    return await get_order(order_id)


# ────────────────────────────────────────────────────────────────────
# Lifecycle actions
# ────────────────────────────────────────────────────────────────────

async def cancel_order(order_id: int) -> dict:
    """Cancel an order (state='cancel')."""
    return await _set_state(order_id, "cancel")


async def void_order(order_id: int) -> dict:
    """Void an order (alias for cancel)."""
    return await _set_state(order_id, "cancel")


async def invoice_order(order_id: int) -> dict:
    """
    Stub: mark the order as invoiced.
    Real invoice creation (account.move) is out of scope for this slice.
    """
    order = await async_get("pos.order", order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.get("state") not in ("paid", "done"):
        raise HTTPException(400, f"Cannot invoice order in state '{order.get('state')}'")
    return await _set_state(order_id, "invoiced")


async def delete_order(order_id: int) -> dict:
    """Delete a draft order. Non-draft orders cannot be deleted."""
    from app.models.secondary.pos_order import PosOrder
    from app.models.secondary.pos_order_line import PosOrderLine
    from app.models.secondary.pos_payment import PosPayment

    order = await async_get("pos.order", order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.get("state") != "draft":
        raise HTTPException(400, f"Only draft orders may be deleted (state='{order.get('state')}')")

    async with await get_session() as session:
        await session.execute(sql_delete(PosPayment).where(PosPayment.pos_order_id == order_id))
        await session.execute(sql_delete(PosOrderLine).where(PosOrderLine.order_id == order_id))
        await session.execute(sql_delete(PosOrder).where(PosOrder.id == order_id))
        await session.commit()

    return {"deleted": True, "id": order_id}


# ────────────────────────────────────────────────────────────────────
# Raw SQL helpers
# ────────────────────────────────────────────────────────────────────

def _clean(vals: dict) -> dict:
    """Drop None values so server defaults kick in."""
    return {k: v for k, v in vals.items() if v is not None}


async def _insert_order(vals: dict, uid: int = 1) -> int:
    """Insert a row into pos_order and return the new id."""
    from app.models.secondary.pos_order import PosOrder

    payload = _clean(vals)
    async with await get_session() as session:
        result = await session.execute(
            sql_insert(PosOrder).values(**payload).returning(PosOrder.id)
        )
        new_id = result.scalar_one()
        await session.commit()
        return int(new_id)


async def _insert_order_line(vals: dict) -> int:
    """Insert a row into pos_order_line and return the new id."""
    from app.models.secondary.pos_order_line import PosOrderLine

    payload = _clean(vals)
    async with await get_session() as session:
        result = await session.execute(
            sql_insert(PosOrderLine).values(**payload).returning(PosOrderLine.id)
        )
        new_id = result.scalar_one()
        await session.commit()
        return int(new_id)


async def _insert_payment(vals: dict) -> int:
    """Insert a row into pos_payment and return the new id."""
    from app.models.secondary.pos_payment import PosPayment

    payload = _clean(vals)
    async with await get_session() as session:
        result = await session.execute(
            sql_insert(PosPayment).values(**payload).returning(PosPayment.id)
        )
        new_id = result.scalar_one()
        await session.commit()
        return int(new_id)


async def _increment_session_seq(session_id: int) -> None:
    """Bump pos_session.sequence_number by 1."""
    from app.models.secondary.pos_session import PosSession

    async with await get_session() as session:
        row = await session.execute(
            select(PosSession.sequence_number).where(PosSession.id == session_id)
        )
        current = row.scalar() or 0
        await session.execute(
            sql_update(PosSession)
            .where(PosSession.id == session_id)
            .values(sequence_number=int(current) + 1)
        )
        await session.commit()


async def _set_state(order_id: int, new_state: str) -> dict:
    """Set pos_order.state directly and return the full order detail."""
    from app.models.secondary.pos_order import PosOrder

    order = await async_get("pos.order", order_id)
    if order is None:
        raise HTTPException(404, "Order not found")

    async with await get_session() as session:
        await session.execute(
            sql_update(PosOrder)
            .where(PosOrder.id == order_id)
            .values(state=new_state)
        )
        await session.commit()

    return await get_order(order_id)
