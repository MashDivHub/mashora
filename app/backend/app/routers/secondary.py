"""
Phase 4 secondary module API endpoints.

Covers: fleet, repair, mrp, event, survey, mass_mailing, pos, calendar.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.services.base import async_create
from app.schemas.secondary import (
    VehicleListParams, VehicleCreate, VehicleUpdate, VehicleCostCreate,
    RepairListParams, RepairCreate, RepairUpdate,
    ProductionListParams, ProductionCreate, ProductionUpdate, BomListParams,
    EventListParams, EventCreate, EventUpdate, RegistrationCreate,
    SurveyListParams, SurveyCreate, SurveyUpdate,
    MailingListParams, MailingCreate, MailingUpdate,
    PosSessionListParams, PosOrderListParams,
    CalendarEventListParams, CalendarEventCreate, CalendarEventUpdate,
)
from app.services.secondary_service import (
    list_vehicles, get_vehicle, update_vehicle, list_vehicle_costs, create_vehicle_cost,
    list_repairs, get_repair, update_repair, repair_action,
    list_productions, get_production, update_production, production_action, list_boms, get_bom,
    list_events, get_event, update_event, event_action, list_registrations, create_registration,
    list_surveys, get_survey, update_survey, survey_action, list_survey_answers,
    list_mailings, get_mailing, update_mailing, mailing_action, get_mailing_stats,
    list_workcenters, list_workorders, get_mrp_dashboard,
    list_pos_sessions, get_pos_session, list_pos_orders, get_pos_order, pos_session_action,
    get_pos_dashboard, list_pos_configs,
    list_calendar_events, get_calendar_event, update_calendar_event, delete_calendar_event, calendar_event_action,
)

router = APIRouter(tags=["secondary modules"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


# ============================================
# FLEET
# ============================================

@router.post("/fleet/vehicles")
async def get_vehicles(params: VehicleListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or VehicleListParams()
    return await list_vehicles(params=p.model_dump())

@router.get("/fleet/vehicles/{vehicle_id}")
async def get_vehicle_detail(vehicle_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_vehicle(vehicle_id=vehicle_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return result

@router.patch("/fleet/vehicles/{vehicle_id}")
async def update_vehicle_detail(vehicle_id: int, body: VehicleUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    result = await update_vehicle(vehicle_id=vehicle_id, vals=body.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return result

@router.post("/fleet/vehicles/create", status_code=201)
async def create_vehicle(body: VehicleCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await async_create("fleet.vehicle", vals=body.model_dump(exclude_none=True), uid=_uid(user))

@router.get("/fleet/vehicles/{vehicle_id}/costs")
async def get_vehicle_costs(vehicle_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await list_vehicle_costs(vehicle_id=vehicle_id)

@router.post("/fleet/costs/create", status_code=201)
async def create_cost(body: VehicleCostCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await create_vehicle_cost(vals=body.model_dump(exclude_none=True))


# ============================================
# REPAIR
# ============================================

@router.post("/repair/orders")
async def get_repairs(params: RepairListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or RepairListParams()
    return await list_repairs(params=p.model_dump())

@router.get("/repair/orders/{repair_id}")
async def get_repair_detail(repair_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_repair(repair_id=repair_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return result

@router.patch("/repair/orders/{repair_id}")
async def update_repair_detail(repair_id: int, body: RepairUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    result = await update_repair(repair_id=repair_id, vals=body.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return result

@router.post("/repair/orders/create", status_code=201)
async def create_repair(body: RepairCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await async_create("repair.order", vals=body.model_dump(exclude_none=True), uid=_uid(user))

@router.post("/repair/orders/{repair_id}/confirm")
async def confirm_repair(repair_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await repair_action(repair_id=repair_id, action="action_repair_confirm")

@router.post("/repair/orders/{repair_id}/start")
async def start_repair(repair_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await repair_action(repair_id=repair_id, action="action_repair_start")

@router.post("/repair/orders/{repair_id}/done")
async def complete_repair(repair_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await repair_action(repair_id=repair_id, action="action_repair_end")

@router.post("/repair/orders/{repair_id}/cancel")
async def cancel_repair(repair_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await repair_action(repair_id=repair_id, action="action_repair_cancel")


# ============================================
# MRP (Manufacturing)
# ============================================

@router.post("/manufacturing/productions")
async def get_productions(params: ProductionListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or ProductionListParams()
    return await list_productions(params=p.model_dump())

@router.get("/manufacturing/productions/{production_id}")
async def get_production_detail(production_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_production(production_id=production_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Production order not found")
    return result

@router.patch("/manufacturing/productions/{production_id}")
async def update_production_detail(production_id: int, body: ProductionUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    result = await update_production(production_id=production_id, vals=body.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Production order not found")
    return result

@router.post("/manufacturing/productions/create", status_code=201)
async def create_production(body: ProductionCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await async_create("mrp.production", vals=body.model_dump(exclude_none=True), uid=_uid(user))

@router.post("/manufacturing/productions/{production_id}/confirm")
async def confirm_production(production_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await production_action(production_id=production_id, action="action_confirm")

@router.post("/manufacturing/productions/{production_id}/start")
async def start_production(production_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await production_action(production_id=production_id, action="button_start")

@router.post("/manufacturing/productions/{production_id}/produce")
async def produce_production(production_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await production_action(production_id=production_id, action="button_mark_done")

@router.post("/manufacturing/productions/{production_id}/cancel")
async def cancel_production(production_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await production_action(production_id=production_id, action="action_cancel")

@router.post("/manufacturing/boms")
async def get_boms(params: BomListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or BomListParams()
    return await list_boms(params=p.model_dump())

@router.get("/manufacturing/boms/{bom_id}")
async def get_bom_detail(bom_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_bom(bom_id=bom_id)
    if result is None:
        raise HTTPException(status_code=404, detail="BOM not found")
    return result

@router.get("/manufacturing/workcenters")
async def get_workcenters(user: CurrentUser | None = Depends(get_optional_user)):
    return await list_workcenters()

@router.post("/manufacturing/workorders")
async def get_workorders(params: dict | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    return await list_workorders(params=params or {})

@router.get("/manufacturing/dashboard")
async def mrp_dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    return await get_mrp_dashboard()


# ============================================
# EVENT
# ============================================

@router.post("/events/list")
async def get_events(params: EventListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or EventListParams()
    return await list_events(params=p.model_dump())

@router.get("/events/{event_id}")
async def get_event_detail(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_event(event_id=event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return result

@router.patch("/events/{event_id}")
async def update_event_detail(event_id: int, body: EventUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    result = await update_event(event_id=event_id, vals=body.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return result

@router.post("/events/create", status_code=201)
async def create_event(body: EventCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await async_create("event.event", vals=body.model_dump(exclude_none=True), uid=_uid(user))

@router.post("/events/{event_id}/confirm")
async def confirm_event(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await event_action(event_id=event_id, action="button_confirm")

@router.post("/events/{event_id}/cancel")
async def cancel_event(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await event_action(event_id=event_id, action="button_cancel")

@router.get("/events/{event_id}/registrations")
async def get_registrations(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await list_registrations(event_id=event_id)

@router.post("/events/registrations/create", status_code=201)
async def create_event_registration(body: RegistrationCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await create_registration(vals=body.model_dump(exclude_none=True))


# ============================================
# SURVEY
# ============================================

@router.post("/surveys/list")
async def get_surveys(params: SurveyListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or SurveyListParams()
    return await list_surveys(params=p.model_dump())

@router.get("/surveys/{survey_id}")
async def get_survey_detail(survey_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_survey(survey_id=survey_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Survey not found")
    return result

@router.patch("/surveys/{survey_id}")
async def update_survey_detail(survey_id: int, body: SurveyUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    result = await update_survey(survey_id=survey_id, vals=body.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Survey not found")
    return result

@router.post("/surveys/create", status_code=201)
async def create_survey(body: SurveyCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await async_create("survey.survey", vals=body.model_dump(exclude_none=True), uid=_uid(user))

@router.post("/surveys/{survey_id}/start")
async def start_survey(survey_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await survey_action(survey_id=survey_id, action="action_start_survey")

@router.post("/surveys/{survey_id}/close")
async def close_survey(survey_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await survey_action(survey_id=survey_id, action="action_close")

@router.get("/surveys/{survey_id}/answers")
async def get_survey_answers(survey_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await list_survey_answers(survey_id=survey_id)


# ============================================
# MASS MAILING
# ============================================

@router.post("/mailing/campaigns")
async def get_mailings(params: MailingListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or MailingListParams()
    return await list_mailings(params=p.model_dump())

@router.get("/mailing/campaigns/{mailing_id}")
async def get_mailing_detail(mailing_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_mailing(mailing_id=mailing_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Mailing not found")
    return result

@router.patch("/mailing/campaigns/{mailing_id}")
async def update_mailing_detail(mailing_id: int, body: MailingUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    result = await update_mailing(mailing_id=mailing_id, vals=body.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Mailing not found")
    return result

@router.post("/mailing/campaigns/create", status_code=201)
async def create_mailing(body: MailingCreate, user: CurrentUser | None = Depends(get_optional_user)):
    vals = body.model_dump(exclude_none=True)
    if "contact_list_ids" in vals:
        vals["contact_list_ids"] = vals["contact_list_ids"]
    return await async_create("mailing.mailing", vals=vals, uid=_uid(user))

@router.post("/mailing/campaigns/{mailing_id}/schedule")
async def schedule_mailing(mailing_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await mailing_action(mailing_id=mailing_id, action="action_schedule")

@router.post("/mailing/campaigns/{mailing_id}/cancel")
async def cancel_mailing(mailing_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await mailing_action(mailing_id=mailing_id, action="action_cancel")

@router.post("/mailing/campaigns/{mailing_id}/send")
async def send_mailing(mailing_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await mailing_action(mailing_id=mailing_id, action="action_put_in_queue")

@router.post("/mailing/campaigns/{mailing_id}/test")
async def test_mailing(mailing_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await mailing_action(mailing_id=mailing_id, action="action_test")

@router.get("/mailing/campaigns/{mailing_id}/stats")
async def get_mailing_statistics(mailing_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_mailing_stats(mailing_id=mailing_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Mailing not found")
    return result


# ============================================
# POS
# ============================================

@router.post("/pos/sessions")
async def get_pos_sessions(params: PosSessionListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or PosSessionListParams()
    return await list_pos_sessions(params=p.model_dump())

@router.get("/pos/sessions/{session_id}")
async def get_pos_session_detail(session_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_pos_session(session_id=session_id)
    if result is None:
        raise HTTPException(status_code=404, detail="POS session not found")
    return result

@router.get("/pos/sessions/{session_id}/orders")
async def get_session_orders(session_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    params = {"session_id": session_id, "offset": 0, "limit": 50, "order": "date_order desc"}
    return await list_pos_orders(params=params)

@router.post("/pos/sessions/{session_id}/open")
async def open_pos_session(session_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await pos_session_action(session_id=session_id, action="action_pos_session_open")

@router.post("/pos/sessions/{session_id}/close")
async def close_pos_session(session_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await pos_session_action(session_id=session_id, action="action_pos_session_close")

@router.post("/pos/orders")
async def get_pos_orders(params: PosOrderListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or PosOrderListParams()
    return await list_pos_orders(params=p.model_dump())

@router.get("/pos/orders/{order_id}")
async def get_pos_order_detail(order_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_pos_order(order_id=order_id)
    if result is None:
        raise HTTPException(status_code=404, detail="POS order not found")
    return result

@router.get("/pos/dashboard")
async def pos_dashboard(user: CurrentUser | None = Depends(get_optional_user)):
    return await get_pos_dashboard()

@router.get("/pos/configs")
async def pos_configs(user: CurrentUser | None = Depends(get_optional_user)):
    return await list_pos_configs()


# ============================================
# CALENDAR
# ============================================

@router.post("/calendar/events")
async def get_calendar_events(params: CalendarEventListParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or CalendarEventListParams()
    return await list_calendar_events(params=p.model_dump())

@router.get("/calendar/events/{event_id}")
async def get_calendar_event_detail(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await get_calendar_event(event_id=event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    return result

@router.patch("/calendar/events/{event_id}")
async def update_calendar_event_detail(event_id: int, body: CalendarEventUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    vals = body.model_dump(exclude_none=True)
    if "partner_ids" in vals:
        vals["partner_ids"] = vals["partner_ids"]
    result = await update_calendar_event(event_id=event_id, vals=vals)
    if result is None:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    return result

@router.delete("/calendar/events/{event_id}", status_code=204)
async def delete_calendar_event_endpoint(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    deleted = await delete_calendar_event(event_id=event_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Calendar event not found")

@router.post("/calendar/events/create", status_code=201)
async def create_calendar_event(body: CalendarEventCreate, user: CurrentUser | None = Depends(get_optional_user)):
    vals = body.model_dump(exclude_none=True)
    return await async_create("calendar.event", vals=vals, uid=_uid(user))

@router.post("/calendar/events/{event_id}/accept")
async def accept_calendar_event(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await calendar_event_action(event_id=event_id, action="action_accept_invitation")

@router.post("/calendar/events/{event_id}/decline")
async def decline_calendar_event(event_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await calendar_event_action(event_id=event_id, action="action_decline_invitation")
