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

from app.services.base import (
    RecordNotFoundError,
    async_action,
    async_count,
    async_create,
    async_delete,
    async_get_or_raise,
    async_get_related,
    async_search_read,
    async_sum,
    async_update,
)
from app.core.model_registry import get_model_class

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
    """Build a domain filter for sale orders."""
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


async def list_orders(
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
    return await async_search_read(
        "sale.order",
        domain,
        SO_LIST_FIELDS,
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
    data = await async_get_or_raise("sale.order", order_id, SO_DETAIL_FIELDS)
    lines = await async_get_related(
        "sale.order", order_id, "order_id", "sale.order.line", SO_LINE_FIELDS
    )
    data["lines"] = lines
    return data


async def create_order(
    vals: dict,
    lines: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create a quotation with optional line items."""
    order_vals = {k: v for k, v in vals.items() if v is not None and k != "lines"}
    order = await async_create("sale.order", order_vals, uid, SO_LIST_FIELDS)
    order_id = order["id"]

    if lines:
        for line in lines:
            line_vals = {k: v for k, v in line.items() if v is not None}
            await async_create(
                "sale.order.line",
                {**line_vals, "order_id": order_id},
                uid,
            )

    return order


async def update_order(
    order_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a draft quotation."""
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_update("sale.order", order_id, clean_vals, uid, SO_LIST_FIELDS)


async def confirm_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Confirm a quotation → sales order."""
    return await async_action("sale.order", order_id, "state", "sale", uid=uid, fields=SO_LIST_FIELDS)


async def cancel_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Cancel a quotation/order."""
    return await async_action("sale.order", order_id, "state", "cancel", uid=uid, fields=SO_LIST_FIELDS)


async def reset_to_draft(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Reset a cancelled order back to draft."""
    return await async_action("sale.order", order_id, "state", "draft", uid=uid, fields=SO_LIST_FIELDS)


async def lock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Lock a confirmed order."""
    return await async_update("sale.order", order_id, {"locked": True}, uid, SO_LIST_FIELDS)


async def unlock_order(
    order_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Unlock a locked order."""
    return await async_update("sale.order", order_id, {"locked": False}, uid, SO_LIST_FIELDS)


async def create_invoice_from_order(
    order_id: int,
    advance_payment_method: str = "delivered",
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create invoice(s) from a confirmed sales order.

    Wizard-based invoice creation is not supported in SQLAlchemy.
    Updates invoice_status to signal invoicing is pending.
    """
    order_data = await async_update(
        "sale.order",
        order_id,
        {"invoice_status": "invoiced"},
        uid,
        ["id", "invoice_ids", "invoice_count", "invoice_status"],
    )
    return {
        "order": order_data,
        "invoices": [],
        "message": (
            "Invoice creation via wizard is not available in the SQLAlchemy backend. "
            "Please create invoices directly through the accounting module."
        ),
    }


async def add_order_line(
    order_id: int,
    line_vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Add a line to a quotation."""
    vals = {k: v for k, v in line_vals.items() if v is not None}
    await async_create(
        "sale.order.line",
        {**vals, "order_id": order_id},
        uid,
    )
    return await async_get_or_raise("sale.order", order_id, SO_DETAIL_FIELDS)


async def update_order_line(
    line_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a specific order line."""
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    await async_update("sale.order.line", line_id, clean_vals, uid)
    # Retrieve the parent order id from the updated line
    line = await async_get_or_raise("sale.order.line", line_id, ["id", "order_id"])
    parent_order_id = line.get("order_id")
    return await async_get_or_raise("sale.order", parent_order_id, SO_DETAIL_FIELDS)


async def delete_order_line(
    order_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Remove a line from a quotation."""
    await async_delete("sale.order.line", line_id)
    return await async_get_or_raise("sale.order", order_id, SO_DETAIL_FIELDS)


async def get_sales_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get sales dashboard summary metrics."""
    import datetime
    today = datetime.date.today()
    first_of_month = today.replace(day=1).isoformat()

    quotations = await async_count("sale.order", [["state", "in", ["draft", "sent"]]])
    to_confirm = await async_count("sale.order", [["state", "=", "sent"]])
    confirmed = await async_count("sale.order", [["state", "=", "sale"]])
    to_invoice = await async_count("sale.order", [
        ["state", "=", "sale"],
        ["invoice_status", "=", "to invoice"],
    ])
    month_revenue = await async_sum("sale.order", "amount_total", [
        ["state", "=", "sale"],
        ["date_order", ">=", first_of_month],
    ])

    return {
        "quotations": quotations,
        "to_confirm": to_confirm,
        "confirmed": confirmed,
        "to_invoice": to_invoice,
        "month_revenue": month_revenue,
    }


# ============================================
# SALES EXTENSIONS — Loyalty, Margins, Teams
# ============================================

LOYALTY_PROGRAM_FIELDS = [
    "id", "name", "program_type", "trigger", "applies_on",
    "date_from", "date_to", "limit_usage", "max_usage",
    "portal_visible", "portal_point_name", "currency_id",
    "company_id", "rule_ids", "reward_ids", "coupon_count",
    "total_order_count", "active",
]

LOYALTY_REWARD_FIELDS = [
    "id", "program_id", "reward_type", "description",
    "required_points", "discount", "discount_mode",
    "discount_applicability", "discount_max_amount",
    "reward_product_id", "reward_product_qty",
]

LOYALTY_RULE_FIELDS = [
    "id", "program_id", "mode", "code",
    "minimum_qty", "minimum_amount",
    "reward_point_amount", "reward_point_mode",
    "product_ids", "product_category_id",
]

LOYALTY_CARD_FIELDS = [
    "id", "program_id", "partner_id", "code",
    "points", "expiration_date", "use_count",
]


async def list_loyalty_programs(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List loyalty/promotion programs."""
    if get_model_class("loyalty.program") is None:
        return {"records": [], "total": 0, "warning": "loyalty module not installed"}

    domain: list[Any] = []
    if params.get("program_type"):
        domain.append(["program_type", "=", params["program_type"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    if params.get("active") is not None:
        domain.append(["active", "=", params["active"]])

    return await async_search_read(
        "loyalty.program",
        domain,
        LOYALTY_PROGRAM_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "name asc"),
    )


async def get_loyalty_program(program_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get full loyalty program detail with rules and rewards."""
    if get_model_class("loyalty.program") is None:
        return None

    data = await async_get_or_raise("loyalty.program", program_id, LOYALTY_PROGRAM_FIELDS)

    rule_ids = data.get("rule_ids") or []
    if rule_ids and get_model_class("loyalty.rule") is not None:
        rules_result = await async_search_read(
            "loyalty.rule", [["id", "in", rule_ids]], LOYALTY_RULE_FIELDS
        )
        data["rules"] = rules_result["records"]
    else:
        data["rules"] = []

    reward_ids = data.get("reward_ids") or []
    if reward_ids and get_model_class("loyalty.reward") is not None:
        rewards_result = await async_search_read(
            "loyalty.reward", [["id", "in", reward_ids]], LOYALTY_REWARD_FIELDS
        )
        data["rewards"] = rewards_result["records"]
    else:
        data["rewards"] = []

    return data


async def list_loyalty_cards(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List loyalty cards/coupons."""
    if get_model_class("loyalty.card") is None:
        return {"records": [], "total": 0}

    domain: list[Any] = []
    if params.get("program_id"):
        domain.append(["program_id", "=", params["program_id"]])
    if params.get("partner_id"):
        domain.append(["partner_id", "=", params["partner_id"]])
    if params.get("search"):
        domain.append(["code", "ilike", params["search"]])

    return await async_search_read(
        "loyalty.card",
        domain,
        LOYALTY_CARD_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "create_date desc"),
    )


async def get_order_margins(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get margin analysis for a sales order."""
    order_data = await async_get_or_raise(
        "sale.order", order_id,
        ["id", "name", "amount_untaxed", "amount_total", "margin", "margin_percent"],
    )

    lines = await async_get_related(
        "sale.order", order_id, "order_id", "sale.order.line",
        ["id", "name", "product_id", "product_uom_qty", "price_unit",
         "price_subtotal", "purchase_price", "margin", "margin_percent"],
    )
    order_data["lines"] = lines
    return order_data


async def get_sales_teams(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List sales teams with member counts and revenue."""
    if get_model_class("crm.team") is None:
        return {"records": [], "total": 0}

    result = await async_search_read(
        "crm.team",
        [],
        ["id", "name", "user_id", "member_ids", "company_id", "color"],
        limit=200,
        order="sequence asc",
    )
    for t in result["records"]:
        t["member_count"] = len(t.get("member_ids") or [])
    return result
