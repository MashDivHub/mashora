"""
IrModuleModule model.
Maps to: ir_module_module
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class IrModuleModule(TimestampMixin, Base):
    """Installed module / addon record (ir_module_module)."""

    __tablename__ = "ir_module_module"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    state: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    latest_version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    published_version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    maintainer: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    license: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    module_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # JSONB translation fields
    shortdesc: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    summary: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    description: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Text blobs
    contributors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    menus_by_module: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reports_by_module: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    views_by_module: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Flags
    application: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    demo: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    web: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    auto_install: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    to_buy: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    imported: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    category_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<IrModuleModule id={self.id} name={self.name!r} state={self.state!r}>"
