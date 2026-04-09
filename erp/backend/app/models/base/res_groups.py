"""
ResGroups model.
Maps to: res_groups
"""
from typing import Optional

from sqlalchemy import Boolean, Double, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ResGroups(TimestampMixin, Base):
    """Access control group (res_groups)."""

    __tablename__ = "res_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    comment: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    share: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    api_key_duration: Mapped[Optional[float]] = mapped_column(Double, nullable=True)

    privilege_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<ResGroups id={self.id}>"
