"""
Website/eCommerce service layer.

Provides high-level operations for:
- Website configuration
- CMS pages and menus
- Product catalog (storefront)
- Shopping cart (sale.order in draft)
- Product categories
- Dashboard metrics
"""
import logging
from typing import Any, Optional

from app.services.base import (
    RecordNotFoundError,
    async_search_read,
    async_count,
    async_get,
    async_get_or_raise,
    async_create,
    async_update,
    async_delete,
    async_action,
    async_sum,
)
from app.core.model_registry import get_model_class

_logger = logging.getLogger(__name__)

# --- Field lists ---

# Core fields that always exist on product.template
PRODUCT_LIST_FIELDS_BASE = [
    "id", "name", "list_price",
    "image_128", "default_code",
    "description_sale", "currency_id",
    "type", "qty_available",
]

# Optional fields present only when website_sale / website_rating are installed
PRODUCT_LIST_FIELDS_OPTIONAL = [
    "website_published", "public_categ_ids", "website_sequence",
    "rating_avg", "rating_count", "compare_list_price",
]

# Combined list kept for backward compatibility; actual reads use base fields
PRODUCT_LIST_FIELDS = PRODUCT_LIST_FIELDS_BASE + PRODUCT_LIST_FIELDS_OPTIONAL

PRODUCT_DETAIL_FIELDS_BASE = PRODUCT_LIST_FIELDS_BASE + [
    "product_variant_ids", "attribute_line_ids",
    "accessory_product_ids",
    "product_template_image_ids",
    "categ_id",
]

PRODUCT_DETAIL_FIELDS_OPTIONAL = PRODUCT_LIST_FIELDS_OPTIONAL + [
    "website_description", "description_ecommerce",
    "alternative_product_ids",
    "website_ribbon_id",
]

PRODUCT_DETAIL_FIELDS = PRODUCT_DETAIL_FIELDS_BASE + PRODUCT_DETAIL_FIELDS_OPTIONAL


def _safe_product_fields(base_fields: list, optional_fields: list) -> list:
    """Return base_fields plus whichever optional_fields exist on the model class."""
    cls = get_model_class("product.template")
    if cls is None:
        return list(base_fields)
    existing = {f for f in optional_fields if hasattr(cls, f)}
    return list(base_fields) + [f for f in optional_fields if f in existing]


CATEGORY_FIELDS = [
    "id", "name", "parent_id", "child_id",
    "sequence", "website_id", "image_128",
]

CART_FIELDS = [
    "id", "name", "state", "partner_id",
    "amount_untaxed", "amount_tax", "amount_total",
    "cart_quantity", "currency_id",
    "order_line",
]

CART_LINE_FIELDS = [
    "id", "product_id", "product_uom_qty", "price_unit",
    "price_subtotal", "price_total", "discount",
    "name", "product_uom_id",
]

PAGE_FIELDS = [
    "id", "name", "url", "website_published",
    "website_id", "date_publish",
    "is_homepage",
]

MENU_FIELDS = [
    "id", "name", "url", "sequence",
    "parent_id", "child_id",
    "website_id", "is_mega_menu",
]

WEBSITE_FIELDS = [
    "id", "name", "domain",
    "company_id", "default_lang_id", "language_ids",
    "logo", "favicon",
    "social_facebook", "social_twitter", "social_instagram",
    "social_linkedin", "social_youtube", "social_tiktok",
    "homepage_url",
]


# --- Website Config ---

