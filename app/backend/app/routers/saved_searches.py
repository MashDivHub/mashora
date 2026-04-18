"""Saved searches (ir.filters) endpoints."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import get_optional_user, CurrentUser
from app.services.saved_search_service import (
    list_saved_searches,
    create_saved_search,
    delete_saved_search,
    set_default_saved_search,
)

router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


class SavedSearchCreate(BaseModel):
    model: str
    name: str
    domain: list = []
    context: dict = {}
    is_default: bool = False


@router.get("")
async def list_endpoint(model: str, user: CurrentUser | None = Depends(get_optional_user)):
    return await list_saved_searches(model=model)


@router.post("")
async def create_endpoint(body: SavedSearchCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await create_saved_search(
        model=body.model,
        name=body.name,
        domain=body.domain,
        context=body.context,
        is_default=body.is_default,
    )


@router.delete("/{filter_id}")
async def delete_endpoint(filter_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    await delete_saved_search(filter_id=filter_id)
    return {"ok": True}


@router.post("/{filter_id}/set-default")
async def set_default_endpoint(filter_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    await set_default_saved_search(filter_id=filter_id)
    return {"ok": True}
