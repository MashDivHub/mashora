from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LicenseCreate(BaseModel):
    plan: str
    max_users: int = 5
    max_apps: int = 10


class LicenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    license_key: str
    plan: str
    max_users: int
    max_apps: int
    features: dict
    valid_from: datetime
    valid_until: datetime | None
    status: str


class LicenseValidation(BaseModel):
    valid: bool
    plan: str | None
    features: dict | None
    message: str
