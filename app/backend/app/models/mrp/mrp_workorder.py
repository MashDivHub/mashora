"""
Work Order model.

Maps to PostgreSQL table: mrp_workorder
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CompanyMixin, TimestampMixin


class MrpWorkorder(Base, TimestampMixin, CompanyMixin):
    """Work order within a manufacturing order. Maps to mrp_workorder table."""

    __tablename__ = "mrp_workorder"
    __mashora_model__ = "mrp.workorder"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    production_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("mrp_production.id", ondelete="CASCADE"), nullable=False
    )
    workcenter_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("mrp_workcenter.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending", server_default="pending"
    )
    qty_producing: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    qty_produced: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    qty_remaining: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    date_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_finished: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duration_expected: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    duration: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    sequence: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    # Relationships
    production: Mapped["MrpProduction"] = relationship(
        "MrpProduction", back_populates="workorders", foreign_keys=[production_id]
    )
    workcenter: Mapped[Optional["MrpWorkcenter"]] = relationship(
        "MrpWorkcenter", foreign_keys=[workcenter_id]
    )

    def __repr__(self) -> str:
        return f"<MrpWorkorder id={self.id} name={self.name!r} state={self.state!r}>"
