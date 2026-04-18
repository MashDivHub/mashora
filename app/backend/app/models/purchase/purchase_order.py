"""Purchase Order and Order Line models."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, Integer, Numeric, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

class PurchaseOrder(Base, TimestampMixin):
    __tablename__ = "purchase_order"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(Integer, nullable=False)
    dest_address_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fiscal_position_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    payment_term_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    incoterm_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    picking_type_id: Mapped[int] = mapped_column(Integer, nullable=False)
    project_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reminder_date_before_receipt: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    priority: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    origin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    partner_ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String, nullable=True, server_default="draft")
    invoice_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    receipt_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    incoterm_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount_untaxed: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    amount_tax: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    amount_total: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    amount_total_cc: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    currency_rate: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    locked: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    acknowledged: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    receipt_reminder_email: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    date_order: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    date_approve: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_planned: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_calendar_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    effective_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    order_line: Mapped[list["PurchaseOrderLine"]] = relationship("PurchaseOrderLine", back_populates="order", lazy="selectin")
    def __repr__(self): return f"<PurchaseOrder(id={self.id}, name={self.name}, state={self.state})>"

class PurchaseOrderLine(Base, TimestampMixin):
    __tablename__ = "purchase_order_line"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_uom_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("purchase_order.id"), nullable=False)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sale_line_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    orderpoint_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    location_final_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    qty_received_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    display_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_description_variants: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    analytic_distribution: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    product_qty: Mapped[float] = mapped_column(Numeric, nullable=False)
    discount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    price_unit: Mapped[float] = mapped_column(Numeric, nullable=False)
    price_subtotal: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    price_total: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    price_tax: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    technical_price_unit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    product_uom_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    qty_invoiced: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    qty_received: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    qty_received_manual: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    qty_to_invoice: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    is_downpayment: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    propagate_cancel: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    date_planned: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="order_line")
    product: Mapped[Optional["ProductProduct"]] = relationship(  # type: ignore[name-defined]
        "ProductProduct",
        primaryjoin="foreign(PurchaseOrderLine.product_id) == ProductProduct.id",
        viewonly=True,
        lazy="noload",
    )
    def __repr__(self): return f"<PurchaseOrderLine(id={self.id}, order_id={self.order_id})>"
