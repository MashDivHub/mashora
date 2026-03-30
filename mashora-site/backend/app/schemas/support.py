from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TicketCreate(BaseModel):
    subject: str
    description: str
    priority: str = "normal"
    category: str = "other"


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    user_id: UUID | None
    user_email: str | None
    subject: str
    description: str
    priority: str
    status: str
    category: str | None
    created_at: datetime
    updated_at: datetime


class TicketMessageCreate(BaseModel):
    message: str


class TicketMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    user_id: UUID | None
    user_email: str | None
    message: str
    is_staff: bool
    created_at: datetime


class TicketList(BaseModel):
    tickets: list[TicketResponse]
    total: int
