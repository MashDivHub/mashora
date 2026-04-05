"""
Pydantic schemas for Phase 4 secondary modules.

Covers: fleet, repair, mrp, event, survey, mass_mailing, pos, calendar.
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


# --- Fleet ---
class VehicleListParams(BaseModel):
    state_id: Optional[int] = None
    driver_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "name asc"

class VehicleCreate(BaseModel):
    model_id: int
    license_plate: str
    driver_id: Optional[int] = None
    fuel_type: Optional[str] = None
    acquisition_date: Optional[date] = None
    seats: Optional[int] = None

# --- Repair ---
class RepairListParams(BaseModel):
    state: Optional[list[str]] = Field(default=None, description="draft, confirmed, under_repair, done, cancel")
    partner_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "name desc"

class RepairCreate(BaseModel):
    product_id: int
    partner_id: Optional[int] = None
    lot_id: Optional[int] = None
    description: Optional[str] = None
    priority: str = "0"

# --- MRP (Manufacturing) ---
class ProductionListParams(BaseModel):
    state: Optional[list[str]] = Field(default=None, description="draft, confirmed, progress, to_close, done, cancel")
    product_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "date_start desc, name desc"

class ProductionCreate(BaseModel):
    product_id: int
    product_qty: float = 1.0
    bom_id: Optional[int] = None
    date_start: Optional[datetime] = None
    date_finished: Optional[datetime] = None

class BomListParams(BaseModel):
    product_tmpl_id: Optional[int] = None
    type: Optional[str] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "product_tmpl_id asc"

# --- Event ---
class EventListParams(BaseModel):
    kanban_state: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "date_begin desc"

class EventCreate(BaseModel):
    name: str
    event_type_id: Optional[int] = None
    date_begin: datetime
    date_end: datetime
    address_id: Optional[int] = None
    organizer_id: Optional[int] = None
    seats_max: int = 0

# --- Survey ---
class SurveyListParams(BaseModel):
    survey_type: Optional[str] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "create_date desc"

class SurveyCreate(BaseModel):
    title: str
    survey_type: str = "survey"
    description: Optional[str] = None
    questions_layout: str = "page_per_section"

# --- Mass Mailing ---
class MailingListParams(BaseModel):
    state: Optional[list[str]] = Field(default=None, description="draft, in_queue, sending, done")
    search: Optional[str] = None
    offset: int = 0
    limit: int = 40
    order: str = "create_date desc"

class MailingCreate(BaseModel):
    name: str
    subject: str
    body_html: Optional[str] = None
    email_from: Optional[str] = None
    contact_list_ids: list[int] = Field(default_factory=list)

# --- POS ---
class PosSessionListParams(BaseModel):
    state: Optional[list[str]] = Field(default=None, description="opening_control, opened, closing_control, closed")
    config_id: Optional[int] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 20
    order: str = "start_at desc"

class PosOrderListParams(BaseModel):
    session_id: Optional[int] = None
    state: Optional[list[str]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "date_order desc"

# --- Calendar ---
class CalendarEventListParams(BaseModel):
    user_id: Optional[int] = None
    partner_id: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None
    offset: int = 0
    limit: int = 50
    order: str = "start desc"

class CalendarEventCreate(BaseModel):
    name: str
    start: datetime
    stop: datetime
    description: Optional[str] = None
    location: Optional[str] = None
    partner_ids: list[int] = Field(default_factory=list)
