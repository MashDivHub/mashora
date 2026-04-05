"""
Pydantic schemas for the Stock/Inventory module.

Covers: stock.picking (transfers), stock.move (movements), stock.quant (stock levels),
stock.location, stock.warehouse.
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


class StockMoveCreate(BaseModel):
    """Create a stock move within a picking."""
    product_id: int
    name: str = ""
    product_uom_qty: float = 1.0
    product_uom_id: Optional[int] = None
    location_id: Optional[int] = None
    location_dest_id: Optional[int] = None


class PickingCreate(BaseModel):
    """Create a new transfer (receipt/delivery/internal)."""
    picking_type_id: int
    partner_id: Optional[int] = None
    location_id: Optional[int] = None
    location_dest_id: Optional[int] = None
    scheduled_date: Optional[datetime] = None
    origin: Optional[str] = None
    move_type: Literal["direct", "one"] = "direct"
    priority: str = "0"
    moves: list[StockMoveCreate] = Field(default_factory=list)


class PickingUpdate(BaseModel):
    """Update an existing draft picking."""
    partner_id: Optional[int] = None
    scheduled_date: Optional[datetime] = None
    origin: Optional[str] = None
    move_type: Optional[str] = None
    priority: Optional[str] = None


class PickingListParams(BaseModel):
    """Parameters for listing pickings."""
    picking_type_id: Optional[int] = None
    picking_type_code: Optional[str] = Field(default=None, description="Filter: incoming, outgoing, internal")
    state: Optional[list[str]] = Field(default=None, description="Filter: draft, waiting, confirmed, assigned, done, cancel")
    partner_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "scheduled_date desc, name desc"


class QuantListParams(BaseModel):
    """Parameters for listing stock quants (current stock)."""
    product_id: Optional[int] = None
    location_id: Optional[int] = None
    lot_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    search: Optional[str] = None
    on_hand: bool = True
    offset: int = 0
    limit: int = 100
    order: str = "product_id asc, location_id asc"


class LocationListParams(BaseModel):
    """Parameters for listing stock locations."""
    usage: Optional[list[str]] = Field(default=None, description="Filter: internal, supplier, customer, view, transit, inventory, production")
    warehouse_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 200
    order: str = "complete_name asc"


# --- Inventory Adjustments ---

class InventoryAdjustmentListParams(BaseModel):
    """Parameters for listing stock quants for inventory adjustment."""
    product_id: Optional[int] = None
    location_id: Optional[int] = None
    lot_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "product_id"


class InventoryCountBody(BaseModel):
    """Body for setting the counted inventory quantity."""
    inventory_quantity: float


class InventoryApplyBody(BaseModel):
    """Body for applying inventory adjustments."""
    quant_ids: list[int]


# --- Scraps ---

class ScrapListParams(BaseModel):
    """Parameters for listing scrap orders."""
    product_id: Optional[int] = None
    state: Optional[str] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "create_date desc"


class ScrapCreate(BaseModel):
    """Create a scrap order."""
    product_id: int
    scrap_qty: float = 1.0
    product_uom_id: Optional[int] = None
    lot_id: Optional[int] = None
    location_id: Optional[int] = None
    scrap_location_id: Optional[int] = None
    picking_id: Optional[int] = None
    origin: Optional[str] = None


# --- Lots/Serials ---

class LotListParams(BaseModel):
    """Parameters for listing lots/serial numbers."""
    product_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "name"


class LotCreate(BaseModel):
    """Create a lot/serial number."""
    name: str
    product_id: int
    company_id: Optional[int] = None
    ref: Optional[str] = None
    note: Optional[str] = None


class LotUpdate(BaseModel):
    """Update a lot/serial number."""
    name: Optional[str] = None
    ref: Optional[str] = None
    note: Optional[str] = None
