"""
CRM module API endpoints.

Provides REST API for:
- Leads & Opportunities (CRUD + pipeline actions)
- Pipeline stages and kanban data
- Won/Lost actions
- Lead-to-opportunity conversion
- Lost reasons
- CRM Dashboard
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.core.orm_adapter import orm_call
from app.schemas.crm import (
    LeadCreate,
    LeadListParams,
    LeadUpdate,
    LeadMarkLost,
    LeadConvert,
    StageListParams,
)
from app.services.crm_service import (
    list_leads,
    get_lead,
    create_lead,
    update_lead,
    move_stage,
    mark_won,
    mark_lost,
    restore_lead,
    convert_to_opportunity,
    create_quotation_from_lead,
    list_stages,
    list_lost_reasons,
    get_pipeline_data,
    get_crm_dashboard,
)

router = APIRouter(prefix="/crm", tags=["crm"])


# ============================================
# Leads & Opportunities
# ============================================

@router.post("/leads")
async def get_leads(params: LeadListParams | None = None):
    """List leads/opportunities with filters."""
    p = params or LeadListParams()
    return await orm_call(list_leads, params=p.model_dump())


@router.get("/leads/{lead_id}")
async def get_lead_detail(lead_id: int):
    """Get full lead/opportunity details."""
    result = await orm_call(get_lead, lead_id=lead_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} not found")
    return result


@router.post("/leads/create", status_code=201)
async def create_new_lead(body: LeadCreate):
    """Create a new lead or opportunity."""
    return await orm_call(create_lead, vals=body.model_dump())


@router.put("/leads/{lead_id}")
async def update_existing_lead(lead_id: int, body: LeadUpdate):
    """Update a lead/opportunity."""
    vals = body.model_dump(exclude_none=True)
    return await orm_call(update_lead, lead_id=lead_id, vals=vals)


@router.post("/leads/{lead_id}/move-stage")
async def move_lead_stage(lead_id: int, stage_id: int = Query(description="Target stage ID")):
    """Move a lead to a different pipeline stage (kanban drag-and-drop)."""
    return await orm_call(move_stage, lead_id=lead_id, stage_id=stage_id)


@router.post("/leads/{lead_id}/won")
async def mark_lead_won(lead_id: int):
    """Mark an opportunity as won."""
    return await orm_call(mark_won, lead_id=lead_id)


@router.post("/leads/{lead_id}/lost")
async def mark_lead_lost(lead_id: int, body: LeadMarkLost):
    """Mark an opportunity as lost (requires reason)."""
    return await orm_call(
        mark_lost,
        lead_id=lead_id,
        lost_reason_id=body.lost_reason_id,
        lost_feedback=body.lost_feedback,
    )


@router.post("/leads/{lead_id}/restore")
async def restore_lost_lead(lead_id: int):
    """Restore a lost (archived) lead."""
    return await orm_call(restore_lead, lead_id=lead_id)


@router.post("/leads/{lead_id}/convert")
async def convert_lead(lead_id: int, body: LeadConvert | None = None):
    """Convert a lead to an opportunity."""
    b = body or LeadConvert()
    return await orm_call(
        convert_to_opportunity,
        lead_id=lead_id,
        partner_id=b.partner_id,
        user_id=b.user_id,
        team_id=b.team_id,
    )


@router.post("/leads/{lead_id}/new-quotation")
async def create_quotation(lead_id: int):
    """Create a sale quotation from an opportunity."""
    return await orm_call(create_quotation_from_lead, lead_id=lead_id)


# ============================================
# Pipeline (Kanban)
# ============================================

@router.get("/pipeline")
async def get_pipeline(
    team_id: int | None = Query(default=None),
    user_id: int | None = Query(default=None),
):
    """Get pipeline data grouped by stage (for kanban view)."""
    return await orm_call(get_pipeline_data, team_id=team_id, user_id=user_id)


# ============================================
# Stages
# ============================================

@router.post("/stages")
async def get_stages(params: StageListParams | None = None):
    """List pipeline stages."""
    p = params or StageListParams()
    return await orm_call(list_stages, params=p.model_dump())


# ============================================
# Lost Reasons
# ============================================

@router.get("/lost-reasons")
async def get_lost_reasons():
    """List lost reasons."""
    return await orm_call(list_lost_reasons)


# ============================================
# Dashboard
# ============================================

@router.get("/dashboard")
async def dashboard():
    """Get CRM dashboard summary metrics."""
    return await orm_call(get_crm_dashboard)
