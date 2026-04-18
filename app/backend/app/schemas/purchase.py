"""
Pydantic schemas for the Purchase module.

Covers: purchase.order (RFQs/purchase orders), purchase.order.line.
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


class PurchaseOrderLineCreate(BaseModel):
    """Create a purchase order line."""
    product_id: Optional[int] = None
    name: str = ""
    product_qty: float = 1.0
    price_unit: float = 0.0
    discount: float = 0.0
    product_uom_id: Optional[int] = None
    tax_ids: list[int] = Field(default_factory=list)
    date_planned: Optional[datetime] = None
    display_type: Literal["line_section", "line_subsection", "line_note"] | None = None


class PurchaseOrderCreate(BaseModel):
    """Create a new RFQ/purchase order."""
    partner_id: int
    date_order: Optional[datetime] = None
    date_planned: Optional[datetime] = None
    fiscal_position_id: Optional[int] = None
    payment_term_id: Optional[int] = None
    incoterm_id: Optional[int] = None
    partner_ref: Optional[str] = None
    origin: Optional[str] = None
    dest_address_id: Optional[int] = None
    note: Optional[str] = None
    priority: Optional[str] = None
    user_id: Optional[int] = None
    picking_type_id: Optional[int] = None
    lines: list[PurchaseOrderLineCreate] = Field(default_factory=list)


class PurchaseOrderUpdate(BaseModel):
    """Update an existing draft RFQ."""
    partner_id: Optional[int] = None
    date_planned: Optional[datetime] = None
    fiscal_position_id: Optional[int] = None
    payment_term_id: Optional[int] = None
    incoterm_id: Optional[int] = None
    partner_ref: Optional[str] = None
    origin: Optional[str] = None
    dest_address_id: Optional[int] = None
    note: Optional[str] = None
    priority: Optional[str] = None
    user_id: Optional[int] = None
    picking_type_id: Optional[int] = None


class PurchaseOrderListParams(BaseModel):
    """Parameters for listing purchase orders."""
    state: Optional[list[str]] = Field(default=None, description="Filter: draft, sent, to approve, purchase, cancel")
    invoice_status: Optional[list[str]] = Field(default=None, description="Filter: no, to invoice, invoiced")
    partner_id: Optional[int] = None
    user_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "date_order desc, name desc"


class PurchaseOrderLineUpdate(BaseModel):
    """Update a single purchase order line."""
    line_id: int
    product_id: Optional[int] = None
    name: Optional[str] = None
    product_qty: Optional[float] = None
    price_unit: Optional[float] = None
    discount: Optional[float] = None
    tax_ids: Optional[list[int]] = None
    date_planned: Optional[datetime] = None
