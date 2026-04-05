"""
Pydantic schemas for the CRM module.

Covers: crm.lead (leads/opportunities), crm.stage (pipeline), crm.lost.reason.
"""
from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field


class LeadCreate(BaseModel):
    """Create a new lead or opportunity."""
    name: str
    type: Literal["lead", "opportunity"] = "opportunity"
    partner_id: Optional[int] = None
    contact_name: Optional[str] = None
    partner_name: Optional[str] = None
    email_from: Optional[str] = None
    phone: Optional[str] = None
    stage_id: Optional[int] = None
    user_id: Optional[int] = None
    team_id: Optional[int] = None
    expected_revenue: Optional[float] = None
    probability: Optional[float] = None
    priority: str = "0"
    date_deadline: Optional[date] = None
    tag_ids: list[int] = Field(default_factory=list)
    description: Optional[str] = None
    website: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    zip: Optional[str] = None
    country_id: Optional[int] = None
    state_id: Optional[int] = None
    campaign_id: Optional[int] = None
    medium_id: Optional[int] = None
    source_id: Optional[int] = None


class LeadUpdate(BaseModel):
    """Update an existing lead/opportunity."""
    name: Optional[str] = None
    partner_id: Optional[int] = None
    contact_name: Optional[str] = None
    partner_name: Optional[str] = None
    email_from: Optional[str] = None
    phone: Optional[str] = None
    stage_id: Optional[int] = None
    user_id: Optional[int] = None
    team_id: Optional[int] = None
    expected_revenue: Optional[float] = None
    probability: Optional[float] = None
    priority: Optional[str] = None
    date_deadline: Optional[date] = None
    tag_ids: Optional[list[int]] = None
    description: Optional[str] = None


class LeadListParams(BaseModel):
    """Parameters for listing leads/opportunities."""
    type: Optional[str] = Field(default=None, description="Filter: lead or opportunity")
    stage_id: Optional[int] = None
    user_id: Optional[int] = None
    team_id: Optional[int] = None
    partner_id: Optional[int] = None
    won_status: Optional[str] = Field(default=None, description="Filter: won, lost, pending")
    priority: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    active: Optional[bool] = True
    offset: int = 0
    limit: int = 40
    order: str = "priority desc, id desc"


class LeadMarkLost(BaseModel):
    """Mark a lead/opportunity as lost."""
    lost_reason_id: int
    lost_feedback: Optional[str] = None


class LeadConvert(BaseModel):
    """Convert a lead to an opportunity."""
    partner_id: Optional[int] = None
    user_id: Optional[int] = None
    team_id: Optional[int] = None


class StageListParams(BaseModel):
    """Parameters for listing pipeline stages."""
    team_id: Optional[int] = None
    is_won: Optional[bool] = None
