from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TenantCreate(BaseModel):
    db_name: str
    subdomain: str | None = None


class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    db_name: str
    subdomain: str | None
    status: str
    mashora_version: str | None
    created_at: datetime
    last_accessed_at: datetime | None


class TenantList(BaseModel):
    tenants: list[TenantResponse]
    total: int
