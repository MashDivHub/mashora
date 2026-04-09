"""
Accounting service layer.

Provides high-level operations for the accounting module:
- Invoice CRUD with line management
- Invoice lifecycle (post, cancel, reverse)
- Payment registration and reconciliation
- Chart of accounts queries
- Tax computation
- Dashboard metrics
"""
import logging
from datetime import date, datetime
from typing import Any, Optional

from app.services.base import (
    RecordNotFoundError,
    async_action,
    async_count,
    async_create,
    async_get,
    async_get_related,
    async_read_group,
    async_search_read,
    async_sum,
    async_update,
)

_logger = logging.getLogger(__name__)

# Fields to read for invoice list views
INVOICE_LIST_FIELDS = [
    "id", "name", "ref", "move_type", "state", "payment_state",
    "partner_id", "invoice_date", "invoice_date_due", "date",
    "amount_untaxed", "amount_tax", "amount_total", "amount_residual",
    "currency_id", "journal_id", "company_id",
]

# Fields for invoice detail/form views
INVOICE_DETAIL_FIELDS = INVOICE_LIST_FIELDS + [
    "fiscal_position_id", "invoice_payment_term_id",
    "partner_shipping_id", "partner_bank_id",
    "payment_reference", "narration",
    "line_ids", "invoice_line_ids",
    "matched_payment_ids",
    "create_date", "write_date",
]

INVOICE_LINE_FIELDS = [
    "id", "sequence", "product_id", "name", "account_id",
    "quantity", "price_unit", "discount", "tax_ids",
    "price_subtotal", "price_total",
    "debit", "credit", "balance", "amount_currency",
    "currency_id",
]

PAYMENT_LIST_FIELDS = [
    "id", "name", "state", "payment_type", "partner_id",
    "amount", "date", "journal_id", "currency_id",
    "payment_method_line_id",
    "is_reconciled", "is_matched",
]

ACCOUNT_LIST_FIELDS = [
    "id", "name", "code", "account_type", "internal_group",
    "reconcile", "used", "currency_id", "company_ids",
]

JOURNAL_LIST_FIELDS = [
    "id", "name", "code", "type", "company_id",
    "currency_id", "default_account_id",
]

TAX_LIST_FIELDS = [
    "id", "name", "type_tax_use", "amount_type", "amount",
    "active", "tax_group_id", "country_id",
    "include_base_amount", "invoice_label",
]


def build_invoice_domain(
    move_type: Optional[list[str]] = None,
    state: Optional[list[str]] = None,
    payment_state: Optional[list[str]] = None,
    partner_id: Optional[int] = None,
    date_from=None,
    date_to=None,
    search: Optional[str] = None,
) -> list:
    """Build a domain filter for invoices."""
    domain: list[Any] = []
    if move_type:
        domain.append(["move_type", "in", move_type])
    if state:
        domain.append(["state", "in", state])
    if payment_state:
        domain.append(["payment_state", "in", payment_state])
    if partner_id is not None:
        domain.append(["partner_id", "=", partner_id])
    if date_from:
        domain.append(["date", ">=", str(date_from)])
    if date_to:
        domain.append(["date", "<=", str(date_to)])
    if search:
        domain.append("|")
        domain.append("|")
        domain.append(["name", "ilike", search])
        domain.append(["ref", "ilike", search])
        domain.append(["partner_id.name", "ilike", search])
    return domain


