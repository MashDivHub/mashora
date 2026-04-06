"""
Sales service layer.

Provides high-level operations for the sales module:
- Quotation/SO CRUD with line management
- Quotation lifecycle (send, confirm, cancel, lock)
- Invoice creation from SO
- Dashboard metrics
"""
import logging
from typing import Any, Optional

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)

SO_LIST_FIELDS = [
    "id", "name", "state", "partner_id", "user_id", "team_id",
    "date_order", "validity_date", "commitment_date",
    "amount_untaxed", "amount_tax", "amount_total",
    "invoice_status", "invoice_count",
    "currency_id", "company_id", "client_order_ref",
]

SO_DETAIL_FIELDS = SO_LIST_FIELDS + [
    "pricelist_id", "payment_term_id", "fiscal_position_id",
    "partner_invoice_id", "partner_shipping_id",
    "note", "reference", "origin",
    "order_line", "invoice_ids",
    "amount_to_invoice", "amount_invoiced",
    "require_signature", "require_payment",
    "signed_by", "signed_on",
    "locked", "create_date", "write_date",
]

SO_LINE_FIELDS = [
    "id", "sequence", "product_id", "product_template_id",
    "name", "product_uom_qty", "product_uom_id",
    "price_unit", "discount", "tax_ids",
    "price_subtotal", "price_total", "price_tax",
    "display_type", "is_downpayment",
    "customer_lead",
]


def build_sale_domain(
    state: Optional[list[str]] = None,
    invoice_status: Optional[list[str]] = None,
    partner_id: Optional[int] = None,
    user_id: Optional[int] = None,
    date_from=None,
    date_to=None,
    search: Optional[str] = None,
) -> list:
    """Build a Mashora domain filter for sale orders."""
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
        domain.append(["client_order_ref", "ilike", search])
        domain.append(["partner_id.name", "ilike", search])
    return domain


def list_orders(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """List sale orders with filters."""
    domain = build_sale_domain(
        state=params.get("state"),
        invoice_status=params.get("invoice_status"),
        partner_id=params.get("partner_id"),
        user_id=params.get("user_id"),
        date_from=params.get("date_from"),
        date_to=params.get("date_to"),
        search=params.get("search"),
    )
    with mashora_env(uid=uid, context=context) as env:
        Order = env["sale.order"]
        total = Order.search_count(domain)
        records = Order.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "date_order desc, name desc"),
        )
        return {"records": records.read(SO_LIST_FIELDS), "total": total}


def get_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    """Get full order details including lines."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        if not order.exists():
            return None
        data = order.read(SO_DETAIL_FIELDS)[0]

        line_ids = data.get("order_line", [])
        if line_ids:
            lines = env["sale.order.line"].browse(line_ids)
            data["lines"] = lines.read(SO_LINE_FIELDS)
        else:
            data["lines"] = []

        return data


def create_order(
    vals: dict,
    lines: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create a quotation with optional line items."""
    with mashora_env(uid=uid, context=context) as env:
        order_vals = {k: v for k, v in vals.items() if v is not None and k != "lines"}

        if lines:
            order_vals["order_line"] = []
            for line in lines:
                line_vals = {k: v for k, v in line.items() if v is not None}
                if "tax_ids" in line_vals:
                    line_vals["tax_ids"] = [(6, 0, line_vals["tax_ids"])]
                order_vals["order_line"].append((0, 0, line_vals))

        order = env["sale.order"].create(order_vals)
        return order.read(SO_LIST_FIELDS)[0]


def update_order(
    order_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a draft quotation."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        if not order.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Sale order {order_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        order.write(clean_vals)
        return order.read(SO_LIST_FIELDS)[0]


def confirm_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Confirm a quotation → sales order."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.action_confirm()
        return order.read(SO_LIST_FIELDS)[0]


def cancel_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Cancel a quotation/order."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.action_cancel()
        return order.read(SO_LIST_FIELDS)[0]


def reset_to_draft(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Reset a cancelled order back to draft."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.action_draft()
        return order.read(SO_LIST_FIELDS)[0]


def lock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Lock a confirmed order."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.action_lock()
        return order.read(SO_LIST_FIELDS)[0]


def unlock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Unlock a locked order."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.action_unlock()
        return order.read(SO_LIST_FIELDS)[0]


def create_invoice_from_order(
    order_id: int,
    advance_payment_method: str = "delivered",
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create invoice(s) from a confirmed sales order."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        ctx = dict(
            env.context,
            active_model="sale.order",
            active_ids=[order_id],
            active_id=order_id,
        )
        wizard = env["sale.advance.payment.inv"].with_context(**ctx).create({
            "advance_payment_method": advance_payment_method,
        })
        result = wizard.create_invoices()

        # Re-read order to get updated invoice info
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
    """Add a line to a quotation."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        vals = {k: v for k, v in line_vals.items() if v is not None}
        if "tax_ids" in vals:
            vals["tax_ids"] = [(6, 0, vals["tax_ids"])]
        order.write({"order_line": [(0, 0, vals)]})
        return order.read(SO_DETAIL_FIELDS)[0]


def update_order_line(
    line_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a specific order line."""
    with mashora_env(uid=uid, context=context) as env:
        line = env["sale.order.line"].browse(line_id)
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "tax_ids" in clean_vals:
            clean_vals["tax_ids"] = [(6, 0, clean_vals["tax_ids"])]
        line.write(clean_vals)
        return line.order_id.read(SO_DETAIL_FIELDS)[0]


def delete_order_line(
    order_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Remove a line from a quotation."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.write({"order_line": [(2, line_id, 0)]})
        return order.read(SO_DETAIL_FIELDS)[0]


def get_sales_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get sales dashboard summary metrics."""
    with mashora_env(uid=uid, context=context) as env:
        Order = env["sale.order"]

        quotations = Order.search_count([("state", "in", ["draft", "sent"])])
        to_confirm = Order.search_count([("state", "=", "sent")])
        confirmed = Order.search_count([("state", "=", "sale")])
        to_invoice = Order.search_count([
            ("state", "=", "sale"),
            ("invoice_status", "=", "to invoice"),
        ])

        # Revenue from confirmed orders (this month)
        import datetime
        today = datetime.date.today()
        first_of_month = today.replace(day=1)
        month_orders = Order.search([
            ("state", "=", "sale"),
            ("date_order", ">=", first_of_month.isoformat()),
        ], limit=1000)
        month_revenue = sum(
            r["amount_total"]
            for r in month_orders.read(["amount_total"])
        )

        return {
            "quotations": quotations,
            "to_confirm": to_confirm,
            "confirmed": confirmed,
            "to_invoice": to_invoice,
            "month_revenue": month_revenue,
        }
