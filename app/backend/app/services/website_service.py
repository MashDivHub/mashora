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

BLOG_POST_FIELDS = [
    "id", "name", "subtitle", "author_id", "blog_id",
    "content", "website_published", "post_date",
    "visits", "tag_ids", "create_date", "write_date",
]


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

    return await async_search_read(
        "blog.post",
        domain,
        BLOG_POST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 20),
        order=params.get("order", "post_date desc"),
    )


async def get_blog_post(post_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get a single blog post."""
    if get_model_class("blog.post") is None:
        return None
    return await async_get("blog.post", post_id, BLOG_POST_FIELDS)


async def list_blogs(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List blog categories."""
    if get_model_class("blog.blog") is None:
        return {"records": [], "total": 0}
    return await async_search_read("blog.blog", [], ["id", "name", "subtitle", "active"], limit=1000, order="name asc")


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
