"""
Service layer for Phase 4 secondary modules.

Covers: fleet, repair, mrp, event, survey, mass_mailing, pos, calendar.
"""
import logging
from typing import Any, Optional

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

VEHICLE_COST_FIELDS = [
    "id", "vehicle_id", "cost_subtype_id", "amount", "date",
    "description", "create_date",
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
        if "fleet.vehicle" not in env.registry:
            return {"records": [], "total": 0, "warning": "fleet module not installed"}
        V = env["fleet.vehicle"]
        total = V.search_count(domain)
        records = V.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "name asc"))
        return {"records": records.read(VEHICLE_FIELDS), "total": total}

def get_vehicle(vehicle_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "fleet.vehicle" not in env.registry:
            return None
        v = env["fleet.vehicle"].browse(vehicle_id)
        if not v.exists():
            return None
        return v.read(VEHICLE_FIELDS + ["color", "horsepower", "odometer", "tag_ids"])[0]

def update_vehicle(vehicle_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "fleet.vehicle" not in env.registry:
            return None
        v = env["fleet.vehicle"].browse(vehicle_id)
        if not v.exists():
            return None
        v.write(vals)
        return v.read(VEHICLE_FIELDS + ["color", "horsepower", "odometer", "tag_ids"])[0]

def list_vehicle_costs(vehicle_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = [["vehicle_id", "=", vehicle_id]]
    with mashora_env(uid=uid, context=context) as env:
        if "fleet.vehicle.cost" not in env.registry:
            return {"records": [], "total": 0, "warning": "fleet module not installed"}
        C = env["fleet.vehicle.cost"]
        total = C.search_count(domain)
        records = C.search(domain, order="date desc")
        return {"records": records.read(VEHICLE_COST_FIELDS), "total": total}

def create_vehicle_cost(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "fleet.vehicle.cost" not in env.registry:
            raise RuntimeError("fleet module not installed")
        c = env["fleet.vehicle.cost"].create(vals)
        return c.read(VEHICLE_COST_FIELDS)[0]


# ============================================
# REPAIR
# ============================================

REPAIR_FIELDS = [
    "id", "name", "state", "product_id", "partner_id",
    "lot_id", "priority", "company_id", "description",
    "operations",
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
        if "repair.order" not in env.registry:
            return {"records": [], "total": 0, "warning": "repair module not installed"}
        R = env["repair.order"]
        total = R.search_count(domain)
        records = R.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "name desc"))
        return {"records": records.read(REPAIR_FIELDS), "total": total}

def get_repair(repair_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "repair.order" not in env.registry:
            return None
        r = env["repair.order"].browse(repair_id)
        if not r.exists():
            return None
        return r.read(REPAIR_FIELDS)[0]

def update_repair(repair_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "repair.order" not in env.registry:
            return None
        r = env["repair.order"].browse(repair_id)
        if not r.exists():
            return None
        r.write(vals)
        return r.read(REPAIR_FIELDS)[0]

def repair_action(repair_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "repair.order" not in env.registry:
            raise RuntimeError("repair module not installed")
        r = env["repair.order"].browse(repair_id)
        getattr(r, action)()
        return r.read(REPAIR_FIELDS)[0]


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
        if "mrp.production" not in env.registry:
            return {"records": [], "total": 0, "warning": "mrp module not installed"}
        P = env["mrp.production"]
        total = P.search_count(domain)
        records = P.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "date_start desc, name desc"))
        return {"records": records.read(PRODUCTION_FIELDS), "total": total}

def get_production(production_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "mrp.production" not in env.registry:
            return None
        p = env["mrp.production"].browse(production_id)
        if not p.exists():
            return None
        data = p.read(PRODUCTION_DETAIL_FIELDS)[0]
        # Read raw materials (components)
        raw_ids = data.get("move_raw_ids", [])
        if raw_ids:
            data["components"] = env["stock.move"].browse(raw_ids).read(MOVE_RAW_FIELDS)
        else:
            data["components"] = []
        # Read work orders
        wo_ids = data.get("workorder_ids", [])
        if wo_ids:
            data["workorders"] = env["mrp.workorder"].browse(wo_ids).read(WORKORDER_FIELDS)
        else:
            data["workorders"] = []
        return data

def update_production(production_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "mrp.production" not in env.registry:
            return None
        p = env["mrp.production"].browse(production_id)
        if not p.exists():
            return None
        p.write(vals)
        return p.read(PRODUCTION_FIELDS)[0]

def production_action(production_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "mrp.production" not in env.registry:
            raise RuntimeError("mrp module not installed")
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
        if "mrp.bom" not in env.registry:
            return {"records": [], "total": 0, "warning": "mrp module not installed"}
        B = env["mrp.bom"]
        total = B.search_count(domain)
        records = B.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 50), order=params.get("order", "product_tmpl_id asc"))
        return {"records": records.read(BOM_FIELDS), "total": total}

def get_bom(bom_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "mrp.bom" not in env.registry:
            return None
        b = env["mrp.bom"].browse(bom_id)
        if not b.exists():
            return None
        data = b.read(BOM_FIELDS)[0]
        line_ids = data.get("bom_line_ids", [])
        if line_ids:
            data["lines"] = env["mrp.bom.line"].browse(line_ids).read(BOM_LINE_FIELDS)
        else:
            data["lines"] = []
        return data


def list_workcenters(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List manufacturing work centers."""
    with mashora_env(uid=uid, context=context) as env:
        if "mrp.workcenter" not in env.registry:
            return {"records": [], "total": 0, "warning": "mrp module not installed"}
        W = env["mrp.workcenter"]
        records = W.search([], order="sequence asc, name asc")
        return {"records": records.read(WORKCENTER_FIELDS), "total": len(records)}


def list_workorders(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List work orders with filters."""
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("workcenter_id"):
        domain.append(["workcenter_id", "=", params["workcenter_id"]])
    if params.get("production_id"):
        domain.append(["production_id", "=", params["production_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        if "mrp.workorder" not in env.registry:
            return {"records": [], "total": 0, "warning": "mrp module not installed"}
        WO = env["mrp.workorder"]
        total = WO.search_count(domain)
        records = WO.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40),
                            order=params.get("order", "date_start desc"))
        return {"records": records.read(WORKORDER_FIELDS), "total": total}


def get_mrp_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get manufacturing dashboard summary."""
    with mashora_env(uid=uid, context=context) as env:
        if "mrp.production" not in env.registry:
            return {"warning": "mrp module not installed"}
        P = env["mrp.production"]
        draft = P.search_count([("state", "=", "draft")])
        confirmed = P.search_count([("state", "=", "confirmed")])
        in_progress = P.search_count([("state", "=", "progress")])
        done = P.search_count([("state", "=", "done")])
        late = P.search_count([
            ("state", "in", ["confirmed", "progress"]),
            ("date_start", "<", _today_str()),
        ])
        bom_count = 0
        if "mrp.bom" in env.registry:
            bom_count = env["mrp.bom"].search_count([])
        wc_count = 0
        if "mrp.workcenter" in env.registry:
            wc_count = env["mrp.workcenter"].search_count([])
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
        if "event.event" not in env.registry:
            return {"records": [], "total": 0, "warning": "event module not installed"}
        E = env["event.event"]
        total = E.search_count(domain)
        records = E.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "date_begin desc"))
        return {"records": records.read(EVENT_FIELDS), "total": total}

def get_event(event_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "event.event" not in env.registry:
            return None
        e = env["event.event"].browse(event_id)
        if not e.exists():
            return None
        return e.read(EVENT_FIELDS + ["registration_ids"])[0]

def update_event(event_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "event.event" not in env.registry:
            return None
        e = env["event.event"].browse(event_id)
        if not e.exists():
            return None
        e.write(vals)
        return e.read(EVENT_FIELDS)[0]

def event_action(event_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "event.event" not in env.registry:
            raise RuntimeError("event module not installed")
        e = env["event.event"].browse(event_id)
        getattr(e, action)()
        return e.read(EVENT_FIELDS)[0]

def list_registrations(event_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = [["event_id", "=", event_id]]
    with mashora_env(uid=uid, context=context) as env:
        if "event.registration" not in env.registry:
            return {"records": [], "total": 0, "warning": "event module not installed"}
        R = env["event.registration"]
        total = R.search_count(domain)
        records = R.search(domain, order="create_date desc")
        return {"records": records.read(EVENT_REGISTRATION_FIELDS), "total": total}

def create_registration(vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "event.registration" not in env.registry:
            raise RuntimeError("event module not installed")
        r = env["event.registration"].create(vals)
        return r.read(EVENT_REGISTRATION_FIELDS)[0]


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

def list_surveys(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("survey_type"):
        domain.append(["survey_type", "=", params["survey_type"]])
    if params.get("search"):
        domain.append(["title", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        if "survey.survey" not in env.registry:
            return {"records": [], "total": 0, "warning": "survey module not installed"}
        S = env["survey.survey"]
        total = S.search_count(domain)
        records = S.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "create_date desc"))
        return {"records": records.read(SURVEY_FIELDS), "total": total}

def get_survey(survey_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "survey.survey" not in env.registry:
            return None
        s = env["survey.survey"].browse(survey_id)
        if not s.exists():
            return None
        return s.read(SURVEY_FIELDS + ["question_ids"])[0]

def update_survey(survey_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "survey.survey" not in env.registry:
            return None
        s = env["survey.survey"].browse(survey_id)
        if not s.exists():
            return None
        s.write(vals)
        return s.read(SURVEY_FIELDS)[0]

def survey_action(survey_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "survey.survey" not in env.registry:
            raise RuntimeError("survey module not installed")
        s = env["survey.survey"].browse(survey_id)
        getattr(s, action)()
        return s.read(SURVEY_FIELDS)[0]

def list_survey_answers(survey_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = [["survey_id", "=", survey_id]]
    with mashora_env(uid=uid, context=context) as env:
        if "survey.user_input" not in env.registry:
            return {"records": [], "total": 0, "warning": "survey module not installed"}
        A = env["survey.user_input"]
        total = A.search_count(domain)
        records = A.search(domain, order="create_date desc")
        return {"records": records.read(SURVEY_ANSWER_FIELDS), "total": total}


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
        if "mailing.mailing" not in env.registry:
            return {"records": [], "total": 0, "warning": "mass_mailing module not installed"}
        M = env["mailing.mailing"]
        total = M.search_count(domain)
        records = M.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 40), order=params.get("order", "create_date desc"))
        return {"records": records.read(MAILING_FIELDS), "total": total}

def get_mailing(mailing_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "mailing.mailing" not in env.registry:
            return None
        m = env["mailing.mailing"].browse(mailing_id)
        if not m.exists():
            return None
        return m.read(MAILING_FIELDS)[0]

def update_mailing(mailing_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "mailing.mailing" not in env.registry:
            return None
        m = env["mailing.mailing"].browse(mailing_id)
        if not m.exists():
            return None
        m.write(vals)
        return m.read(MAILING_FIELDS)[0]

def mailing_action(mailing_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "mailing.mailing" not in env.registry:
            raise RuntimeError("mass_mailing module not installed")
        m = env["mailing.mailing"].browse(mailing_id)
        getattr(m, action)()
        return m.read(MAILING_FIELDS)[0]

def get_mailing_stats(mailing_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "mailing.mailing" not in env.registry:
            return None
        m = env["mailing.mailing"].browse(mailing_id)
        if not m.exists():
            return None
        data = m.read(["id", "name", "subject", "state", "sent", "delivered", "opened", "bounced", "clicked"])[0]
        return data


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

def list_pos_sessions(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    domain: list[Any] = []
    if params.get("state"):
        domain.append(["state", "in", params["state"]])
    if params.get("config_id"):
        domain.append(["config_id", "=", params["config_id"]])
    if params.get("search"):
        domain.append(["name", "ilike", params["search"]])
    with mashora_env(uid=uid, context=context) as env:
        if "pos.session" not in env.registry:
            return {"records": [], "total": 0, "warning": "point_of_sale module not installed"}
        S = env["pos.session"]
        total = S.search_count(domain)
        records = S.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 20), order=params.get("order", "start_at desc"))
        return {"records": records.read(POS_SESSION_FIELDS), "total": total}

def get_pos_session(session_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "pos.session" not in env.registry:
            return None
        s = env["pos.session"].browse(session_id)
        if not s.exists():
            return None
        data = s.read(POS_SESSION_DETAIL_FIELDS)[0]
        # Read orders summary
        order_ids = data.get("order_ids", [])
        if order_ids:
            orders = env["pos.order"].browse(order_ids)
            data["orders"] = orders.read(POS_ORDER_FIELDS)
        else:
            data["orders"] = []
        # Read payment methods
        pm_ids = data.get("payment_method_ids", [])
        if pm_ids:
            data["payment_methods"] = env["pos.payment.method"].browse(pm_ids).read(POS_PAYMENT_METHOD_FIELDS)
        else:
            data["payment_methods"] = []
        return data


def get_pos_dashboard(uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get POS dashboard summary."""
    with mashora_env(uid=uid, context=context) as env:
        if "pos.session" not in env.registry:
            return {"warning": "point_of_sale module not installed"}
        Session = env["pos.session"]
        Order = env["pos.order"]
        open_sessions = Session.search_count([("state", "in", ["opened", "opening_control"])])
        closed_today = Session.search_count([
            ("state", "=", "closed"),
            ("stop_at", ">=", _today_str()),
        ])
        total_orders_today = Order.search_count([
            ("date_order", ">=", _today_str()),
            ("state", "in", ["paid", "done"]),
        ])
        today_orders = Order.search([
            ("date_order", ">=", _today_str()),
            ("state", "in", ["paid", "done"]),
        ], limit=5000)
        today_revenue = sum(r["amount_total"] for r in today_orders.read(["amount_total"]))
        return {
            "open_sessions": open_sessions,
            "closed_today": closed_today,
            "orders_today": total_orders_today,
            "revenue_today": today_revenue,
        }


def _today_str() -> str:
    import datetime
    return datetime.date.today().isoformat()


def list_pos_configs(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List POS configurations."""
    with mashora_env(uid=uid, context=context) as env:
        if "pos.config" not in env.registry:
            return {"records": [], "total": 0}
        Config = env["pos.config"]
        configs = Config.search([])
        data = configs.read(POS_CONFIG_FIELDS)
        # Enrich with session counts
        for cfg in data:
            cfg["session_count"] = env["pos.session"].search_count([("config_id", "=", cfg["id"])])
            cfg["open_session"] = env["pos.session"].search_count([
                ("config_id", "=", cfg["id"]),
                ("state", "in", ["opened", "opening_control"]),
            ])
        return {"records": data, "total": len(data)}


def get_pos_order(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "pos.order" not in env.registry:
            return None
        o = env["pos.order"].browse(order_id)
        if not o.exists():
            return None
        data = o.read(POS_ORDER_DETAIL_FIELDS)[0]
        # Read order lines
        line_ids = data.get("lines", [])
        if line_ids:
            data["order_lines"] = env["pos.order.line"].browse(line_ids).read(POS_ORDER_LINE_FIELDS)
        else:
            data["order_lines"] = []
        # Read payments
        payment_ids = data.get("payment_ids", [])
        if payment_ids:
            data["payments"] = env["pos.payment"].browse(payment_ids).read(POS_PAYMENT_FIELDS)
        else:
            data["payments"] = []
        return data


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
        if "pos.order" not in env.registry:
            return {"records": [], "total": 0, "warning": "point_of_sale module not installed"}
        O = env["pos.order"]
        total = O.search_count(domain)
        records = O.search(domain, offset=params.get("offset", 0), limit=params.get("limit", 50), order=params.get("order", "date_order desc"))
        return {"records": records.read(POS_ORDER_FIELDS), "total": total}

def get_pos_order(order_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        if "pos.order" not in env.registry:
            return None
        o = env["pos.order"].browse(order_id)
        if not o.exists():
            return None
        return o.read(POS_ORDER_FIELDS)[0]

def pos_session_action(session_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        if "pos.session" not in env.registry:
            raise RuntimeError("point_of_sale module not installed")
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

def get_calendar_event(event_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        e = env["calendar.event"].browse(event_id)
        if not e.exists():
            return None
        return e.read(CALENDAR_FIELDS)[0]

def update_calendar_event(event_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        e = env["calendar.event"].browse(event_id)
        if not e.exists():
            return None
        e.write(vals)
        return e.read(CALENDAR_FIELDS)[0]

def delete_calendar_event(event_id: int, uid: int = 1, context: Optional[dict] = None) -> bool:
    with mashora_env(uid=uid, context=context) as env:
        e = env["calendar.event"].browse(event_id)
        if not e.exists():
            return False
        e.unlink()
        return True

def calendar_event_action(event_id: int, action: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        e = env["calendar.event"].browse(event_id)
        getattr(e, action)()
        return e.read(CALENDAR_FIELDS)[0]
