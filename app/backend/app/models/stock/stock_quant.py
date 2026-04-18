"""
Stock Quant model.

Maps to existing PostgreSQL table: stock_quant
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Integer, String, ForeignKey, Numeric, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin


class StockQuant(Base, TimestampMixin, CompanyMixin):
    """
    Maps to stock_quant table.

    Represents the on-hand stock of a product at a given location.
    Each quant records the quantity, value, and optional lot/package/owner.
    """

    __tablename__ = "stock_quant"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    location_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    lot_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_lot.id", ondelete="SET NULL"), nullable=True
    )
    # stock_quant_package model is not registered; keep as plain FK-less column
    package_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    reserved_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    inventory_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    inventory_diff_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    inventory_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    in_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    product: Mapped[Optional["ProductProduct"]] = relationship(  # type: ignore[name-defined]
        "ProductProduct", foreign_keys=[product_id]
    )
    location: Mapped[Optional["StockLocation"]] = relationship(  # type: ignore[name-defined]
        "StockLocation", foreign_keys=[location_id]
    )
    lot: Mapped[Optional["StockLot"]] = relationship(  # type: ignore[name-defined]
        "StockLot", foreign_keys=[lot_id]
    )

    def __repr__(self) -> str:
        return (
            f"<StockQuant id={self.id} product_id={self.product_id} "
            f"location_id={self.location_id} quantity={self.quantity}>"
        )
