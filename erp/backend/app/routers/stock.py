"""
Stock/Inventory module API endpoints.

Provides REST API for:
- Transfers/Pickings (CRUD + lifecycle: confirm, assign, validate, unreserve)
- Stock Levels (quants)
- Locations & Warehouses
- Picking Types
- Inventory Dashboard
"""
from fastapi import APIRouter, HTTPException

from app.core.orm_adapter import orm_call
from app.schemas.stock import (
    PickingCreate,
    PickingListParams,
    PickingUpdate,
    QuantListParams,
    LocationListParams,
)
from app.services.stock_service import (
    list_pickings,
    get_picking,
    create_picking,
    update_picking,
    confirm_picking,
    assign_picking,
    validate_picking,
    unreserve_picking,
    cancel_picking,
    list_quants,
    list_locations,
    list_warehouses,
    list_picking_types,
    get_inventory_dashboard,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


# ============================================
# Transfers / Pickings
# ============================================

@router.post("/transfers")
async def get_transfers(params: PickingListParams | None = None):
    """List transfers (receipts, deliveries, internal) with filters."""
    p = params or PickingListParams()
    return await orm_call(list_pickings, params=p.model_dump())


@router.get("/transfers/{picking_id}")
async def get_transfer_detail(picking_id: int):
    """Get full transfer details including moves and move lines."""
    result = await orm_call(get_picking, picking_id=picking_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Transfer {picking_id} not found")
    return result


@router.post("/transfers/create", status_code=201)
async def create_transfer(body: PickingCreate):
    """Create a new transfer."""
    vals = body.model_dump(exclude={"moves"}, exclude_none=True)
    moves = [m.model_dump(exclude_none=True) for m in body.moves] if body.moves else None
    return await orm_call(create_picking, vals=vals, moves=moves)


@router.put("/transfers/{picking_id}")
async def update_transfer(picking_id: int, body: PickingUpdate):
    """Update a draft transfer."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_picking, picking_id=picking_id, vals=vals)


@router.post("/transfers/{picking_id}/confirm")
async def confirm_transfer(picking_id: int):
    """Confirm a draft transfer."""
    return await orm_call(confirm_picking, picking_id=picking_id)


@router.post("/transfers/{picking_id}/assign")
async def check_availability(picking_id: int):
    """Check availability / reserve stock for the transfer."""
    return await orm_call(assign_picking, picking_id=picking_id)


@router.post("/transfers/{picking_id}/validate")
async def validate_transfer(picking_id: int):
    """Validate and complete the transfer."""
    return await orm_call(validate_picking, picking_id=picking_id)


@router.post("/transfers/{picking_id}/unreserve")
async def unreserve_transfer(picking_id: int):
    """Release reserved stock."""
    return await orm_call(unreserve_picking, picking_id=picking_id)


@router.post("/transfers/{picking_id}/cancel")
async def cancel_transfer(picking_id: int):
    """Cancel a transfer."""
    return await orm_call(cancel_picking, picking_id=picking_id)


# ============================================
# Stock Levels (Quants)
# ============================================

@router.post("/stock")
async def get_stock_levels(params: QuantListParams | None = None):
    """Query current stock levels by product, location, lot."""
    p = params or QuantListParams()
    return await orm_call(list_quants, params=p.model_dump())


# ============================================
# Locations
# ============================================

@router.post("/locations")
async def get_locations(params: LocationListParams | None = None):
    """List stock locations."""
    p = params or LocationListParams()
    return await orm_call(list_locations, params=p.model_dump())


# ============================================
# Warehouses
# ============================================

@router.get("/warehouses")
async def get_warehouses():
    """List all warehouses."""
    return await orm_call(list_warehouses)


# ============================================
# Picking Types
# ============================================

@router.get("/picking-types")
async def get_picking_types():
    """List all picking types with their counters."""
    return await orm_call(list_picking_types)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard():
    """Get inventory dashboard summary metrics."""
    return await orm_call(get_inventory_dashboard)
