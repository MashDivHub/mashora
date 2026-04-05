"""Action resolution REST endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call, mashora_env
from app.core.actions import get_action, get_action_for_model, get_action_views

router = APIRouter(prefix="/actions", tags=["actions"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


def _resolve_xmlid(xmlid: str, uid: int = 1, context: dict | None = None) -> dict | None:
    """Resolve an XML ID (e.g. 'sale.action_report_saleorder') to an action."""
    with mashora_env(uid=uid, context=context) as env:
        try:
            record = env.ref(xmlid)
            if record:
                # Pass the model name so get_action looks in the right table
                action_model = record._name if hasattr(record, '_name') else None
                return get_action(action_id=record.id, action_model=action_model, uid=uid, context=context)
        except (ValueError, Exception):
            return None
    return None


@router.get("/ref/{xmlid:path}")
async def get_action_by_xmlid(xmlid: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Fetch an action definition by XML ID (e.g. sale.action_report_saleorder)."""
    result = await orm_call(_resolve_xmlid, xmlid=xmlid, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Action '{xmlid}' not found")
    return result


@router.get("/{action_id}")
async def get_action_endpoint(action_id: int, action_model: str | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """Fetch an action definition by ID. Optionally specify action_model to search only that type."""
    result = await orm_call(get_action, action_id=action_id, action_model=action_model, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"Action {action_id} not found")
    return result


@router.get("/for-model/{model_name}")
async def get_model_action(model_name: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Get the default action for a model."""
    result = await orm_call(get_action_for_model, model_name=model_name, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"No action found for model {model_name}")
    return result


@router.get("/{action_id}/views")
async def get_action_views_endpoint(action_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get all view definitions for an action's view modes."""
    result = await orm_call(get_action_views, action_id=action_id, uid=_uid(user), context=_ctx(user))
    return result