async def get_website_config(website_id: Optional[int] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("website") is None:
        return {}
    if website_id:
        result = await async_get("website", website_id, WEBSITE_FIELDS)
        return result or {}
    result = await async_search_read("website", [], WEBSITE_FIELDS, limit=1)
    records = result["records"]
    return records[0] if records else {}


# --- CMS Pages ---

async def list_pages(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("published") is not None:
        domain.append(["website_published", "=", params["published"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["url", "ilike", params["search"]])

    if get_model_class("website.page") is None:
        return {"records": [], "total": 0, "warning": "website module not installed"}

    return await async_search_read(
        "website.page",
        domain,
        PAGE_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "url asc"),
    )


# --- Menus ---

async def list_menus(params: Optional[dict] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    params = params or {}
    domain: list[Any] = []
    if params.get("website_id"):
        domain.append(["website_id", "=", params["website_id"]])
    if params.get("parent_id") is not None:
        domain.append(["parent_id", "=", params["parent_id"] or False])

    if get_model_class("website.menu") is None:
        return {"records": [], "total": 0, "warning": "website module not installed"}

    return await async_search_read("website.menu", domain, MENU_FIELDS, limit=1000, order="sequence asc")


# --- Product Catalog ---

async def list_products(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    cls = get_model_class("product.template")

    domain: list[Any] = [["sale_ok", "=", True]]
    if cls is not None and hasattr(cls, "website_published") and params.get("published_only", False):
        domain.append(["website_published", "=", True])
    if cls is not None and hasattr(cls, "public_categ_ids") and params.get("category_id"):
        domain.append(["public_categ_ids", "child_of", params["category_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["default_code", "ilike", params["search"]])
    if params.get("min_price") is not None:
        domain.append(["list_price", ">=", params["min_price"]])
    if params.get("max_price") is not None:
        domain.append(["list_price", "<=", params["max_price"]])

    order = "name asc"
    if cls is not None and hasattr(cls, "website_sequence"):
        order = "website_sequence asc, name asc"

    safe_fields = _safe_product_fields(PRODUCT_LIST_FIELDS_BASE, PRODUCT_LIST_FIELDS_OPTIONAL)
    return await async_search_read(
        "product.template",
        domain,
        safe_fields,
        offset=params.get("offset", 0),
        limit=params.get("limit", 20),
        order=params.get("order", order),
    )


async def get_product(product_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    safe_fields = _safe_product_fields(PRODUCT_DETAIL_FIELDS_BASE, PRODUCT_DETAIL_FIELDS_OPTIONAL)
    data = await async_get("product.template", product_id, safe_fields)
    if data is None:
        return None

    # Read variants
    variant_ids = data.get("product_variant_ids", [])
    if variant_ids:
        variant_result = await async_search_read(
            "product.product",
            [["id", "in", variant_ids]],
            ["id", "name", "default_code", "list_price", "qty_available", "barcode",
             "product_template_attribute_value_ids"],
            limit=len(variant_ids) + 1,
        )
        data["variants"] = variant_result["records"]
    else:
        data["variants"] = []

    # Image is stored in ir_attachment, not on the template itself.
    # Expose a flag so the UI knows whether to show the image via the dedicated endpoint.
    img = await get_product_image(product_tmpl_id=product_id)
    data["has_image"] = img is not None

    return data


# --- Categories ---

async def list_categories(params: Optional[dict] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    params = params or {}
    domain: list[Any] = []
    if params.get("parent_id") is not None:
        parent = params["parent_id"]
        domain.append(["parent_id", "=", parent if parent != 0 else False])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])

    if get_model_class("product.public.category") is None:
        return {"records": [], "total": 0, "warning": "website_sale module not installed"}

    return await async_search_read(
        "product.public.category",
        domain,
        CATEGORY_FIELDS,
        limit=1000,
        order="sequence asc, name asc",
    )


# --- Shopping Cart helpers ---

async def _read_cart(order_id: int) -> Optional[dict]:
    """Read cart data including lines."""
    data = await async_get("sale.order", order_id, CART_FIELDS)
    if data is None:
        return None
    line_ids = data.get("order_line", [])
    if line_ids:
        lines_result = await async_search_read(
            "sale.order.line",
            [["id", "in", line_ids]],
            CART_LINE_FIELDS,
            limit=len(line_ids) + 1,
        )
        data["lines"] = lines_result["records"]
    else:
        data["lines"] = []
    return data


# --- Shopping Cart ---

async def get_cart(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    data = await async_get("sale.order", order_id, CART_FIELDS)
    if data is None or data.get("state") != "draft":
        return None
    line_ids = data.get("order_line", [])
    if line_ids:
        lines_result = await async_search_read(
            "sale.order.line",
            [["id", "in", line_ids]],
            CART_LINE_FIELDS,
            limit=len(line_ids) + 1,
        )
        data["lines"] = lines_result["records"]
    else:
        data["lines"] = []
    return data


async def add_to_cart(
    order_id: int,
    product_id: int,
    quantity: float = 1.0,
    product_uom_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    line_vals: dict[str, Any] = {
        "order_id": order_id,
        "product_id": product_id,
        "product_uom_qty": quantity,
    }
    if product_uom_id:
        line_vals["product_uom_id"] = product_uom_id
    await async_create("sale.order.line", line_vals, uid, CART_LINE_FIELDS)
    return await _read_cart(order_id)


async def update_cart_line(
    line_id: int,
    quantity: float,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    # Get line to find order_id
    line = await async_get("sale.order.line", line_id, ["id", "order_id"])
    order_id = line["order_id"] if line else None

    if quantity <= 0:
        await async_delete("sale.order.line", line_id)
    else:
        await async_update("sale.order.line", line_id, {"product_uom_qty": quantity}, uid, CART_LINE_FIELDS)

    return await _read_cart(order_id)


async def remove_cart_line(
    order_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    await async_delete("sale.order.line", line_id)
    return await _read_cart(order_id)


async def clear_cart(order_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    lines_result = await async_search_read(
        "sale.order.line",
        [["order_id", "=", order_id]],
        ["id"],
        limit=1000,
    )
    for line in lines_result["records"]:
        await async_delete("sale.order.line", line["id"])
    return await _read_cart(order_id)


# --- Checkout ---

CHECKOUT_FIELDS = [
    "id", "name", "partner_id", "partner_invoice_id", "partner_shipping_id",
    "amount_untaxed", "amount_tax", "amount_total", "state",
    "order_line", "payment_term_id", "note",
]


async def get_checkout_info(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get checkout info including addresses and payment terms."""
    data = await async_get("sale.order", order_id, CHECKOUT_FIELDS)
    if data is None:
        return None
    if data.get("order_line"):
        lines_result = await async_search_read(
            "sale.order.line",
            [["id", "in", data["order_line"]]],
            CART_LINE_FIELDS,
            limit=len(data["order_line"]) + 1,
        )
        data["lines"] = lines_result["records"]
    else:
        data["lines"] = []
    terms_result = await async_search_read("account.payment.term", [], ["id", "name", "note"], limit=100)
    data["available_payment_terms"] = terms_result["records"]
    return data


async def set_checkout_addresses(
    order_id: int,
    invoice_partner_id: int,
    shipping_partner_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    """Set billing and shipping addresses for checkout."""
    vals: dict[str, Any] = {"partner_invoice_id": invoice_partner_id}
    if shipping_partner_id:
        vals["partner_shipping_id"] = shipping_partner_id
    return await async_update("sale.order", order_id, vals, uid, CHECKOUT_FIELDS)


async def confirm_checkout(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Confirm the sale order (checkout complete)."""
    return await async_action("sale.order", order_id, "state", "sale", uid=uid, fields=CHECKOUT_FIELDS)


async def get_customer_addresses(partner_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get all addresses for a customer (for address selection at checkout)."""
    domain: list[Any] = [
        "|",
        ["id", "=", partner_id],
        ["parent_id", "=", partner_id],
    ]
    return await async_search_read(
        "res.partner",
        domain,
        ["id", "name", "type", "street", "street2", "city", "zip", "state_id", "country_id", "phone", "email"],
        limit=100,
        order="type",
    )


# --- Dashboard ---

async def get_website_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    import datetime

    cls_pt = get_model_class("product.template")
    cls_so = get_model_class("sale.order")

    has_website_published = cls_pt is not None and hasattr(cls_pt, "website_published")
    has_website_id = cls_so is not None and hasattr(cls_so, "website_id")
    has_cart_quantity = cls_so is not None and hasattr(cls_so, "cart_quantity")

    published_products = (
        await async_count("product.template", [["website_published", "=", True], ["sale_ok", "=", True]])
        if has_website_published else 0
    )
    unpublished_products = (
        await async_count("product.template", [["website_published", "=", False], ["sale_ok", "=", True]])
        if has_website_published
        else await async_count("product.template", [["sale_ok", "=", True]])
    )

    total_pages = 0
    if get_model_class("website.page") is not None:
        total_pages = await async_count("website.page", [])

    first_of_month = datetime.date.today().replace(day=1)
    orders_this_month = 0
    abandoned_carts = 0
    online_revenue = 0.0

    if has_website_id:
        orders_this_month = await async_count("sale.order", [
            ["website_id", "!=", False],
            ["state", "=", "sale"],
            ["date_order", ">=", first_of_month.isoformat()],
        ])
        if has_cart_quantity:
            abandoned_carts = await async_count("sale.order", [
                ["website_id", "!=", False],
                ["state", "=", "draft"],
                ["cart_quantity", ">", 0],
            ])
        online_revenue = await async_sum("sale.order", "amount_total", [
            ["website_id", "!=", False],
            ["state", "=", "sale"],
            ["date_order", ">=", first_of_month.isoformat()],
        ])

    return {
        "products": {
            "published": published_products,
            "unpublished": unpublished_products,
        },
        "pages": total_pages,
        "orders_this_month": orders_this_month,
        "abandoned_carts": abandoned_carts,
        "online_revenue": online_revenue,
    }


# --- Blog ---

# Keep list/detail fields lean — we never ship the cover_image bytes over
# JSON. The frontend fetches the image via the dedicated
# /website/blog/posts/{id}/cover-image endpoint, and we expose a
# cover_image_url pointing at it on every returned record.
BLOG_POST_FIELDS = [
    "id", "name", "subtitle", "author_id", "blog_id",
    "content", "teaser", "website_published", "post_date",
    "visits", "create_date", "write_date",
]


def _attach_cover_url(record: dict) -> dict:
    """Add a cover_image_url pointing at the binary endpoint."""
    post_id = record.get("id")
    if post_id is not None:
        record["cover_image_url"] = f"/api/v1/website/blog/posts/{post_id}/cover-image"
    return record


async def list_blog_posts(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List blog posts with filters."""
    domain: list[Any] = []
    if params.get("published") is not None:
        domain.append(["website_published", "=", params["published"]])
    if params.get("blog_id"):
        domain.append(["blog_id", "=", params["blog_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])

    if get_model_class("blog.post") is None:
        return {"records": [], "total": 0, "warning": "website_blog module not installed"}

    # Use a safe default order: post_date may be NULL for drafts, fall back to id
    result = await async_search_read(
        "blog.post",
        domain,
        BLOG_POST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 20),
        order=params.get("order", "post_date desc nulls last, id desc"),
    )
    result["records"] = [_attach_cover_url(r) for r in result.get("records", [])]
    return result


async def get_blog_post(post_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get a single blog post."""
    if get_model_class("blog.post") is None:
        return None
    record = await async_get("blog.post", post_id, BLOG_POST_FIELDS)
    if record is None:
        return None
    return _attach_cover_url(record)


async def list_blogs(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List blog categories."""
    if get_model_class("blog.blog") is None:
        return {"records": [], "total": 0}
    return await async_search_read("blog.blog", [], ["id", "name", "subtitle", "active"], limit=1000, order="name asc")


# ─── Blog post cover image (stored inline on blog_post.cover_image) ──────────

async def get_blog_post_cover_image(post_id: int) -> Optional[bytes]:
    """Return the raw cover image bytes for a blog post (or None if unset)."""
    from sqlalchemy import select
    from app.models.website.blog_post import BlogPost
    from app.services.base import get_session

    async with await get_session() as session:
        row = (
            await session.execute(
                select(BlogPost.cover_image).where(BlogPost.id == post_id)
            )
        ).first()
        if not row:
            return None
        blob = row[0]
        return bytes(blob) if blob is not None else None


async def set_blog_post_cover_image(post_id: int, image_bytes: Optional[bytes]) -> None:
    """Upsert (or clear) the cover image for a blog post."""
    from sqlalchemy import update as sql_update
    from app.models.website.blog_post import BlogPost
    from app.services.base import get_session

    async with await get_session() as session:
        await session.execute(
            sql_update(BlogPost)
            .where(BlogPost.id == post_id)
            .values(cover_image=image_bytes if image_bytes else None)
        )
        await session.commit()


async def publish_page(page_id: int, publish: bool, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Publish or unpublish a CMS page."""
    return await async_update(
        "website.page", page_id, {"website_published": publish}, uid,
        ["id", "name", "url", "website_published"],
    )


async def publish_product(product_id: int, publish: bool, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Publish or unpublish a product on the website."""
    return await async_update(
        "product.template", product_id, {"website_published": publish}, uid,
        ["id", "name", "website_published"],
    )


async def get_product_stats(product_tmpl_id: int) -> dict:
    """Aggregate counts/totals for the product-detail smart buttons."""
    pending_move_states = ["waiting", "confirmed", "assigned", "partially_available"]

    # On hand / reserved — stock_quant uses product_id (variant), traverse via product.product_tmpl_id
    on_hand_total = await async_sum(
        "stock.quant", "quantity",
        domain=[["product.product_tmpl_id", "=", product_tmpl_id]],
    )
    reserved_total = await async_sum(
        "stock.quant", "reserved_quantity",
        domain=[["product.product_tmpl_id", "=", product_tmpl_id]],
    )

    # Incoming/outgoing pending stock moves (by variant → template)
    incoming_qty = await async_sum(
        "stock.move", "product_uom_qty",
        domain=[
            ["product.product_tmpl_id", "=", product_tmpl_id],
            ["state", "in", pending_move_states],
            ["picking_type.code", "=", "incoming"],
        ],
    )
    outgoing_qty = await async_sum(
        "stock.move", "product_uom_qty",
        domain=[
            ["product.product_tmpl_id", "=", product_tmpl_id],
            ["state", "in", pending_move_states],
            ["picking_type.code", "=", "outgoing"],
        ],
    )
    forecasted = float(on_hand_total or 0) + float(incoming_qty or 0) - float(outgoing_qty or 0)

    sold_qty = await async_sum(
        "sale.order.line", "qty_delivered",
        domain=[
            ["product.product_tmpl_id", "=", product_tmpl_id],
            ["order.state", "in", ["sale", "done"]],
        ],
    )
    purchased_qty = await async_sum(
        "purchase.order.line", "product_qty",
        domain=[
            ["product.product_tmpl_id", "=", product_tmpl_id],
            ["order.state", "in", ["purchase", "done"]],
        ],
    )

    in_transfers = await async_count(
        "stock.picking",
        domain=[
            ["move_lines.product.product_tmpl_id", "=", product_tmpl_id],
            ["picking_type.code", "=", "incoming"],
            ["state", "in", pending_move_states],
        ],
    )
    out_transfers = await async_count(
        "stock.picking",
        domain=[
            ["move_lines.product.product_tmpl_id", "=", product_tmpl_id],
            ["picking_type.code", "=", "outgoing"],
            ["state", "in", pending_move_states],
        ],
    )

    reordering_count = await async_count(
        "stock.warehouse.orderpoint",
        domain=[["product.product_tmpl_id", "=", product_tmpl_id]],
    )

    return {
        "on_hand": float(on_hand_total or 0),
        "reserved": float(reserved_total or 0),
        "forecasted": forecasted,
        "sold": float(sold_qty or 0),
        "purchased": float(purchased_qty or 0),
        "in_count": int(in_transfers or 0),
        "out_count": int(out_transfers or 0),
        "reordering_count": int(reordering_count or 0),
    }


# ─── Product image (backed by ir_attachment) ─────────────────────────────────
# In Odoo, product.template.image_1920 is a stored-on-attachment field: bytes
# live in ir_attachment rows keyed by (res_model='product.template', res_id,
# res_field='image_1920'). There's no image_1920 column on product_template
# itself, so plain ORM updates silently lose the data.

async def get_product_image(product_tmpl_id: int, field: str = "image_1920") -> Optional[bytes]:
    """Return the raw image bytes for a product template (or None if unset)."""
    from sqlalchemy import select
    from app.models.base.ir_attachment import IrAttachment
    from app.services.base import get_session

    async with await get_session() as session:
        row = (
            await session.execute(
                select(IrAttachment.db_datas).where(
                    IrAttachment.res_model == "product.template",
                    IrAttachment.res_id == product_tmpl_id,
                    IrAttachment.res_field == field,
                )
            )
        ).first()
        return bytes(row[0]) if row and row[0] is not None else None


async def set_product_image(
    product_tmpl_id: int, image_bytes: Optional[bytes], field: str = "image_1920",
) -> None:
    """Upsert (or delete) the product-template image via ir_attachment.

    - If image_bytes is None or empty, the attachment is deleted (image cleared).
    - Otherwise, an attachment is created/updated with type=binary and db_datas.
    """
    from sqlalchemy import select, delete as sql_delete
    from app.models.base.ir_attachment import IrAttachment
    from app.services.base import get_session

    async with await get_session() as session:
        existing = (
            await session.execute(
                select(IrAttachment).where(
                    IrAttachment.res_model == "product.template",
                    IrAttachment.res_id == product_tmpl_id,
                    IrAttachment.res_field == field,
                )
            )
        ).scalar_one_or_none()

        if not image_bytes:
            if existing is not None:
                await session.execute(
                    sql_delete(IrAttachment).where(IrAttachment.id == existing.id)
                )
                await session.commit()
            return

        if existing is not None:
            existing.db_datas = image_bytes
            existing.type = "binary"
            existing.mimetype = existing.mimetype or "image/png"
            existing.file_size = len(image_bytes)
            existing.store_fname = None  # stored inline in DB
            await session.commit()
            return

        new_row = IrAttachment(
            name=field,
            type="binary",
            res_model="product.template",
            res_id=product_tmpl_id,
            res_field=field,
            db_datas=image_bytes,
            mimetype="image/png",
            file_size=len(image_bytes),
        )
        session.add(new_row)
        await session.commit()
