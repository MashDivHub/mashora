"""
Accounting module API endpoints.

Provides REST API for:
- Invoices & Bills (CRUD + lifecycle actions)
- Payments (registration, listing)
- Chart of Accounts
- Journals
- Taxes
- Dashboard metrics
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.schemas.account import (
    InvoiceCreate,
    InvoiceListParams,
    InvoiceUpdate,
    InvoiceLineCreate,
    InvoiceLineUpdate,
    PaymentListParams,
    PaymentRegisterFromInvoice,
    AccountListParams,
    AccountCreate,
    JournalListParams,
    TaxListParams,
)
from app.services.account_service import (
    list_invoices,
    get_invoice,
    create_invoice,
    update_invoice,
    post_invoice,
    cancel_invoice,
    reverse_invoice,
    add_invoice_line,
    update_invoice_line,
    delete_invoice_line,
    list_payments,
    register_payment_for_invoices,
    list_accounts,
    list_journals,
    list_taxes,
    get_accounting_dashboard,
    get_trial_balance,
    get_profit_and_loss,
    get_balance_sheet,
    get_aged_receivable,
    get_aged_payable,
    list_bank_statements,
    get_bank_statement,
    list_unreconciled_lines,
    reconcile_statement_line,
    list_journal_entries,
    create_journal_entry,
)

router = APIRouter(prefix="/accounting", tags=["accounting"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# Invoices & Bills
# ============================================

@router.post("/invoices")
async def get_invoices(params: InvoiceListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List invoices/bills with filters."""
    p = params or InvoiceListParams()
    result = await list_invoices(params=p.model_dump())
    return result


