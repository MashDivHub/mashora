"""
Stock Warehouse, Location, and Picking Type models.

Maps to existing PostgreSQL tables: stock_warehouse, stock_location, stock_picking_type
"""
from typing import Optional, List

from sqlalchemy import Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, CompanyMixin, ActiveMixin


class StockWarehouse(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """Maps to stock_warehouse table."""

    __tablename__ = "stock_warehouse"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    code: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_partner.id", ondelete="SET NULL"), nullable=True
    )
    lot_stock_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    view_location_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    wh_input_stock_loc_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    wh_output_stock_loc_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    wh_pack_stock_loc_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reception_steps: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    delivery_steps: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Relationships
    lot_stock: Mapped[Optional["StockLocation"]] = relationship(
        "StockLocation", foreign_keys=[lot_stock_id]
    )

    def __repr__(self) -> str:
        return f"<StockWarehouse id={self.id} code={self.code!r}>"


class StockLocation(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """Maps to stock_location table."""

    __tablename__ = "stock_location"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    complete_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="CASCADE"), nullable=True
    )
    usage: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    comment: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    posx: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    posy: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    posz: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    barcode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    removal_strategy_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_removal.id", ondelete="SET NULL"), nullable=True
    )
    valuation_in_account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_account.id", ondelete="SET NULL"), nullable=True
    )
    valuation_out_account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("account_account.id", ondelete="SET NULL"), nullable=True
    )
    scrap_location: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    return_location: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    replenish_location: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Self-referential relationship
    parent: Mapped[Optional["StockLocation"]] = relationship(
        "StockLocation", remote_side="StockLocation.id", foreign_keys=[location_id]
    )
    children: Mapped[List["StockLocation"]] = relationship(
        "StockLocation", back_populates="parent", foreign_keys=[location_id]
    )

    def __repr__(self) -> str:
        return f"<StockLocation id={self.id} usage={self.usage!r}>"


class StockPickingType(Base, TimestampMixin, CompanyMixin, ActiveMixin):
    """Maps to stock_picking_type table."""

    __tablename__ = "stock_picking_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[JSONB]] = mapped_column(JSONB, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sequence_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_sequence.id", ondelete="SET NULL"), nullable=True
    )
    sequence_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    default_location_src_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    default_location_dest_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    return_picking_type_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_picking_type.id", ondelete="SET NULL"), nullable=True
    )
    warehouse_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_warehouse.id", ondelete="SET NULL"), nullable=True
    )
    show_entire_packs: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    use_create_lots: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    use_existing_lots: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    show_operations: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    show_reserved: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    reservation_method: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Relationships
    warehouse: Mapped[Optional["StockWarehouse"]] = relationship(
        "StockWarehouse", foreign_keys=[warehouse_id]
    )
    default_location_src: Mapped[Optional["StockLocation"]] = relationship(
        "StockLocation", foreign_keys=[default_location_src_id]
    )
    default_location_dest: Mapped[Optional["StockLocation"]] = relationship(
        "StockLocation", foreign_keys=[default_location_dest_id]
    )

    def __repr__(self) -> str:
        return f"<StockPickingType id={self.id} code={self.code!r}>"
