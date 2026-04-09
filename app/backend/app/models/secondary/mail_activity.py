"""
SQLAlchemy models for mail_activity and mail_activity_type tables.
"""
from typing import Optional
from datetime import date, datetime

from sqlalchemy import Integer, String, Text, Boolean, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, ActiveMixin


class MailActivityType(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "mail_activity_type"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    delay_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    triggered_next_type_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("mail_activity_type.id"), nullable=True)
    default_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=True)

    delay_unit: Mapped[str] = mapped_column(String, nullable=False)
    delay_from: Mapped[str] = mapped_column(String, nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    decoration_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    res_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    chaining_type: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    name: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    default_note: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    triggered_next_type: Mapped[Optional["MailActivityType"]] = relationship(
        "MailActivityType", remote_side="MailActivityType.id", foreign_keys=[triggered_next_type_id]
    )

    def __repr__(self) -> str:
        return f"<MailActivityType id={self.id} name={self.name!r}>"


class MailActivity(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "mail_activity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    res_model_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    res_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    activity_type_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("mail_activity_type.id"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=True)
    recommended_activity_type_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("mail_activity_type.id"), nullable=True)
    previous_activity_type_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("mail_activity_type.id"), nullable=True)
    calendar_event_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    res_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    res_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    user_tz: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    date_deadline: Mapped[date] = mapped_column(Date, nullable=False)
    date_done: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    automated: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships
    activity_type: Mapped[Optional["MailActivityType"]] = relationship(
        "MailActivityType", foreign_keys=[activity_type_id]
    )

    def __repr__(self) -> str:
        return f"<MailActivity id={self.id} res_model={self.res_model!r} res_id={self.res_id}>"
