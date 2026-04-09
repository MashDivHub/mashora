"""
Menu tree builder for the dynamic sidebar.

Fetches ir.ui.menu records and builds a hierarchical tree structure.
Now uses SQLAlchemy async.
"""
import logging
from typing import Any, Optional

from app.services.base import async_get, async_search_read

_logger = logging.getLogger(__name__)

MENU_FIELDS = [
    "id", "name", "parent_id", "sequence", "action",
    "web_icon", "active",
]


async def get_menu_tree(uid: int = 1, context: Optional[dict] = None) -> list[dict]:
    """
    Fetch the full menu hierarchy.
    Returns a nested tree structure.
    """
    result = await async_search_read(
        "ir.ui.menu",
        domain=[],
        fields=MENU_FIELDS,
        limit=2000,
        order="sequence asc, id asc",
    )
    menu_data = result["records"]

    # Build tree
    menu_by_id = {m["id"]: {**m, "children": []} for m in menu_data}
    roots = []

    for m in menu_data:
        parent_id = m.get("parent_id")
        # parent_id may be int or [id, name] tuple from JSONB
        if isinstance(parent_id, (list, tuple)):
            parent_id = parent_id[0]

        if parent_id and parent_id in menu_by_id:
            menu_by_id[parent_id]["children"].append(menu_by_id[m["id"]])
        elif not parent_id:
            roots.append(menu_by_id[m["id"]])

    return roots


async def get_menu_action(menu_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get the action associated with a menu item."""
    menu = await async_get("ir.ui.menu", menu_id, ["name", "action"])
    if not menu or not menu.get("action"):
        return None

    action_ref = menu["action"]

    # Parse action reference
    if isinstance(action_ref, str) and "," in action_ref:
        action_model, action_id = action_ref.rsplit(",", 1)
        from app.core.actions import get_action
        return await get_action(int(action_id), uid=uid, context=context)
    elif isinstance(action_ref, int):
        from app.core.actions import get_action
        return await get_action(action_ref, uid=uid, context=context)

    return None
