"""
Action resolution for the dynamic view engine.

Fetches ir.actions.act_window definitions and resolves menu → action mappings.
"""
import logging
from typing import Any, Optional

from app.core.orm_adapter import mashora_env

_logger = logging.getLogger(__name__)

ACTION_FIELDS_BASE = [
    "id", "name", "res_model", "view_mode", "view_ids",
    "domain", "context", "target", "limit", "search_view_id",
    "help", "type",
]

ACTION_FIELDS_OPTIONAL = ["groups_id", "binding_model_id"]

VIEW_FIELDS_BASE = [
    "id", "view_mode", "sequence",
]

VIEW_FIELDS_OPTIONAL = ["view_id", "act_window_id"]


CLIENT_ACTION_FIELDS = ["id", "name", "type", "tag", "context", "params", "target"]

def get_action(action_id: int, uid: int = 1, context: Optional[dict] = None, action_model: Optional[str] = None) -> Optional[dict]:
    """Fetch an action definition by ID, searching across action types."""
    with mashora_env(uid=uid, context=context) as env:
        # If a specific action model is given, search only that
        models = [action_model] if action_model else [
            'ir.actions.act_window', 'ir.actions.client',
            'ir.actions.server', 'ir.actions.report',
            'ir.actions.act_url',
        ]

        for model in models:
            if model not in env.registry:
                continue
            action = env[model].browse(action_id)
            if not action.exists():
                continue

            if model == 'ir.actions.act_window':
                model_fields = env[model]._fields
                fields = [f for f in ACTION_FIELDS_BASE if f in model_fields]
                fields += [f for f in ACTION_FIELDS_OPTIONAL if f in model_fields]
                data = action.read(fields)[0]
                data['action_type'] = model
                # Fetch view_ids details
                if data.get('view_ids'):
                    view_model = env['ir.actions.act_window.view']
                    vf = view_model._fields
                    v_fields = [f for f in VIEW_FIELDS_BASE if f in vf] + [f for f in VIEW_FIELDS_OPTIONAL if f in vf]
                    view_ids = view_model.browse(data['view_ids'])
                    data['views'] = view_ids.read(v_fields)
                else:
                    data['views'] = []
                if data.get('view_mode'):
                    data['view_mode_list'] = [v.strip() for v in data['view_mode'].split(',')]
                return data

            elif model == 'ir.actions.client':
                model_fields = env[model]._fields
                fields = [f for f in CLIENT_ACTION_FIELDS if f in model_fields]
                data = action.read(fields)[0]
                data['action_type'] = model
                return data

            elif model == 'ir.actions.report':
                report_fields = [f for f in ['id', 'name', 'type', 'report_name', 'report_type', 'model', 'print_report_name'] if f in env[model]._fields]
                data = action.read(report_fields)[0]
                data['action_type'] = model
                return data

            elif model == 'ir.actions.act_url':
                data = action.read(['id', 'name', 'type', 'url', 'target'])[0]
                data['action_type'] = model
                return data

            else:
                fields = [f for f in ['id', 'name', 'type'] if f in env[model]._fields]
                data = action.read(fields)[0]
                data['action_type'] = model
                return data

        return None


def get_action_for_model(model_name: str, uid: int = 1, context: Optional[dict] = None) -> Optional[dict]:
    """Get the default window action for a model."""
    with mashora_env(uid=uid, context=context) as env:
        actions = env['ir.actions.act_window'].search(
            [('res_model', '=', model_name)], limit=1, order='id'
        )
        if not actions:
            return None
        return get_action(actions[0].id, uid=uid, context=context)


def get_action_views(action_id: int, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get all view definitions for an action's view modes."""
    action = get_action(action_id, uid=uid, context=context)
    if not action:
        return {}

    from app.core.views import get_view_definition
    views = {}
    for vm in action.get('view_mode_list', ['list', 'form']):
        try:
            view_def = get_view_definition(
                model=action['res_model'], view_type=vm, uid=uid, context=context
            )
            views[vm] = view_def
        except Exception as e:
            _logger.warning("Failed to load %s view for %s: %s", vm, action['res_model'], e)

    return {"action": action, "views": views}
