"""
Purchase module API endpoints.

Provides REST API for:
- RFQs & Purchase Orders (CRUD + lifecycle actions)
- Order Lines management
- Vendor Bill creation from PO
- Purchase Dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.schemas.purchase import (
    PurchaseOrderCreate,
    PurchaseOrderListParams,
    PurchaseOrderUpdate,
    PurchaseOrderLineCreate,
    PurchaseOrderLineUpdate,
)
from app.services.purchase_service import (
    list_orders,
    get_order,
    create_order,
    update_order,
    confirm_order,
    approve_order,
    cancel_order,
    reset_to_draft,
    lock_order,
    unlock_order,
    create_vendor_bill,
    add_order_line,
    update_order_line,
    delete_order_line,
    get_purchase_dashboard,
)

router = APIRouter(prefix="/purchase", tags=["purchase"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# RFQs & Purchase Orders
# ============================================

@router.post("/orders")
async def get_orders(params: PurchaseOrderListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List RFQs/purchase orders with filters."""
    p = params or PurchaseOrderListParams()
    return await list_orders(params=p.model_dump())


@router.get("/orders/{order_id}")
async def get_order_detail(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get full order details including lines."""
    result = await get_order(order_id=order_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Purchase order {order_id} not found")
    return result


@router.post("/orders/create", status_code=201)
async def create_new_order(body: PurchaseOrderCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new RFQ."""
    vals = body.model_dump(exclude={"lines"}, exclude_none=True)
    lines = [l.model_dump(exclude_none=True) for l in body.lines] if body.lines else None
    return await create_order(vals=vals, lines=lines)


@router.put("/orders/{order_id}")
async def update_existing_order(order_id: int, body: PurchaseOrderUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a draft RFQ."""
    vals = body.model_dump(exclude_none=True)
    return await update_order(order_id=order_id, vals=vals)


@router.post("/orders/{order_id}/confirm")
async def confirm_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Confirm RFQ. Goes to 'to approve' or directly to 'purchase'."""
    return await confirm_order(order_id=order_id)


@router.post("/orders/{order_id}/approve")
async def approve_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Approve an order in 'to approve' state -> 'purchase'."""
    return await approve_order(order_id=order_id)


@router.post("/orders/{order_id}/cancel")
async def cancel_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Cancel an RFQ/PO."""
    return await cancel_order(order_id=order_id)


@router.post("/orders/{order_id}/draft")
async def reset_order_to_draft(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Reset a cancelled order back to draft."""
    return await reset_to_draft(order_id=order_id)


@router.post("/orders/{order_id}/lock")
async def lock_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Lock a confirmed PO."""
    return await lock_order(order_id=order_id)


@router.post("/orders/{order_id}/unlock")
async def unlock_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Unlock a locked PO."""
    return await unlock_order(order_id=order_id)


@router.post("/orders/{order_id}/create-bill")
async def create_bill(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a vendor bill from a confirmed PO."""
    return await create_vendor_bill(order_id=order_id)


# ============================================
# Order Lines
# ============================================

@router.post("/orders/{order_id}/lines")
async def add_line(order_id: int, body: PurchaseOrderLineCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Add a line to an RFQ."""
    return await add_order_line(order_id=order_id, line_vals=body.model_dump(exclude_none=True), )


@router.put("/orders/lines/{line_id}")
async def update_line(line_id: int, body: PurchaseOrderLineUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a specific order line."""
    vals = body.model_dump(exclude={"line_id"}, exclude_none=True)
    return await update_order_line(line_id=line_id, vals=vals)


@router.delete("/orders/{order_id}/lines/{line_id}")
async def remove_line(order_id: int, line_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Remove a line from an RFQ."""
    return await delete_order_line(order_id=order_id, line_id=line_id)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    """Get purchase dashboard summary metrics."""
    return await get_purchase_dashboard()
