"""
IrCron model.
Maps to: ir_cron
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import ActiveMixin, Base, TimestampMixin


class IrCron(TimestampMixin, ActiveMixin, Base):
    """Scheduled cron job (ir_cron)."""

    __tablename__ = "ir_cron"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cron_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    interval_number: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_type: Mapped[str] = mapped_column(String, nullable=False)
    nextcall: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    lastcall: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    first_failure_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    priority: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    failure_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    ir_actions_server_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ir_act_server.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("res_users.id", ondelete="CASCADE"), nullable=False
    )

    action_server: Mapped["IrActServer"] = relationship(
        "IrActServer", foreign_keys=[ir_actions_server_id]
    )
    user: Mapped["ResUsers"] = relationship(
        "ResUsers", foreign_keys=[user_id]
    )

    def __repr__(self) -> str:
        return f"<IrCron id={self.id} cron_name={self.cron_name!r}>"


from app.models.base.ir_actions import IrActServer  # noqa: E402, F401
from app.models.base.res_users import ResUsers  # noqa: E402, F401
