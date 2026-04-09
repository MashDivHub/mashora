"""
SQLAlchemy models for calendar_event and calendar_attendee tables.
"""
from typing import Optional, List
from datetime import date, datetime

from sqlalchemy import Integer, String, Text, Boolean, Date, Double, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, ActiveMixin


class CalendarEvent(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "calendar_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("res_users.id"), nullable=True)
    videocall_channel_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    res_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    res_model_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recurrence_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    opportunity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    videocall_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    privacy: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    show_as: Mapped[str] = mapped_column(String, nullable=False)
    res_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    stop_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    allday: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    recurrency: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    follow_recurrence: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    start: Mapped[datetime] = mapped_column(nullable=False)
    stop: Mapped[datetime] = mapped_column(nullable=False)

    duration: Mapped[Optional[float]] = mapped_column(Double, nullable=True)

    # Relationships
    attendees: Mapped[List["CalendarAttendee"]] = relationship("CalendarAttendee", back_populates="event")

    def __repr__(self) -> str:
        return f"<CalendarEvent id={self.id} name={self.name!r}>"


class CalendarAttendee(Base, TimestampMixin):
    __tablename__ = "calendar_attendee"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey("calendar_event.id"), nullable=False)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("res_partner.id"), nullable=False)

    common_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    availability: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    event: Mapped["CalendarEvent"] = relationship("CalendarEvent", back_populates="attendees")
    partner: Mapped["ResPartner"] = relationship("ResPartner", foreign_keys=[partner_id])

    def __repr__(self) -> str:
        return f"<CalendarAttendee id={self.id} event_id={self.event_id} partner_id={self.partner_id}>"
