"""Product Template, Product, Category models."""
from typing import Optional
from sqlalchemy import Boolean, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

class ProductCategory(Base, TimestampMixin):
    __tablename__ = "product_category"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    complete_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    parent_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_properties_definition: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

class ProductTemplate(Base, TimestampMixin):
    __tablename__ = "product_template"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    categ_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uom_id: Mapped[int] = mapped_column(Integer, nullable=False)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sale_delay: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    service_tracking: Mapped[str] = mapped_column(String, nullable=False)
    default_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tracking: Mapped[str] = mapped_column(String, nullable=False, server_default="none")
    invoice_policy: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    purchase_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    description_sale: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    description_purchase: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    list_price: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    volume: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    sale_ok: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    purchase_ok: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    is_storable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_favorite: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    # eCommerce out-of-stock behavior (added via migration 2026_04_17_product_ecommerce_groupb.sql)
    allow_out_of_stock_order: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    out_of_stock_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    available_threshold: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    show_availability: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="false")
    product_variants: Mapped[list["ProductProduct"]] = relationship("ProductProduct", back_populates="product_tmpl", lazy="selectin")

class ProductProduct(Base, TimestampMixin):
    __tablename__ = "product_product"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_tmpl_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_template.id"), nullable=False)
    default_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    barcode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    combination_indices: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    standard_price: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    volume: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    is_favorite: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    product_tmpl: Mapped["ProductTemplate"] = relationship("ProductTemplate", back_populates="product_variants")
