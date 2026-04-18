"""ir.filters — saved searches per model."""
from typing import Optional

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class IrFilters(Base, TimestampMixin):
    __tablename__ = "ir_filters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    model_id: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(Text, nullable=False, server_default="[]")
    context: Mapped[str] = mapped_column(Text, nullable=False, server_default="{}")
    sort: Mapped[str] = mapped_column(String, nullable=False, server_default="[]")
    is_default: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="false")
    active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, server_default="true")
    action_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
