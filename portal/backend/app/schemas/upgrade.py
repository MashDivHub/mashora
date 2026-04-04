from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UpgradeCreate(BaseModel):
    tenant_id: UUID
    to_version: str


class UpgradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    from_version: str | None
    to_version: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    log: str | None
    created_at: datetime


class AvailableUpgrade(BaseModel):
    current_version: str | None
    latest_version: str
    available: bool
