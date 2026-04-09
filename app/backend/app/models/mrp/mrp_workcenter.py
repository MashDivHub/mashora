"""
Work Center model.

Maps to PostgreSQL table: mrp_workcenter
"""
from typing import Optional

from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CompanyMixin, TimestampMixin


class MrpWorkcenter(Base, TimestampMixin, CompanyMixin):
    """Work center resource. Maps to mrp_workcenter table."""

    __tablename__ = "mrp_workcenter"
    __mashora_model__ = "mrp.workcenter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    time_start: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    time_stop: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    time_efficiency: Mapped[float] = mapped_column(
        Float, nullable=False, default=100.0, server_default="100.0"
    )
    capacity: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, server_default="1.0"
    )
    sequence: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    color: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    working_state: Mapped[str] = mapped_column(
        String(32), nullable=False, default="normal", server_default="normal"
    )
    oee: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    blocked_time: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )
    productive_time: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0.0"
    )

    def __repr__(self) -> str:
        return f"<MrpWorkcenter id={self.id} code={self.code!r} working_state={self.working_state!r}>"
