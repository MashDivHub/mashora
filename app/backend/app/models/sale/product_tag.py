"""Product Tag and product-product M2M (optional products) models."""
from typing import Optional

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


# M2M: product.template <-> product.tag
product_tag_template_rel = Table(
    "product_tag_product_template_rel",
    Base.metadata,
    Column("product_template_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    Column("product_tag_id", Integer, ForeignKey("product_tag.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True,
)

# M2M: product.template <-> product.template for "Optional Products" (upsell)
# Odoo's product_optional_rel uses src_id/dest_id
product_optional_rel = Table(
    "product_optional_rel",
    Base.metadata,
    Column("src_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    Column("dest_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True,
)


class ProductTag(Base, TimestampMixin):
    __tablename__ = "product_tag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    visible_to_customers: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