@router.get("/invoices/{invoice_id}")
async def get_invoice_detail(invoice_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get full invoice details including lines."""
    result = await get_invoice(invoice_id=invoice_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    return result


@router.post("/invoices/create", status_code=201)
async def create_new_invoice(body: InvoiceCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new invoice/bill."""
    vals = body.model_dump(exclude={"lines"}, exclude_none=True)
    lines = [l.model_dump(exclude_none=True) for l in body.lines] if body.lines else None
    result = await create_invoice(vals=vals, lines=lines)
    return result


@router.put("/invoices/{invoice_id}")
async def update_existing_invoice(invoice_id: int, body: InvoiceUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a draft invoice."""
    vals = body.model_dump(exclude_none=True)
    result = await update_invoice(invoice_id=invoice_id, vals=vals)
    return result


@router.post("/invoices/{invoice_id}/post")
async def post_existing_invoice(invoice_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Post (validate) a draft invoice. Changes state from draft to posted."""
    result = await post_invoice(invoice_id=invoice_id)
    return result


@router.post("/invoices/{invoice_id}/cancel")
async def cancel_existing_invoice(invoice_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Cancel an invoice."""
    result = await cancel_invoice(invoice_id=invoice_id)
    return result


@router.post("/invoices/{invoice_id}/reverse")
async def reverse_existing_invoice(
    invoice_id: int,
    reason: str = Query(default="", description="Reason for reversal"),
    date: str | None = Query(default=None, description="Reversal date (YYYY-MM-DD)"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Create a reversal (credit note) for a posted invoice."""
    result = await reverse_invoice(invoice_id=invoice_id, reason=reason, date=date, )
    return result


# ============================================
# Invoice Lines
# ============================================

@router.post("/invoices/{invoice_id}/lines")
async def add_line(invoice_id: int, body: InvoiceLineCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Add a line to a draft invoice."""
    result = await add_invoice_line(invoice_id=invoice_id, line_vals=body.model_dump(exclude_none=True), )
    return result


@router.put("/invoices/lines/{line_id}")
async def update_line(line_id: int, body: InvoiceLineUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a specific invoice line."""
    vals = body.model_dump(exclude={"line_id"}, exclude_none=True)
    result = await update_invoice_line(line_id=line_id, vals=vals)
    return result


@router.delete("/invoices/{invoice_id}/lines/{line_id}")
async def remove_line(invoice_id: int, line_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Remove a line from a draft invoice."""
    result = await delete_invoice_line(invoice_id=invoice_id, line_id=line_id, )
    return result


# ============================================
# Payments
# ============================================

@router.post("/payments")
async def get_payments(params: PaymentListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List payments with filters."""
    p = params or PaymentListParams()
    result = await list_payments(params=p.model_dump())
    return result


@router.post("/payments/register")
async def register_payment(body: PaymentRegisterFromInvoice, user: CurrentUser | None = Depends(get_optional_user)):
    """Register a payment against specific invoices."""
    result = await register_payment_for_invoices(invoice_ids=body.invoice_ids, amount=body.amount, date=str(body.date) if body.date else None, journal_id=body.journal_id, payment_method_line_id=body.payment_method_line_id, )
    return result


# ============================================
# Chart of Accounts
# ============================================

@router.post("/accounts")
async def get_accounts(params: AccountListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List GL accounts (chart of accounts)."""
    p = params or AccountListParams()
    result = await list_accounts(params=p.model_dump())
    return result


@router.post("/accounts/create", status_code=201)
async def create_account(body: AccountCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new GL account."""
    from app.services.base import async_create
    result = await async_create("account.account", vals=body.model_dump(exclude_none=True))
    return result


# ============================================
# Journals
# ============================================

@router.post("/journals")
async def get_journals(params: JournalListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List accounting journals."""
    p = params or JournalListParams()
    result = await list_journals(params=p.model_dump())
    return result


# ============================================
# Taxes
# ============================================

@router.post("/taxes")
async def get_taxes(params: TaxListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List tax definitions."""
    p = params or TaxListParams()
    result = await list_taxes(params=p.model_dump())
    return result


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    """Get accounting dashboard summary metrics."""
    result = await get_accounting_dashboard()
    return result


# ============================================
# Financial Reports
# ============================================

@router.get("/reports/trial-balance")
async def trial_balance(
    date_from: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get trial balance data."""
    result = await get_trial_balance(date_from=date_from, date_to=date_to)
    return result


@router.get("/reports/profit-and-loss")
async def profit_and_loss(
    date_from: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get profit and loss report grouped by account type."""
    result = await get_profit_and_loss(date_from=date_from, date_to=date_to)
    return result


@router.get("/reports/balance-sheet")
async def balance_sheet(
    date_to: Optional[str] = Query(default=None, description="As-of date (YYYY-MM-DD)"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get balance sheet data grouped by account type."""
    result = await get_balance_sheet(date_to=date_to)
    return result


@router.get("/reports/aged-receivable")
async def aged_receivable(user: CurrentUser | None = Depends(get_optional_user)):
    """Get aged receivable report bucketed by days overdue."""
    result = await get_aged_receivable()
    return result


@router.get("/reports/aged-payable")
async def aged_payable(user: CurrentUser | None = Depends(get_optional_user)):
    """Get aged payable report bucketed by days overdue."""
    result = await get_aged_payable()
    return result


# ============================================
# Bank Reconciliation
# ============================================

@router.get("/bank-statements/unreconciled")
async def get_unreconciled_lines(
    journal_id: Optional[int] = Query(default=None, description="Filter by journal ID"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """List unreconciled bank statement lines."""
    result = await list_unreconciled_lines(journal_id=journal_id)
    return result


@router.post("/bank-statements")
async def get_bank_statements(
    offset: int = Query(default=0, description="Pagination offset"),
    limit: int = Query(default=50, description="Page size"),
    order: str = Query(default="date desc", description="Sort order"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """List bank statements."""
    result = await list_bank_statements(offset=offset, limit=limit, order=order)
    return result


@router.get("/bank-statements/{statement_id}")
async def get_bank_statement_detail(statement_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get a bank statement with its lines."""
    result = await get_bank_statement(statement_id=statement_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Bank statement {statement_id} not found")
    return result


@router.post("/bank-statements/lines/{line_id}/reconcile")
async def reconcile_line(
    line_id: int,
    counterpart_ids: list[int] | None = None,
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Reconcile a bank statement line with counterpart journal items."""
    result = await reconcile_statement_line(line_id=line_id, counterpart_ids=counterpart_ids, )
    return result


# ============================================
# Journal Entries
# ============================================

@router.post("/journal-entries")
async def get_journal_entries(
    offset: int = Query(default=0, description="Pagination offset"),
    limit: int = Query(default=50, description="Page size"),
    order: str = Query(default="date desc", description="Sort order"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """List journal entries."""
    result = await list_journal_entries(offset=offset, limit=limit, order=order)
    return result


@router.post("/journal-entries/create", status_code=201)
async def create_new_journal_entry(body: dict, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new journal entry."""
    result = await create_journal_entry(vals=body)
    return result
