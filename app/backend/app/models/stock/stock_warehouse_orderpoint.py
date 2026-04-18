"""Stock Warehouse Orderpoint — reordering rules."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StockWarehouseOrderpoint(Base):
    __tablename__ = "stock_warehouse_orderpoint"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    warehouse_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stock_warehouse.id", ondelete="CASCADE"), nullable=False,
    )
    location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stock_location.id", ondelete="CASCADE"), nullable=False,
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_product.id", ondelete="CASCADE"), nullable=False,
    )
    replenishment_uom_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, nullable=False)
    route_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    trigger: Mapped[str] = mapped_column(String, nullable=False, server_default="auto")
    snoozed_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    deadline_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    product_min_qty: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="0")
    product_max_qty: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default="0")
    qty_to_order_computed: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    qty_to_order_manual: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")

    create_uid: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    write_uid: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    create_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    write_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
