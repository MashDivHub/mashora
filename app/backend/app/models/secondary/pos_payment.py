"""SQLAlchemy model for pos_payment (payment record on a pos_order)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PosPayment(Base, TimestampMixin):
    __tablename__ = "pos_payment"
    __mashora_model__ = "pos.payment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pos_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pos_order.id", ondelete="CASCADE"), nullable=False
    )
    payment_method_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pos_payment_method.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default="now()", nullable=True
    )
    card_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    transaction_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ticket: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<PosPayment id={self.id} order={self.pos_order_id} amount={self.amount}>"
