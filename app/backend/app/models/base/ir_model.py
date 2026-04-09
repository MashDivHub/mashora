"""
IrModel, IrModelFields, IrModelAccess, IrModelData models.
Maps to: ir_model, ir_model_fields, ir_model_access, ir_model_data
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class IrModel(TimestampMixin, Base):
    """ORM model descriptor (ir_model)."""

    __tablename__ = "ir_model"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    order: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    fold_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    abstract: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    transient: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_mail_thread: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_mail_activity: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_mail_blacklist: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Website form
    website_form_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    website_form_label: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    website_form_access: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    website_form_default_field_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    fields: Mapped[list["IrModelFields"]] = relationship(
        "IrModelFields", back_populates="ir_model"
    )
    access_rules: Mapped[list["IrModelAccess"]] = relationship(
        "IrModelAccess", back_populates="model"
    )

    def __repr__(self) -> str:
        return f"<IrModel id={self.id} model={self.model!r}>"


class IrModelFields(TimestampMixin, Base):
    """Field descriptor for an ORM model (ir_model_fields)."""

    __tablename__ = "ir_model_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    ttype: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False)
    field_description: Mapped[dict] = mapped_column(JSONB, nullable=False)
    help: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    relation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    relation_field: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    relation_table: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    column1: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    column2: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    related: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    depends: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    translate: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    on_delete: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    currency_field: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    compute: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tracking: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Boolean flags
    copied: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    required: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    readonly: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    index: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    company_dependent: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    group_expand: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    selectable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    store: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    sanitize: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    sanitize_overridable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    sanitize_tags: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    sanitize_attributes: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    sanitize_style: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    sanitize_form: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    strip_style: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    strip_classes: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    website_form_blacklisted: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Foreign keys
    model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="CASCADE"), nullable=False
    )
    relation_field_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model_fields.id", ondelete="SET NULL"), nullable=True
    )
    related_field_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model_fields.id", ondelete="SET NULL"), nullable=True
    )

    ir_model: Mapped["IrModel"] = relationship("IrModel", back_populates="fields")

    def __repr__(self) -> str:
        return f"<IrModelFields id={self.id} model={self.model!r} name={self.name!r}>"


class IrModelAccess(TimestampMixin, Base):
    """ACL rule on a model (ir_model_access)."""

    __tablename__ = "ir_model_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    perm_read: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    perm_write: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    perm_create: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    perm_unlink: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_groups.id", ondelete="CASCADE"), nullable=True
    )

    model: Mapped["IrModel"] = relationship("IrModel", back_populates="access_rules")

    def __repr__(self) -> str:
        return f"<IrModelAccess id={self.id} name={self.name!r} model_id={self.model_id}>"


class IrModelData(TimestampMixin, Base):
    """External identifier (XMLID) registry (ir_model_data)."""

    __tablename__ = "ir_model_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    module: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    res_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    noupdate: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    def __repr__(self) -> str:
        return f"<IrModelData id={self.id} module={self.module!r} name={self.name!r}>"
