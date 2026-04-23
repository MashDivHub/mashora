"""SQLAlchemy model for pos_session (open/close register session)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, CompanyMixin


class PosSession(Base, TimestampMixin, CompanyMixin):
    __tablename__ = "pos_session"
    __mashora_model__ = "pos.session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    config_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pos_config.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="RESTRICT"), nullable=False
    )
    state: Mapped[Optional[str]] = mapped_column(
        String, default="opening_control", server_default="'opening_control'", nullable=True
    )
    start_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    stop_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cash_register_balance_start: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    cash_register_balance_end_real: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    cash_register_balance_end: Mapped[Optional[float]] = mapped_column(
        Float, default=0, server_default="0", nullable=True
    )
    cash_control: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    cash_journal_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rescue: Mapped[Optional[bool]] = mapped_column(
        Boolean, default=False, server_default="false", nullable=True
    )
    sequence_number: Mapped[Optional[int]] = mapped_column(
        Integer, default=1, server_default="1", nullable=True
    )
    login_number: Mapped[Optional[int]] = mapped_column(
        Integer, default=0, server_default="0", nullable=True
    )
    opening_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closing_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<PosSession id={self.id} name={self.name!r} state={self.state}>"
