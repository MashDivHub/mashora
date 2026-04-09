"""
Onchange endpoint for form field interactions.

When a user changes a field value in a form, the frontend calls this
endpoint to get computed updates for dependent fields.
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser

router = APIRouter(tags=["onchange"])
_logger = logging.getLogger(__name__)


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


class OnchangeRequest(BaseModel):
    record_id: int | None = None
    field_name: str
    field_value: Any
    current_values: dict[str, Any] = {}


class OnchangeResponse(BaseModel):
    updated_fields: dict[str, Any] = {}
    warnings: list[str] = []


@router.post("/model/{model_name}/onchange", response_model=OnchangeResponse)
async def onchange(model_name: str, body: OnchangeRequest, user: CurrentUser | None = Depends(get_optional_user)):
    """
    Execute an onchange for a form field.

    Returns empty updated_fields since the legacy ORM onchange mechanism
    is not available with SQLAlchemy. Field computations happen server-side
    on save.
    """
    return OnchangeResponse(updated_fields={}, warnings=[])
