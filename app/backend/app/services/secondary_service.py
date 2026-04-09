"""
Service layer for Phase 4 secondary modules.

Covers: fleet, repair, mrp, event, survey, mass_mailing, pos, calendar.
"""
import logging
from typing import Any, Optional

from app.core.model_registry import get_model_class
from app.services.base import (
    RecordNotFoundError,
    async_action,
    async_count,
    async_create,
    async_delete,
    async_get,
    async_get_or_raise,
    async_search_read,
    async_sum,
    async_update,
)

_logger = logging.getLogger(__name__)


# ============================================
# FLEET
# ============================================

VEHICLE_FIELDS = [
    "id", "name", "license_plate", "model_id", "driver_id",
    "state_id", "fuel_type", "acquisition_date", "seats",
    "company_id", "image_128",
]

VEHICLE_COST_FIELDS = [
    "id", "vehicle_id", "cost_subtype_id", "amount", "date",
    "description", "create_date",
]


async def list_vehicles(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("fleet.vehicle") is None:
        return {"records": [], "total": 0, "warning": "fleet module not installed"}
    domain: list[Any] = []
    if params.get("state_id"):
        domain.append(["state_id", "=", params["state_id"]])
    if params.get("driver_id"):
        domain.append(["driver_id", "=", params["driver_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["license_plate", "ilike", params["search"]])
    return await async_search_read(
        "fleet.vehicle", domain, VEHICLE_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "name asc"),
    )


async def get_vehicle(vehicle_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("fleet.vehicle") is None:
        return None
    return await async_get("fleet.vehicle", vehicle_id, VEHICLE_FIELDS + ["color", "horsepower", "odometer", "tag_ids"])


async def update_vehicle(vehicle_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("fleet.vehicle") is None:
        return None
    try:
        return await async_update("fleet.vehicle", vehicle_id, vals, uid=uid,
                                   fields=VEHICLE_FIELDS + ["color", "horsepower", "odometer", "tag_ids"])
    except RecordNotFoundError:
        return None


async def list_vehicle_costs(vehicle_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("fleet.vehicle.cost") is None:
        return {"records": [], "total": 0, "warning": "fleet module not installed"}
    domain: list[Any] = [["vehicle_id", "=", vehicle_id]]
    return await async_search_read("fleet.vehicle.cost", domain, VEHICLE_COST_FIELDS, order="date desc")


async def create_vehicle_cost(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("fleet.vehicle.cost") is None:
        raise RuntimeError("fleet module not installed")
    return await async_create("fleet.vehicle.cost", vals, uid=uid, fields=VEHICLE_COST_FIELDS)


# ============================================
# REPAIR
# ============================================

REPAIR_FIELDS = [
    "id", "name", "state", "product_id", "partner_id",
    "lot_id", "priority", "company_id", "description",
    "operations",
]


async def list_repairs(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("repair.order") is None:
        return {"records": [], "total": 0, "warning": "repair module not installed"}
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("partner_id"):
        domain.append(["partner_id", "=", params["partner_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["product_id.name", "ilike", params["search"]])
    return await async_search_read(
        "repair.order", domain, REPAIR_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "name desc"),
    )


async def get_repair(repair_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("repair.order") is None:
        return None
    return await async_get("repair.order", repair_id, REPAIR_FIELDS)


async def update_repair(repair_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("repair.order") is None:
        return None
    try:
        return await async_update("repair.order", repair_id, vals, uid=uid, fields=REPAIR_FIELDS)
    except RecordNotFoundError:
        return None


async def repair_action(repair_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("repair.order") is None:
        raise RuntimeError("repair module not installed")
    state_map = {"action_repair_confirm": "confirmed", "action_repair_start": "under_repair", "action_repair_end": "done", "action_repair_cancel": "cancel"}
    new_state = state_map.get(action)
    if new_state:
        return await async_action("repair.order", repair_id, "state", new_state, uid=uid, fields=REPAIR_FIELDS)
    return await async_get_or_raise("repair.order", repair_id, REPAIR_FIELDS)


# ============================================
# MRP (Manufacturing)
# ============================================

PRODUCTION_FIELDS = [
    "id", "name", "state", "product_id", "product_qty",
    "qty_producing", "product_uom_id",
    "bom_id", "date_start", "date_finished",
    "company_id", "user_id", "origin",
]

PRODUCTION_DETAIL_FIELDS = PRODUCTION_FIELDS + [
    "move_raw_ids", "move_finished_ids", "workorder_ids",
    "lot_producing_id", "create_date", "write_date",
]

BOM_FIELDS = [
    "id", "code", "product_tmpl_id", "product_qty",
    "product_uom_id", "type", "bom_line_ids", "company_id",
    "ready_to_produce",
]

BOM_LINE_FIELDS = [
    "id", "product_id", "product_qty", "product_uom_id",
    "bom_id", "sequence",
]

WORKCENTER_FIELDS = [
    "id", "name", "code", "active", "company_id",
    "time_start", "time_stop", "time_efficiency",
    "capacity", "sequence", "color",
    "working_state", "oee", "blocked_time", "productive_time",
]

WORKORDER_FIELDS = [
    "id", "name", "state", "production_id", "workcenter_id",
    "product_id", "qty_producing", "qty_produced", "qty_remaining",
    "date_start", "date_finished", "duration_expected", "duration",
]

MOVE_RAW_FIELDS = [
    "id", "product_id", "product_uom_qty", "quantity",
    "product_uom_id", "state",
]


async def list_productions(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("mrp.production") is None:
        return {"records": [], "total": 0, "warning": "mrp module not installed"}
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("product_id"):
        domain.append(["product_id", "=", params["product_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["product_id.name", "ilike", params["search"]])
    return await async_search_read(
        "mrp.production", domain, PRODUCTION_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date_start desc, name desc"),
    )


async def get_production(production_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("mrp.production") is None:
        return None
    data = await async_get("mrp.production", production_id, PRODUCTION_DETAIL_FIELDS)
    if data is None:
        return None
    # Read raw materials (components)
    raw_ids = data.get("move_raw_ids") or []
    if raw_ids:
        result = await async_search_read("stock.move", [["id", "in", raw_ids]], MOVE_RAW_FIELDS, limit=len(raw_ids))
        data["components"] = result["records"]
    else:
        data["components"] = []
    # Read work orders
    wo_ids = data.get("workorder_ids") or []
    if wo_ids:
        result = await async_search_read("mrp.workorder", [["id", "in", wo_ids]], WORKORDER_FIELDS, limit=len(wo_ids))
        data["workorders"] = result["records"]
    else:
        data["workorders"] = []
    return data


async def update_production(production_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("mrp.production") is None:
        return None
    try:
        return await async_update("mrp.production", production_id, vals, uid=uid, fields=PRODUCTION_FIELDS)
    except RecordNotFoundError:
        return None


async def production_action(production_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("mrp.production") is None:
        raise RuntimeError("mrp module not installed")
    state_map = {"action_confirm": "confirmed", "button_start": "progress", "button_mark_done": "done", "action_cancel": "cancel"}
    new_state = state_map.get(action)
    if new_state:
        return await async_action("mrp.production", production_id, "state", new_state, uid=uid, fields=PRODUCTION_FIELDS)
    return await async_get_or_raise("mrp.production", production_id, PRODUCTION_FIELDS)


async def list_boms(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("mrp.bom") is None:
        return {"records": [], "total": 0, "warning": "mrp module not installed"}
    domain: list[Any] = []
    if params.get("product_tmpl_id"):
        domain.append(["product_tmpl_id", "=", params["product_tmpl_id"]])
    if params.get("type"):
        domain.append(["type", "=", params["type"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["code", "ilike", params["search"]])
        domain.append(["product_tmpl_id.name", "ilike", params["search"]])
    return await async_search_read(
        "mrp.bom", domain, BOM_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "product_tmpl_id asc"),
    )


async def get_bom(bom_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("mrp.bom") is None:
        return None
    data = await async_get("mrp.bom", bom_id, BOM_FIELDS)
    if data is None:
        return None
    line_ids = data.get("bom_line_ids") or []
    if line_ids:
        result = await async_search_read("mrp.bom.line", [["id", "in", line_ids]], BOM_LINE_FIELDS, limit=len(line_ids))
        data["lines"] = result["records"]
    else:
        data["lines"] = []
    return data


async def list_workcenters(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List manufacturing work centers."""
    if get_model_class("mrp.workcenter") is None:
        return {"records": [], "total": 0, "warning": "mrp module not installed"}
    result = await async_search_read("mrp.workcenter", [], WORKCENTER_FIELDS, limit=1000, order="sequence asc, name asc")
    return result


async def list_workorders(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List work orders with filters."""
    if get_model_class("mrp.workorder") is None:
        return {"records": [], "total": 0, "warning": "mrp module not installed"}
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("workcenter_id"):
        domain.append(["workcenter_id", "=", params["workcenter_id"]])
    if params.get("production_id"):
        domain.append(["production_id", "=", params["production_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    return await async_search_read(
        "mrp.workorder", domain, WORKORDER_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date_start desc"),
    )


async def get_mrp_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get manufacturing dashboard summary."""
    if get_model_class("mrp.production") is None:
        return {"warning": "mrp module not installed"}
    draft = await async_count("mrp.production", [["state", "=", "draft"]])
    confirmed = await async_count("mrp.production", [["state", "=", "confirmed"]])
    in_progress = await async_count("mrp.production", [["state", "=", "progress"]])
    done = await async_count("mrp.production", [["state", "=", "done"]])
    late = await async_count("mrp.production", [
        ["state", "in", ["confirmed", "progress"]],
        ["date_start", "<", _today_str()],
    ])
    bom_count = await async_count("mrp.bom", []) if get_model_class("mrp.bom") is not None else 0
    wc_count = await async_count("mrp.workcenter", []) if get_model_class("mrp.workcenter") is not None else 0
    return {
        "draft": draft, "confirmed": confirmed, "in_progress": in_progress,
        "done": done, "late": late, "bom_count": bom_count, "workcenter_count": wc_count,
    }


# ============================================
# EVENT
# ============================================

EVENT_FIELDS = [
    "id", "name", "event_type_id", "date_begin", "date_end",
    "address_id", "organizer_id", "kanban_state",
    "seats_max", "seats_reserved", "seats_available", "seats_used",
    "company_id",
]

EVENT_REGISTRATION_FIELDS = [
    "id", "event_id", "partner_id", "name", "email",
    "phone", "state", "create_date",
]


async def list_events(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("event.event") is None:
        return {"records": [], "total": 0, "warning": "event module not installed"}
    domain: list[Any] = []
    if params.get("kanban_state"):
        domain.append(["kanban_state", "=", params["kanban_state"]])
    if params.get("date_from"):
        domain.append(["date_begin", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["date_end", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    return await async_search_read(
        "event.event", domain, EVENT_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date_begin desc"),
    )


async def get_event(event_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("event.event") is None:
        return None
    return await async_get("event.event", event_id, EVENT_FIELDS + ["registration_ids"])


async def update_event(event_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("event.event") is None:
        return None
    try:
        return await async_update("event.event", event_id, vals, uid=uid, fields=EVENT_FIELDS)
    except RecordNotFoundError:
        return None


async def event_action(event_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("event.event") is None:
        raise RuntimeError("event module not installed")
    state_map = {"button_confirm": "confirm", "button_cancel": "cancel"}
    new_state = state_map.get(action)
    if new_state:
        return await async_action("event.event", event_id, "state", new_state, uid=uid, fields=EVENT_FIELDS)
    return await async_get_or_raise("event.event", event_id, EVENT_FIELDS)


async def list_registrations(event_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("event.registration") is None:
        return {"records": [], "total": 0, "warning": "event module not installed"}
    domain: list[Any] = [["event_id", "=", event_id]]
    return await async_search_read("event.registration", domain, EVENT_REGISTRATION_FIELDS, order="create_date desc")


async def create_registration(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("event.registration") is None:
        raise RuntimeError("event module not installed")
    return await async_create("event.registration", vals, uid=uid, fields=EVENT_REGISTRATION_FIELDS)


# ============================================
# SURVEY
# ============================================

SURVEY_FIELDS = [
    "id", "title", "survey_type", "description",
    "questions_layout", "user_id", "active",
    "access_token", "session_state",
]

SURVEY_ANSWER_FIELDS = [
    "id", "survey_id", "partner_id", "state",
    "scoring_total", "create_date",
]


async def list_surveys(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("survey.survey") is None:
        return {"records": [], "total": 0, "warning": "survey module not installed"}
    domain: list[Any] = []
    if params.get("survey_type"):
        domain.append(["survey_type", "=", params["survey_type"]])
    if params.get("search"):
        domain.append(["title", "ilike", params["search"]])
    return await async_search_read(
        "survey.survey", domain, SURVEY_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "create_date desc"),
    )


async def get_survey(survey_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("survey.survey") is None:
        return None
    return await async_get("survey.survey", survey_id, SURVEY_FIELDS + ["question_ids"])


async def update_survey(survey_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("survey.survey") is None:
        return None
    try:
        return await async_update("survey.survey", survey_id, vals, uid=uid, fields=SURVEY_FIELDS)
    except RecordNotFoundError:
        return None


async def survey_action(survey_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("survey.survey") is None:
        raise RuntimeError("survey module not installed")
    state_map = {"action_start_survey": "open", "action_close": "closed"}
    new_state = state_map.get(action)
    if new_state:
        return await async_action("survey.survey", survey_id, "state", new_state, uid=uid, fields=SURVEY_FIELDS)
    return await async_get_or_raise("survey.survey", survey_id, SURVEY_FIELDS)


async def list_survey_answers(survey_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("survey.user_input") is None:
        return {"records": [], "total": 0, "warning": "survey module not installed"}
    domain: list[Any] = [["survey_id", "=", survey_id]]
    return await async_search_read("survey.user_input", domain, SURVEY_ANSWER_FIELDS, order="create_date desc")


# ============================================
# MASS MAILING
# ============================================

MAILING_FIELDS = [
    "id", "name", "subject", "state", "mailing_type",
    "email_from", "contact_list_ids", "user_id",
    "sent", "delivered", "opened", "bounced",
]


async def list_mailings(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("mailing.mailing") is None:
        return {"records": [], "total": 0, "warning": "mass_mailing module not installed"}
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["subject", "ilike", params["search"]])
    return await async_search_read(
        "mailing.mailing", domain, MAILING_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "create_date desc"),
    )


async def get_mailing(mailing_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("mailing.mailing") is None:
        return None
    return await async_get("mailing.mailing", mailing_id, MAILING_FIELDS)


async def update_mailing(mailing_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("mailing.mailing") is None:
        return None
    try:
        return await async_update("mailing.mailing", mailing_id, vals, uid=uid, fields=MAILING_FIELDS)
    except RecordNotFoundError:
        return None


async def mailing_action(mailing_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("mailing.mailing") is None:
        raise RuntimeError("mass_mailing module not installed")
    state_map = {"action_schedule": "in_queue", "action_cancel": "draft", "action_put_in_queue": "in_queue", "action_test": "test"}
    new_state = state_map.get(action)
    if new_state:
        return await async_action("mailing.mailing", mailing_id, "state", new_state, uid=uid, fields=MAILING_FIELDS)
    return await async_get_or_raise("mailing.mailing", mailing_id, MAILING_FIELDS)


async def get_mailing_stats(mailing_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("mailing.mailing") is None:
        return None
    return await async_get("mailing.mailing", mailing_id,
                            ["id", "name", "subject", "state", "sent", "delivered", "opened", "bounced", "clicked"])


# ============================================
# POS
# ============================================

POS_SESSION_FIELDS = [
    "id", "name", "state", "config_id", "user_id",
    "start_at", "stop_at",
    "cash_register_balance_start", "cash_register_balance_end_real",
    "cash_register_balance_end", "cash_register_difference",
    "order_count", "total_payments_amount",
]

POS_SESSION_DETAIL_FIELDS = POS_SESSION_FIELDS + [
    "order_ids", "opening_notes", "closing_notes",
    "cash_control", "payment_method_ids", "company_id", "currency_id",
]

POS_ORDER_FIELDS = [
    "id", "name", "state", "session_id", "partner_id",
    "date_order", "amount_total", "amount_tax",
    "amount_paid", "amount_return",
    "pos_reference", "employee_id",
]

POS_ORDER_DETAIL_FIELDS = POS_ORDER_FIELDS + [
    "lines", "payment_ids", "fiscal_position_id",
    "to_invoice", "account_move", "config_id",
]

POS_ORDER_LINE_FIELDS = [
    "id", "product_id", "full_product_name", "qty",
    "price_unit", "discount", "price_subtotal",
    "price_subtotal_incl", "customer_note",
]

POS_PAYMENT_FIELDS = [
    "id", "amount", "payment_method_id", "card_type", "transaction_id",
]

POS_CONFIG_FIELDS = [
    "id", "name", "company_id", "currency_id",
    "payment_method_ids", "pricelist_id",
    "journal_id", "warehouse_id",
    "module_pos_restaurant", "iface_tax_included",
    "iface_tipproduct", "tip_product_id",
    "iface_print_auto", "iface_cashdrawer",
    "cash_rounding", "limit_categories",
]

POS_PAYMENT_METHOD_FIELDS = [
    "id", "name", "type", "is_cash_count", "journal_id",
]


async def list_pos_sessions(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("pos.session") is None:
        return {"records": [], "total": 0, "warning": "point_of_sale module not installed"}
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("config_id"):
        domain.append(["config_id", "=", params["config_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    return await async_search_read(
        "pos.session", domain, POS_SESSION_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 20),
        order=params.get("order", "start_at desc"),
    )


async def get_pos_session(session_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("pos.session") is None:
        return None
    data = await async_get("pos.session", session_id, POS_SESSION_DETAIL_FIELDS)
    if data is None:
        return None
    # Read orders summary
    order_ids = data.get("order_ids") or []
    if order_ids:
        result = await async_search_read("pos.order", [["id", "in", order_ids]], POS_ORDER_FIELDS, limit=len(order_ids))
        data["orders"] = result["records"]
    else:
        data["orders"] = []
    # Read payment methods
    pm_ids = data.get("payment_method_ids") or []
    if pm_ids:
        result = await async_search_read("pos.payment.method", [["id", "in", pm_ids]], POS_PAYMENT_METHOD_FIELDS, limit=len(pm_ids))
        data["payment_methods"] = result["records"]
    else:
        data["payment_methods"] = []
    return data


async def get_pos_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get POS dashboard summary."""
    if get_model_class("pos.session") is None:
        return {"warning": "point_of_sale module not installed"}
    open_sessions = await async_count("pos.session", [["state", "in", ["opened", "opening_control"]]])
    closed_today = await async_count("pos.session", [
        ["state", "=", "closed"],
        ["stop_at", ">=", _today_str()],
    ])
    total_orders_today = await async_count("pos.order", [
        ["date_order", ">=", _today_str()],
        ["state", "in", ["paid", "done"]],
    ])
    today_revenue = await async_sum("pos.order", "amount_total", [
        ["date_order", ">=", _today_str()],
        ["state", "in", ["paid", "done"]],
    ])
    return {
        "open_sessions": open_sessions,
        "closed_today": closed_today,
        "orders_today": total_orders_today,
        "revenue_today": today_revenue,
    }


def _today_str() -> str:
    import datetime
    return datetime.date.today().isoformat()


async def list_pos_configs(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List POS configurations."""
    if get_model_class("pos.config") is None:
        return {"records": [], "total": 0}
    result = await async_search_read("pos.config", [], POS_CONFIG_FIELDS, limit=1000)
    data = result["records"]
    # Enrich with session counts
    for cfg in data:
        cfg["session_count"] = await async_count("pos.session", [["config_id", "=", cfg["id"]]])
        cfg["open_session"] = await async_count("pos.session", [
            ["config_id", "=", cfg["id"]],
            ["state", "in", ["opened", "opening_control"]],
        ])
    return {"records": data, "total": len(data)}


async def get_pos_order(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    if get_model_class("pos.order") is None:
        return None
    data = await async_get("pos.order", order_id, POS_ORDER_DETAIL_FIELDS)
    if data is None:
        return None
    # Read order lines
    line_ids = data.get("lines") or []
    if line_ids:
        result = await async_search_read("pos.order.line", [["id", "in", line_ids]], POS_ORDER_LINE_FIELDS, limit=len(line_ids))
        data["order_lines"] = result["records"]
    else:
        data["order_lines"] = []
    # Read payments
    payment_ids = data.get("payment_ids") or []
    if payment_ids:
        result = await async_search_read("pos.payment", [["id", "in", payment_ids]], POS_PAYMENT_FIELDS, limit=len(payment_ids))
        data["payments"] = result["records"]
    else:
        data["payments"] = []
    return data


async def list_pos_orders(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("pos.order") is None:
        return {"records": [], "total": 0, "warning": "point_of_sale module not installed"}
    domain: list[Any] = []
    if params.get("session_id"):
        domain.append(["session_id", "=", params["session_id"]])
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("date_from"):
        domain.append(["date_order", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["date_order", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["pos_reference", "ilike", params["search"]])
    return await async_search_read(
        "pos.order", domain, POS_ORDER_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "date_order desc"),
    )


async def pos_session_action(session_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    if get_model_class("pos.session") is None:
        raise RuntimeError("point_of_sale module not installed")
    state_map = {"action_pos_session_open": "opened", "action_pos_session_close": "closed"}
    new_state = state_map.get(action)
    if new_state:
        return await async_action("pos.session", session_id, "state", new_state, uid=uid, fields=POS_SESSION_FIELDS)
    return await async_get_or_raise("pos.session", session_id, POS_SESSION_FIELDS)


# ============================================
# CALENDAR
# ============================================

CALENDAR_FIELDS = [
    "id", "name", "start", "stop", "allday",
    "description", "location", "partner_ids",
    "user_id", "recurrency",
]


async def list_calendar_events(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("user_id"):
        domain.append(["user_id", "=", params["user_id"]])
    if params.get("partner_id"):
        domain.append(["partner_ids", "in", [params["partner_id"]]])
    if params.get("date_from"):
        domain.append(["start", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["stop", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    return await async_search_read(
        "calendar.event", domain, CALENDAR_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 50),
        order=params.get("order", "start desc"),
    )


async def get_calendar_event(event_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    return await async_get("calendar.event", event_id, CALENDAR_FIELDS)


async def update_calendar_event(event_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    try:
        return await async_update("calendar.event", event_id, vals, uid=uid, fields=CALENDAR_FIELDS)
    except RecordNotFoundError:
        return None


async def delete_calendar_event(event_id: int, uid: int = 1, context: Optional[dict] = None) -> bool:
    try:
        return await async_delete("calendar.event", event_id)
    except RecordNotFoundError:
        return False


async def calendar_event_action(event_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    # Calendar events don't have a state machine — just return the record
    return await async_get_or_raise("calendar.event", event_id, CALENDAR_FIELDS)
