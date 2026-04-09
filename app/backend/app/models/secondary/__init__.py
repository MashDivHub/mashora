"""
Secondary models for Mashora ERP — mail_ and calendar_ tables.
"""
from .mail_message import MailMessage, MailFollowers
from .mail_activity import MailActivity, MailActivityType
from .calendar_event import CalendarEvent, CalendarAttendee
from .calendar_sync import CalendarProvider, CalendarSyncLog
from .ir_mail_server import IrMailServer

__all__ = [
    "MailMessage",
    "MailFollowers",
    "MailActivity",
    "MailActivityType",
    "CalendarEvent",
    "CalendarAttendee",
    "CalendarProvider",
    "CalendarSyncLog",
    "IrMailServer",
]
