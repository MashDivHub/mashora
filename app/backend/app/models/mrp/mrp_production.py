"""
Manufacturing Order (Production) model.

Maps to PostgreSQL table: mrp_production
"""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CompanyMixin, TimestampMixin


class MrpProduction(Base, TimestampMixin, CompanyMixin):
    """Manufacturing order. Maps to mrp_production table."""

    __tablename__ = "mrp_production"
    __mashora_model__ = "mrp.production"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    origin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    product_qty: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, server_default="1.0"
    )
    product_uom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    bom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("mrp_bom.id", ondelete="SET NULL"), nullable=True
    )
    date_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_finished: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    state: Mapped[str] = mapped_column(
        String(32), nullable=False, default="draft", server_default="draft"
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    priority: Mapped[str] = mapped_column(
        String(1), nullable=False, default="0", server_default="0"
    )
    lot_producing_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_lot.id", ondelete="SET NULL"), nullable=True
    )
    qty_producing: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    qty_produced: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )

    # Relationships
    bom: Mapped[Optional["MrpBom"]] = relationship(  # type: ignore[name-defined]
        "MrpBom", foreign_keys=[bom_id]
    )
    workorders: Mapped[List["MrpWorkorder"]] = relationship(
        "MrpWorkorder", back_populates="production", foreign_keys="MrpWorkorder.production_id"
    )

    def __repr__(self) -> str:
        return f"<MrpProduction id={self.id} name={self.name!r} state={self.state!r}>"
