"""
IrRule model.
Maps to: ir_rule
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, TimestampMixin


class IrRule(TimestampMixin, ActiveMixin, Base):
    """Record-level security rule (ir_rule)."""

    __tablename__ = "ir_rule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    domain_force: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    perm_read: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    perm_write: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    perm_create: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    perm_unlink: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    global_: Mapped[Optional[bool]] = mapped_column("global", Boolean, nullable=True)

    model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ir_model.id", ondelete="CASCADE"), nullable=False
    )

    model: Mapped["IrModel"] = relationship("IrModel")

    def __repr__(self) -> str:
        return f"<IrRule id={self.id} name={self.name!r} model_id={self.model_id}>"


from app.models.base.ir_model import IrModel  # noqa: E402, F401
