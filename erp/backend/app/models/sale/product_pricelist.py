"""Product Pricelist models."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class ProductPricelist(Base, TimestampMixin):
    __tablename__ = "product_pricelist"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[int] = mapped_column(Integer, nullable=False)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")

class ProductPricelistItem(Base, TimestampMixin):
    __tablename__ = "product_pricelist_item"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pricelist_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    categ_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_tmpl_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    applied_on: Mapped[str] = mapped_column(String, nullable=False)
    compute_price: Mapped[str] = mapped_column(String, nullable=False)
    base: Mapped[str] = mapped_column(String, nullable=False)
    min_quantity: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    fixed_price: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    price_discount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    price_surcharge: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    date_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
