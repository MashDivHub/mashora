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
from typing import Any

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)

# --- Field lists ---

PRODUCT_LIST_FIELDS = [
    "id", "name", "list_price", "website_published",
    "image_128", "default_code",
    "public_categ_ids", "website_sequence",
    "description_sale", "rating_avg", "rating_count",
    "compare_list_price", "currency_id",
    "type", "qty_available",
]

PRODUCT_DETAIL_FIELDS = PRODUCT_LIST_FIELDS + [
    "website_description", "description_ecommerce",
    "product_variant_ids", "attribute_line_ids",
    "alternative_product_ids", "accessory_product_ids",
    "website_ribbon_id",
    "product_template_image_ids",
    "categ_id",
]

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

def get_website_config(website_id: Optional[int] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Website = env["website"]
        if website_id:
            site = Website.browse(website_id)
        else:
            site = Website.search([], limit=1)
        if not site.exists():
            return {}
        return site.read(WEBSITE_FIELDS)[0]


# --- CMS Pages ---

def list_pages(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("published") is not None:
        domain.append(["website_published", "=", params["published"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["url", "ilike", params["search"]])

    with mashora_env(uid=uid, context=context) as env:
        Page = env["website.page"]
        total = Page.search_count(domain)
        records = Page.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 50),
            order=params.get("order", "url asc"),
        )
        return {"records": records.read(PAGE_FIELDS), "total": total}


# --- Menus ---

def list_menus(params: Optional[dict] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    params = params or {}
    domain: list[Any] = []
    if params.get("website_id"):
        domain.append(["website_id", "=", params["website_id"]])
    if params.get("parent_id") is not None:
        domain.append(["parent_id", "=", params["parent_id"] or False])

    with mashora_env(uid=uid, context=context) as env:
        Menu = env["website.menu"]
        records = Menu.search(domain, order="sequence asc")
        return {"records": records.read(MENU_FIELDS), "total": len(records)}


# --- Product Catalog ---

def list_products(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = [["sale_ok", "=", True]]
    if params.get("published_only", True):
        domain.append(["website_published", "=", True])
    if params.get("category_id"):
        domain.append(["public_categ_ids", "child_of", params["category_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["default_code", "ilike", params["search"]])
    if params.get("min_price") is not None:
        domain.append(["list_price", ">=", params["min_price"]])
    if params.get("max_price") is not None:
        domain.append(["list_price", "<=", params["max_price"]])

    with mashora_env(uid=uid, context=context) as env:
        Product = env["product.template"]
        total = Product.search_count(domain)
        records = Product.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 20),
            order=params.get("order", "website_sequence asc, name asc"),
        )
        return {"records": records.read(PRODUCT_LIST_FIELDS), "total": total}


def get_product(product_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        product = env["product.template"].browse(product_id)
        if not product.exists():
            return None
        data = product.read(PRODUCT_DETAIL_FIELDS)[0]

        # Read variants
        variant_ids = data.get("product_variant_ids", [])
        if variant_ids:
            variants = env["product.product"].browse(variant_ids)
            data["variants"] = variants.read([
                "id", "name", "default_code", "list_price",
                "qty_available", "barcode",
                "product_template_attribute_value_ids",
            ])
        else:
            data["variants"] = []

        return data


# --- Categories ---

def list_categories(params: Optional[dict] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    params = params or {}
    domain: list[Any] = []
    if params.get("parent_id") is not None:
        parent = params["parent_id"]
        domain.append(["parent_id", "=", parent if parent != 0 else False])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])

    with mashora_env(uid=uid, context=context) as env:
        Category = env["product.public.category"]
        records = Category.search(domain, order="sequence asc, name asc")
        return {"records": records.read(CATEGORY_FIELDS), "total": len(records)}


# --- Shopping Cart ---

def get_cart(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        if not order.exists() or order.state != "draft":
            return None
        data = order.read(CART_FIELDS)[0]

        line_ids = data.get("order_line", [])
        if line_ids:
            lines = env["sale.order.line"].browse(line_ids)
            data["lines"] = lines.read(CART_LINE_FIELDS)
        else:
            data["lines"] = []

        return data


def add_to_cart(
    order_id: int,
    product_id: int,
    quantity: float = 1.0,
    product_uom_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        line_vals: dict[str, Any] = {
            "product_id": product_id,
            "product_uom_qty": quantity,
        }
        if product_uom_id:
            line_vals["product_uom_id"] = product_uom_id
        order.write({"order_line": [(0, 0, line_vals)]})
        return get_cart(order_id, uid=uid, context=context)


def update_cart_line(
    line_id: int,
    quantity: float,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        line = env["sale.order.line"].browse(line_id)
        if quantity <= 0:
            order_id = line.order_id.id
            line.unlink()
        else:
            order_id = line.order_id.id
            line.write({"product_uom_qty": quantity})
        return get_cart(order_id, uid=uid, context=context)


def remove_cart_line(
    order_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.write({"order_line": [(2, line_id, 0)]})
        return get_cart(order_id, uid=uid, context=context)


def clear_cart(order_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        line_ids = order.order_line.ids
        if line_ids:
            order.write({"order_line": [(2, lid, 0) for lid in line_ids]})
        return get_cart(order_id, uid=uid, context=context)


# --- Dashboard ---

def get_website_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Product = env["product.template"]
        Order = env["sale.order"]
        Page = env["website.page"]

        published_products = Product.search_count([
            ["website_published", "=", True],
            ["sale_ok", "=", True],
        ])
        unpublished_products = Product.search_count([
            ["website_published", "=", False],
            ["sale_ok", "=", True],
        ])
        total_pages = Page.search_count([])

        # Online orders (from website)
        import datetime
        first_of_month = datetime.date.today().replace(day=1)
        orders_this_month = Order.search_count([
            ("website_id", "!=", False),
            ("state", "=", "sale"),
            ("date_order", ">=", first_of_month.isoformat()),
        ])
        abandoned_carts = Order.search_count([
            ("website_id", "!=", False),
            ("state", "=", "draft"),
            ("cart_quantity", ">", 0),
        ])

        # Revenue from online orders this month
        month_orders = Order.search([
            ("website_id", "!=", False),
            ("state", "=", "sale"),
            ("date_order", ">=", first_of_month.isoformat()),
        ], limit=1000)
        online_revenue = sum(r["amount_total"] for r in month_orders.read(["amount_total"]))

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
