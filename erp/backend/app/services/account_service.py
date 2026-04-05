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
from typing import Any, Optional

from app.core.orm_adapter import mashora_env, call_method

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
    "payment_method_line_id", "ref",
    "is_reconciled", "is_matched",
]

ACCOUNT_LIST_FIELDS = [
    "id", "name", "code", "account_type", "internal_group",
    "reconcile", "used", "currency_id", "company_ids",
]

JOURNAL_LIST_FIELDS = [
    "id", "name", "code", "type", "company_id",
    "currency_id", "account_id",
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
    """Build a Mashora domain filter for invoices."""
    domain: list[Any] = []
    if move_type:
        domain.append(["move_type", "in", move_type])
    if state:
        domain.append(["state", "in", state])
    if payment_state:
        domain.append(["payment_state", "in", payment_state])
    if partner_id:
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


def list_invoices(
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
    with mashora_env(uid=uid, context=context) as env:
        Move = env["account.move"]
        total = Move.search_count(domain)
        records = Move.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "date desc, name desc"),
        )
        data = records.read(INVOICE_LIST_FIELDS)
        return {"records": data, "total": total}


def get_invoice(
    invoice_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    """Get full invoice details including lines."""
    with mashora_env(uid=uid, context=context) as env:
        move = env["account.move"].browse(invoice_id)
        if not move.exists():
            return None

        data = move.read(INVOICE_DETAIL_FIELDS)[0]

        # Read invoice lines separately for detailed data
        line_ids = data.get("invoice_line_ids", [])
        if line_ids:
            lines = env["account.move.line"].browse(line_ids)
            data["invoice_lines"] = lines.read(INVOICE_LINE_FIELDS)
        else:
            data["invoice_lines"] = []

        return data


def create_invoice(
    vals: dict,
    lines: Optional[list[dict]] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create an invoice with optional line items."""
    with mashora_env(uid=uid, context=context) as env:
        move_vals = {k: v for k, v in vals.items() if v is not None and k != "lines"}

        # Convert line dicts to Mashora command format
        if lines:
            move_vals["invoice_line_ids"] = []
            for line in lines:
                line_vals = {k: v for k, v in line.items() if v is not None}
                # Convert tax_ids to Mashora command format: [(6, 0, [ids])]
                if "tax_ids" in line_vals:
                    line_vals["tax_ids"] = [(6, 0, line_vals["tax_ids"])]
                move_vals["invoice_line_ids"].append((0, 0, line_vals))

        move = env["account.move"].create(move_vals)
        return move.read(INVOICE_LIST_FIELDS)[0]


def update_invoice(
    invoice_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a draft invoice."""
    with mashora_env(uid=uid, context=context) as env:
        move = env["account.move"].browse(invoice_id)
        if not move.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Invoice {invoice_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        move.write(clean_vals)
        return move.read(INVOICE_LIST_FIELDS)[0]


def post_invoice(
    invoice_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Post (validate) a draft invoice. Changes state to 'posted'."""
    with mashora_env(uid=uid, context=context) as env:
        move = env["account.move"].browse(invoice_id)
        move.action_post()
        return move.read(INVOICE_LIST_FIELDS)[0]


def cancel_invoice(
    invoice_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Cancel a posted invoice via button_draft then button_cancel."""
    with mashora_env(uid=uid, context=context) as env:
        move = env["account.move"].browse(invoice_id)
        move.button_draft()
        move.button_cancel()
        return move.read(INVOICE_LIST_FIELDS)[0]


def reverse_invoice(
    invoice_id: int,
    reason: str = "",
    date: Optional[str] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create a reversal (credit note) for an invoice."""
    with mashora_env(uid=uid, context=context) as env:
        move = env["account.move"].browse(invoice_id)
        wizard_vals = {"reason": reason}
        if date:
            wizard_vals["date"] = date

        # Use the reversal wizard
        ctx = dict(env.context, active_model="account.move", active_ids=[invoice_id])
        wizard = env["account.move.reversal"].with_context(**ctx).create(wizard_vals)
        result = wizard.reverse_moves()

        # Return the created reversal
        if isinstance(result, dict) and result.get("res_id"):
            reversal = env["account.move"].browse(result["res_id"])
            return reversal.read(INVOICE_LIST_FIELDS)[0]
        return {"result": result}


def add_invoice_line(
    invoice_id: int,
    line_vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Add a line to a draft invoice."""
    with mashora_env(uid=uid, context=context) as env:
        move = env["account.move"].browse(invoice_id)
        vals = {k: v for k, v in line_vals.items() if v is not None}
        if "tax_ids" in vals:
            vals["tax_ids"] = [(6, 0, vals["tax_ids"])]
        move.write({"invoice_line_ids": [(0, 0, vals)]})
        return move.read(INVOICE_DETAIL_FIELDS)[0]


def update_invoice_line(
    line_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Update a specific invoice line."""
    with mashora_env(uid=uid, context=context) as env:
        line = env["account.move.line"].browse(line_id)
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "tax_ids" in clean_vals:
            clean_vals["tax_ids"] = [(6, 0, clean_vals["tax_ids"])]
        line.write(clean_vals)
        return line.move_id.read(INVOICE_DETAIL_FIELDS)[0]


def delete_invoice_line(
    invoice_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Remove a line from a draft invoice."""
    with mashora_env(uid=uid, context=context) as env:
        move = env["account.move"].browse(invoice_id)
        move.write({"invoice_line_ids": [(2, line_id, 0)]})
        return move.read(INVOICE_DETAIL_FIELDS)[0]


# --- Payments ---

def list_payments(
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

    with mashora_env(uid=uid, context=context) as env:
        Payment = env["account.payment"]
        total = Payment.search_count(domain)
        records = Payment.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "date desc, name desc"),
        )
        return {"records": records.read(PAYMENT_LIST_FIELDS), "total": total}


def register_payment_for_invoices(
    invoice_ids: list[int],
    amount: Optional[float] = None,
    date: Optional[str] = None,
    journal_id: Optional[int] = None,
    payment_method_line_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Register payment against invoices using the payment wizard."""
    with mashora_env(uid=uid, context=context) as env:
        ctx = dict(
            env.context,
            active_model="account.move",
            active_ids=invoice_ids,
        )
        wizard_vals: dict[str, Any] = {}
        if amount is not None:
            wizard_vals["amount"] = amount
        if date:
            wizard_vals["payment_date"] = date
        if journal_id:
            wizard_vals["journal_id"] = journal_id
        if payment_method_line_id:
            wizard_vals["payment_method_line_id"] = payment_method_line_id

        wizard = env["account.payment.register"].with_context(**ctx).create(wizard_vals)
        result = wizard.action_create_payments()

        # Try to find created payments
        if isinstance(result, dict) and result.get("res_id"):
            payment = env["account.payment"].browse(result["res_id"])
            return payment.read(PAYMENT_LIST_FIELDS)[0]

        return {"result": "Payment registered successfully"}


# --- Chart of Accounts ---

def list_accounts(
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

    with mashora_env(uid=uid, context=context) as env:
        Account = env["account.account"]
        total = Account.search_count(domain)
        records = Account.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 200),
            order=params.get("order", "code asc"),
        )
        return {"records": records.read(ACCOUNT_LIST_FIELDS), "total": total}


# --- Journals ---

def list_journals(
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

    with mashora_env(uid=uid, context=context) as env:
        Journal = env["account.journal"]
        total = Journal.search_count(domain)
        records = Journal.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 50),
            order=params.get("order", "sequence asc"),
        )
        return {"records": records.read(JOURNAL_LIST_FIELDS), "total": total}


# --- Taxes ---

def list_taxes(
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

    with mashora_env(uid=uid, context=context) as env:
        Tax = env["account.tax"]
        total = Tax.search_count(domain)
        records = Tax.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 100),
            order=params.get("order", "sequence asc"),
        )
        return {"records": records.read(TAX_LIST_FIELDS), "total": total}


# --- Dashboard Metrics ---

def get_accounting_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get accounting dashboard summary metrics."""
    with mashora_env(uid=uid, context=context) as env:
        Move = env["account.move"]
        Payment = env["account.payment"]

        # Invoice counts by state
        draft_invoices = Move.search_count([
            ("move_type", "in", ["out_invoice", "out_refund"]),
            ("state", "=", "draft"),
        ])
        unpaid_invoices = Move.search_count([
            ("move_type", "in", ["out_invoice"]),
            ("state", "=", "posted"),
            ("payment_state", "in", ["not_paid", "partial"]),
        ])
        overdue_invoices = Move.search_count([
            ("move_type", "=", "out_invoice"),
            ("state", "=", "posted"),
            ("payment_state", "in", ["not_paid", "partial"]),
            ("invoice_date_due", "<", env.cr.now().date().isoformat()),
        ])

        # Bill counts
        draft_bills = Move.search_count([
            ("move_type", "in", ["in_invoice", "in_refund"]),
            ("state", "=", "draft"),
        ])
        unpaid_bills = Move.search_count([
            ("move_type", "=", "in_invoice"),
            ("state", "=", "posted"),
            ("payment_state", "in", ["not_paid", "partial"]),
        ])

        # Totals for unpaid
        unpaid_invoice_records = Move.search([
            ("move_type", "=", "out_invoice"),
            ("state", "=", "posted"),
            ("payment_state", "in", ["not_paid", "partial"]),
        ], limit=1000)
        total_receivable = sum(r["amount_residual"] for r in unpaid_invoice_records.read(["amount_residual"]))

        unpaid_bill_records = Move.search([
            ("move_type", "=", "in_invoice"),
            ("state", "=", "posted"),
            ("payment_state", "in", ["not_paid", "partial"]),
        ], limit=1000)
        total_payable = sum(r["amount_residual"] for r in unpaid_bill_records.read(["amount_residual"]))

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

def get_trial_balance(date_from=None, date_to=None, uid=1, context=None):
    """Get trial balance data."""
    with mashora_env(uid=uid, context=context) as env:
        domain = [('account_id', '!=', False)]
        if date_from:
            domain.append(('date', '>=', date_from))
        if date_to:
            domain.append(('date', '<=', date_to))

        lines = env['account.move.line'].read_group(
            domain,
            ['account_id', 'debit', 'credit', 'balance'],
            ['account_id'],
            orderby='account_id',
        )
        return {"records": lines, "total": len(lines)}


def get_profit_and_loss(date_from=None, date_to=None, uid=1, context=None):
    """Get P&L report data grouped by account type."""
    with mashora_env(uid=uid, context=context) as env:
        domain = [('account_id.account_type', 'in', [
            'income', 'income_other',
            'expense', 'expense_depreciation', 'expense_direct_cost',
        ])]
        if date_from:
            domain.append(('date', '>=', date_from))
        if date_to:
            domain.append(('date', '<=', date_to))
        domain.append(('parent_state', '=', 'posted'))

        lines = env['account.move.line'].read_group(
            domain,
            ['account_id', 'debit', 'credit', 'balance'],
            ['account_id'],
            orderby='account_id',
        )

        # Group by income vs expense
        income_lines = []
        expense_lines = []
        total_income = 0
        total_expense = 0

        for line in lines:
            account = env['account.account'].browse(line['account_id'][0])
            entry = {
                'account_id': line['account_id'],
                'debit': line['debit'],
                'credit': line['credit'],
                'balance': abs(line['balance']),
                'account_type': account.account_type,
            }
            if 'income' in account.account_type:
                income_lines.append(entry)
                total_income += abs(line['balance'])
            else:
                expense_lines.append(entry)
                total_expense += abs(line['balance'])

        return {
            "income": income_lines,
            "expense": expense_lines,
            "total_income": total_income,
            "total_expense": total_expense,
            "net_profit": total_income - total_expense,
        }


def get_balance_sheet(date_to=None, uid=1, context=None):
    """Get balance sheet data grouped by account type."""
    with mashora_env(uid=uid, context=context) as env:
        domain = [('account_id.account_type', 'in', [
            'asset_receivable', 'asset_cash', 'asset_current',
            'asset_non_current', 'asset_prepayments', 'asset_fixed',
            'liability_payable', 'liability_credit_card',
            'liability_current', 'liability_non_current',
            'equity', 'equity_unaffected',
        ])]
        if date_to:
            domain.append(('date', '<=', date_to))
        domain.append(('parent_state', '=', 'posted'))

        lines = env['account.move.line'].read_group(
            domain,
            ['account_id', 'debit', 'credit', 'balance'],
            ['account_id'],
            orderby='account_id',
        )

        assets = []
        liabilities = []
        equity = []
        total_assets = 0
        total_liabilities = 0
        total_equity = 0

        for line in lines:
            account = env['account.account'].browse(line['account_id'][0])
            entry = {
                'account_id': line['account_id'],
                'debit': line['debit'],
                'credit': line['credit'],
                'balance': line['balance'],
                'account_type': account.account_type,
            }
            if account.account_type.startswith('asset'):
                assets.append(entry)
                total_assets += line['balance']
            elif account.account_type.startswith('liability'):
                liabilities.append(entry)
                total_liabilities += abs(line['balance'])
            else:
                equity.append(entry)
                total_equity += abs(line['balance'])

        return {
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
        }


def get_aged_receivable(uid=1, context=None):
    """Get aged receivable report."""
    with mashora_env(uid=uid, context=context) as env:
        from datetime import date, timedelta
        today = date.today()

        domain = [
            ('account_id.account_type', '=', 'asset_receivable'),
            ('parent_state', '=', 'posted'),
            ('reconciled', '=', False),
            ('balance', '!=', 0),
        ]

        lines = env['account.move.line'].search_read(
            domain,
            ['partner_id', 'date_maturity', 'balance', 'move_id'],
            order='partner_id, date_maturity',
        )

        # Bucket: current, 1-30, 31-60, 61-90, 90+
        result = []
        for line in lines:
            due = line.get('date_maturity') or today
            if isinstance(due, str):
                from datetime import datetime
                due = datetime.strptime(due, '%Y-%m-%d').date()
            days = (today - due).days
            bucket = 'current' if days <= 0 else '1_30' if days <= 30 else '31_60' if days <= 60 else '61_90' if days <= 90 else '90_plus'
            result.append({**line, 'days_overdue': max(0, days), 'bucket': bucket})

        return {"records": result, "total": len(result)}


def get_aged_payable(uid=1, context=None):
    """Get aged payable report."""
    with mashora_env(uid=uid, context=context) as env:
        from datetime import date
        today = date.today()

        domain = [
            ('account_id.account_type', '=', 'liability_payable'),
            ('parent_state', '=', 'posted'),
            ('reconciled', '=', False),
            ('balance', '!=', 0),
        ]

        lines = env['account.move.line'].search_read(
            domain,
            ['partner_id', 'date_maturity', 'balance', 'move_id'],
            order='partner_id, date_maturity',
        )

        result = []
        for line in lines:
            due = line.get('date_maturity') or today
            if isinstance(due, str):
                from datetime import datetime
                due = datetime.strptime(due, '%Y-%m-%d').date()
            days = (today - due).days
            bucket = 'current' if days <= 0 else '1_30' if days <= 30 else '31_60' if days <= 60 else '61_90' if days <= 90 else '90_plus'
            result.append({**line, 'days_overdue': max(0, days), 'bucket': bucket})

        return {"records": result, "total": len(result)}


# --- Bank Reconciliation ---

BANK_STATEMENT_FIELDS = [
    "id", "name", "journal_id", "date", "balance_start",
    "balance_end_real", "state", "line_ids",
    "create_date", "write_date",
]

BANK_STATEMENT_LINE_FIELDS = [
    "id", "statement_id", "date", "payment_ref", "partner_id",
    "amount", "amount_currency", "currency_id",
    "is_reconciled", "move_id",
]


def list_bank_statements(uid=1, context=None, domain=None, offset=0, limit=50, order="date desc"):
    with mashora_env(uid=uid, context=context) as env:
        d = domain or []
        total = env['account.bank.statement'].search_count(d)
        records = env['account.bank.statement'].search(d, offset=offset, limit=limit, order=order)
        data = records.read(BANK_STATEMENT_FIELDS)
        return {"records": data, "total": total}


def get_bank_statement(statement_id, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        record = env['account.bank.statement'].browse(statement_id)
        if not record.exists():
            return None
        data = record.read(BANK_STATEMENT_FIELDS)[0]
        if data.get('line_ids'):
            lines = env['account.bank.statement.line'].browse(data['line_ids'])
            data['lines'] = lines.read(BANK_STATEMENT_LINE_FIELDS)
        return data


def list_unreconciled_lines(journal_id=None, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        domain = [('is_reconciled', '=', False), ('amount', '!=', 0)]
        if journal_id:
            domain.append(('journal_id', '=', journal_id))
        lines = env['account.bank.statement.line'].search_read(
            domain,
            BANK_STATEMENT_LINE_FIELDS,
            order='date desc',
        )
        return {"records": lines, "total": len(lines)}


def reconcile_statement_line(line_id, counterpart_ids=None, uid=1, context=None):
    """Reconcile a bank statement line with counterpart journal items."""
    with mashora_env(uid=uid, context=context) as env:
        line = env['account.bank.statement.line'].browse(line_id)
        if counterpart_ids:
            counterparts = env['account.move.line'].browse(counterpart_ids)
            line.reconcile(lines_vals_list=[{
                'counterpart_aml_id': cp.id
            } for cp in counterparts])
        else:
            # Auto-reconcile
            line.action_undo_reconciliation() if line.is_reconciled else None
        return line.read(BANK_STATEMENT_LINE_FIELDS)[0]


# --- Journal Entries ---

JOURNAL_ENTRY_FIELDS = [
    "id", "name", "ref", "date", "journal_id", "state",
    "line_ids", "amount_total", "partner_id",
    "create_date", "write_date",
]


def list_journal_entries(uid=1, context=None, domain=None, offset=0, limit=50, order="date desc"):
    with mashora_env(uid=uid, context=context) as env:
        d = domain or []
        d.append(('move_type', '=', 'entry'))
        total = env['account.move'].search_count(d)
        records = env['account.move'].search(d, offset=offset, limit=limit, order=order)
        data = records.read(JOURNAL_ENTRY_FIELDS)
        return {"records": data, "total": total}


def create_journal_entry(vals, uid=1, context=None):
    with mashora_env(uid=uid, context=context) as env:
        vals['move_type'] = 'entry'
        record = env['account.move'].create(vals)
        return record.read(JOURNAL_ENTRY_FIELDS)[0]
