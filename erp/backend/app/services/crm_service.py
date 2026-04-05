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
from typing import Any

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)

LEAD_LIST_FIELDS = [
    "id", "name", "type", "active",
    "stage_id", "user_id", "team_id", "partner_id",
    "contact_name", "partner_name", "email_from", "phone",
    "expected_revenue", "prorated_revenue", "probability",
    "priority", "won_status", "color",
    "date_deadline", "date_closed", "date_conversion",
    "tag_ids", "company_id", "currency_id",
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
    if partner_id:
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


def list_leads(
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
    with mashora_env(uid=uid, context=context) as env:
        Lead = env["crm.lead"]
        total = Lead.search_count(domain)
        records = Lead.search(
            domain,
            offset=params.get("offset", 0),
            limit=params.get("limit", 40),
            order=params.get("order", "priority desc, id desc"),
        )
        return {"records": records.read(LEAD_LIST_FIELDS), "total": total}


def get_lead(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> Optional[dict]:
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].browse(lead_id)
        if not lead.exists():
            return None
        return lead.read(LEAD_DETAIL_FIELDS)[0]


def create_lead(
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "tag_ids" in clean_vals:
            clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
        lead = env["crm.lead"].create(clean_vals)
        return lead.read(LEAD_LIST_FIELDS)[0]


def update_lead(
    lead_id: int,
    vals: dict,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].browse(lead_id)
        if not lead.exists():
            from mashora.exceptions import MissingError
            raise MissingError(f"Lead {lead_id} not found")
        clean_vals = {k: v for k, v in vals.items() if v is not None}
        if "tag_ids" in clean_vals:
            clean_vals["tag_ids"] = [(6, 0, clean_vals["tag_ids"])]
        lead.write(clean_vals)
        return lead.read(LEAD_LIST_FIELDS)[0]


def move_stage(
    lead_id: int,
    stage_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Move a lead to a different pipeline stage (kanban drag-and-drop)."""
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].browse(lead_id)
        lead.write({"stage_id": stage_id})
        return lead.read(LEAD_LIST_FIELDS)[0]


def mark_won(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].browse(lead_id)
        lead.action_set_won_rainbowman()
        return lead.read(LEAD_LIST_FIELDS)[0]


def mark_lost(
    lead_id: int,
    lost_reason_id: int,
    lost_feedback: Optional[str] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].browse(lead_id)
        vals = {"lost_reason_id": lost_reason_id}
        if lost_feedback:
            vals["lost_feedback"] = lost_feedback
        lead.write(vals)
        lead.action_set_lost()
        return lead.read(LEAD_LIST_FIELDS)[0]


def restore_lead(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Restore a lost (archived) lead."""
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].with_context(active_test=False).browse(lead_id)
        lead.action_unarchive()
        return lead.read(LEAD_LIST_FIELDS)[0]


def convert_to_opportunity(
    lead_id: int,
    partner_id: Optional[int] = None,
    user_id: Optional[int] = None,
    team_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].browse(lead_id)
        lead.convert_opportunity(
            partner=env["res.partner"].browse(partner_id) if partner_id else False,
            user_ids=user_id or False,
            team_id=team_id or False,
        )
        return lead.read(LEAD_DETAIL_FIELDS)[0]


def create_quotation_from_lead(
    lead_id: int,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Create a sale order quotation from an opportunity."""
    with mashora_env(uid=uid, context=context) as env:
        lead = env["crm.lead"].browse(lead_id)
        action = lead.action_new_quotation()
        if isinstance(action, dict) and action.get("res_id"):
            so = env["sale.order"].browse(action["res_id"])
            return so.read(["id", "name", "state", "amount_total"])[0]
        return {"action": action}


# --- Pipeline Stages ---

def list_stages(
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

    with mashora_env(uid=uid, context=context) as env:
        Stage = env["crm.stage"]
        records = Stage.search(domain, order="sequence asc")
        return {"records": records.read(STAGE_FIELDS), "total": len(records)}


# --- Lost Reasons ---

def list_lost_reasons(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Reason = env["crm.lost.reason"]
        records = Reason.search([])
        return {"records": records.read(LOST_REASON_FIELDS), "total": len(records)}


# --- Pipeline Data (for Kanban) ---

def get_pipeline_data(
    team_id: Optional[int] = None,
    user_id: Optional[int] = None,
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """Get pipeline data grouped by stage for kanban view."""
    with mashora_env(uid=uid, context=context) as env:
        # Get stages
        stage_domain: list[Any] = []
        if team_id:
            stage_domain.append("|")
            stage_domain.append(["team_ids", "=", team_id])
            stage_domain.append(["team_ids", "=", False])
        stages = env["crm.stage"].search(stage_domain, order="sequence asc")
        stage_data = stages.read(STAGE_FIELDS)

        # Get leads per stage
        lead_domain: list[Any] = [
            ["type", "=", "opportunity"],
            ["active", "=", True],
        ]
        if team_id:
            lead_domain.append(["team_id", "=", team_id])
        if user_id:
            lead_domain.append(["user_id", "=", user_id])

        Lead = env["crm.lead"]
        pipeline = []
        for stage in stage_data:
            stage_leads = Lead.search(
                lead_domain + [["stage_id", "=", stage["id"]]],
                order="priority desc, id desc",
                limit=50,
            )
            leads = stage_leads.read(LEAD_LIST_FIELDS)
            total_revenue = sum(l.get("expected_revenue", 0) for l in leads)
            pipeline.append({
                "stage": stage,
                "leads": leads,
                "count": len(leads),
                "total_revenue": total_revenue,
            })

        return {"pipeline": pipeline}


# --- Dashboard ---

def get_crm_dashboard(
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        Lead = env["crm.lead"]

        # Opportunities
        open_opps = Lead.search_count([
            ("type", "=", "opportunity"),
            ("active", "=", True),
            ("won_status", "=", "pending"),
        ])
        won_this_month = Lead.search_count([
            ("type", "=", "opportunity"),
            ("won_status", "=", "won"),
            ("date_closed", ">=", _first_of_month()),
        ])
        lost_this_month = Lead.search_count([
            ("type", "=", "opportunity"),
            ("won_status", "=", "lost"),
            ("date_closed", ">=", _first_of_month()),
            ("active", "=", False),
        ])

        # Revenue
        open_records = Lead.search([
            ("type", "=", "opportunity"),
            ("active", "=", True),
            ("won_status", "=", "pending"),
        ], limit=2000)
        total_expected = sum(r["expected_revenue"] for r in open_records.read(["expected_revenue"]))
        total_prorated = sum(r["prorated_revenue"] for r in open_records.read(["prorated_revenue"]))

        # Leads
        unassigned_leads = Lead.search_count([
            ("type", "=", "lead"),
            ("active", "=", True),
            ("user_id", "=", False),
        ])
        new_leads_month = Lead.search_count([
            ("type", "=", "lead"),
            ("create_date", ">=", _first_of_month()),
        ])

        # Overdue activities
        import datetime
        overdue_activities = Lead.search_count([
            ("type", "=", "opportunity"),
            ("active", "=", True),
            ("activity_date_deadline", "<", datetime.date.today().isoformat()),
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


def _first_of_month() -> str:
    import datetime
    return datetime.date.today().replace(day=1).isoformat()
