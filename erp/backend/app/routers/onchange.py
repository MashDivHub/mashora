"""
Onchange endpoint for form field interactions.

When a user changes a field value in a form, the frontend calls this
endpoint to get computed updates for dependent fields.
This mimics Mashora's @api.onchange mechanism.
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import mashora_env, orm_call

router = APIRouter(tags=["onchange"])
_logger = logging.getLogger(__name__)


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
    updated_fields: dict[str, Any] = {}
    warnings: list[str] = []


def _clean_vals_for_orm(model_obj, vals: dict) -> dict:
    """
    Clean form values so they are ORM-compatible.
    - Many2one: [id, name] -> id
    - Many2many: keep as-is or extract IDs
    - Remove unknown fields
    """
    clean = {}
    fields_info = model_obj._fields
    for key, value in vals.items():
        if key not in fields_info:
            continue
        field = fields_info[key]
        ftype = field.type

        if ftype == 'many2one':
            if isinstance(value, (list, tuple)) and len(value) >= 1:
                clean[key] = value[0]  # Extract ID from [id, name]
            elif isinstance(value, bool):
                clean[key] = False
            else:
                clean[key] = value
        elif ftype in ('one2many', 'many2many'):
            if isinstance(value, list) and value and isinstance(value[0], (list, tuple)):
                # Already command format
                clean[key] = value
            elif isinstance(value, list) and value and isinstance(value[0], int):
                clean[key] = [(6, 0, value)]  # Set IDs
            else:
                clean[key] = value or []
        else:
            clean[key] = value
    return clean


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

        # Clean values for ORM compatibility
        vals = _clean_vals_for_orm(Model, current_values)

        # Clean the changed field value
        if field_name in Model._fields:
            field = Model._fields[field_name]
            if field.type == 'many2one' and isinstance(field_value, (list, tuple)):
                vals[field_name] = field_value[0] if field_value else False
            else:
                vals[field_name] = field_value
        else:
            vals[field_name] = field_value

        try:
            # Get the onchange spec for this model
            field_onchange = Model._onchange_spec()

            if record_id:
                record = Model.browse(record_id)
                if not record.exists():
                    return {"updated_fields": {}, "warnings": []}
            else:
                record = Model.new(vals)

            # Execute the onchange
            result = record.onchange(vals, [field_name], field_onchange)

            updated_fields = {}
            warnings = []

            if result.get("value"):
                # Convert ORM values back to frontend format
                for k, v in result["value"].items():
                    if k in Model._fields:
                        f = Model._fields[k]
                        if f.type == 'many2one' and v:
                            # Convert to [id, name] format
                            try:
                                rec = env[f.comodel_name].browse(v) if isinstance(v, int) else v
                                if hasattr(rec, 'display_name'):
                                    updated_fields[k] = [rec.id, rec.display_name]
                                else:
                                    updated_fields[k] = v
                            except Exception:
                                updated_fields[k] = v
                        else:
                            updated_fields[k] = v
                    else:
                        updated_fields[k] = v

            if result.get("warning"):
                warning = result["warning"]
                if isinstance(warning, dict):
                    warnings.append(warning.get("message", str(warning)))
                else:
                    warnings.append(str(warning))

            return {"updated_fields": updated_fields, "warnings": warnings}

        except Exception as e:
            _logger.warning("Onchange failed for %s.%s: %s", model, field_name, e, exc_info=True)
            return {"updated_fields": {}, "warnings": []}


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
