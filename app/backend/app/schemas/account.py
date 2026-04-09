"""
Pydantic schemas for the Accounting module.

Covers: account.move (invoices/bills/entries), account.move.line (journal items),
account.journal, account.account (chart of accounts), account.tax, account.payment.
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


# --- account.move (Invoices / Bills / Journal Entries) ---

class InvoiceLineCreate(BaseModel):
    """Create/update an invoice line."""
    product_id: Optional[int] = None
    name: str = ""
    quantity: float = 1.0
    price_unit: float = 0.0
    discount: float = 0.0
    account_id: Optional[int] = None
    tax_ids: list[int] = Field(default_factory=list)
    analytic_distribution: Optional[dict[str, float]] = None


class InvoiceCreate(BaseModel):
    """Create a new invoice/bill/entry."""
    move_type: Literal[
        "entry", "out_invoice", "out_refund",
        "in_invoice", "in_refund", "out_receipt", "in_receipt"
    ] = "out_invoice"
    partner_id: Optional[int] = None
    journal_id: Optional[int] = None
    invoice_date: Optional[date] = None
    date: Optional[date] = None
    ref: Optional[str] = None
    currency_id: Optional[int] = None
    fiscal_position_id: Optional[int] = None
    invoice_payment_term_id: Optional[int] = None
    lines: list[InvoiceLineCreate] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    """Update an existing draft invoice."""
    partner_id: Optional[int] = None
    invoice_date: Optional[date] = None
    date: Optional[date] = None
    ref: Optional[str] = None
    currency_id: Optional[int] = None
    fiscal_position_id: Optional[int] = None
    invoice_payment_term_id: Optional[int] = None


class InvoiceLineUpdate(BaseModel):
    """Update a single invoice line."""
    line_id: int
    product_id: Optional[int] = None
    name: Optional[str] = None
    quantity: Optional[float] = None
    price_unit: Optional[float] = None
    discount: Optional[float] = None
    account_id: Optional[int] = None
    tax_ids: Optional[list[int]] = None


class InvoiceListParams(BaseModel):
    """Parameters for listing invoices."""
    move_type: Optional[list[str]] = Field(
        default=None,
        description="Filter by type: out_invoice, in_invoice, etc."
    )
    state: Optional[list[str]] = Field(
        default=None,
        description="Filter by state: draft, posted, cancel"
    )
    payment_state: Optional[list[str]] = Field(
        default=None,
        description="Filter: not_paid, paid, partial, in_payment, reversed"
    )
    partner_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = Field(default=None, description="Search by name, ref, or partner")
    offset: int = 0
    limit: int = 40
    order: str = "date desc, name desc"


# --- account.payment ---

class PaymentCreate(BaseModel):
    """Register a payment."""
    payment_type: Literal["inbound", "outbound"] = "inbound"
    partner_id: Optional[int] = None
    amount: float
    date: Optional[date] = None
    journal_id: Optional[int] = None
    currency_id: Optional[int] = None
    payment_method_line_id: Optional[int] = None
    ref: Optional[str] = None


class PaymentRegisterFromInvoice(BaseModel):
    """Register payment against specific invoices via wizard."""
    invoice_ids: list[int]
    amount: Optional[float] = None
    date: Optional[date] = None
    journal_id: Optional[int] = None
    payment_method_line_id: Optional[int] = None


class PaymentListParams(BaseModel):
    """Parameters for listing payments."""
    payment_type: Optional[str] = None
    state: Optional[list[str]] = None
    partner_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "date desc, name desc"


# --- account.account (Chart of Accounts) ---

class AccountListParams(BaseModel):
    """Parameters for listing GL accounts."""
    account_type: Optional[list[str]] = None
    internal_group: Optional[list[str]] = None
    reconcile: Optional[bool] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 200
    order: str = "code asc"


class AccountCreate(BaseModel):
    """Create a new GL account."""
    name: str
    code: str
    account_type: str
    reconcile: bool = False
    tax_ids: list[int] = Field(default_factory=list)
    currency_id: Optional[int] = None


# --- account.journal ---

class JournalListParams(BaseModel):
    """Parameters for listing journals."""
    type: Optional[list[str]] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "sequence asc"


# --- account.tax ---

class TaxListParams(BaseModel):
    """Parameters for listing taxes."""
    type_tax_use: Optional[str] = None
    active: Optional[bool] = True
    search: Optional[str] = None
    offset: int = 0
    limit: int = 100
    order: str = "sequence asc"
