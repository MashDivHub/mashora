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

from app.core.orm_adapter import orm_call
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
)

router = APIRouter(prefix="/accounting", tags=["accounting"])


# ============================================
# Invoices & Bills
# ============================================

@router.post("/invoices")
async def get_invoices(params: InvoiceListParams | None = None):
    """List invoices/bills with filters."""
    p = params or InvoiceListParams()
    result = await orm_call(list_invoices, params=p.model_dump())
    return result


@router.get("/invoices/{invoice_id}")
async def get_invoice_detail(invoice_id: int):
    """Get full invoice details including lines."""
    result = await orm_call(get_invoice, invoice_id=invoice_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    return result


@router.post("/invoices/create", status_code=201)
async def create_new_invoice(body: InvoiceCreate):
    """Create a new invoice/bill."""
    vals = body.model_dump(exclude={"lines"}, exclude_none=True)
    lines = [l.model_dump(exclude_none=True) for l in body.lines] if body.lines else None
    result = await orm_call(create_invoice, vals=vals, lines=lines)
    return result


@router.put("/invoices/{invoice_id}")
async def update_existing_invoice(invoice_id: int, body: InvoiceUpdate):
    """Update a draft invoice."""
    vals = body.model_dump(exclude_none=True)
    result = await orm_call(update_invoice, invoice_id=invoice_id, vals=vals)
    return result


@router.post("/invoices/{invoice_id}/post")
async def post_existing_invoice(invoice_id: int):
    """Post (validate) a draft invoice. Changes state from draft to posted."""
    result = await orm_call(post_invoice, invoice_id=invoice_id)
    return result


@router.post("/invoices/{invoice_id}/cancel")
async def cancel_existing_invoice(invoice_id: int):
    """Cancel an invoice."""
    result = await orm_call(cancel_invoice, invoice_id=invoice_id)
    return result


@router.post("/invoices/{invoice_id}/reverse")
async def reverse_existing_invoice(
    invoice_id: int,
    reason: str = Query(default="", description="Reason for reversal"),
    date: str | None = Query(default=None, description="Reversal date (YYYY-MM-DD)"),
):
    """Create a reversal (credit note) for a posted invoice."""
    result = await orm_call(
        reverse_invoice,
        invoice_id=invoice_id,
        reason=reason,
        date=date,
    )
    return result


# ============================================
# Invoice Lines
# ============================================

@router.post("/invoices/{invoice_id}/lines")
async def add_line(invoice_id: int, body: InvoiceLineCreate):
    """Add a line to a draft invoice."""
    result = await orm_call(
        add_invoice_line,
        invoice_id=invoice_id,
        line_vals=body.model_dump(exclude_none=True),
    )
    return result


@router.put("/invoices/lines/{line_id}")
async def update_line(line_id: int, body: InvoiceLineUpdate):
    """Update a specific invoice line."""
    vals = body.model_dump(exclude={"line_id"}, exclude_none=True)
    result = await orm_call(update_invoice_line, line_id=line_id, vals=vals)
    return result


@router.delete("/invoices/{invoice_id}/lines/{line_id}")
async def remove_line(invoice_id: int, line_id: int):
    """Remove a line from a draft invoice."""
    result = await orm_call(
        delete_invoice_line,
        invoice_id=invoice_id,
        line_id=line_id,
    )
    return result


# ============================================
# Payments
# ============================================

@router.post("/payments")
async def get_payments(params: PaymentListParams | None = None):
    """List payments with filters."""
    p = params or PaymentListParams()
    result = await orm_call(list_payments, params=p.model_dump())
    return result


@router.post("/payments/register")
async def register_payment(body: PaymentRegisterFromInvoice):
    """Register a payment against specific invoices."""
    result = await orm_call(
        register_payment_for_invoices,
        invoice_ids=body.invoice_ids,
        amount=body.amount,
        date=str(body.date) if body.date else None,
        journal_id=body.journal_id,
        payment_method_line_id=body.payment_method_line_id,
    )
    return result


# ============================================
# Chart of Accounts
# ============================================

@router.post("/accounts")
async def get_accounts(params: AccountListParams | None = None):
    """List GL accounts (chart of accounts)."""
    p = params or AccountListParams()
    result = await orm_call(list_accounts, params=p.model_dump())
    return result


@router.post("/accounts/create", status_code=201)
async def create_account(body: AccountCreate):
    """Create a new GL account."""
    from app.core.orm_adapter import create_record
    result = await orm_call(
        create_record,
        model="account.account",
        vals=body.model_dump(exclude_none=True),
    )
    return result


# ============================================
# Journals
# ============================================

@router.post("/journals")
async def get_journals(params: JournalListParams | None = None):
    """List accounting journals."""
    p = params or JournalListParams()
    result = await orm_call(list_journals, params=p.model_dump())
    return result


# ============================================
# Taxes
# ============================================

@router.post("/taxes")
async def get_taxes(params: TaxListParams | None = None):
    """List tax definitions."""
    p = params or TaxListParams()
    result = await orm_call(list_taxes, params=p.model_dump())
    return result


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard():
    """Get accounting dashboard summary metrics."""
    result = await orm_call(get_accounting_dashboard)
    return result
