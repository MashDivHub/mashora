"""
Stock/Inventory module API endpoints.

Provides REST API for:
- Transfers/Pickings (CRUD + lifecycle: confirm, assign, validate, unreserve)
- Stock Levels (quants)
- Locations & Warehouses
- Picking Types
- Inventory Dashboard
"""
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call
from app.schemas.stock import (
    PickingCreate,
    PickingListParams,
    PickingUpdate,
    QuantListParams,
    LocationListParams,
    InventoryAdjustmentListParams,
    InventoryCountBody,
    InventoryApplyBody,
    ScrapListParams,
    ScrapCreate,
    LotListParams,
    LotCreate,
    LotUpdate,
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
    list_inventory_adjustments,
    set_inventory_quantity,
    apply_inventory_adjustment,
    list_scraps,
    create_scrap,
    validate_scrap,
    create_return,
    list_lots,
    get_lot,
    create_lot,
    update_lot,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# Transfers / Pickings
# ============================================

@router.post("/transfers")
async def get_transfers(params: PickingListParams | None = None, user: CurrentUser = Depends(get_current_user)):
    """List transfers (receipts, deliveries, internal) with filters."""
    p = params or PickingListParams()
    return await orm_call(list_pickings, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


@router.get("/transfers/{picking_id}")
async def get_transfer_detail(picking_id: int, user: CurrentUser = Depends(get_current_user)):
    """Get full transfer details including moves and move lines."""
    result = await orm_call(get_picking, picking_id=picking_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Transfer {picking_id} not found")
    return result


@router.post("/transfers/create", status_code=201)
async def create_transfer(body: PickingCreate, user: CurrentUser = Depends(get_current_user)):
    """Create a new transfer."""
    vals = body.model_dump(exclude={"moves"}, exclude_none=True)
    moves = [m.model_dump(exclude_none=True) for m in body.moves] if body.moves else None
    return await orm_call(create_picking, vals=vals, moves=moves, uid=_uid(user), context=_ctx(user))


@router.put("/transfers/{picking_id}")
async def update_transfer(picking_id: int, body: PickingUpdate, user: CurrentUser = Depends(get_current_user)):
    """Update a draft transfer."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_picking, picking_id=picking_id, vals=vals, uid=_uid(user), context=_ctx(user))


@router.post("/transfers/{picking_id}/confirm")
async def confirm_transfer(picking_id: int, user: CurrentUser = Depends(get_current_user)):
    """Confirm a draft transfer."""
    return await orm_call(confirm_picking, picking_id=picking_id, uid=_uid(user), context=_ctx(user))


@router.post("/transfers/{picking_id}/assign")
async def check_availability(picking_id: int, user: CurrentUser = Depends(get_current_user)):
    """Check availability / reserve stock for the transfer."""
    return await orm_call(assign_picking, picking_id=picking_id, uid=_uid(user), context=_ctx(user))


@router.post("/transfers/{picking_id}/validate")
async def validate_transfer(picking_id: int, user: CurrentUser = Depends(get_current_user)):
    """Validate and complete the transfer."""
    return await orm_call(validate_picking, picking_id=picking_id, uid=_uid(user), context=_ctx(user))


@router.post("/transfers/{picking_id}/unreserve")
async def unreserve_transfer(picking_id: int, user: CurrentUser = Depends(get_current_user)):
    """Release reserved stock."""
    return await orm_call(unreserve_picking, picking_id=picking_id, uid=_uid(user), context=_ctx(user))


@router.post("/transfers/{picking_id}/cancel")
async def cancel_transfer(picking_id: int, user: CurrentUser = Depends(get_current_user)):
    """Cancel a transfer."""
    return await orm_call(cancel_picking, picking_id=picking_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Stock Levels (Quants)
# ============================================

@router.post("/stock")
async def get_stock_levels(params: QuantListParams | None = None, user: CurrentUser = Depends(get_current_user)):
    """Query current stock levels by product, location, lot."""
    p = params or QuantListParams()
    return await orm_call(list_quants, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


# ============================================
# Locations
# ============================================

@router.post("/locations")
async def get_locations(params: LocationListParams | None = None, user: CurrentUser = Depends(get_current_user)):
    """List stock locations."""
    p = params or LocationListParams()
    return await orm_call(list_locations, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


# ============================================
# Warehouses
# ============================================

@router.get("/warehouses")
async def get_warehouses(user: CurrentUser = Depends(get_current_user)):
    """List all warehouses."""
    return await orm_call(list_warehouses, uid=_uid(user), context=_ctx(user))


# ============================================
# Picking Types
# ============================================

@router.get("/picking-types")
async def get_picking_types(user: CurrentUser = Depends(get_current_user)):
    """List all picking types with their counters."""
    return await orm_call(list_picking_types, uid=_uid(user), context=_ctx(user))


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard(user: CurrentUser = Depends(get_current_user)):
    """Get inventory dashboard summary metrics."""
    return await orm_call(get_inventory_dashboard, uid=_uid(user), context=_ctx(user))


# ============================================
# Inventory Adjustments
# ============================================

@router.post("/inventory/adjustments")
async def get_inventory_adjustments(
    params: InventoryAdjustmentListParams | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    """List stock quants for inventory adjustment (internal locations only)."""
    p = params or InventoryAdjustmentListParams()
    domain = []
    if p.product_id:
        domain.append(["product_id", "=", p.product_id])
    if p.location_id:
        domain.append(["location_id", "=", p.location_id])
    if p.lot_id:
        domain.append(["lot_id", "=", p.lot_id])
    if p.search:
        domain.append("|")
        domain.append(["product_id.name", "ilike", p.search])
        domain.append(["location_id.complete_name", "ilike", p.search])
    return await orm_call(
        list_inventory_adjustments,
        uid=_uid(user), context=_ctx(user),
        domain=domain, offset=p.offset, limit=p.limit, order=p.order,
    )


@router.post("/inventory/adjustments/{quant_id}/count")
async def set_inventory_count(
    quant_id: int,
    body: InventoryCountBody,
    user: CurrentUser = Depends(get_current_user),
):
    """Set the counted quantity for an inventory adjustment quant."""
    return await orm_call(
        set_inventory_quantity,
        quant_id=quant_id, inventory_quantity=body.inventory_quantity,
        uid=_uid(user), context=_ctx(user),
    )


@router.post("/inventory/adjustments/apply")
async def apply_adjustments(
    body: InventoryApplyBody,
    user: CurrentUser = Depends(get_current_user),
):
    """Apply inventory adjustments for the given quant IDs."""
    return await orm_call(
        apply_inventory_adjustment,
        quant_ids=body.quant_ids,
        uid=_uid(user), context=_ctx(user),
    )


# ============================================
# Scraps
# ============================================

@router.post("/scraps")
async def get_scraps(
    params: ScrapListParams | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    """List scrap orders."""
    p = params or ScrapListParams()
    domain = []
    if p.product_id:
        domain.append(["product_id", "=", p.product_id])
    if p.state:
        domain.append(["state", "=", p.state])
    if p.search:
        domain.append(["product_id.name", "ilike", p.search])
    return await orm_call(
        list_scraps,
        uid=_uid(user), context=_ctx(user),
        domain=domain, offset=p.offset, limit=p.limit, order=p.order,
    )


@router.post("/scraps/create", status_code=201)
async def create_scrap_order(
    body: ScrapCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new scrap order."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(create_scrap, vals=vals, uid=_uid(user), context=_ctx(user))


@router.post("/scraps/{scrap_id}/validate")
async def validate_scrap_order(
    scrap_id: int,
    user: CurrentUser = Depends(get_current_user),
):
    """Validate (confirm) a scrap order."""
    return await orm_call(validate_scrap, scrap_id=scrap_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Returns
# ============================================

@router.post("/transfers/{picking_id}/return")
async def return_transfer(
    picking_id: int,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a return transfer for the given picking."""
    result = await orm_call(create_return, picking_id=picking_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Transfer {picking_id} not found")
    return result


# ============================================
# Lots / Serial Numbers
# ============================================

@router.post("/lots")
async def get_lots(
    params: LotListParams | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    """List lot/serial numbers."""
    p = params or LotListParams()
    domain = []
    if p.product_id:
        domain.append(["product_id", "=", p.product_id])
    if p.search:
        domain.append(["name", "ilike", p.search])
    return await orm_call(
        list_lots,
        uid=_uid(user), context=_ctx(user),
        domain=domain, offset=p.offset, limit=p.limit, order=p.order,
    )


@router.get("/lots/{lot_id}")
async def get_lot_detail(
    lot_id: int,
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single lot/serial number by ID."""
    result = await orm_call(get_lot, lot_id=lot_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Lot {lot_id} not found")
    return result


@router.post("/lots/create", status_code=201)
async def create_lot_record(
    body: LotCreate,
    user: CurrentUser = Depends(get_current_user),
):
    """Create a new lot/serial number."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(create_lot, vals=vals, uid=_uid(user), context=_ctx(user))


@router.put("/lots/{lot_id}")
async def update_lot_record(
    lot_id: int,
    body: LotUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    """Update an existing lot/serial number."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_lot, lot_id=lot_id, vals=vals, uid=_uid(user), context=_ctx(user))
