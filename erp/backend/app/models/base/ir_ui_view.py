"""
IrUiView model.
Maps to: ir_ui_view
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, TimestampMixin


class IrUiView(TimestampMixin, ActiveMixin, Base):
    """UI view definition (ir_ui_view)."""

    __tablename__ = "ir_ui_view"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    arch_fs: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mode: Mapped[str] = mapped_column(String, nullable=False)
    arch_prev: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    arch_updated: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    customize_show: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)

    # JSONB
    arch_db: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    website_meta_title: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    website_meta_description: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    website_meta_keywords: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    seo_name: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Website
    website_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    theme_template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    website_meta_og_img: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    visibility: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    visibility_password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_seo_optimized: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    track: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    inherit_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_ui_view.id", ondelete="SET NULL"), nullable=True
    )

    inherit: Mapped[Optional["IrUiView"]] = relationship(
        "IrUiView", remote_side="IrUiView.id", back_populates="children"
    )
    children: Mapped[list["IrUiView"]] = relationship(
        "IrUiView", back_populates="inherit"
    )

    def __repr__(self) -> str:
        return f"<IrUiView id={self.id} name={self.name!r} model={self.model!r}>"
