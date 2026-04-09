"""Action resolution REST endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_optional_user, CurrentUser
from app.services.base import async_search_read, async_get
from app.core.actions import get_action, get_action_for_model, get_action_views

router = APIRouter(prefix="/actions", tags=["actions"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


@router.get("/ref/{xmlid:path}")
async def get_action_by_xmlid(xmlid: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Fetch an action definition by XML ID."""
    # Look up the ir.model.data record to resolve xmlid
    parts = xmlid.split(".", 1)
    domain: list = [["complete_name", "=", xmlid]]
    if len(parts) == 2:
        domain = [["module", "=", parts[0]], ["name", "=", parts[1]]]
    result = await async_search_read(
        "ir.model.data",
        domain=domain,
        fields=["id", "res_id", "model"],
        limit=1,
    )
    if not result["records"]:
        raise HTTPException(status_code=404, detail=f"Action '{xmlid}' not found")
    rec = result["records"][0]
    action_data = await async_get(rec["model"], rec["res_id"])
    if action_data is None:
        raise HTTPException(status_code=404, detail=f"Action '{xmlid}' not found")
    return action_data


@router.get("/for-model/{model_name}")
async def get_model_action(model_name: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Get the default action for a model."""
    result = await async_search_read(
        "ir.actions.act_window",
        domain=[["res_model", "=", model_name]],
        fields=["id", "name", "res_model", "view_mode", "domain", "context"],
        limit=1,
        order="id asc",
    )
    if not result["records"]:
        raise HTTPException(status_code=404, detail=f"No action found for model {model_name}")
    return result["records"][0]


@router.get("/{action_id}")
async def get_action_endpoint(action_id: int, action_model: str | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """Fetch an action definition by ID."""
    model = action_model or "ir.actions.act_window"
    result = await async_get(model, action_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Action {action_id} not found")
    return result


@router.get("/{action_id}/views")
async def get_action_views_endpoint(action_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get all view definitions for an action's view modes."""
    result = await async_search_read(
        "ir.ui.view",
        domain=[],
        fields=["id", "name", "type", "model"],
        limit=20,
    )
    return {"views": result["records"]}
