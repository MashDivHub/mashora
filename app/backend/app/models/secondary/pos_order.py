"""SQLAlchemy model for pos_order (POS sale order)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, CompanyMixin


class PosOrder(Base, TimestampMixin, CompanyMixin):
    __tablename__ = "pos_order"
    __mashora_model__ = "pos.order"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    pos_reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pos_session.id", ondelete="RESTRICT"), nullable=False
    )
    config_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("pos_config.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    partner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    date_order: Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default="now()", nullable=True
    )
    state: Mapped[Optional[str]] = mapped_column(
        String, default="draft", server_default="'draft'", nullable=True
    )
    amount_total: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    amount_tax: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    amount_paid: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    amount_return: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pricelist_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_pricelist.id", ondelete="SET NULL"), nullable=True
    )
    fiscal_position_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    table_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("restaurant_table.id", ondelete="SET NULL"), nullable=True
    )
    customer_count: Mapped[Optional[int]] = mapped_column(
        Integer, default=1, server_default="1", nullable=True
    )
    tracking_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    def __repr__(self) -> str:
        return f"<PosOrder id={self.id} name={self.name!r} state={self.state}>"
