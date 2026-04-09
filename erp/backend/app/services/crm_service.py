"""
CRM service layer.

Provides high-level operations for the CRM module:
- Lead/Opportunity CRUD and pipeline management
- Won/Lost actions
- Lead-to-opportunity conversion
- Pipeline stages and lost reasons
- Dashboard metrics
"""
import logging
from typing import Any, Optional

from app.services.base import (
    RecordNotFoundError,
    async_count,
    async_create,
    async_delete,
    async_get,
    async_get_or_raise,
    async_search_read,
    async_sum,
    async_update,
    get_model_class,
    _first_of_month,
    _today,
)

_logger = logging.getLogger(__name__)

LEAD_LIST_FIELDS = [
    "id", "name", "type", "active",
    "stage_id", "user_id", "team_id", "partner_id",
    "contact_name", "partner_name", "email_from", "phone",
    "expected_revenue", "prorated_revenue", "probability",
    "priority", "won_status", "color",
    "date_deadline", "date_closed", "date_conversion",
    "tag_ids", "company_id",
    "activity_date_deadline",
    "create_date",
]

LEAD_DETAIL_FIELDS = LEAD_LIST_FIELDS + [
    "description", "website", "function",
    "street", "street2", "city", "zip", "country_id", "state_id",
    "lost_reason_id",
    "recurring_revenue", "recurring_revenue_monthly",
    "recurring_plan",
    "campaign_id", "medium_id", "source_id",
    "calendar_event_ids", "meeting_display_date", "meeting_display_label",
    "duplicate_lead_count",
    "date_open", "day_open", "day_close",
    "date_last_stage_update",
    "write_date",
]

STAGE_FIELDS = [
    "id", "name", "sequence", "is_won", "fold",
    "team_ids", "requirements", "color",
]

LOST_REASON_FIELDS = [
    "id", "name", "active", "leads_count",
]


def build_lead_domain(
    type: Optional[str] = None,
    stage_id: Optional[int] = None,
    user_id: Optional[int] = None,
    team_id: Optional[int] = None,
    partner_id: Optional[int] = None,
    won_status: Optional[str] = None,
    priority: Optional[str] = None,
    date_from=None,
    date_to=None,
    search: Optional[str] = None,
    active: Optional[bool] = True,
) -> list:
    domain: list[Any] = []
    if active is not None:
        domain.append(["active", "=", active])
    if type:
        domain.append(["type", "=", type])
    if stage_id:
        domain.append(["stage_id", "=", stage_id])
    if user_id:
        domain.append(["user_id", "=", user_id])
    if team_id:
        domain.append(["team_id", "=", team_id])
    if partner_id is not None:
        domain.append(["partner_id", "=", partner_id])
    if won_status:
        domain.append(["won_status", "=", won_status])
    if priority:
        domain.append(["priority", "=", priority])
    if date_from:
        domain.append(["create_date", ">=", str(date_from)])
    if date_to:
        domain.append(["create_date", "<=", str(date_to)])
    if search:
        domain.append("|")
        domain.append("|")
        domain.append("|")
        domain.append(["name", "ilike", search])
        domain.append(["contact_name", "ilike", search])
        domain.append(["partner_name", "ilike", search])
        domain.append(["email_from", "ilike", search])
    return domain


async def list_leads(
    params: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    domain = build_lead_domain(
        type=params.get("type"),
        stage_id=params.get("stage_id"),
        user_id=params.get("user_id"),
        team_id=params.get("team_id"),
        partner_id=params.get("partner_id"),
        won_status=params.get("won_status"),
        priority=params.get("priority"),
        date_from=params.get("date_from"),
        date_to=params.get("date_to"),
        search=params.get("search"),
        active=params.get("active"),
    )
    return await async_search_read(
        "crm.lead",
        domain,
        LEAD_LIST_FIELDS,
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "priority desc, id desc"),
    )


