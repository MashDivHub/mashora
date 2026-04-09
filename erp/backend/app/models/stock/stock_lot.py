"""
Stock Lot / Serial Number model.

Maps to existing PostgreSQL table: stock_lot
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin


class StockLot(Base, TimestampMixin, CompanyMixin):
    """
    Maps to stock_lot table.

    Represents a lot or serial number for a trackable product.
    """

    __tablename__ = "stock_lot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    product_uom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    expiration_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    use_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    removal_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    alert_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    product_qty: Mapped[Optional[float]] = mapped_column(nullable=True)

    # Relationships
    product: Mapped[Optional["ProductProduct"]] = relationship(  # type: ignore[name-defined]
        "ProductProduct", foreign_keys=[product_id]
    )

    def __repr__(self) -> str:
        return f"<StockLot id={self.id} name={self.name!r} product_id={self.product_id}>"
