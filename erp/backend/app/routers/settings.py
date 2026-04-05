"""
Settings module endpoints.

Settings in Mashora/Odoo are just res.config.settings TransientModel forms.
Opening settings creates a wizard, editing changes fields, "Apply" executes it.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call, mashora_env

router = APIRouter(prefix="/settings", tags=["settings"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


def _list_settings_modules(uid: int = 1, context: Optional[dict] = None) -> list:
    """List installed modules that have settings."""
    with mashora_env(uid=uid, context=context) as env:
        if 'res.config.settings' not in env.registry:
            return []
        Settings = env['res.config.settings']
        # Get all fields grouped by module
        fields = Settings.fields_get()
        modules = set()
        for fname, fmeta in fields.items():
            # Module-specific fields have module prefix or are in a specific group
            if fmeta.get('module'):
                modules.add(fmeta['module'])

        # Also get from ir.module.module
        installed = env['ir.module.module'].search_read(
            [('state', '=', 'installed')],
            ['name', 'shortdesc'],
            order='shortdesc',
        )
        return installed


def _open_settings(uid: int = 1, context: Optional[dict] = None) -> dict:
    """Create a res.config.settings wizard and return its data + view."""
    with mashora_env(uid=uid, context=context) as env:
        if 'res.config.settings' not in env.registry:
            return {"error": "Settings not available"}

        Settings = env['res.config.settings']
        # Create a new settings wizard (this loads current values)
        wizard = Settings.create({})
        data = wizard.read()[0]

        return {
            "id": wizard.id,
            "data": data,
            "model": "res.config.settings",
        }


def _apply_settings(wizard_id: int, vals: dict, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Apply settings changes."""
    with mashora_env(uid=uid, context=context) as env:
        wizard = env['res.config.settings'].browse(wizard_id)
        if vals:
            wizard.write(vals)
        wizard.execute()
        return {"success": True}


@router.get("/modules")
async def list_modules(user: CurrentUser | None = Depends(get_optional_user)):
    """List installed modules."""
    return await orm_call(_list_settings_modules, uid=_uid(user), context=_ctx(user))


@router.post("/open")
async def open_settings(user: CurrentUser | None = Depends(get_optional_user)):
    """Create a settings wizard and return current values."""
    return await orm_call(_open_settings, uid=_uid(user), context=_ctx(user))


@router.post("/apply")
async def apply_settings(
    wizard_id: int,
    vals: dict | None = None,
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Apply settings changes."""
    return await orm_call(_apply_settings, wizard_id=wizard_id, vals=vals or {}, uid=_uid(user), context=_ctx(user))
