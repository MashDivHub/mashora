"""
IrUiMenu model.
Maps to: ir_ui_menu
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, TimestampMixin


class IrUiMenu(TimestampMixin, ActiveMixin, Base):
    """Navigation menu item (ir_ui_menu)."""

    __tablename__ = "ir_ui_menu"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parent_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    web_icon: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ir_ui_menu.id", ondelete="CASCADE"), nullable=True
    )

    parent: Mapped[Optional["IrUiMenu"]] = relationship(
        "IrUiMenu", remote_side="IrUiMenu.id", back_populates="children"
    )
    children: Mapped[list["IrUiMenu"]] = relationship(
        "IrUiMenu", back_populates="parent"
    )

    def __repr__(self) -> str:
        return f"<IrUiMenu id={self.id} parent_id={self.parent_id}>"
