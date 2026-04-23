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
from pydantic import BaseModel

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.model_registry import get_model_class
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


@router.get("/contact-info")
async def website_contact_info(user: CurrentUser | None = Depends(get_optional_user)):
    """Return public company contact info (email, phone, address, socials)."""
    from app.services.base import async_search_read
    # Get the first website
    website_result = await async_search_read(
        "website",
        [],
        ["id", "name", "company_id",
         "social_facebook", "social_twitter", "social_instagram",
         "social_linkedin", "social_youtube", "social_tiktok"],
        limit=1,
    )
    website_records = website_result.get("records", [])
    if not website_records:
        return {"company": None, "social": {}}
    website = website_records[0]

    company_id = website.get("company_id")
    if isinstance(company_id, list) and company_id:
        company_id_int = company_id[0]
    elif isinstance(company_id, int):
        company_id_int = company_id
    else:
        company_id_int = None

    company: dict = {}
    if company_id_int:
        company_result = await async_search_read(
            "res.company",
            [["id", "=", company_id_int]],
            ["id", "name", "email", "phone", "mobile",
             "street", "street2", "city", "zip", "state_id", "country_id",
             "website"],
            limit=1,
        )
        company_records = company_result.get("records", [])
        if company_records:
            company = company_records[0]

    return {
        "company": company or None,
        "social": {
            "facebook": website.get("social_facebook") or None,
            "twitter": website.get("social_twitter") or None,
            "instagram": website.get("social_instagram") or None,
            "linkedin": website.get("social_linkedin") or None,
            "youtube": website.get("social_youtube") or None,
            "tiktok": website.get("social_tiktok") or None,
        },
    }


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


@router.get("/products/{product_id}/stats")
async def get_product_stats_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Aggregated counts/totals for the product detail smart-buttons bar."""
    from app.services.website_service import get_product_stats
    return await get_product_stats(product_tmpl_id=product_id)


@router.get("/products/{product_id}/image")
async def get_product_image_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Stream the product image bytes. 404 if unset."""
    from fastapi.responses import Response as FastapiResponse
    from app.services.website_service import get_product_image
    blob = await get_product_image(product_tmpl_id=product_id)
    if not blob:
        return FastapiResponse(status_code=404)
    return FastapiResponse(content=blob, media_type="image/png")


class ProductImagePut(BaseModel):
    image_b64: str | None = None  # pass null/empty to remove


@router.put("/products/{product_id}/image")
async def set_product_image_endpoint(product_id: int, body: ProductImagePut, user: CurrentUser | None = Depends(get_optional_user)):
    """Upsert (or clear) the product template image. Accepts base64."""
    import base64
    from app.services.website_service import set_product_image
    image_bytes: bytes | None = None
    if body.image_b64:
        try:
            image_bytes = base64.b64decode(body.image_b64)
        except Exception:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
    await set_product_image(product_tmpl_id=product_id, image_bytes=image_bytes)
    return {"ok": True, "has_image": image_bytes is not None}


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


