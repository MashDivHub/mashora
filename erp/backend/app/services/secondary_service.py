"""
Service layer for Phase 4 secondary modules.

Covers: fleet, repair, mrp, event, survey, mass_mailing, pos, calendar.
"""
import logging
from typing import Any

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)


# ============================================
# FLEET
# ============================================

VEHICLE_FIELDS = [
    "id", "name", "license_plate", "model_id", "driver_id",
    "state_id", "fuel_type", "acquisition_date", "seats",
    "company_id", "image_128",
]

def list_vehicles(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("state_id"):
        domain.append(["state_id", "=", params["state_id"]])
    if params.get("driver_id"):
        domain.append(["driver_id", "=", params["driver_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["license_plate", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        V = env["fleet.vehicle"]
        total = V.search_count(domain)
        records = V.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "name asc"))
        return {"records": records.read(VEHICLE_FIELDS), "total": total}

def get_vehicle(vehicle_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        v = env["fleet.vehicle"].browse(vehicle_id)
        if not v.exists():
            return None
        return v.read(VEHICLE_FIELDS + ["color", "horsepower", "odometer", "tag_ids"])[0]


# ============================================
# REPAIR
# ============================================

REPAIR_FIELDS = [
    "id", "name", "state", "product_id", "partner_id",
    "lot_id", "priority", "company_id", "description",
]

def list_repairs(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("partner_id"):
        domain.append(["partner_id", "=", params["partner_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["product_id.name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        R = env["repair.order"]
        total = R.search_count(domain)
        records = R.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "name desc"))
        return {"records": records.read(REPAIR_FIELDS), "total": total}

def repair_action(repair_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        r = env["repair.order"].browse(repair_id)
        getattr(r, action)()
        return r.read(REPAIR_FIELDS)[0]


# ============================================
# MRP (Manufacturing)
# ============================================

PRODUCTION_FIELDS = [
    "id", "name", "state", "product_id", "product_qty",
    "bom_id", "date_start", "date_finished",
    "company_id", "user_id",
]

BOM_FIELDS = [
    "id", "code", "product_tmpl_id", "product_qty",
    "type", "bom_line_ids", "company_id",
]

def list_productions(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("product_id"):
        domain.append(["product_id", "=", params["product_id"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["product_id.name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        P = env["mrp.production"]
        total = P.search_count(domain)
        records = P.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "date_start desc, name desc"))
        return {"records": records.read(PRODUCTION_FIELDS), "total": total}

def production_action(production_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        p = env["mrp.production"].browse(production_id)
        getattr(p, action)()
        return p.read(PRODUCTION_FIELDS)[0]

def list_boms(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("product_tmpl_id"):
        domain.append(["product_tmpl_id", "=", params["product_tmpl_id"]])
    if params.get("type"):
        domain.append(["type", "=", params["type"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["code", "ilike", params["search"]])
        domain.append(["product_tmpl_id.name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        B = env["mrp.bom"]
        total = B.search_count(domain)
        records = B.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 50), order=params.get("order", "product_tmpl_id asc"))
        return {"records": records.read(BOM_FIELDS), "total": total}


# ============================================
# EVENT
# ============================================

EVENT_FIELDS = [
    "id", "name", "event_type_id", "date_begin", "date_end",
    "address_id", "organizer_id", "kanban_state",
    "seats_max", "seats_reserved", "seats_available", "seats_used",
    "company_id",
]

def list_events(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("kanban_state"):
        domain.append(["kanban_state", "=", params["kanban_state"]])
    if params.get("date_from"):
        domain.append(["date_begin", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["date_end", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        E = env["event.event"]
        total = E.search_count(domain)
        records = E.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "date_begin desc"))
        return {"records": records.read(EVENT_FIELDS), "total": total}


# ============================================
# SURVEY
# ============================================

SURVEY_FIELDS = [
    "id", "title", "survey_type", "description",
    "questions_layout", "user_id", "active",
    "access_token", "session_state",
]

def list_surveys(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("survey_type"):
        domain.append(["survey_type", "=", params["survey_type"]])
    if params.get("search"):
        domain.append(["title", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        S = env["survey.survey"]
        total = S.search_count(domain)
        records = S.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "create_date desc"))
        return {"records": records.read(SURVEY_FIELDS), "total": total}


# ============================================
# MASS MAILING
# ============================================

MAILING_FIELDS = [
    "id", "name", "subject", "state", "mailing_type",
    "email_from", "contact_list_ids", "user_id",
    "sent", "delivered", "opened", "bounced",
]

def list_mailings(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("search"):
        domain.append("|")
        domain.append(["name", "ilike", params["search"]])
        domain.append(["subject", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        M = env["mailing.mailing"]
        total = M.search_count(domain)
        records = M.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "create_date desc"))
        return {"records": records.read(MAILING_FIELDS), "total": total}

def mailing_action(mailing_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        m = env["mailing.mailing"].browse(mailing_id)
        getattr(m, action)()
        return m.read(MAILING_FIELDS)[0]


# ============================================
# POS
# ============================================

POS_SESSION_FIELDS = [
    "id", "name", "state", "config_id", "user_id",
    "start_at", "stop_at",
    "cash_register_balance_start", "cash_register_balance_end_real",
]

POS_ORDER_FIELDS = [
    "id", "name", "state", "session_id", "partner_id",
    "date_order", "amount_total", "amount_tax",
    "pos_reference",
]

def list_pos_sessions(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("config_id"):
        domain.append(["config_id", "=", params["config_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        S = env["pos.session"]
        total = S.search_count(domain)
        records = S.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 20), order=params.get("order", "start_at desc"))
        return {"records": records.read(POS_SESSION_FIELDS), "total": total}

def list_pos_orders(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
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
    with mashora_env(uid=uid, context=context) as env:
        O = env["pos.order"]
        total = O.search_count(domain)
        records = O.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 50), order=params.get("order", "date_order desc"))
        return {"records": records.read(POS_ORDER_FIELDS), "total": total}

def pos_session_action(session_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        s = env["pos.session"].browse(session_id)
        getattr(s, action)()
        return s.read(POS_SESSION_FIELDS)[0]


# ============================================
# CALENDAR
# ============================================

CALENDAR_FIELDS = [
    "id", "name", "start", "stop", "allday",
    "description", "location", "partner_ids",
    "user_id", "recurrency",
]

def list_calendar_events(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
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
    with mashora_env(uid=uid, context=context) as env:
        E = env["calendar.event"]
        total = E.search_count(domain)
        records = E.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 50), order=params.get("order", "start desc"))
        return {"records": records.read(CALENDAR_FIELDS), "total": total}
