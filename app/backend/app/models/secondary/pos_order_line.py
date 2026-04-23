"""SQLAlchemy model for pos_order_line (order line item)."""
from typing import Optional

from sqlalchemy import Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PosOrderLine(Base, TimestampMixin):
    __tablename__ = "pos_order_line"
    __mashora_model__ = "pos.order.line"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pos_order.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    qty: Mapped[Optional[float]] = mapped_column(
        Float, default=1, server_default="1", nullable=True
    )
    price_unit: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    price_subtotal: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    price_subtotal_incl: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    discount: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    tax_ids_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(
        Integer, default=10, server_default="10", nullable=True
    )

    def __repr__(self) -> str:
        return f"<PosOrderLine id={self.id} order_id={self.order_id} name={self.name!r}>"
