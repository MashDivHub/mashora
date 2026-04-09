"""
res.partner specific endpoints.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.services.base import async_search_read, async_get, async_create, async_update, async_delete

router = APIRouter(prefix="/partners", tags=["partners (PoC)"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


PARTNER_FIELDS_BASE = [
    "id", "name", "email", "phone",
    "street", "city", "zip",
    "is_company", "active",
    "create_date", "write_date",
]


@router.get("")
async def list_partners(
    search: str | None = Query(default=None, description="Search by name"),
    is_company: bool | None = Query(default=None, description="Filter companies or individuals"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=200),
    order: str = Query(default="name asc"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """List partners with optional search and filters."""
    domain: list[Any] = []
    if search:
        domain.append(["name", "ilike", search])
    if is_company is not None:
        domain.append(["is_company", "=", is_company])

    result = await async_search_read(
        "res.partner",
        domain=domain,
        fields=PARTNER_FIELDS_BASE,
        offset=offset,
        limit=limit,
        order=order,
    )
    return result


@router.get("/{partner_id}")
async def get_partner(partner_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Read a single partner by ID."""
    result = await async_get("res.partner", partner_id, fields=PARTNER_FIELDS_BASE)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Partner {partner_id} not found")
    return result


@router.post("", status_code=201)
async def create_partner(
    name: str = Query(description="Partner name"),
    email: str | None = Query(default=None),
    phone: str | None = Query(default=None),
    is_company: bool = Query(default=False),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Create a new partner."""
    vals: dict[str, Any] = {"name": name, "is_company": is_company}
    if email:
        vals["email"] = email
    if phone:
        vals["phone"] = phone

    result = await async_create("res.partner", vals=vals, uid=_uid(user))
    return result


@router.put("/{partner_id}")
async def update_partner(partner_id: int, name: str | None = None, email: str | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    """Update a partner's name and/or email."""
    vals: dict[str, Any] = {}
    if name is not None:
        vals["name"] = name
    if email is not None:
        vals["email"] = email

    if not vals:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await async_update("res.partner", partner_id, vals=vals, uid=_uid(user))
    return result


@router.delete("/{partner_id}")
async def delete_partner(partner_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Delete a partner."""
    await async_delete("res.partner", partner_id)
    return {"deleted": True, "id": partner_id}
