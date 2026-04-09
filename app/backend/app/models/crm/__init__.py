"""CRM models."""

from .crm_lead import CrmLead
from .crm_stage import CrmStage
from .crm_team import CrmTeam
from .crm_lost_reason import CrmLostReason

__all__ = [
    "CrmLead",
    "CrmStage",
    "CrmTeam",
    "CrmLostReason",
]
