"""
Purchase service layer.

Provides high-level operations for the purchase module:
- RFQ/PO CRUD with line management
- RFQ lifecycle (send, confirm, approve, cancel)
- Vendor bill creation from PO
- Dashboard metrics
"""
import datetime
import logging
from typing import Any, Optional

from app.services.base import (
    RecordNotFoundError,
    async_action,
    async_count,
    async_create,
    async_delete,
    async_get,
    async_get_related,
    async_search_read,
    async_sum,
    async_update,
)

_logger = logging.getLogger(__name__)

PO_LIST_FIELDS = [
    "id", "name", "state", "partner_id", "user_id",
    "date_order", "date_approve", "date_planned",
    "amount_untaxed", "amount_tax", "amount_total",
    "invoice_status", "invoice_count",
    "currency_id", "company_id", "partner_ref", "origin",
    "priority",
]

PO_DETAIL_FIELDS = PO_LIST_FIELDS + [
    "fiscal_position_id", "payment_term_id", "incoterm_id",
    "dest_address_id",
    "note", "order_line", "invoice_ids",
    "locked", "acknowledged",
    "create_date", "write_date",
]

PO_LINE_FIELDS = [
    "id", "sequence", "product_id",
    "name", "product_qty", "product_uom_id",
    "price_unit", "discount", "tax_ids",
    "price_subtotal", "price_total", "price_tax",
    "date_planned", "qty_received", "qty_invoiced", "qty_to_invoice",
    "display_type", "is_downpayment",
]


def build_purchase_domain(
    state: Optional[list[str]] = None,
    invoice_status: Optional[list[str]] = None,
    partner_id: Optional[int] = None,
    user_id: Optional[int] = None,
    date_from=None,
    date_to=None,
    search: Optional[str] = None,
) -> list:
    """Build a domain filter for purchase orders."""
    domain: list[Any] = []
    if state:
        domain.append(["state", "in", state])
    if invoice_status:
        domain.append(["invoice_status", "in", invoice_status])
    if partner_id is not None:
        domain.append(["partner_id", "=", partner_id])
    if user_id:
        domain.append(["user_id", "=", user_id])
    if date_from:
        domain.append(["date_order", ">=", str(date_from)])
    if date_to:
        domain.append(["date_order", "<=", str(date_to)])
    if search:
        domain.append("|")
        domain.append("|")
        domain.append(["name", "ilike", search])
        domain.append(["partner_ref", "ilike", search])
        domain.append(["partner_id.name", "ilike", search])
    return domain


