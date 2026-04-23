"""
Secondary models for Mashora ERP — mail_, calendar_, fleet_ and pos_ tables.
"""
from .mail_message import MailMessage, MailFollowers
from .mail_activity import MailActivity, MailActivityType
from .calendar_event import CalendarEvent, CalendarAttendee
from .calendar_sync import CalendarProvider, CalendarSyncLog
from .ir_mail_server import IrMailServer
from .fleet_extras import (
    FleetVehicleLogContract,
    FleetVehicleOdometer,
    FleetVehicleAssignationLog,
)
from .pos_config import PosConfig
from .pos_payment_method import PosPaymentMethod, pos_config_payment_method_rel
from .pos_category import PosCategory
from .pos_session import PosSession
from .pos_order import PosOrder
from .pos_order_line import PosOrderLine
from .pos_payment import PosPayment
from .restaurant_floor import RestaurantFloor
from .restaurant_table import RestaurantTable
from .pos_printer import PosPrinter

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
    "FleetVehicleLogContract",
    "FleetVehicleOdometer",
    "FleetVehicleAssignationLog",
    "PosConfig",
    "PosPaymentMethod",
    "pos_config_payment_method_rel",
    "PosCategory",
    "PosSession",
    "PosOrder",
    "PosOrderLine",
    "PosPayment",
    "RestaurantFloor",
    "RestaurantTable",
    "PosPrinter",
]
