"""Product Attribute and Variant models (Odoo-compatible schema)."""
from typing import Optional, List
from decimal import Decimal

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, Numeric, String, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


# M2M: attribute line <-> attribute values (which values are active on this line for this template)
product_attribute_value_ptal_rel = Table(
    "product_attribute_value_product_template_attribute_line_rel",
    Base.metadata,
    Column("product_attribute_value_id", Integer, ForeignKey("product_attribute_value.id", ondelete="CASCADE"), primary_key=True),
    Column("product_template_attribute_line_id", Integer, ForeignKey("product_template_attribute_line.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True,
)

# M2M: variant (product.product) <-> template attribute value (the combination that defines the variant)
product_variant_combination = Table(
    "product_variant_combination",
    Base.metadata,
    Column("product_product_id", Integer, ForeignKey("product_product.id", ondelete="CASCADE"), primary_key=True),
    Column("product_template_attribute_value_id", Integer, ForeignKey("product_template_attribute_value.id", ondelete="CASCADE"), primary_key=True),
    extend_existing=True,
)


class ProductAttribute(Base, TimestampMixin):
    __tablename__ = "product_attribute"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    create_variant: Mapped[Optional[str]] = mapped_column(String, nullable=True, server_default="always")
    display_type: Mapped[Optional[str]] = mapped_column(String, nullable=True, server_default="radio")
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")

    values: Mapped[List["ProductAttributeValue"]] = relationship(
        "ProductAttributeValue", back_populates="attribute", lazy="selectin", order_by="ProductAttributeValue.sequence"
    )


class ProductAttributeValue(Base, TimestampMixin):
    __tablename__ = "product_attribute_value"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    attribute_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_attribute.id", ondelete="CASCADE"), nullable=False)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    html_color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_custom: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="false")
    default_extra_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")

    attribute: Mapped["ProductAttribute"] = relationship("ProductAttribute", back_populates="values")


class ProductTemplateAttributeLine(Base, TimestampMixin):
    """A link between a product template and an attribute, with the selected values for that template."""
    __tablename__ = "product_template_attribute_line"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_tmpl_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_template.id", ondelete="CASCADE"), nullable=False)
    attribute_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_attribute.id", ondelete="CASCADE"), nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    value_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")

    attribute: Mapped["ProductAttribute"] = relationship("ProductAttribute", lazy="selectin")
    value_ids: Mapped[List["ProductAttributeValue"]] = relationship(
        "ProductAttributeValue",
        secondary=product_attribute_value_ptal_rel,
        lazy="selectin",
    )


class ProductTemplateAttributeValue(Base, TimestampMixin):
    """A concrete (template, attribute, value) combination — one per template-line-value."""
    __tablename__ = "product_template_attribute_value"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_tmpl_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_template.id", ondelete="CASCADE"), nullable=False)
    attribute_line_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_template_attribute_line.id", ondelete="CASCADE"), nullable=False)
    attribute_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_attribute.id", ondelete="CASCADE"), nullable=False)
    product_attribute_value_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_attribute_value.id", ondelete="CASCADE"), nullable=False)
    price_extra: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    color: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ptav_active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")

    attribute_value: Mapped["ProductAttributeValue"] = relationship("ProductAttributeValue", lazy="selectin")
    attribute: Mapped["ProductAttribute"] = relationship("ProductAttribute", lazy="selectin")
