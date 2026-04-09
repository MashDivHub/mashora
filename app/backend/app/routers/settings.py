"""
Settings module endpoints.

Reads installed modules and settings from SQLAlchemy-backed tables.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_optional_user, CurrentUser
from app.services.base import async_search_read, async_get, async_create, async_update

router = APIRouter(prefix="/settings", tags=["settings"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


@router.get("/modules")
async def list_modules(user: CurrentUser | None = Depends(get_optional_user)):
    """List installed modules."""
    result = await async_search_read(
        "ir.module.module",
        domain=[["state", "=", "installed"]],
        fields=["name", "shortdesc"],
        order="shortdesc",
        limit=500,
    )
    return result["records"]


@router.post("/open")
async def open_settings(user: CurrentUser | None = Depends(get_optional_user)):
    """Return current settings config record."""
    result = await async_search_read(
        "res.config.settings",
        domain=[],
        fields=[],
        limit=1,
        order="id desc",
    )
    if result["records"]:
        return {"id": result["records"][0]["id"], "data": result["records"][0], "model": "res.config.settings"}
    return {"error": "Settings not available"}


class ApplySettingsBody(BaseModel):
    id: int
    vals: dict | None = None


@router.post("/apply")
async def apply_settings(
    body: ApplySettingsBody,
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Apply settings changes."""
    updated = await async_update("res.config.settings", body.id, body.vals or {}, uid=_uid(user))
    return {"success": True, "data": updated}