async def get_lead(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    return await async_get("crm.lead", lead_id, LEAD_DETAIL_FIELDS)


async def create_lead(
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    # tag_ids many2many list — strip ORM tuple syntax; store raw list for SQLAlchemy
    if "tag_ids" in clean_vals and isinstance(clean_vals["tag_ids"], list):
        # Unwrap [(6, 0, ids)] style if caller passes it; otherwise keep plain list
        first = clean_vals["tag_ids"][0] if clean_vals["tag_ids"] else None
        if isinstance(first, (list, tuple)) and len(first) == 3 and first[0] == 6:
            clean_vals["tag_ids"] = first[2]
    return await async_create("crm.lead", clean_vals, uid, LEAD_LIST_FIELDS)


async def update_lead(
    lead_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    clean_vals = {k: v for k, v in vals.items() if v is not None}
    if "tag_ids" in clean_vals and isinstance(clean_vals["tag_ids"], list):
        first = clean_vals["tag_ids"][0] if clean_vals["tag_ids"] else None
        if isinstance(first, (list, tuple)) and len(first) == 3 and first[0] == 6:
            clean_vals["tag_ids"] = first[2]
    return await async_update("crm.lead", lead_id, clean_vals, uid, LEAD_LIST_FIELDS)


async def move_stage(
    lead_id: int,
    stage_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Move a lead to a different pipeline stage (kanban drag-and-drop)."""
    return await async_update("crm.lead", lead_id, {"stage_id": stage_id}, uid, LEAD_LIST_FIELDS)


async def mark_won(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    import datetime
    return await async_update(
        "crm.lead",
        lead_id,
        {"won_status": "won", "date_closed": datetime.date.today().isoformat()},
        uid,
        LEAD_LIST_FIELDS,
    )


async def mark_lost(
    lead_id: int,
    lost_reason_id: int,
    lost_feedback: Optional[str] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    import datetime
    vals: dict[str, Any] = {
        "lost_reason_id": lost_reason_id,
        "won_status": "lost",
        "active": False,
        "date_closed": datetime.date.today().isoformat(),
    }
    if lost_feedback:
        vals["lost_feedback"] = lost_feedback
    return await async_update("crm.lead", lead_id, vals, uid, LEAD_LIST_FIELDS)


async def restore_lead(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Restore a lost (archived) lead."""
    return await async_update(
        "crm.lead",
        lead_id,
        {"active": True, "won_status": "pending"},
        uid,
        LEAD_LIST_FIELDS,
    )


async def convert_to_opportunity(
    lead_id: int,
    partner_id: Optional[int] = None,
    user_id: Optional[int] = None,
    team_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    import datetime
    vals: dict[str, Any] = {
        "type": "opportunity",
        "date_conversion": datetime.date.today().isoformat(),
    }
    if partner_id:
        vals["partner_id"] = partner_id
    if user_id:
        vals["user_id"] = user_id
    if team_id:
        vals["team_id"] = team_id
    return await async_update("crm.lead", lead_id, vals, uid, LEAD_DETAIL_FIELDS)


async def create_quotation_from_lead(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create a sale order quotation from an opportunity.

    Returns the lead record; full sale order creation requires additional
    sale order service logic outside CRM scope.
    """
    return await async_get_or_raise("crm.lead", lead_id, LEAD_DETAIL_FIELDS)


# --- Pipeline Stages ---

async def list_stages(
    params: Optional[dict] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    params = params or {}
    domain: list[Any] = []
    if params.get("team_id"):
        domain.append("|")
        domain.append(["team_ids", "=", params["team_id"]])
        domain.append(["team_ids", "=", False])
    if params.get("is_won") is not None:
        domain.append(["is_won", "=", params["is_won"]])

    return await async_search_read(
        "crm.stage",
        domain,
        STAGE_FIELDS,
        offset=0,
        limit=1000,
        order="sequence asc",
    )


# --- Lost Reasons ---

async def list_lost_reasons(uid: int = 1, context: Optional[dict] = None) -> dict:
    return await async_search_read(
        "crm.lost.reason",
        [],
        LOST_REASON_FIELDS,
        offset=0,
        limit=1000,
    )


# --- Pipeline Data (for Kanban) ---

async def get_pipeline_data(
    team_id: Optional[int] = None,
    user_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get pipeline data grouped by stage for kanban view."""
    # Get stages
    stage_domain: list[Any] = []
    if team_id:
        stage_domain.append("|")
        stage_domain.append(["team_ids", "=", team_id])
        stage_domain.append(["team_ids", "=", False])

    stages_result = await async_search_read(
        "crm.stage", stage_domain, STAGE_FIELDS, offset=0, limit=1000, order="sequence asc"
    )
    stage_data = stages_result["records"]

    # Build base lead domain
    lead_domain: list[Any] = [
        ["type", "=", "opportunity"],
        ["active", "=", True],
    ]
    if team_id:
        lead_domain.append(["team_id", "=", team_id])
    if user_id:
        lead_domain.append(["user_id", "=", user_id])

    pipeline = []
    for stage in stage_data:
        stage_leads_result = await async_search_read(
            "crm.lead",
            lead_domain + [["stage_id", "=", stage["id"]]],
            LEAD_LIST_FIELDS,
            offset=0,
            limit=50,
            order="priority desc, id desc",
        )
        leads = stage_leads_result["records"]
        total_revenue = sum(l.get("expected_revenue", 0) for l in leads)
        pipeline.append({
            "stage": stage,
            "leads": leads,
            "count": len(leads),
            "total_revenue": total_revenue,
        })

    return {"pipeline": pipeline}


# --- Dashboard ---

async def get_crm_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    first_of_month = _first_of_month()
    today = _today()

    # Opportunities
    open_opps = await async_count("crm.lead", [
        ["type", "=", "opportunity"],
        ["active", "=", True],
        ["won_status", "=", "pending"],
    ])
    won_this_month = await async_count("crm.lead", [
        ["type", "=", "opportunity"],
        ["won_status", "=", "won"],
        ["date_closed", ">=", first_of_month],
    ])
    lost_this_month = await async_count("crm.lead", [
        ["type", "=", "opportunity"],
        ["won_status", "=", "lost"],
        ["date_closed", ">=", first_of_month],
        ["active", "=", False],
    ])

    # Revenue
    open_domain = [
        ["type", "=", "opportunity"],
        ["active", "=", True],
        ["won_status", "=", "pending"],
    ]
    total_expected = await async_sum("crm.lead", "expected_revenue", open_domain)
    total_prorated = await async_sum("crm.lead", "prorated_revenue", open_domain)

    # Leads
    unassigned_leads = await async_count("crm.lead", [
        ["type", "=", "lead"],
        ["active", "=", True],
        ["user_id", "=", False],
    ])
    new_leads_month = await async_count("crm.lead", [
        ["type", "=", "lead"],
        ["create_date", ">=", first_of_month],
    ])

    # Overdue activities
    overdue_activities = await async_count("crm.lead", [
        ["type", "=", "opportunity"],
        ["active", "=", True],
        ["activity_date_deadline", "<", today],
    ])

    return {
        "opportunities": {
            "open": open_opps,
            "won_this_month": won_this_month,
            "lost_this_month": lost_this_month,
            "total_expected_revenue": total_expected,
            "total_prorated_revenue": total_prorated,
        },
        "leads": {
            "unassigned": unassigned_leads,
            "new_this_month": new_leads_month,
        },
        "overdue_activities": overdue_activities,
    }


# ============================================
# CRM Extensions — Activities, Lost Reasons
# ============================================

async def list_crm_activities(params: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List CRM activities (meetings, calls, emails)."""
    if get_model_class("mail.activity") is None:
        return {"records": [], "total": 0}

    domain: list[Any] = [["res_model", "=", "crm.lead"]]
    if params.get("user_id"):
        domain.append(["user_id", "=", params["user_id"]])
    if params.get("activity_type_id"):
        domain.append(["activity_type_id", "=", params["activity_type_id"]])
    if params.get("date_from"):
        domain.append(["date_deadline", ">=", str(params["date_from"])])
    if params.get("date_to"):
        domain.append(["date_deadline", "<=", str(params["date_to"])])
    if params.get("search"):
        domain.append(["summary", "ilike", params["search"]])

    return await async_search_read(
        "mail.activity",
        domain,
        ["id", "summary", "note", "date_deadline", "user_id",
         "activity_type_id", "res_id", "res_name", "state"],
        offset=params.get("offset", 0),
        limit=params.get("limit", 40),
        order=params.get("order", "date_deadline asc"),
    )


async def list_activity_types(uid: int = 1, context: Optional[dict] = None) -> dict:
    """List activity types (call, email, meeting, etc.)."""
    if get_model_class("mail.activity.type") is None:
        return {"records": [], "total": 0}

    return await async_search_read(
        "mail.activity.type",
        [],
        ["id", "name", "category", "icon"],
        offset=0,
        limit=1000,
        order="sequence asc",
    )
