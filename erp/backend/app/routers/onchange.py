"""
Onchange endpoint for form field interactions.

When a user changes a field value in a form, the frontend calls this
endpoint to get computed updates for dependent fields.
This mimics Mashora's @api.onchange mechanism.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import mashora_env, orm_call

router = APIRouter(tags=["onchange"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


class OnchangeRequest(BaseModel):
    record_id: int | None = None
    field_name: str
    field_value: Any
    current_values: dict[str, Any] = {}


class OnchangeResponse(BaseModel):
    updated_fields: dict[str, Any]
    warnings: list[str] = []


def _execute_onchange(
    model: str,
    record_id: Optional[int],
    field_name: str,
    field_value: Any,
    current_values: dict[str, Any],
    uid: int = 1,
    context: Optional[dict] = None,
) -> dict:
    """
    Execute an onchange by creating/loading a record in a virtual environment,
    applying the field change, and collecting all computed updates.
    """
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]

        # Build the values dict with the changed field
        vals = dict(current_values)
        vals[field_name] = field_value

        if record_id:
            # Existing record: load it and apply changes
            record = Model.browse(record_id)
            if not record.exists():
                return {"updated_fields": {}, "warnings": []}
        else:
            # New record: use onchange specs
            record = Model.new(vals)

        # Get the onchange spec for this model
        # onchange_spec maps field names to their onchange fields
        field_onchange = Model._onchange_spec()

        # Check if this field has an onchange
        if field_name not in field_onchange:
            return {"updated_fields": {}, "warnings": []}

        # Execute the onchange
        # Use Mashora's built-in onchange mechanism
        result = record.onchange(vals, [field_name], field_onchange)

        updated_fields = {}
        warnings = []

        if result.get("value"):
            updated_fields = result["value"]

        if result.get("warning"):
            warning = result["warning"]
            if isinstance(warning, dict):
                warnings.append(warning.get("message", str(warning)))
            else:
                warnings.append(str(warning))

        return {"updated_fields": updated_fields, "warnings": warnings}


@router.post("/model/{model_name}/onchange", response_model=OnchangeResponse)
async def onchange(model_name: str, body: OnchangeRequest, user: CurrentUser | None = Depends(get_optional_user)):
    """
    Execute an onchange for a form field.

    When a user changes partner_id on an invoice, this endpoint returns
    the updated payment_term_id, fiscal_position_id, currency_id, etc.
    """
    result = await orm_call(
        _execute_onchange,
        model=model_name,
        record_id=body.record_id,
        field_name=body.field_name,
        field_value=body.field_value,
        current_values=body.current_values,
        uid=_uid(user),
        context=_ctx(user),
    )
    return result
