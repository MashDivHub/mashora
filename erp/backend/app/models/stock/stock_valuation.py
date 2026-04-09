"""
Stock Valuation Layer model.

Maps to existing PostgreSQL table: stock_valuation_layer
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Integer, String, ForeignKey, Numeric, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin


class StockValuationLayer(Base, TimestampMixin, CompanyMixin):
    """
    Maps to stock_valuation_layer table.

    Records every inventory valuation event (receipt, delivery, adjustment)
    for products using average cost or FIFO costing methods.
    """

    __tablename__ = "stock_valuation_layer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    uom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    currency_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_currency.id", ondelete="SET NULL"), nullable=True
    )
    unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    remaining_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    remaining_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    stock_move_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_move.id", ondelete="SET NULL"), nullable=True
    )
    stock_valuation_layer_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_valuation_layer.id", ondelete="SET NULL"), nullable=True
    )
    account_move_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_move.id", ondelete="SET NULL"), nullable=True
    )
    account_move_line_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_move_line.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    product: Mapped[Optional["ProductProduct"]] = relationship(  # type: ignore[name-defined]
        "ProductProduct", foreign_keys=[product_id]
    )
    stock_move: Mapped[Optional["StockMove"]] = relationship(  # type: ignore[name-defined]
        "StockMove", foreign_keys=[stock_move_id]
    )

    def __repr__(self) -> str:
        return (
            f"<StockValuationLayer id={self.id} product_id={self.product_id} "
            f"quantity={self.quantity} value={self.value}>"
        )
