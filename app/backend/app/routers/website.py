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
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
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
    get_checkout_info,
    set_checkout_addresses,
    confirm_checkout,
    get_customer_addresses,
    get_website_dashboard,
    list_blog_posts,
    get_blog_post,
    list_blogs,
    publish_page,
    publish_product,
)

router = APIRouter(prefix="/website", tags=["website"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# Website Config
# ============================================

@router.get("/config")
async def website_config(website_id: int | None = Query(default=None), user: CurrentUser | None = Depends(get_optional_user)):
    """Get website configuration (name, domain, languages, social links)."""
    return await get_website_config(website_id=website_id)


@router.get("/homepage")
async def get_homepage():
    """Return the published homepage (page with url='/') or 404."""
    from app.services.base import async_search_read
    result = await async_search_read(
        "website.page",
        domain=[["url", "=", "/"], ["website_published", "=", True]],
        fields=["id", "name", "url", "content", "website_published"],
        limit=1,
    )
    records = result.get("records", [])
    if not records:
        raise HTTPException(status_code=404, detail="No homepage configured")
    return records[0]


# ============================================
# CMS Pages
# ============================================

@router.post("/pages")
async def get_pages(params: PageListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List CMS pages."""
    p = params or PageListParams()
    return await list_pages(params=p.model_dump())


# ============================================
# Menus
# ============================================

@router.post("/menus")
async def get_menus(params: MenuListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List website navigation menus."""
    p = params or MenuListParams()
    return await list_menus(params=p.model_dump())


# ============================================
# Product Catalog
# ============================================

@router.post("/products")
async def get_products(params: ProductListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List products for the storefront."""
    p = params or ProductListParams()
    return await list_products(params=p.model_dump())


@router.get("/products/{product_id}")
async def get_product_detail(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get product details with variants."""
    result = await get_product(product_id=product_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    return result


# ============================================
# Categories
# ============================================

@router.post("/categories")
async def get_categories(params: CategoryListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List product categories (shop navigation)."""
    p = params or CategoryListParams()
    return await list_categories(params=p.model_dump())


# ============================================
# Shopping Cart
# ============================================

@router.get("/cart/{order_id}")
async def get_cart_detail(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get shopping cart contents."""
    result = await get_cart(order_id=order_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Cart not found")
    return result


@router.post("/cart/{order_id}/add")
async def cart_add(order_id: int, body: CartAddItem, user: CurrentUser | None = Depends(get_optional_user)):
    """Add a product to the cart."""
    return await add_to_cart(order_id=order_id, product_id=body.product_id, quantity=body.quantity, product_uom_id=body.product_uom_id, )


@router.put("/cart/{order_id}/lines/{line_id}")
async def cart_update(order_id: int, line_id: int, body: CartUpdateItem, user: CurrentUser | None = Depends(get_optional_user)):
    """Update cart line quantity. Set to 0 to remove."""
    return await update_cart_line(line_id=line_id, quantity=body.quantity)


@router.delete("/cart/{order_id}/lines/{line_id}")
async def cart_remove(order_id: int, line_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Remove an item from the cart."""
    return await remove_cart_line(order_id=order_id, line_id=line_id)


@router.post("/cart/{order_id}/clear")
async def cart_clear(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Clear all items from the cart."""
    return await clear_cart(order_id=order_id)


# ============================================
# Checkout
# ============================================

@router.get("/checkout/{order_id}")
async def get_checkout(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get checkout info including addresses and available payment terms."""
    result = await get_checkout_info(order_id=order_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


@router.post("/checkout/{order_id}/addresses")
async def set_checkout_addresses_endpoint(
    order_id: int,
    invoice_partner_id: int = Query(...),
    shipping_partner_id: Optional[int] = Query(default=None),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Set billing and shipping addresses for checkout."""
    result = await set_checkout_addresses(order_id=order_id, invoice_partner_id=invoice_partner_id, shipping_partner_id=shipping_partner_id, )
    if result is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


@router.post("/checkout/{order_id}/confirm")
async def confirm_checkout_endpoint(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Confirm the sale order (checkout complete)."""
    result = await confirm_checkout(order_id=order_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


@router.get("/checkout/{order_id}/addresses")
async def get_addresses(
    order_id: int,
    partner_id: int = Query(...),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get all addresses for a customer (for address selection at checkout)."""
    return await get_customer_addresses(partner_id=partner_id)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    """Get website/eCommerce dashboard metrics."""
    return await get_website_dashboard()


# ============================================
# Blog
# ============================================

@router.post("/blog/posts")
async def blog_posts(params: dict | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """List blog posts."""
    return await list_blog_posts(params=params or {})

@router.get("/blog/posts/{post_id}")
async def blog_post_detail(post_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get a single blog post."""
    result = await get_blog_post(post_id=post_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return result

@router.get("/blog/categories")
async def blog_categories(user: CurrentUser | None = Depends(get_optional_user)):
    """List blog categories."""
    return await list_blogs()


# ============================================
# Publish actions
# ============================================

@router.post("/pages/{page_id}/publish")
async def toggle_page_publish(page_id: int, publish: bool = True, user: CurrentUser | None = Depends(get_optional_user)):
    """Publish or unpublish a CMS page."""
    return await publish_page(page_id=page_id, publish=publish)

@router.post("/products/{product_id}/publish")
async def toggle_product_publish(product_id: int, publish: bool = True, user: CurrentUser | None = Depends(get_optional_user)):
    """Publish or unpublish a product."""
    return await publish_product(product_id=product_id, publish=publish)
