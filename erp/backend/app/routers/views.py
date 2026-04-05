"""
View definition endpoints.

Serves parsed view architectures and field metadata for dynamic rendering.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call
from app.core.views import get_view_definition, get_search_view
from app.core.fields import get_fields_info, get_model_info, get_selection_values, search_relation

router = APIRouter(prefix="/views", tags=["views"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


@router.get("/{model_name}/{view_type}")
async def get_view(
    model_name: str,
    view_type: str,
    view_id: int | None = Query(default=None),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get a parsed view definition (arch XML -> JSON) for a model."""
    return await orm_call(get_view_definition, model=model_name, view_type=view_type, view_id=view_id, uid=_uid(user), context=_ctx(user))


@router.get("/{model_name}/search")
async def get_search(model_name: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Get search view filters and group-by options."""
    return await orm_call(get_search_view, model=model_name, uid=_uid(user), context=_ctx(user))


@router.get("/{model_name}/fields")
async def get_fields(
    model_name: str,
    fields: str | None = Query(default=None, description="Comma-separated field names"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get enriched field metadata for dynamic form rendering."""
    field_list = fields.split(",") if fields else None
    return await orm_call(get_fields_info, model=model_name, fields=field_list, uid=_uid(user), context=_ctx(user))


@router.get("/{model_name}/info")
async def get_model(model_name: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Get model-level metadata (name, table, access rights)."""
    return await orm_call(get_model_info, model=model_name, uid=_uid(user), context=_ctx(user))


@router.get("/{model_name}/selection/{field_name}")
async def get_selection(model_name: str, field_name: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Get selection field values."""
    return await orm_call(get_selection_values, model=model_name, field=field_name, uid=_uid(user), context=_ctx(user))


@router.get("/{model_name}/search-relation/{field_name}")
async def search_related(
    model_name: str,
    field_name: str,
    q: str = Query(default="", description="Search text"),
    limit: int = Query(default=20, ge=1, le=100),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Search records in a related model (for Many2one autocomplete)."""
    return await orm_call(search_relation, model=model_name, field=field_name, search=q, limit=limit, uid=_uid(user), context=_ctx(user))
