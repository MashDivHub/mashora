"""
res.partner specific endpoints — PoC test endpoints.

These endpoints demonstrate the ORM adapter with a concrete model.
They serve as the proof that the adapter works end-to-end:
create, read, update, delete a partner record.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import (
    create_record,
    delete_record,
    orm_call,
    read_record,
    search_read,
    write_record,
)

router = APIRouter(prefix="/partners", tags=["partners (PoC)"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None

# Default fields to read for partner — keeps responses concise
# Only include fields guaranteed in base; extras are added dynamically
PARTNER_FIELDS_BASE = [
    "id", "name", "email", "phone",
    "street", "city", "zip",
    "is_company", "active",
    "create_date", "write_date",
]

# Extra fields that may not exist depending on installed modules
PARTNER_FIELDS_OPTIONAL = ["mobile", "company_type", "website", "function"]


def _get_partner_fields(env) -> list[str]:
    """Return partner fields that actually exist in the current registry."""
    model_fields = env["res.partner"]._fields
    fields = list(PARTNER_FIELDS_BASE)
    for f in PARTNER_FIELDS_OPTIONAL:
        if f in model_fields:
            fields.append(f)
    return fields


@router.get("")
async def list_partners(
    search: str | None = Query(default=None, description="Search by name"),
    is_company: bool | None = Query(default=None, description="Filter companies or individuals"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=200),
    order: str = Query(default="name asc"),
    user: CurrentUser = Depends(get_current_user),
):
    """List partners with optional search and filters."""
    domain: list[Any] = []
    if search:
        domain.append(["name", "ilike", search])
    if is_company is not None:
        domain.append(["is_company", "=", is_company])

    result = await orm_call(
        search_read,
        model="res.partner",
        domain=domain,
        fields=PARTNER_FIELDS_BASE,
        offset=offset,
        limit=limit,
        order=order,
        uid=_uid(user),
        context=_ctx(user),
    )
    return result


@router.get("/{partner_id}")
async def get_partner(partner_id: int, user: CurrentUser = Depends(get_current_user)):
    """Read a single partner by ID."""
    result = await orm_call(
        read_record,
        model="res.partner",
        record_id=partner_id,
        fields=PARTNER_FIELDS_BASE,
        uid=_uid(user),
        context=_ctx(user),
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Partner {partner_id} not found")
    return result


@router.post("", status_code=201)
async def create_partner(
    name: str = Query(description="Partner name"),
    email: str | None = Query(default=None),
    phone: str | None = Query(default=None),
    is_company: bool = Query(default=False),
    user: CurrentUser = Depends(get_current_user),
):
    """
    Create a new partner — simplified endpoint for PoC testing.

    This is intentionally simple (query params instead of body)
    to make it easy to test from the Swagger UI.
    """
    vals: dict[str, Any] = {"name": name}
    if email:
        vals["email"] = email
    if phone:
        vals["phone"] = phone
    vals["is_company"] = is_company

    result = await orm_call(
        create_record,
        model="res.partner",
        vals=vals,
        uid=_uid(user),
        context=_ctx(user),
    )
    return result


@router.put("/{partner_id}")
async def update_partner(partner_id: int, name: str | None = None, email: str | None = None, user: CurrentUser = Depends(get_current_user)):
    """Update a partner's name and/or email."""
    vals: dict[str, Any] = {}
    if name is not None:
        vals["name"] = name
    if email is not None:
        vals["email"] = email

    if not vals:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await orm_call(
        write_record,
        model="res.partner",
        record_id=partner_id,
        vals=vals,
        uid=_uid(user),
        context=_ctx(user),
    )
    return result


@router.delete("/{partner_id}")
async def delete_partner(partner_id: int, user: CurrentUser = Depends(get_current_user)):
    """Delete a partner."""
    await orm_call(
        delete_record,
        model="res.partner",
        record_id=partner_id,
        uid=_uid(user),
        context=_ctx(user),
    )
    return {"deleted": True, "id": partner_id}