async def list_orders(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """List purchase orders with filters."""
    domain = build_purchase_domain(
        state=params.get("state"),
        invoice_status=params.get("invoice_status"),
        partner_id=params.get("partner_id"),
        user_id=params.get("user_id"),
        date_from=params.get("date_from"),
        date_to=params.get("date_to"),
        search=params.get("search"),
    )
    return await async_search_read(
        "purchase.order",
        domain=domain,
        fields=PO_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date_order desc, name desc"),
    )


async def get_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    """Get full order details including lines."""
    data = await async_get("purchase.order", order_id, PO_DETAIL_FIELDS)
    if data is None:
        return None

    lines = await async_get_related(
        "purchase.order",
        order_id,
        "order_id",
        "purchase.order.line",
        fields=PO_LINE_FIELDS,
    )
    data["lines"] = lines
    return data


async def create_order(
    vals: dict,
    lines: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create an RFQ with optional line items."""
    order_vals = {k: v for k, v in vals.items() if v is not None and k != "lines"}
    order = await async_create("purchase.order", order_vals, uid=uid, fields=PO_LIST_FIELDS)

    if lines:
        order_id = order["id"]
        for line in lines:
            line_vals = {k: v for k, v in line.items() if v is not None}
            line_vals["order_id"] = order_id
            await async_create("purchase.order.line", line_vals, uid=uid)

    return order


async def update_order(
    order_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a draft RFQ."""
    existing = await async_get("purchase.order", order_id)
    if existing is None:
        raise RecordNotFoundError("purchase.order", order_id)
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_update("purchase.order", order_id, clean_vals, uid=uid, fields=PO_LIST_FIELDS)


async def confirm_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Confirm an RFQ. May go to 'to approve' or directly to 'purchase'."""
    return await async_action("purchase.order", order_id, "state", "purchase", uid=uid, fields=PO_LIST_FIELDS)


async def approve_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Approve an order in 'to approve' state -> 'purchase'."""
    return await async_action("purchase.order", order_id, "state", "purchase", uid=uid, fields=PO_LIST_FIELDS)


async def cancel_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Cancel an RFQ/PO."""
    return await async_action("purchase.order", order_id, "state", "cancel", uid=uid, fields=PO_LIST_FIELDS)


async def reset_to_draft(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Reset a cancelled order back to draft."""
    return await async_action("purchase.order", order_id, "state", "draft", uid=uid, fields=PO_LIST_FIELDS)


async def lock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Lock a confirmed PO."""
    return await async_update("purchase.order", order_id, {"locked": True}, uid, PO_LIST_FIELDS)


async def unlock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Unlock a locked PO."""
    return await async_update("purchase.order", order_id, {"locked": False}, uid, PO_LIST_FIELDS)


async def create_vendor_bill(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create vendor bill from a confirmed PO (wizard not available; returns advisory message)."""
    return {
        "message": "Vendor bill creation via wizard is not available in the async API. "
                   "Please create the vendor bill manually from the Accounting module.",
        "order_id": order_id,
    }


async def add_order_line(
    order_id: int,
    line_vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Add a line to an RFQ."""
    vals = {k: v for k, v in line_vals.items() if v is not None}
    vals["order_id"] = order_id
    await async_create("purchase.order.line", vals, uid=uid)
    data = await async_get("purchase.order", order_id, PO_DETAIL_FIELDS)
    if data is None:
        raise RecordNotFoundError("purchase.order", order_id)
    lines = await async_get_related(
        "purchase.order",
        order_id,
        "order_id",
        "purchase.order.line",
        fields=PO_LINE_FIELDS,
    )
    data["lines"] = lines
    return data


async def update_order_line(
    line_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a specific order line."""
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    await async_update("purchase.order.line", line_id, clean_vals, uid=uid)

    line = await async_get("purchase.order.line", line_id, ["order_id"])
    if line is None:
        raise RecordNotFoundError("purchase.order.line", line_id)
    order_id = line["order_id"]

    data = await async_get("purchase.order", order_id, PO_DETAIL_FIELDS)
    if data is None:
        raise RecordNotFoundError("purchase.order", order_id)
    lines = await async_get_related(
        "purchase.order",
        order_id,
        "order_id",
        "purchase.order.line",
        fields=PO_LINE_FIELDS,
    )
    data["lines"] = lines
    return data


async def delete_order_line(
    order_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Remove a line from an RFQ."""
    await async_delete("purchase.order.line", line_id)

    data = await async_get("purchase.order", order_id, PO_DETAIL_FIELDS)
    if data is None:
        raise RecordNotFoundError("purchase.order", order_id)
    lines = await async_get_related(
        "purchase.order",
        order_id,
        "order_id",
        "purchase.order.line",
        fields=PO_LINE_FIELDS,
    )
    data["lines"] = lines
    return data


async def get_purchase_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get purchase dashboard summary metrics."""
    today = datetime.date.today()
    first_of_month = today.replace(day=1).isoformat()

    rfqs = await async_count("purchase.order", [["state", "in", ["draft", "sent"]]])
    to_approve = await async_count("purchase.order", [["state", "=", "to approve"]])
    confirmed = await async_count("purchase.order", [["state", "=", "purchase"]])
    to_invoice = await async_count("purchase.order", [
        ["state", "=", "purchase"],
        ["invoice_status", "=", "to invoice"],
    ])
    late = await async_count("purchase.order", [
        ["state", "=", "purchase"],
        ["date_planned", "<", today.isoformat()],
        ["invoice_status", "!=", "invoiced"],
    ])
    month_spend = await async_sum("purchase.order", "amount_total", [
        ["state", "=", "purchase"],
        ["date_approve", ">=", first_of_month],
    ])

    return {
        "rfqs": rfqs,
        "to_approve": to_approve,
        "confirmed": confirmed,
        "to_invoice": to_invoice,
        "late_deliveries": late,
        "month_spend": month_spend,
    }
