"""Storefront-facing hierarchical categories + accessory/alternative product M2Ms."""
from typing import Optional

from sqlalchemy import Boolean, Column, ForeignKey, Integer, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


# M2M: product.template <-> product.public.category
product_template_public_category_rel = Table(
    "product_template_public_category_rel",
    Base.metadata,
    Column("product_template_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    Column("product_public_category_id", Integer, ForeignKey("product_public_category.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True,
)

# M2M: product.template <-> product.template — accessory products (cross-sell)
product_accessory_rel = Table(
    "product_accessory_rel",
    Base.metadata,
    Column("src_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    Column("dest_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True,
)

# M2M: product.template <-> product.template — alternative products
product_alternative_rel = Table(
    "product_alternative_rel",
    Base.metadata,
    Column("src_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    Column("dest_id", Integer, ForeignKey("product_template.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True,
)


class ProductPublicCategory(Base, TimestampMixin):
    __tablename__ = "product_public_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_public_category.id", ondelete="SET NULL"), nullable=True
    )
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
