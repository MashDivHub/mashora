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

from app.core.orm_adapter import mashora_env

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

# Combined list kept for backward compatibility; actual reads are filtered at runtime
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


def _safe_product_fields(model, base_fields, optional_fields):
    """Return base_fields plus whichever optional_fields exist on the model."""
    mf = model._fields
    return [f for f in base_fields] + [f for f in optional_fields if f in mf]

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
        if "website" not in env.registry:
            return {}
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
        if "website.page" not in env.registry:
            return {"records": [], "total": 0, "warning": "website module not installed"}
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
        if "website.menu" not in env.registry:
            return {"records": [], "total": 0, "warning": "website module not installed"}
        Menu = env["website.menu"]
        records = Menu.search(domain, order="sequence asc")
        return {"records": records.read(MENU_FIELDS), "total": len(records)}


# --- Product Catalog ---

def list_products(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Product = env["product.template"]
        model_fields = Product._fields

        domain: list[Any] = [["sale_ok", "=", True]]
        if "website_published" in model_fields and params.get("published_only", False):
            domain.append(["website_published", "=", True])
        if "public_categ_ids" in model_fields and params.get("category_id"):
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
        if "website_sequence" in model_fields:
            order = "website_sequence asc, name asc"

        total = Product.search_count(domain)
        records = Product.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 20),
            order=params.get("order", order),
        )
        safe_fields = _safe_product_fields(Product, PRODUCT_LIST_FIELDS_BASE, PRODUCT_LIST_FIELDS_OPTIONAL)
        return {"records": records.read(safe_fields), "total": total}


