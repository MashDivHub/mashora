"""
Menu tree builder for the dynamic sidebar.

Fetches ir.ui.menu records and builds a hierarchical tree structure.
"""
import logging
from typing import Any, Optional

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)

MENU_FIELDS_BASE = [
    "id", "name", "parent_id", "sequence", "action",
    "web_icon", "child_id", "active",
]

MENU_FIELDS_OPTIONAL = ["groups_id"]


def get_menu_tree(uid: int = 1, context: Optional[dict] = None) -> list[dict]:
    """
    Fetch the full menu hierarchy respecting user access rights.
    Returns a nested tree structure.
    """
    with mashora_env(uid=uid, context=context) as env:
        Menu = env['ir.ui.menu']
        model_fields = Menu._fields
        fields = [f for f in MENU_FIELDS_BASE if f in model_fields]
        fields += [f for f in MENU_FIELDS_OPTIONAL if f in model_fields]
        # Fetch all accessible menus
        all_menus = Menu.search([], order='sequence, id')
        menu_data = all_menus.read(fields)

        # Build tree
        menu_by_id = {m['id']: {**m, 'children': []} for m in menu_data}
        roots = []

        for m in menu_data:
            parent_id = m['parent_id'][0] if m['parent_id'] else None
            if parent_id and parent_id in menu_by_id:
                menu_by_id[parent_id]['children'].append(menu_by_id[m['id']])
            elif not parent_id:
                roots.append(menu_by_id[m['id']])

        return roots


def get_menu_action(menu_id: int, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get the action associated with a menu item."""
    with mashora_env(uid=uid, context=context) as env:
        menu = env['ir.ui.menu'].browse(menu_id)
        if not menu.exists():
            return None
        data = menu.read(['name', 'action'])[0]
        if not data.get('action'):
            return None

        # Parse action reference: "ir.actions.act_window,123"
        action_ref = data['action']
        if isinstance(action_ref, str) and ',' in action_ref:
            action_model, action_id = action_ref.rsplit(',', 1)
            from app.core.actions import get_action
            return get_action(int(action_id), uid=uid, context=context)
        elif isinstance(action_ref, (list, tuple)):
            # Could be (model, id) tuple
            from app.core.actions import get_action
            return get_action(action_ref[0] if isinstance(action_ref[0], int) else int(action_ref[1]), uid=uid, context=context)

        return None
