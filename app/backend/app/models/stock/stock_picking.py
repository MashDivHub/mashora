"""
Stock Picking, Move, and Move Line models.

Maps to existing PostgreSQL tables: stock_picking, stock_move, stock_move_line
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Integer, String, Boolean, ForeignKey, Numeric, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin


class StockPicking(Base, TimestampMixin, CompanyMixin):
    """Maps to stock_picking table."""

    __tablename__ = "stock_picking"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    origin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    note: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    scheduled_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_done: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    picking_type_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_picking_type.id", ondelete="SET NULL"), nullable=True
    )
    partner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    location_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    location_dest_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    move_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sale_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sale_order.id", ondelete="SET NULL"), nullable=True
    )
    backorder_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_picking.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Relationships
    picking_type: Mapped[Optional["StockPickingType"]] = relationship(  # type: ignore[name-defined]
        "StockPickingType", foreign_keys=[picking_type_id]
    )
    location_src: Mapped[Optional["StockLocation"]] = relationship(  # type: ignore[name-defined]
        "StockLocation", foreign_keys=[location_id]
    )
    location_dest: Mapped[Optional["StockLocation"]] = relationship(  # type: ignore[name-defined]
        "StockLocation", foreign_keys=[location_dest_id]
    )
    move_lines: Mapped[List["StockMove"]] = relationship(
        "StockMove", back_populates="picking", foreign_keys="StockMove.picking_id"
    )

    def __repr__(self) -> str:
        return f"<StockPicking id={self.id} name={self.name!r} state={self.state!r}>"


class StockMove(Base, TimestampMixin, CompanyMixin):
    """Maps to stock_move table."""

    __tablename__ = "stock_move"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    date_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    product_uom: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    product_uom_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    quantity_done: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    location_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    location_dest_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    picking_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_picking.id", ondelete="SET NULL"), nullable=True
    )
    picking_type_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_picking_type.id", ondelete="SET NULL"), nullable=True
    )
    origin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    description_picking: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    price_unit: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    origin_returned_move_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_move.id", ondelete="SET NULL"), nullable=True
    )
    warehouse_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_warehouse.id", ondelete="SET NULL"), nullable=True
    )
    sale_line_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("sale_order_line.id", ondelete="SET NULL"), nullable=True
    )
    purchase_line_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("purchase_order_line.id", ondelete="SET NULL"), nullable=True
    )
    scrapped: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    propagate_cancel: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Relationships
    picking: Mapped[Optional["StockPicking"]] = relationship(
        "StockPicking", back_populates="move_lines", foreign_keys=[picking_id]
    )
    product: Mapped[Optional["ProductProduct"]] = relationship(  # type: ignore[name-defined]
        "ProductProduct", foreign_keys=[product_id]
    )
    move_line_ids: Mapped[List["StockMoveLine"]] = relationship(
        "StockMoveLine", back_populates="move", foreign_keys="StockMoveLine.move_id"
    )

    def __repr__(self) -> str:
        return f"<StockMove id={self.id} state={self.state!r} qty={self.product_uom_qty}>"


class StockMoveLine(Base, TimestampMixin, CompanyMixin):
    """Maps to stock_move_line table."""

    __tablename__ = "stock_move_line"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    picking_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_picking.id", ondelete="SET NULL"), nullable=True
    )
    move_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_move.id", ondelete="SET NULL"), nullable=True
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="SET NULL"), nullable=True
    )
    product_uom_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("uom_uom.id", ondelete="SET NULL"), nullable=True
    )
    product_uom_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    qty_done: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    location_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    location_dest_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    lot_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_lot.id", ondelete="SET NULL"), nullable=True
    )
    lot_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    package_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_quant_package.id", ondelete="SET NULL"), nullable=True
    )
    result_package_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_quant_package.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    description_picking: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)

    # Relationships
    move: Mapped[Optional["StockMove"]] = relationship(
        "StockMove", back_populates="move_line_ids", foreign_keys=[move_id]
    )
    lot: Mapped[Optional["StockLot"]] = relationship(  # type: ignore[name-defined]
        "StockLot", foreign_keys=[lot_id]
    )

    def __repr__(self) -> str:
        return f"<StockMoveLine id={self.id} qty_done={self.qty_done}>"
