"""
Sales module API endpoints.

Provides REST API for:
- Quotations & Sales Orders (CRUD + lifecycle actions)
- Order Lines management
- Invoice creation from SO
- Sales Dashboard
"""
from fastapi import APIRouter, HTTPException, Query

from app.core.orm_adapter import orm_call
from app.schemas.sale import (
    SaleOrderCreate,
    SaleOrderListParams,
    SaleOrderUpdate,
    SaleOrderLineCreate,
    SaleOrderLineUpdate,
)
from app.services.sale_service import (
    list_orders,
    get_order,
    create_order,
    update_order,
    confirm_order,
    cancel_order,
    reset_to_draft,
    lock_order,
    unlock_order,
    create_invoice_from_order,
    add_order_line,
    update_order_line,
    delete_order_line,
    get_sales_dashboard,
)

router = APIRouter(prefix="/sales", tags=["sales"])


# ============================================
# Quotations & Sales Orders
# ============================================

@router.post("/orders")
async def get_orders(params: SaleOrderListParams | None = None):
    """List quotations/sales orders with filters."""
    p = params or SaleOrderListParams()
    return await orm_call(list_orders, params=p.model_dump())


@router.get("/orders/{order_id}")
async def get_order_detail(order_id: int):
    """Get full order details including lines."""
    result = await orm_call(get_order, order_id=order_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Sale order {order_id} not found")
    return result


@router.post("/orders/create", status_code=201)
async def create_new_order(body: SaleOrderCreate):
    """Create a new quotation."""
    vals = body.model_dump(exclude={"lines"}, exclude_none=True)
    lines = [l.model_dump(exclude_none=True) for l in body.lines] if body.lines else None
    return await orm_call(create_order, vals=vals, lines=lines)


@router.put("/orders/{order_id}")
async def update_existing_order(order_id: int, body: SaleOrderUpdate):
    """Update a draft quotation."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_order, order_id=order_id, vals=vals)


@router.post("/orders/{order_id}/confirm")
async def confirm_existing_order(order_id: int):
    """Confirm quotation → sales order. State changes from draft/sent to sale."""
    return await orm_call(confirm_order, order_id=order_id)


@router.post("/orders/{order_id}/cancel")
async def cancel_existing_order(order_id: int):
    """Cancel a quotation/order."""
    return await orm_call(cancel_order, order_id=order_id)


@router.post("/orders/{order_id}/draft")
async def reset_order_to_draft(order_id: int):
    """Reset a cancelled order back to draft."""
    return await orm_call(reset_to_draft, order_id=order_id)


@router.post("/orders/{order_id}/lock")
async def lock_existing_order(order_id: int):
    """Lock a confirmed order to prevent modifications."""
    return await orm_call(lock_order, order_id=order_id)


@router.post("/orders/{order_id}/unlock")
async def unlock_existing_order(order_id: int):
    """Unlock a locked order."""
    return await orm_call(unlock_order, order_id=order_id)


@router.post("/orders/{order_id}/create-invoice")
async def create_invoice(
    order_id: int,
    method: str = Query(
        default="delivered",
        description="Invoicing method: delivered, percentage, fixed",
    ),
):
    """Create invoice(s) from a confirmed sales order."""
    return await orm_call(
        create_invoice_from_order,
        order_id=order_id,
        advance_payment_method=method,
    )


# ============================================
# Order Lines
# ============================================

@router.post("/orders/{order_id}/lines")
async def add_line(order_id: int, body: SaleOrderLineCreate):
    """Add a line to a quotation."""
    return await orm_call(
        add_order_line,
        order_id=order_id,
        line_vals=body.model_dump(exclude_none=True),
    )


@router.put("/orders/lines/{line_id}")
async def update_line(line_id: int, body: SaleOrderLineUpdate):
    """Update a specific order line."""
    vals = body.model_dump(exclude={"line_id"}, exclude_none=True)
    return await orm_call(update_order_line, line_id=line_id, vals=vals)


@router.delete("/orders/{order_id}/lines/{line_id}")
async def remove_line(order_id: int, line_id: int):
    """Remove a line from a quotation."""
    return await orm_call(delete_order_line, order_id=order_id, line_id=line_id)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard():
    """Get sales dashboard summary metrics."""
    return await orm_call(get_sales_dashboard)
