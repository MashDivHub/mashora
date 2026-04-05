"""
Phase 4 secondary module API endpoints.

Covers: fleet, repair, mrp, event, survey, mass_mailing, pos, calendar.
"""
from fastapi import APIRouter, HTTPException

from app.core.orm_adapter import orm_call, create_record
from app.schemas.secondary import (
    VehicleListParams, VehicleCreate,
    RepairListParams, RepairCreate,
    ProductionListParams, ProductionCreate, BomListParams,
    EventListParams, EventCreate,
    SurveyListParams, SurveyCreate,
    MailingListParams, MailingCreate,
    PosSessionListParams, PosOrderListParams,
    CalendarEventListParams, CalendarEventCreate,
)
from app.services.secondary_service import (
    list_vehicles, get_vehicle,
    list_repairs, repair_action,
    list_productions, production_action, list_boms,
    list_events,
    list_surveys,
    list_mailings, mailing_action,
    list_pos_sessions, list_pos_orders, pos_session_action,
    list_calendar_events,
)

router = APIRouter(tags=["secondary modules"])


# ============================================
# FLEET
# ============================================

@router.post("/fleet/vehicles")
async def get_vehicles(params: VehicleListParams | None = None):
    p = params or VehicleListParams()
    return await orm_call(list_vehicles, params=p.model_dump())

@router.get("/fleet/vehicles/{vehicle_id}")
async def get_vehicle_detail(vehicle_id: int):
    result = await orm_call(get_vehicle, vehicle_id=vehicle_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return result

@router.post("/fleet/vehicles/create", status_code=201)
async def create_vehicle(body: VehicleCreate):
    return await orm_call(create_record, model="fleet.vehicle", vals=body.model_dump(exclude_none=True))


# ============================================
# REPAIR
# ============================================

@router.post("/repair/orders")
async def get_repairs(params: RepairListParams | None = None):
    p = params or RepairListParams()
    return await orm_call(list_repairs, params=p.model_dump())

@router.post("/repair/orders/create", status_code=201)
async def create_repair(body: RepairCreate):
    return await orm_call(create_record, model="repair.order", vals=body.model_dump(exclude_none=True))

@router.post("/repair/orders/{repair_id}/start")
async def start_repair(repair_id: int):
    return await orm_call(repair_action, repair_id=repair_id, action="action_repair_start")

@router.post("/repair/orders/{repair_id}/done")
async def complete_repair(repair_id: int):
    return await orm_call(repair_action, repair_id=repair_id, action="action_repair_done")


# ============================================
# MRP (Manufacturing)
# ============================================

@router.post("/manufacturing/productions")
async def get_productions(params: ProductionListParams | None = None):
    p = params or ProductionListParams()
    return await orm_call(list_productions, params=p.model_dump())

@router.post("/manufacturing/productions/create", status_code=201)
async def create_production(body: ProductionCreate):
    return await orm_call(create_record, model="mrp.production", vals=body.model_dump(exclude_none=True))

@router.post("/manufacturing/productions/{production_id}/confirm")
async def confirm_production(production_id: int):
    return await orm_call(production_action, production_id=production_id, action="action_confirm")

@router.post("/manufacturing/boms")
async def get_boms(params: BomListParams | None = None):
    p = params or BomListParams()
    return await orm_call(list_boms, params=p.model_dump())


# ============================================
# EVENT
# ============================================

@router.post("/events/list")
async def get_events(params: EventListParams | None = None):
    p = params or EventListParams()
    return await orm_call(list_events, params=p.model_dump())

@router.post("/events/create", status_code=201)
async def create_event(body: EventCreate):
    return await orm_call(create_record, model="event.event", vals=body.model_dump(exclude_none=True))


# ============================================
# SURVEY
# ============================================

@router.post("/surveys/list")
async def get_surveys(params: SurveyListParams | None = None):
    p = params or SurveyListParams()
    return await orm_call(list_surveys, params=p.model_dump())

@router.post("/surveys/create", status_code=201)
async def create_survey(body: SurveyCreate):
    return await orm_call(create_record, model="survey.survey", vals=body.model_dump(exclude_none=True))


# ============================================
# MASS MAILING
# ============================================

@router.post("/mailing/campaigns")
async def get_mailings(params: MailingListParams | None = None):
    p = params or MailingListParams()
    return await orm_call(list_mailings, params=p.model_dump())

@router.post("/mailing/campaigns/create", status_code=201)
async def create_mailing(body: MailingCreate):
    vals = body.model_dump(exclude_none=True)
    if "contact_list_ids" in vals:
        vals["contact_list_ids"] = [(6, 0, vals["contact_list_ids"])]
    return await orm_call(create_record, model="mailing.mailing", vals=vals)

@router.post("/mailing/campaigns/{mailing_id}/send")
async def send_mailing(mailing_id: int):
    return await orm_call(mailing_action, mailing_id=mailing_id, action="action_put_in_queue")

@router.post("/mailing/campaigns/{mailing_id}/test")
async def test_mailing(mailing_id: int):
    return await orm_call(mailing_action, mailing_id=mailing_id, action="action_test")


# ============================================
# POS
# ============================================

@router.post("/pos/sessions")
async def get_pos_sessions(params: PosSessionListParams | None = None):
    p = params or PosSessionListParams()
    return await orm_call(list_pos_sessions, params=p.model_dump())

@router.post("/pos/sessions/{session_id}/open")
async def open_pos_session(session_id: int):
    return await orm_call(pos_session_action, session_id=session_id, action="action_pos_session_open")

@router.post("/pos/sessions/{session_id}/close")
async def close_pos_session(session_id: int):
    return await orm_call(pos_session_action, session_id=session_id, action="action_pos_session_close")

@router.post("/pos/orders")
async def get_pos_orders(params: PosOrderListParams | None = None):
    p = params or PosOrderListParams()
    return await orm_call(list_pos_orders, params=p.model_dump())


# ============================================
# CALENDAR
# ============================================

@router.post("/calendar/events")
async def get_calendar_events(params: CalendarEventListParams | None = None):
    p = params or CalendarEventListParams()
    return await orm_call(list_calendar_events, params=p.model_dump())

@router.post("/calendar/events/create", status_code=201)
async def create_calendar_event(body: CalendarEventCreate):
    vals = body.model_dump(exclude_none=True)
    if "partner_ids" in vals:
        vals["partner_ids"] = [(6, 0, vals["partner_ids"])]
    return await orm_call(create_record, model="calendar.event", vals=vals)
