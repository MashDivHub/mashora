"""
Wizard (TransientModel) endpoints.

Wizards are multi-step, session-bound, temporary records in Mashora.
They have a different lifecycle than regular records:
1. Create with context (which record triggered the wizard)
2. Fill in wizard fields
3. Execute the wizard action
4. Wizard is auto-deleted after execution

Examples: Register Payment, Send Invoice, Confirm Order
"""
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.orm_adapter import mashora_env, orm_call

router = APIRouter(prefix="/wizard", tags=["wizards"])


class WizardCreate(BaseModel):
    context: dict[str, Any] = {}
    defaults: dict[str, Any] = {}


class WizardUpdate(BaseModel):
    vals: dict[str, Any]


class WizardAction(BaseModel):
    args: list[Any] = []
    kwargs: dict[str, Any] = {}


def _create_wizard(
    model: str,
    context: dict[str, Any],
    defaults: dict[str, Any],
    uid: int = 1,
) -> dict:
    """Create a wizard record with the given context."""
    with mashora_env(uid=uid, context=context) as env:
        Wizard = env[model]
        record = Wizard.create(defaults)
        # Read all fields so the frontend can render the wizard form
        return record.read()[0]


def _read_wizard(model: str, wizard_id: int, uid: int = 1) -> Optional[dict]:
    """Read current wizard state."""
    with mashora_env(uid=uid) as env:
        record = env[model].browse(wizard_id)
        if not record.exists():
            return None
        return record.read()[0]


def _update_wizard(model: str, wizard_id: int, vals: dict, uid: int = 1) -> dict:
    """Update wizard fields."""
    with mashora_env(uid=uid) as env:
        record = env[model].browse(wizard_id)
        record.write(vals)
        return record.read()[0]


def _execute_wizard(
    model: str,
    wizard_id: int,
    action: str,
    args: list,
    kwargs: dict,
    uid: int = 1,
) -> Any:
    """Execute a wizard action method."""
    with mashora_env(uid=uid) as env:
        record = env[model].browse(wizard_id)
        method = getattr(record, action)
        result = method(*args, **kwargs)

        # Handle common return types
        if hasattr(result, 'read'):
            return {"type": "records", "data": result.read()}
        if isinstance(result, dict) and result.get("type") == "ir.actions.act_window":
            return {"type": "action", "data": result}
        if result is None:
            return {"type": "done"}
        return {"type": "result", "data": result}


@router.post("/{model_name}", status_code=201)
async def create_wizard(model_name: str, body: WizardCreate):
    """Create a new wizard instance with context."""
    result = await orm_call(
        _create_wizard,
        model=model_name,
        context=body.context,
        defaults=body.defaults,
    )
    return result


@router.get("/{model_name}/{wizard_id}")
async def get_wizard(model_name: str, wizard_id: int):
    """Read wizard state."""
    result = await orm_call(_read_wizard, model=model_name, wizard_id=wizard_id)
    if result is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Wizard not found or expired")
    return result


@router.put("/{model_name}/{wizard_id}")
async def update_wizard(model_name: str, wizard_id: int, body: WizardUpdate):
    """Update wizard fields."""
    result = await orm_call(
        _update_wizard,
        model=model_name,
        wizard_id=wizard_id,
        vals=body.vals,
    )
    return result


@router.post("/{model_name}/{wizard_id}/{action}")
async def execute_wizard_action(
    model_name: str,
    wizard_id: int,
    action: str,
    body: WizardAction | None = None,
):
    """Execute a wizard action (e.g., action_create_payments)."""
    b = body or WizardAction()
    result = await orm_call(
        _execute_wizard,
        model=model_name,
        wizard_id=wizard_id,
        action=action,
        args=b.args,
        kwargs=b.kwargs,
    )
    return result
