"""
Purchase service layer.

Provides high-level operations for the purchase module:
- RFQ/PO CRUD with line management
- RFQ lifecycle (send, confirm, approve, cancel)
- Vendor bill creation from PO
- Dashboard metrics
"""
import logging
from typing import Any

from app.core.orm_adapter import mashora_env

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
    """Build a Mashora domain filter for purchase orders."""
    domain: list[Any] = []
    if state:
        domain.append(["state", "in", state])
    if invoice_status:
        domain.append(["invoice_status", "in", invoice_status])
    if partner_id:
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


def list_orders(
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
    with mashora_env(uid=uid, context=context) as env:
        Order = env["purchase.order"]
        total = Order.search_count(domain)
        records = Order.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "date_order desc, name desc"),
        )
        return {"records": records.read(PO_LIST_FIELDS), "total": total}


def get_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    """Get full order details including lines."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        if not order.exists():
            return None
        data = order.read(PO_DETAIL_FIELDS)[0]

        line_ids = data.get("order_line", [])
        if line_ids:
            lines = env["purchase.order.line"].browse(line_ids)
            data["lines"] = lines.read(PO_LINE_FIELDS)
        else:
            data["lines"] = []

        return data


def create_order(
    vals: dict,
    lines: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create an RFQ with optional line items."""
    with mashora_env(uid=uid, context=context) as env:
        order_vals = {k: v for k, v in vals.items() if v is not None and k != "lines"}

        if lines:
            order_vals["order_line"] = []
            for line in lines:
                line_vals = {k: v for k, v in line.items() if v is not None}
                if "tax_ids" in line_vals:
                    line_vals["tax_ids"] = [(6, 0, line_vals["tax_ids"])]
                order_vals["order_line"].append((0, 0, line_vals))

        order = env["purchase.order"].create(order_vals)
        return order.read(PO_LIST_FIELDS)[0]


def update_order(
    order_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a draft RFQ."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        if not order.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Purchase order {order_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        order.write(clean_vals)
        return order.read(PO_LIST_FIELDS)[0]


def confirm_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Confirm an RFQ. May go to 'to approve' or directly to 'purchase'."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        order.button_confirm()
        return order.read(PO_LIST_FIELDS)[0]


def approve_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Approve an order in 'to approve' state -> 'purchase'."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        order.button_approve()
        return order.read(PO_LIST_FIELDS)[0]


def cancel_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Cancel an RFQ/PO."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        order.button_cancel()
        return order.read(PO_LIST_FIELDS)[0]


def reset_to_draft(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Reset a cancelled order back to draft."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        order.button_draft()
        return order.read(PO_LIST_FIELDS)[0]


def lock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Lock a confirmed PO."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        order.button_lock()
        return order.read(PO_LIST_FIELDS)[0]


def unlock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Unlock a locked PO."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        order.button_unlock()
        return order.read(PO_LIST_FIELDS)[0]


def create_vendor_bill(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create vendor bill from a confirmed PO."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        result = order.action_create_invoice()

        order_data = order.read(["invoice_ids", "invoice_count", "invoice_status"])[0]
        invoice_ids = order_data.get("invoice_ids", [])

        invoices = []
        if invoice_ids:
            invoices = env["account.move"].browse(invoice_ids).read([
                "id", "name", "state", "amount_total", "amount_residual",
            ])

        return {"order": order_data, "invoices": invoices}


def add_order_line(
    order_id: int,
    line_vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Add a line to an RFQ."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        vals = {k: v for k, v in line_vals.items() if v is not None}
        if "tax_ids" in vals:
            vals["tax_ids"] = [(6, 0, vals["tax_ids"])]
        order.write({"order_line": [(0, 0, vals)]})
        return order.read(PO_DETAIL_FIELDS)[0]


def update_order_line(
    line_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a specific order line."""
    with mashora_env(uid=uid, context=context) as env:
        line = env["purchase.order.line"].browse(line_id)
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "tax_ids" in clean_vals:
            clean_vals["tax_ids"] = [(6, 0, clean_vals["tax_ids"])]
        line.write(clean_vals)
        return line.order_id.read(PO_DETAIL_FIELDS)[0]


def delete_order_line(
    order_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Remove a line from an RFQ."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["purchase.order"].browse(order_id)
        order.write({"order_line": [(2, line_id, 0)]})
        return order.read(PO_DETAIL_FIELDS)[0]


def get_purchase_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get purchase dashboard summary metrics."""
    with mashora_env(uid=uid, context=context) as env:
        Order = env["purchase.order"]

        rfqs = Order.search_count([("state", "in", ["draft", "sent"])])
        to_approve = Order.search_count([("state", "=", "to approve")])
        confirmed = Order.search_count([("state", "=", "purchase")])
        to_invoice = Order.search_count([
            ("state", "=", "purchase"),
            ("invoice_status", "=", "to invoice"),
        ])

        # Late deliveries
        import datetime
        today = datetime.date.today()
        late = Order.search_count([
            ("state", "=", "purchase"),
            ("date_planned", "<", today.isoformat()),
            ("invoice_status", "!=", "invoiced"),
        ])

        # This month spend
        first_of_month = today.replace(day=1)
        month_orders = Order.search([
            ("state", "=", "purchase"),
            ("date_approve", ">=", first_of_month.isoformat()),
        ], limit=1000)
        month_spend = sum(
            r["amount_total"]
            for r in month_orders.read(["amount_total"])
        )

        return {
            "rfqs": rfqs,
            "to_approve": to_approve,
            "confirmed": confirmed,
            "to_invoice": to_invoice,
            "late_deliveries": late,
            "month_spend": month_spend,
        }
