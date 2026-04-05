"""
Pydantic schemas for the Website/eCommerce module.

Covers: website config, CMS pages, product catalog, shopping cart, categories.
"""
from datetime import date
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


# --- Product Catalog ---

class ProductListParams(BaseModel):
    """Parameters for listing products on the storefront."""
    category_id: Optional[int] = None
    search: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    published_only: bool = True
    offset: int = 0
    limit: int = 20
    order: str = "website_sequence asc, name asc"


class CategoryListParams(BaseModel):
    """Parameters for listing product categories."""
    parent_id: Optional[int] = Field(default=None, description="Filter by parent category. Use 0 for root categories.")
    search: Optional[str] = None


# --- Shopping Cart ---

class CartAddItem(BaseModel):
    """Add an item to the shopping cart."""
    product_id: int
    quantity: float = 1.0
    product_uom_id: Optional[int] = None


class CartUpdateItem(BaseModel):
    """Update a cart line item quantity."""
    quantity: float


# --- Checkout ---

class CheckoutAddress(BaseModel):
    """Address for checkout (billing or shipping)."""
    name: str
    street: str
    city: str
    zip: Optional[str] = None
    country_id: int
    state_id: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None


# --- CMS Pages ---

class PageListParams(BaseModel):
    """Parameters for listing CMS pages."""
    search: Optional[str] = None
    published: Optional[bool] = None
    offset: int = 0
    limit: int = 50
    order: str = "url asc"


# --- Website Menu ---

class MenuListParams(BaseModel):
    """Parameters for listing website menus."""
    website_id: Optional[int] = None
    parent_id: Optional[int] = None