@router.get("/blog/posts/{post_id}/cover-image")
async def get_blog_post_cover_image_endpoint(post_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Stream the blog post cover image bytes. 404 if unset."""
    from fastapi.responses import Response as FastapiResponse
    from app.services.website_service import get_blog_post_cover_image
    blob = await get_blog_post_cover_image(post_id=post_id)
    if not blob:
        return FastapiResponse(status_code=404)
    # Try to detect the mime type from magic bytes; fall back to octet-stream.
    media_type = "application/octet-stream"
    if len(blob) >= 4:
        if blob[:8] == b"\x89PNG\r\n\x1a\n":
            media_type = "image/png"
        elif blob[:3] == b"\xff\xd8\xff":
            media_type = "image/jpeg"
        elif blob[:6] in (b"GIF87a", b"GIF89a"):
            media_type = "image/gif"
        elif blob[:4] == b"RIFF" and len(blob) >= 12 and blob[8:12] == b"WEBP":
            media_type = "image/webp"
    return FastapiResponse(content=blob, media_type=media_type)


class BlogCoverImagePut(BaseModel):
    image: str | None = None  # base64; null/empty to clear


@router.put("/blog/posts/{post_id}/cover-image")
async def set_blog_post_cover_image_endpoint(
    post_id: int,
    body: BlogCoverImagePut,
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Upsert (or clear) the blog post cover image. Accepts base64 in `image`."""
    import base64
    from app.services.website_service import set_blog_post_cover_image
    image_bytes: bytes | None = None
    if body.image:
        try:
            image_bytes = base64.b64decode(body.image)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
    await set_blog_post_cover_image(post_id=post_id, image_bytes=image_bytes)
    return {"ok": True, "has_cover_image": image_bytes is not None}


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
# Newsletter
# ============================================

@router.post("/newsletter/subscribe")
async def newsletter_subscribe(
    body: dict,
    user: CurrentUser | None = Depends(get_optional_user)
):
    """Subscribe an email to the default newsletter mailing list."""
    from app.services.base import async_search_read, async_create
    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    # Find or create the default "Newsletter" mailing list
    if get_model_class("mailing.list") is None:
        # Fallback: create a CRM lead so the signup isn't lost
        if get_model_class("crm.lead") is not None:
            await async_create("crm.lead", {
                "name": f"Newsletter signup: {email}",
                "email_from": email,
                "type": "lead",
                "description": "Subscribed via website newsletter form.",
            })
            return {"success": True, "method": "lead_fallback"}
        raise HTTPException(status_code=503, detail="Newsletter service unavailable")

    list_result = await async_search_read(
        "mailing.list",
        [["name", "=", "Newsletter"]],
        ["id", "name"],
        limit=1,
    )
    list_records = list_result.get("records", [])
    if list_records:
        list_id = list_records[0]["id"]
    else:
        created_list = await async_create("mailing.list", {"name": "Newsletter"})
        list_id = created_list["id"] if isinstance(created_list, dict) else created_list

    # Check if the contact already exists
    if get_model_class("mailing.contact") is None:
        raise HTTPException(status_code=503, detail="mailing.contact not available")

    existing = await async_search_read(
        "mailing.contact",
        [["email", "=", email]],
        ["id", "list_ids"],
        limit=1,
    )
    existing_records = existing.get("records", [])
    if existing_records:
        # Already subscribed -- idempotent success.
        # async_write is not available in app.services.base, so we cannot
        # mutate list_ids here; treat as already subscribed.
        return {"success": True, "already_subscribed": True}

    # Create new contact with list
    await async_create("mailing.contact", {
        "email": email,
        "list_ids": [[6, 0, [list_id]]],
    })
    return {"success": True, "created": True}


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


# ============================================
# Product attributes & variants
# ============================================

from pydantic import BaseModel
from app.services.product_attribute_service import (
    list_attributes as _list_attributes,
    get_template_attribute_lines as _get_template_attribute_lines,
    create_attribute_line as _create_attribute_line,
    update_attribute_line_values as _update_attribute_line_values,
    delete_attribute_line as _delete_attribute_line,
    create_attribute_value as _create_attribute_value,
    create_attribute as _create_attribute,
    regenerate_variants as _regenerate_variants,
    list_variants as _list_variants,
    update_ptav_price_extra as _update_ptav_price_extra,
)


class AttributeLineCreate(BaseModel):
    attribute_id: int
    value_ids: list[int] = []


class AttributeLineUpdate(BaseModel):
    value_ids: list[int]


class AttributeValueCreate(BaseModel):
    attribute_id: int
    name: str
    html_color: str | None = None


class AttributeCreate(BaseModel):
    name: str
    create_variant: str = "always"
    display_type: str = "radio"


@router.get("/attributes")
async def list_product_attributes(user: CurrentUser | None = Depends(get_optional_user)):
    """All active attributes with their values (for the attribute picker)."""
    return await _list_attributes()


@router.post("/attributes")
async def create_product_attribute(body: AttributeCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await _create_attribute(name=body.name, create_variant=body.create_variant, display_type=body.display_type)


@router.post("/attributes/values")
async def create_product_attribute_value(body: AttributeValueCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await _create_attribute_value(attribute_id=body.attribute_id, name=body.name, html_color=body.html_color)


@router.get("/products/{product_id}/attribute-lines")
async def get_product_attribute_lines(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _get_template_attribute_lines(product_tmpl_id=product_id)


@router.post("/products/{product_id}/attribute-lines")
async def add_product_attribute_line(product_id: int, body: AttributeLineCreate, user: CurrentUser | None = Depends(get_optional_user)):
    line_id = await _create_attribute_line(
        product_tmpl_id=product_id,
        attribute_id=body.attribute_id,
        value_ids=body.value_ids,
    )
    return {"id": line_id}


@router.put("/products/attribute-lines/{line_id}")
async def update_product_attribute_line(line_id: int, body: AttributeLineUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    await _update_attribute_line_values(line_id=line_id, value_ids=body.value_ids)
    return {"ok": True}


@router.delete("/products/attribute-lines/{line_id}")
async def remove_product_attribute_line(line_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    await _delete_attribute_line(line_id=line_id)
    return {"ok": True}


@router.post("/products/{product_id}/regenerate-variants")
async def regenerate_product_variants(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Rebuild product.product variants for this template from the current attribute lines."""
    return await _regenerate_variants(product_tmpl_id=product_id)


@router.get("/products/{product_id}/variants")
async def list_product_variants(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _list_variants(product_tmpl_id=product_id)


class PtavPriceExtraUpdate(BaseModel):
    price_extra: float


@router.put("/products/attribute-values/{ptav_id}/price-extra")
async def set_ptav_price_extra(ptav_id: int, body: PtavPriceExtraUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    await _update_ptav_price_extra(ptav_id=ptav_id, price_extra=body.price_extra)
    return {"ok": True}


# ============================================
# Product tags & optional products (eCommerce)
# ============================================

from app.services.product_ecommerce_service import (
    list_tags as _list_tags,
    create_tag as _create_tag,
    get_product_tags as _get_product_tags,
    set_product_tags as _set_product_tags,
    get_optional_products as _get_optional_products,
    set_optional_products as _set_optional_products,
)


class TagCreate(BaseModel):
    name: str
    color: str | None = None


class ProductTagsSet(BaseModel):
    tag_ids: list[int]


class ProductOptionalSet(BaseModel):
    product_ids: list[int]


@router.get("/tags")
async def list_product_tags(user: CurrentUser | None = Depends(get_optional_user)):
    return await _list_tags()


@router.post("/tags")
async def create_product_tag(body: TagCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await _create_tag(name=body.name, color=body.color)


@router.get("/products/{product_id}/tags")
async def get_product_tags_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _get_product_tags(product_tmpl_id=product_id)


@router.put("/products/{product_id}/tags")
async def set_product_tags_endpoint(product_id: int, body: ProductTagsSet, user: CurrentUser | None = Depends(get_optional_user)):
    await _set_product_tags(product_tmpl_id=product_id, tag_ids=body.tag_ids)
    return {"ok": True}


@router.get("/products/{product_id}/optional-products")
async def get_optional_products_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _get_optional_products(product_tmpl_id=product_id)


@router.put("/products/{product_id}/optional-products")
async def set_optional_products_endpoint(product_id: int, body: ProductOptionalSet, user: CurrentUser | None = Depends(get_optional_user)):
    await _set_optional_products(product_tmpl_id=product_id, linked_ids=body.product_ids)
    return {"ok": True}


# ============================================
# Product eCommerce — accessory, alternative, public categories, out-of-stock, media (Group B)
# ============================================

from fastapi.responses import Response
from app.services.product_ecommerce_service import (
    get_accessory_products as _get_accessory_products,
    set_accessory_products as _set_accessory_products,
    get_alternative_products as _get_alternative_products,
    set_alternative_products as _set_alternative_products,
    list_public_categories as _list_public_categories,
    create_public_category as _create_public_category,
    get_product_public_categories as _get_product_public_categories,
    set_product_public_categories as _set_product_public_categories,
    get_stock_settings as _get_stock_settings,
    set_stock_settings as _set_stock_settings,
    list_ecommerce_media as _list_ecommerce_media,
    add_ecommerce_media as _add_ecommerce_media,
    delete_ecommerce_media as _delete_ecommerce_media,
    get_ecommerce_media_image as _get_ecommerce_media_image,
)


class ProductIdList(BaseModel):
    product_ids: list[int]


class PublicCategoryCreate(BaseModel):
    name: str
    parent_id: int | None = None


class PublicCategorySet(BaseModel):
    category_ids: list[int]


class StockSettings(BaseModel):
    allow_out_of_stock_order: bool | None = None
    out_of_stock_message: str | None = None
    available_threshold: float | None = None
    show_availability: bool | None = None


class MediaCreate(BaseModel):
    name: str | None = None
    image_b64: str | None = None
    video_url: str | None = None


# Accessory
@router.get("/products/{product_id}/accessory-products")
async def get_accessory_products_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _get_accessory_products(product_tmpl_id=product_id)


@router.put("/products/{product_id}/accessory-products")
async def set_accessory_products_endpoint(product_id: int, body: ProductIdList, user: CurrentUser | None = Depends(get_optional_user)):
    await _set_accessory_products(product_tmpl_id=product_id, linked_ids=body.product_ids)
    return {"ok": True}


# Alternative
@router.get("/products/{product_id}/alternative-products")
async def get_alternative_products_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _get_alternative_products(product_tmpl_id=product_id)


@router.put("/products/{product_id}/alternative-products")
async def set_alternative_products_endpoint(product_id: int, body: ProductIdList, user: CurrentUser | None = Depends(get_optional_user)):
    await _set_alternative_products(product_tmpl_id=product_id, linked_ids=body.product_ids)
    return {"ok": True}


# Public categories
@router.get("/public-categories")
async def list_public_categories_endpoint(user: CurrentUser | None = Depends(get_optional_user)):
    return await _list_public_categories()


@router.post("/public-categories")
async def create_public_category_endpoint(body: PublicCategoryCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await _create_public_category(name=body.name, parent_id=body.parent_id)


@router.get("/products/{product_id}/public-categories")
async def get_product_public_categories_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _get_product_public_categories(product_tmpl_id=product_id)


@router.put("/products/{product_id}/public-categories")
async def set_product_public_categories_endpoint(product_id: int, body: PublicCategorySet, user: CurrentUser | None = Depends(get_optional_user)):
    await _set_product_public_categories(product_tmpl_id=product_id, category_ids=body.category_ids)
    return {"ok": True}


# Out-of-stock / availability
@router.get("/products/{product_id}/stock-settings")
async def get_stock_settings_endpoint(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _get_stock_settings(product_tmpl_id=product_id)


@router.put("/products/{product_id}/stock-settings")
async def set_stock_settings_endpoint(product_id: int, body: StockSettings, user: CurrentUser | None = Depends(get_optional_user)):
    await _set_stock_settings(product_tmpl_id=product_id, payload=body.dict(exclude_unset=True))
    return {"ok": True}


# eCommerce media gallery
@router.get("/products/{product_id}/media")
async def list_product_media(product_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await _list_ecommerce_media(product_tmpl_id=product_id)


@router.post("/products/{product_id}/media")
async def add_product_media(product_id: int, body: MediaCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await _add_ecommerce_media(
        product_tmpl_id=product_id, name=body.name, image_b64=body.image_b64, video_url=body.video_url,
    )


@router.delete("/products/media/{media_id}")
async def delete_product_media(media_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    await _delete_ecommerce_media(media_id=media_id)
    return {"ok": True}


@router.get("/products/media/{media_id}/image")
async def get_product_media_image(media_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    image_bytes = await _get_ecommerce_media_image(media_id=media_id)
    if not image_bytes:
        return Response(status_code=404)
    return Response(content=bytes(image_bytes), media_type="image/png")
