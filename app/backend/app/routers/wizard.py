"""
Wizard (TransientModel) endpoints.

Wizards are temporary records used for multi-step operations.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.services.base import async_create, async_get, async_update, async_delete

router = APIRouter(prefix="/wizard", tags=["wizards"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


class WizardCreate(BaseModel):
    context: dict[str, Any] = {}
    defaults: dict[str, Any] = {}


class WizardUpdate(BaseModel):
    vals: dict[str, Any]


class WizardAction(BaseModel):
    args: list[Any] = []
    kwargs: dict[str, Any] = {}


@router.post("/{model_name}", status_code=201)
async def create_wizard(model_name: str, body: WizardCreate, user: CurrentUser | None = Depends(get_optional_user)):
    """Create a new wizard instance with context."""
    result = await async_create(model_name, vals=body.defaults, uid=_uid(user))
    return result


@router.get("/{model_name}/{wizard_id}")
async def get_wizard(model_name: str, wizard_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Read wizard state."""
    result = await async_get(model_name, wizard_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Wizard not found or expired")
    return result


@router.put("/{model_name}/{wizard_id}")
async def update_wizard(model_name: str, wizard_id: int, body: WizardUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    """Update wizard fields."""
    result = await async_update(model_name, wizard_id, vals=body.vals, uid=_uid(user))
    return result


@router.post("/{model_name}/{wizard_id}/{action}")
async def execute_wizard_action(
    model_name: str,
    wizard_id: int,
    action: str,
    body: WizardAction | None = None,
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Execute a wizard action."""
    if action.startswith('_'):
        raise HTTPException(status_code=400, detail=f"Cannot call private method '{action}'")
    # With SQLAlchemy backend, wizard actions are not directly executable
    # Return a done signal; callers should implement action logic in services
    return {"type": "done", "action": action, "wizard_id": wizard_id}