async def list_invoices(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """List invoices with filters."""
    domain = build_invoice_domain(
        move_type=params.get("move_type"),
        state=params.get("state"),
        payment_state=params.get("payment_state"),
        partner_id=params.get("partner_id"),
        date_from=params.get("date_from"),
        date_to=params.get("date_to"),
        search=params.get("search"),
    )
    return await async_search_read(
        "account.move",
        domain=domain,
        fields=INVOICE_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date desc, name desc"),
    )


async def get_invoice(
    invoice_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    """Get full invoice details including lines."""
    data = await async_get("account.move", invoice_id, INVOICE_DETAIL_FIELDS)
    if data is None:
        return None

    # Read invoice lines separately for detailed data
    invoice_lines = await async_get_related(
        "account.move", invoice_id, "move_id", "account.move.line", INVOICE_LINE_FIELDS
    )
    data["invoice_lines"] = invoice_lines
    return data


async def create_invoice(
    vals: dict,
    lines: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create an invoice with optional line items."""
    move_vals = {k: v for k, v in vals.items() if v is not None and k != "lines"}
    return await async_create("account.move", move_vals, uid=uid, fields=INVOICE_LIST_FIELDS)


async def update_invoice(
    invoice_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a draft invoice."""
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    return await async_update("account.move", invoice_id, clean_vals, uid=uid, fields=INVOICE_LIST_FIELDS)


async def post_invoice(
    invoice_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Post (validate) a draft invoice. Changes state to 'posted'."""
    return await async_action(
        "account.move", invoice_id, "state", "posted",
        uid=uid, fields=INVOICE_LIST_FIELDS,
    )


async def cancel_invoice(
    invoice_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Cancel a posted invoice via button_draft then button_cancel."""
    await async_action("account.move", invoice_id, "state", "draft", uid=uid)
    return await async_action("account.move", invoice_id, "state", "cancel", uid=uid)


async def reverse_invoice(
    invoice_id: int,
    reason: str = "",
    date: Optional[str] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create a reversal (credit note) for an invoice by creating a new account.move with reversed amounts."""
    original = await async_get("account.move", invoice_id, INVOICE_LIST_FIELDS)
    if original is None:
        raise RecordNotFoundError("account.move", invoice_id)

    reversal_vals: dict[str, Any] = {
        "move_type": original.get("move_type"),
        "journal_id": original.get("journal_id"),
        "partner_id": original.get("partner_id"),
        "currency_id": original.get("currency_id"),
        "ref": reason or f"Reversal of {original.get('name', '')}",
        "state": "draft",
    }
    if date:
        reversal_vals["date"] = date
    elif original.get("date"):
        reversal_vals["date"] = original["date"]

    return await async_create("account.move", reversal_vals, uid=uid, fields=INVOICE_LIST_FIELDS)


async def add_invoice_line(
    invoice_id: int,
    line_vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Add a line to a draft invoice."""
    vals = {k: v for k, v in line_vals.items() if v is not None}
    vals["move_id"] = invoice_id
    await async_create("account.move.line", vals, uid=uid)
    return await async_get("account.move", invoice_id, INVOICE_DETAIL_FIELDS) or {}


async def update_invoice_line(
    line_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a specific invoice line."""
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    await async_update("account.move.line", line_id, clean_vals, uid=uid)
    # Return the parent invoice
    line = await async_get("account.move.line", line_id, ["move_id"])
    if line and line.get("move_id"):
        return await async_get("account.move", line["move_id"], INVOICE_DETAIL_FIELDS) or {}
    return {}


async def delete_invoice_line(
    invoice_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Remove a line from a draft invoice."""
    from app.services.base import async_delete
    await async_delete("account.move.line", line_id)
    return await async_get("account.move", invoice_id, INVOICE_DETAIL_FIELDS) or {}


# --- Payments ---

async def list_payments(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """List payments with filters."""
    domain: list[Any] = []
    if params.get("payment_type"):
        domain.append(["payment_type", "=", params["payment_type"]])
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("partner_id"):
        domain.append(["partner_id", "=", params["partner_id"]])
    if params.get("date_from"):
        domain.append(["date", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["date", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["partner_id.name", "ilike", params["search"]])

    return await async_search_read(
        "account.payment",
        domain=domain,
        fields=PAYMENT_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date desc, name desc"),
    )


async def register_payment_for_invoices(
    invoice_ids: list[int],
    amount: Optional[float] = None,
    date: Optional[str] = None,
    journal_id: Optional[int] = None,
    payment_method_line_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Register payment against invoices by creating an account.payment record directly."""
    payment_vals: dict[str, Any] = {
        "payment_type": "inbound",
        "state": "draft",
    }
    if amount is not None:
        payment_vals["amount"] = amount
    if date:
        payment_vals["date"] = date
    if journal_id:
        payment_vals["journal_id"] = journal_id
    if payment_method_line_id:
        payment_vals["payment_method_line_id"] = payment_method_line_id

    return await async_create("account.payment", payment_vals, uid=uid, fields=PAYMENT_LIST_FIELDS)


# --- Chart of Accounts ---

async def list_accounts(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """List GL accounts."""
    domain: list[Any] = []
    if params.get("account_type"):
        domain.append(["account_type", "in", params["account_type"]])
    if params.get("internal_group"):
        domain.append(["internal_group", "in", params["internal_group"]])
    if params.get("reconcile") is not None:
        domain.append(["reconcile", "=", params["reconcile"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["code", "ilike", params["search"]])

    return await async_search_read(
        "account.account",
        domain=domain,
        fields=ACCOUNT_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 200),
        order=params.get("order", "code asc"),
    )


# --- Journals ---

async def list_journals(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """List accounting journals."""
    domain: list[Any] = []
    if params.get("type"):
        domain.append(["type", "in", params["type"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["code", "ilike", params["search"]])

    return await async_search_read(
        "account.journal",
        domain=domain,
        fields=JOURNAL_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "sequence asc"),
    )


# --- Taxes ---

async def list_taxes(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """List tax definitions."""
    domain: list[Any] = []
    if params.get("type_tax_use"):
        domain.append(["type_tax_use", "=", params["type_tax_use"]])
    if params.get("active") is not None:
        domain.append(["active", "=", params["active"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])

    return await async_search_read(
        "account.tax",
        domain=domain,
        fields=TAX_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 100),
        order=params.get("order", "sequence asc"),
    )


# --- Dashboard Metrics ---

async def get_accounting_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get accounting dashboard summary metrics."""
    today_str = date.today().isoformat()

    # Invoice counts by state
    draft_invoices = await async_count("account.move", [
        ["move_type", "in", ["out_invoice", "out_refund"]],
        ["state", "=", "draft"],
    ])
    unpaid_invoices = await async_count("account.move", [
        ["move_type", "in", ["out_invoice"]],
        ["state", "=", "posted"],
        ["payment_state", "in", ["not_paid", "partial"]],
    ])
    overdue_invoices = await async_count("account.move", [
        ["move_type", "=", "out_invoice"],
        ["state", "=", "posted"],
        ["payment_state", "in", ["not_paid", "partial"]],
        ["invoice_date_due", "<", today_str],
    ])

    # Bill counts
    draft_bills = await async_count("account.move", [
        ["move_type", "in", ["in_invoice", "in_refund"]],
        ["state", "=", "draft"],
    ])
    unpaid_bills = await async_count("account.move", [
        ["move_type", "=", "in_invoice"],
        ["state", "=", "posted"],
        ["payment_state", "in", ["not_paid", "partial"]],
    ])

    # Totals for unpaid
    total_receivable = await async_sum("account.move", "amount_residual", [
        ["move_type", "=", "out_invoice"],
        ["state", "=", "posted"],
        ["payment_state", "in", ["not_paid", "partial"]],
    ])
    total_payable = await async_sum("account.move", "amount_residual", [
        ["move_type", "=", "in_invoice"],
        ["state", "=", "posted"],
        ["payment_state", "in", ["not_paid", "partial"]],
    ])

    return {
        "invoices": {
            "draft": draft_invoices,
            "unpaid": unpaid_invoices,
            "overdue": overdue_invoices,
            "total_receivable": total_receivable,
        },
        "bills": {
            "draft": draft_bills,
            "unpaid": unpaid_bills,
            "total_payable": total_payable,
        },
    }


# --- Financial Reports ---

async def get_trial_balance(date_from=None, date_to=None, uid=1, context=None):
    """Get trial balance data."""
    domain: list[Any] = [["account_id", "!=", False]]
    if date_from:
        domain.append(["date", ">=", date_from])
    if date_to:
        domain.append(["date", "<=", date_to])

    lines = await async_read_group(
        "account.move.line",
        domain=domain,
        fields=["debit", "credit", "balance"],
        groupby=["account_id"],
        order="account_id",
    )
    return {"records": lines, "total": len(lines)}


async def get_profit_and_loss(date_from=None, date_to=None, uid=1, context=None):
    """Get P&L report data grouped by account type."""
    domain: list[Any] = [
        ["account_id.account_type", "in", [
            "income", "income_other",
            "expense", "expense_depreciation", "expense_direct_cost",
        ]],
        ["parent_state", "=", "posted"],
    ]
    if date_from:
        domain.append(["date", ">=", date_from])
    if date_to:
        domain.append(["date", "<=", date_to])

    lines = await async_read_group(
        "account.move.line",
        domain=domain,
        fields=["debit", "credit", "balance"],
        groupby=["account_id"],
        order="account_id",
    )

    # Group by income vs expense
    income_lines = []
    expense_lines = []
    total_income = 0.0
    total_expense = 0.0

    for line in lines:
        account_type = line.get("account_type", "")
        balance = abs(line.get("balance", 0))
        entry = {
            "account_id": line.get("account_id"),
            "debit": line.get("debit", 0),
            "credit": line.get("credit", 0),
            "balance": balance,
            "account_type": account_type,
        }
        if "income" in account_type:
            income_lines.append(entry)
            total_income += balance
        else:
            expense_lines.append(entry)
            total_expense += balance

    return {
        "income": income_lines,
        "expense": expense_lines,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_profit": total_income - total_expense,
    }


async def get_balance_sheet(date_to=None, uid=1, context=None):
    """Get balance sheet data grouped by account type."""
    domain: list[Any] = [
        ["account_id.account_type", "in", [
            "asset_receivable", "asset_cash", "asset_current",
            "asset_non_current", "asset_prepayments", "asset_fixed",
            "liability_payable", "liability_credit_card",
            "liability_current", "liability_non_current",
            "equity", "equity_unaffected",
        ]],
        ["parent_state", "=", "posted"],
    ]
    if date_to:
        domain.append(["date", "<=", date_to])

    lines = await async_read_group(
        "account.move.line",
        domain=domain,
        fields=["debit", "credit", "balance"],
        groupby=["account_id"],
        order="account_id",
    )

    assets = []
    liabilities = []
    equity = []
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0

    for line in lines:
        account_type = line.get("account_type", "")
        bal = line.get("balance", 0)
        entry = {
            "account_id": line.get("account_id"),
            "debit": line.get("debit", 0),
            "credit": line.get("credit", 0),
            "balance": bal,
            "account_type": account_type,
        }
        if account_type.startswith("asset"):
            assets.append(entry)
            total_assets += bal
        elif account_type.startswith("liability"):
            liabilities.append(entry)
            total_liabilities += abs(bal)
        else:
            equity.append(entry)
            total_equity += abs(bal)

    return {
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
    }


async def get_aged_receivable(uid=1, context=None):
    """Get aged receivable report."""
    today = date.today()

    domain: list[Any] = [
        ["account_id.account_type", "=", "asset_receivable"],
        ["parent_state", "=", "posted"],
        ["reconciled", "=", False],
        ["balance", "!=", 0],
    ]

    result_data = await async_search_read(
        "account.move.line",
        domain=domain,
        fields=["partner_id", "date_maturity", "balance", "move_id"],
        order="partner_id, date_maturity",
        limit=10000,
    )
    lines = result_data.get("records", [])

    result = []
    for line in lines:
        due = line.get("date_maturity") or today.isoformat()
        if isinstance(due, str):
            due = datetime.strptime(due, "%Y-%m-%d").date()
        days = (today - due).days
        bucket = (
            "current" if days <= 0
            else "1_30" if days <= 30
            else "31_60" if days <= 60
            else "61_90" if days <= 90
            else "90_plus"
        )
        result.append({**line, "days_overdue": max(0, days), "bucket": bucket})

    return {"records": result, "total": len(result)}


async def get_aged_payable(uid=1, context=None):
    """Get aged payable report."""
    today = date.today()

    domain: list[Any] = [
        ["account_id.account_type", "=", "liability_payable"],
        ["parent_state", "=", "posted"],
        ["reconciled", "=", False],
        ["balance", "!=", 0],
    ]

    result_data = await async_search_read(
        "account.move.line",
        domain=domain,
        fields=["partner_id", "date_maturity", "balance", "move_id"],
        order="partner_id, date_maturity",
        limit=10000,
    )
    lines = result_data.get("records", [])

    result = []
    for line in lines:
        due = line.get("date_maturity") or today.isoformat()
        if isinstance(due, str):
            due = datetime.strptime(due, "%Y-%m-%d").date()
        days = (today - due).days
        bucket = (
            "current" if days <= 0
            else "1_30" if days <= 30
            else "31_60" if days <= 60
            else "61_90" if days <= 90
            else "90_plus"
        )
        result.append({**line, "days_overdue": max(0, days), "bucket": bucket})

    return {"records": result, "total": len(result)}


# --- Bank Reconciliation ---

BANK_STATEMENT_FIELDS = [
    "id", "name", "journal_id", "date", "balance_start",
    "balance_end_real", "line_ids",
    "create_date", "write_date",
]

BANK_STATEMENT_LINE_FIELDS = [
    "id", "statement_id", "date", "payment_ref", "partner_id",
    "amount", "amount_currency", "currency_id",
    "is_reconciled", "move_id",
]


async def list_bank_statements(uid=1, context=None, domain=None, offset=0, limit=50, order="date desc"):
    d = domain or []
    return await async_search_read(
        "account.bank.statement",
        domain=d,
        fields=BANK_STATEMENT_FIELDS,
        offset=offset,
        limit=limit,
        order=order,
    )


async def get_bank_statement(statement_id, uid=1, context=None):
    data = await async_get("account.bank.statement", statement_id, BANK_STATEMENT_FIELDS)
    if data is None:
        return None
    lines = await async_get_related(
        "account.bank.statement", statement_id, "statement_id",
        "account.bank.statement.line", BANK_STATEMENT_LINE_FIELDS,
    )
    data["lines"] = lines
    return data


async def list_unreconciled_lines(journal_id=None, uid=1, context=None):
    domain: list[Any] = [["is_reconciled", "=", False], ["amount", "!=", 0]]
    if journal_id:
        domain.append(["journal_id", "=", journal_id])
    result = await async_search_read(
        "account.bank.statement.line",
        domain=domain,
        fields=BANK_STATEMENT_LINE_FIELDS,
        order="date desc",
        limit=10000,
    )
    return {"records": result.get("records", []), "total": result.get("total", 0)}


async def reconcile_statement_line(line_id, counterpart_ids=None, uid=1, context=None):
    """Reconcile a bank statement line with counterpart journal items."""
    await async_update(
        "account.bank.statement.line",
        line_id,
        {"is_reconciled": True},
        uid=uid,
    )
    return await async_get("account.bank.statement.line", line_id, BANK_STATEMENT_LINE_FIELDS) or {}


# --- Journal Entries ---

JOURNAL_ENTRY_FIELDS = [
    "id", "name", "ref", "date", "journal_id", "state",
    "line_ids", "amount_total", "partner_id",
    "create_date", "write_date",
]


async def list_journal_entries(uid=1, context=None, domain=None, offset=0, limit=50, order="date desc"):
    d = list(domain) if domain else []
    d.append(["move_type", "=", "entry"])
    return await async_search_read(
        "account.move",
        domain=d,
        fields=JOURNAL_ENTRY_FIELDS,
        offset=offset,
        limit=limit,
        order=order,
    )


async def create_journal_entry(vals, uid=1, context=None):
    entry_vals = {**vals, "move_type": "entry"}
    return await async_create("account.move", entry_vals, uid=uid, fields=JOURNAL_ENTRY_FIELDS)
