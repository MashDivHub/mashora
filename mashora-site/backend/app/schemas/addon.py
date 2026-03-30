from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AddonCreate(BaseModel):
    technical_name: str
    display_name: str
    summary: str | None = None
    description: str | None = None
    category: str | None = None
    price_cents: int = 0
    currency: str = "USD"


class AddonVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version: str
    changelog: str | None
    file_size: int | None
    mashora_version_compat: str | None
    published_at: datetime | None


class AddonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    technical_name: str
    display_name: str
    summary: str | None
    author_name: str | None = None
    category: str | None
    version: str | None
    price_cents: int
    currency: str
    icon_url: str | None
    download_count: int
    rating_avg: Decimal
    rating_count: int
    status: str
    created_at: datetime


class AddonDetail(AddonResponse):
    description: str | None
    mashora_version_min: str
    versions: list[AddonVersionResponse] = []


class AddonVersionCreate(BaseModel):
    version: str
    changelog: str | None = None
    mashora_version_compat: str = "19.0"


class AddonReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class AddonReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    user_email: str | None = None
    rating: int
    comment: str | None
    created_at: datetime


class AddonList(BaseModel):
    addons: list[AddonResponse]
    total: int
    page: int
    per_page: int


class InstallAddonRequest(BaseModel):
    tenant_id: UUID
    version_id: UUID | None = None
