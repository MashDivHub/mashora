"""
Pydantic schemas for the Sales module.

Covers: sale.order (quotations/sales orders), sale.order.line (order lines).
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


class SaleOrderLineCreate(BaseModel):
    """Create an order line."""
    product_id: Optional[int] = None
    name: str = ""
    product_uom_qty: float = 1.0
    price_unit: float = 0.0
    discount: float = 0.0
    product_uom_id: Optional[int] = None
    tax_ids: list[int] = Field(default_factory=list)
    display_type: Literal["line_section", "line_note"] | None = None


class SaleOrderCreate(BaseModel):
    """Create a new quotation/sales order."""
    partner_id: int
    date_order: Optional[datetime] = None
    validity_date: Optional[date] = None
    pricelist_id: Optional[int] = None
    payment_term_id: Optional[int] = None
    fiscal_position_id: Optional[int] = None
    client_order_ref: Optional[str] = None
    note: Optional[str] = None
    lines: list[SaleOrderLineCreate] = Field(default_factory=list)


class SaleOrderUpdate(BaseModel):
    """Update an existing draft quotation."""
    partner_id: Optional[int] = None
    validity_date: Optional[date] = None
    pricelist_id: Optional[int] = None
    payment_term_id: Optional[int] = None
    fiscal_position_id: Optional[int] = None
    client_order_ref: Optional[str] = None
    note: Optional[str] = None


class SaleOrderListParams(BaseModel):
    """Parameters for listing sale orders."""
    state: Optional[list[str]] = Field(default=None, description="Filter: draft, sent, sale, cancel")
    invoice_status: Optional[list[str]] = Field(default=None, description="Filter: to invoice, invoiced, upselling, no")
    partner_id: Optional[int] = None
    user_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "date_order desc, name desc"


class SaleOrderLineUpdate(BaseModel):
    """Update a single order line."""
    line_id: int
    product_id: Optional[int] = None
    name: Optional[str] = None
    product_uom_qty: Optional[float] = None
    price_unit: Optional[float] = None
    discount: Optional[float] = None
    tax_ids: Optional[list[int]] = None
