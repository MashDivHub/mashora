"""
Action resolution for the dynamic view engine.

Fetches ir.actions.act_window definitions and resolves menu → action mappings.
Now uses SQLAlchemy async.
"""
import logging
from typing import Any, Optional

from app.services.base import async_get, async_search_read

_logger = logging.getLogger(__name__)

ACTION_FIELDS = [
    "id", "name", "res_model", "view_mode", "domain", "context",
    "target", "limit", "search_view_id", "help", "type",
    "binding_model_id", "binding_type", "binding_view_types",
    "view_id",
]

CLIENT_ACTION_FIELDS = ["id", "name", "type", "context"]


async def get_action(action_id: int, uid: int = 1, context: Optional[dict] = None, action_model: Optional[str] = None) -> Optional[dict]:
    """Fetch an action definition by ID."""
    # Try act_window first (most common)
    data = await async_get("ir.act.window", action_id, ACTION_FIELDS)
    if data:
        data["action_type"] = "ir.actions.act_window"
        if data.get("view_mode"):
            data["view_mode_list"] = [v.strip() for v in data["view_mode"].split(",")]
        return data

    # Try ir.actions (base)
    data = await async_get("ir.actions", action_id, ["id", "name", "type", "path", "binding_type"])
    if data:
        data["action_type"] = data.get("type", "ir.actions.act_window")
        return data

    # Try server action
    data = await async_get("ir.act.server", action_id, ["id", "name", "type", "state", "usage"])
    if data:
        data["action_type"] = "ir.actions.server"
        return data

    return None


async def get_action_for_model(model_name: str, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get the default window action for a model."""
    result = await async_search_read(
        "ir.act.window",
        domain=[["res_model", "=", model_name]],
        fields=ACTION_FIELDS,
        limit=1,
        order="id asc",
    )
    if not result["records"]:
        return None

    data = result["records"][0]
    data["action_type"] = "ir.actions.act_window"
    if data.get("view_mode"):
        data["view_mode_list"] = [v.strip() for v in data["view_mode"].split(",")]
    return data


async def get_action_views(action_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get all view definitions for an action's view modes."""
    action = await get_action(action_id, uid=uid, context=context)
    if not action:
        return {}

    from app.core.views import get_view_definition
    views = {}
    for vm in action.get("view_mode_list", ["list", "form"]):
        try:
            view_def = await get_view_definition(
                model=action["res_model"], view_type=vm, uid=uid, context=context
            )
            views[vm] = view_def
        except Exception as e:
            _logger.warning("Failed to load %s view for %s: %s", vm, action["res_model"], e)

    return {"action": action, "views": views}
