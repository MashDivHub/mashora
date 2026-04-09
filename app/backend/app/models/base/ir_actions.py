"""
IrActions, IrActWindow, IrActServer models.
Maps to: ir_actions, ir_act_window, ir_act_server

All three tables share the ir_actions_id_seq sequence (single-table inheritance
is the Odoo pattern, but here we map them as independent tables that each carry
the shared base columns, matching the actual PostgreSQL schema).
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class IrActions(TimestampMixin, Base):
    """Base action record (ir_actions)."""

    __tablename__ = "ir_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    help: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    binding_type: Mapped[str] = mapped_column(String, nullable=False)
    binding_view_types: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    binding_model_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<IrActions id={self.id} type={self.type!r}>"


class IrActWindow(TimestampMixin, Base):
    """Window action — opens a list/form view (ir_act_window)."""

    __tablename__ = "ir_act_window"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    help: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    binding_type: Mapped[str] = mapped_column(String, nullable=False)
    binding_view_types: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    res_model: Mapped[str] = mapped_column(String, nullable=False)
    view_mode: Mapped[str] = mapped_column(String, nullable=False)
    target: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    context: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    res_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    usage: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mobile_view_mode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    filter: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    cache: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    binding_model_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="SET NULL"), nullable=True
    )
    view_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_ui_view.id", ondelete="SET NULL"), nullable=True
    )
    search_view_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_ui_view.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<IrActWindow id={self.id} res_model={self.res_model!r}>"


class IrActServer(TimestampMixin, Base):
    """Server action — runs Python code / CRUD (ir_act_server)."""

    __tablename__ = "ir_act_server"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    help: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    binding_type: Mapped[str] = mapped_column(String, nullable=False)
    binding_view_types: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    usage: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    html_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activity_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    automated_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    update_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    update_m2m_operation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    update_boolean_value: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    evaluation_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    resource_ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    webhook_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    activity_summary: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    followers_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    followers_partner_field_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mail_post_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    activity_date_deadline_range_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    activity_user_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    activity_user_field_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sms_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    website_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    activity_date_deadline_range: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mail_post_autofollow: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    website_published: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    binding_model_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="SET NULL"), nullable=True
    )
    model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="CASCADE"), nullable=False
    )
    crud_model_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="SET NULL"), nullable=True
    )
    update_related_model_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="SET NULL"), nullable=True
    )
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_act_server.id", ondelete="SET NULL"), nullable=True
    )
    link_field_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model_fields.id", ondelete="SET NULL"), nullable=True
    )
    update_field_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_model_fields.id", ondelete="SET NULL"), nullable=True
    )
    sequence_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_sequence.id", ondelete="SET NULL"), nullable=True
    )
    selection_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    activity_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="SET NULL"), nullable=True
    )
    activity_type_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sms_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<IrActServer id={self.id} state={self.state!r}>"