def get_product(product_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        Product = env["product.template"]
        product = Product.browse(product_id)
        if not product.exists():
            return None
        safe_fields = _safe_product_fields(Product, PRODUCT_DETAIL_FIELDS_BASE, PRODUCT_DETAIL_FIELDS_OPTIONAL)
        data = product.read(safe_fields)[0]

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
        if "product.public.category" not in env.registry:
            return {"records": [], "total": 0, "warning": "website_sale module not installed"}
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


def _read_cart_in_env(env, order_id: int) -> Optional[dict]:
    """Read cart data within an already-open env (no second transaction)."""
    order = env["sale.order"].browse(order_id)
    if not order.exists():
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
        return _read_cart_in_env(env, order_id)


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
        return _read_cart_in_env(env, order_id)


def remove_cart_line(
    order_id: int,
    line_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        order.write({"order_line": [(2, line_id, 0)]})
        return _read_cart_in_env(env, order_id)


def clear_cart(order_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        line_ids = order.order_line.ids
        if line_ids:
            order.write({"order_line": [(2, lid, 0) for lid in line_ids]})
        return _read_cart_in_env(env, order_id)


# --- Checkout ---

CHECKOUT_FIELDS = [
    "id", "name", "partner_id", "partner_invoice_id", "partner_shipping_id",
    "amount_untaxed", "amount_tax", "amount_total", "state",
    "order_line", "payment_term_id", "note",
]


def get_checkout_info(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get checkout info including addresses and payment terms."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        if not order.exists():
            return None
        data = order.read(CHECKOUT_FIELDS)[0]
        if data.get("order_line"):
            lines = env["sale.order.line"].browse(data["order_line"])
            data["lines"] = lines.read(CART_LINE_FIELDS)
        else:
            data["lines"] = []
        terms = env["account.payment.term"].search_read([], ["id", "name", "note"])
        data["available_payment_terms"] = terms
        return data


def set_checkout_addresses(
    order_id: int,
    invoice_partner_id: int,
    shipping_partner_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    """Set billing and shipping addresses for checkout."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        if not order.exists():
            return None
        vals = {"partner_invoice_id": invoice_partner_id}
        if shipping_partner_id:
            vals["partner_shipping_id"] = shipping_partner_id
        order.write(vals)
        return order.read(CHECKOUT_FIELDS)[0]


def confirm_checkout(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Confirm the sale order (checkout complete)."""
    with mashora_env(uid=uid, context=context) as env:
        order = env["sale.order"].browse(order_id)
        if not order.exists():
            return None
        order.action_confirm()
        return order.read(CHECKOUT_FIELDS)[0]


def get_customer_addresses(partner_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get all addresses for a customer (for address selection at checkout)."""
    with mashora_env(uid=uid, context=context) as env:
        domain = [
            "|",
            ("id", "=", partner_id),
            ("parent_id", "=", partner_id),
        ]
        addresses = env["res.partner"].search_read(
            domain,
            ["id", "name", "type", "street", "street2", "city", "zip", "state_id", "country_id", "phone", "email"],
            order="type",
        )
        return {"records": addresses, "total": len(addresses)}


# --- Dashboard ---

def get_website_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    import datetime
    with mashora_env(uid=uid, context=context) as env:
        Product = env["product.template"]
        Order = env["sale.order"]
        pt_fields = Product._fields
        so_fields = Order._fields

        has_website_published = "website_published" in pt_fields
        has_website_id = "website_id" in so_fields
        has_cart_quantity = "cart_quantity" in so_fields

        published_products = (
            Product.search_count([["website_published", "=", True], ["sale_ok", "=", True]])
            if has_website_published else 0
        )
        unpublished_products = (
            Product.search_count([["website_published", "=", False], ["sale_ok", "=", True]])
            if has_website_published
            else Product.search_count([["sale_ok", "=", True]])
        )

        total_pages = 0
        if "website.page" in env.registry:
            total_pages = env["website.page"].search_count([])

        first_of_month = datetime.date.today().replace(day=1)
        orders_this_month = 0
        abandoned_carts = 0
        online_revenue = 0.0

        if has_website_id:
            orders_this_month = Order.search_count([
                ("website_id", "!=", False),
                ("state", "=", "sale"),
                ("date_order", ">=", first_of_month.isoformat()),
            ])
            if has_cart_quantity:
                abandoned_carts = Order.search_count([
                    ("website_id", "!=", False),
                    ("state", "=", "draft"),
                    ("cart_quantity", ">", 0),
                ])
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


# --- Blog ---

BLOG_POST_FIELDS = [
    "id", "name", "subtitle", "author_id", "blog_id",
    "content", "website_published", "post_date",
    "visits", "tag_ids", "create_date", "write_date",
]


def list_blog_posts(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List blog posts with filters."""
    domain: list[Any] = []
    if params.get("published") is not None:
        domain.append(["website_published", "=", params["published"]])
    if params.get("blog_id"):
        domain.append(["blog_id", "=", params["blog_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        if "blog.post" not in env.registry:
            return {"records": [], "total": 0, "warning": "website_blog module not installed"}
        Post = env["blog.post"]
        total = Post.search_count(domain)
        records = Post.search(domain, offset=params.get("offset", 0),
                              limit=params.get("limit", 20),
                              order=params.get("order", "post_date desc"))
        return {"records": records.read(BLOG_POST_FIELDS), "total": total}


def get_blog_post(post_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get a single blog post."""
    with mashora_env(uid=uid, context=context) as env:
        if "blog.post" not in env.registry:
            return None
        post = env["blog.post"].browse(post_id)
        if not post.exists():
            return None
        return post.read(BLOG_POST_FIELDS)[0]


def list_blogs(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List blog categories."""
    with mashora_env(uid=uid, context=context) as env:
        if "blog.blog" not in env.registry:
            return {"records": [], "total": 0}
        Blog = env["blog.blog"]
        blogs = Blog.search([], order="name asc")
        data = blogs.read(["id", "name", "subtitle", "active"])
        return {"records": data, "total": len(data)}


def publish_page(page_id: int, publish: bool, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Publish or unpublish a CMS page."""
    with mashora_env(uid=uid, context=context) as env:
        page = env["website.page"].browse(page_id)
        if not page.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Page {page_id} not found")
        page.write({"website_published": publish})
        return page.read(["id", "name", "url", "website_published"])[0]


def publish_product(product_id: int, publish: bool, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Publish or unpublish a product on the website."""
    with mashora_env(uid=uid, context=context) as env:
        product = env["product.template"].browse(product_id)
        if not product.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Product {product_id} not found")
        product.write({"website_published": publish})
        return product.read(["id", "name", "website_published"])[0]
