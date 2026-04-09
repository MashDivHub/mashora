"""Product Supplier Info model."""
from datetime import date
from typing import Optional
from sqlalchemy import Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class ProductSupplierinfo(Base, TimestampMixin):
    __tablename__ = "product_supplierinfo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(Integer, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_uom_id: Mapped[int] = mapped_column(Integer, nullable=False)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    currency_id: Mapped[int] = mapped_column(Integer, nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    product_tmpl_id: Mapped[int] = mapped_column(Integer, nullable=False)
    delay: Mapped[int] = mapped_column(Integer, nullable=False)
    product_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    min_qty: Mapped[float] = mapped_column(Numeric, nullable=False)
    price: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    discount: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
