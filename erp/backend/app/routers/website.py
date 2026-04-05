"""
Website/eCommerce module API endpoints.

Provides REST API for:
- Website configuration
- CMS Pages and Menus
- Product catalog (storefront)
- Shopping cart
- Product categories
- Dashboard
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.core.orm_adapter import orm_call
from app.schemas.website import (
    ProductListParams,
    CategoryListParams,
    CartAddItem,
    CartUpdateItem,
    PageListParams,
    MenuListParams,
)
from app.services.website_service import (
    get_website_config,
    list_pages,
    list_menus,
    list_products,
    get_product,
    list_categories,
    get_cart,
    add_to_cart,
    update_cart_line,
    remove_cart_line,
    clear_cart,
    get_website_dashboard,
)

router = APIRouter(prefix="/website", tags=["website"])


# ============================================
# Website Config
# ============================================

@router.get("/config")
async def website_config(website_id: int | None = Query(default=None)):
    """Get website configuration (name, domain, languages, social links)."""
    return await orm_call(get_website_config, website_id=website_id)


# ============================================
# CMS Pages
# ============================================

@router.post("/pages")
async def get_pages(params: PageListParams | None = None):
    """List CMS pages."""
    p = params or PageListParams()
    return await orm_call(list_pages, params=p.model_dump())


# ============================================
# Menus
# ============================================

@router.post("/menus")
async def get_menus(params: MenuListParams | None = None):
    """List website navigation menus."""
    p = params or MenuListParams()
    return await orm_call(list_menus, params=p.model_dump())


# ============================================
# Product Catalog
# ============================================

@router.post("/products")
async def get_products(params: ProductListParams | None = None):
    """List products for the storefront."""
    p = params or ProductListParams()
    return await orm_call(list_products, params=p.model_dump())


@router.get("/products/{product_id}")
async def get_product_detail(product_id: int):
    """Get product details with variants."""
    result = await orm_call(get_product, product_id=product_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    return result


# ============================================
# Categories
# ============================================

@router.post("/categories")
async def get_categories(params: CategoryListParams | None = None):
    """List product categories (shop navigation)."""
    p = params or CategoryListParams()
    return await orm_call(list_categories, params=p.model_dump())


# ============================================
# Shopping Cart
# ============================================

@router.get("/cart/{order_id}")
async def get_cart_detail(order_id: int):
    """Get shopping cart contents."""
    result = await orm_call(get_cart, order_id=order_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Cart not found")
    return result


@router.post("/cart/{order_id}/add")
async def cart_add(order_id: int, body: CartAddItem):
    """Add a product to the cart."""
    return await orm_call(
        add_to_cart,
        order_id=order_id,
        product_id=body.product_id,
        quantity=body.quantity,
        product_uom_id=body.product_uom_id,
    )


@router.put("/cart/{order_id}/lines/{line_id}")
async def cart_update(order_id: int, line_id: int, body: CartUpdateItem):
    """Update cart line quantity. Set to 0 to remove."""
    return await orm_call(update_cart_line, line_id=line_id, quantity=body.quantity)


@router.delete("/cart/{order_id}/lines/{line_id}")
async def cart_remove(order_id: int, line_id: int):
    """Remove an item from the cart."""
    return await orm_call(remove_cart_line, order_id=order_id, line_id=line_id)


@router.post("/cart/{order_id}/clear")
async def cart_clear(order_id: int):
    """Clear all items from the cart."""
    return await orm_call(clear_cart, order_id=order_id)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard():
    """Get website/eCommerce dashboard metrics."""
    return await orm_call(get_website_dashboard)
