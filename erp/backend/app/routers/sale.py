"""
Sales module API endpoints.

Provides REST API for:
- Quotations & Sales Orders (CRUD + lifecycle actions)
- Order Lines management
- Invoice creation from SO
- Sales Dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
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


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# Quotations & Sales Orders
# ============================================

@router.post("/orders")
async def get_orders(params: SaleOrderListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List quotations/sales orders with filters."""
    p = params or SaleOrderListParams()
    return await orm_call(list_orders, params=p.model_dump(), uid=_uid(user), context=_ctx(user))


@router.get("/orders/{order_id}")
async def get_order_detail(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get full order details including lines."""
    result = await orm_call(get_order, order_id=order_id, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Sale order {order_id} not found")
    return result


@router.post("/orders/create", status_code=201)
async def create_new_order(body: SaleOrderCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new quotation."""
    vals = body.model_dump(exclude={"lines"}, exclude_none=True)
    lines = [l.model_dump(exclude_none=True) for l in body.lines] if body.lines else None
    return await orm_call(create_order, vals=vals, lines=lines, uid=_uid(user), context=_ctx(user))


@router.put("/orders/{order_id}")
async def update_existing_order(order_id: int, body: SaleOrderUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a draft quotation."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_order, order_id=order_id, vals=vals, uid=_uid(user), context=_ctx(user))


@router.post("/orders/{order_id}/confirm")
async def confirm_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Confirm quotation → sales order. State changes from draft/sent to sale."""
    return await orm_call(confirm_order, order_id=order_id, uid=_uid(user), context=_ctx(user))


@router.post("/orders/{order_id}/cancel")
async def cancel_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Cancel a quotation/order."""
    return await orm_call(cancel_order, order_id=order_id, uid=_uid(user), context=_ctx(user))


@router.post("/orders/{order_id}/draft")
async def reset_order_to_draft(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Reset a cancelled order back to draft."""
    return await orm_call(reset_to_draft, order_id=order_id, uid=_uid(user), context=_ctx(user))


@router.post("/orders/{order_id}/lock")
async def lock_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Lock a confirmed order to prevent modifications."""
    return await orm_call(lock_order, order_id=order_id, uid=_uid(user), context=_ctx(user))


@router.post("/orders/{order_id}/unlock")
async def unlock_existing_order(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Unlock a locked order."""
    return await orm_call(unlock_order, order_id=order_id, uid=_uid(user), context=_ctx(user))


@router.post("/orders/{order_id}/create-invoice")
async def create_invoice(
    order_id: int,
    method: str = Query(
        default="delivered",
        description="Invoicing method: delivered, percentage, fixed",
    ),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Create invoice(s) from a confirmed sales order."""
    return await orm_call(
        create_invoice_from_order,
        order_id=order_id,
        advance_payment_method=method,
        uid=_uid(user),
        context=_ctx(user),
    )


# ============================================
# Order Lines
# ============================================

@router.post("/orders/{order_id}/lines")
async def add_line(order_id: int, body: SaleOrderLineCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Add a line to a quotation."""
    return await orm_call(
        add_order_line,
        order_id=order_id,
        line_vals=body.model_dump(exclude_none=True),
        uid=_uid(user),
        context=_ctx(user),
    )


@router.put("/orders/lines/{line_id}")
async def update_line(line_id: int, body: SaleOrderLineUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a specific order line."""
    vals = body.model_dump(exclude={"line_id"}, exclude_none=True)
    return await orm_call(update_order_line, line_id=line_id, vals=vals, uid=_uid(user), context=_ctx(user))


@router.delete("/orders/{order_id}/lines/{line_id}")
async def remove_line(order_id: int, line_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Remove a line from a quotation."""
    return await orm_call(delete_order_line, order_id=order_id, line_id=line_id, uid=_uid(user), context=_ctx(user))


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    """Get sales dashboard summary metrics."""
    return await orm_call(get_sales_dashboard, uid=_uid(user), context=_ctx(user))
