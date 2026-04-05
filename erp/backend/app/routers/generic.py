"""
Generic CRUD endpoints for any Mashora model.

These endpoints work with ANY model in the Mashora ORM by accepting
the model name as a path parameter. This is the foundation of the
REST API adapter layer.

Endpoints:
    GET    /model/{model_name}          → search + read (list)
    GET    /model/{model_name}/{id}     → read single record
    POST   /model/{model_name}          → create record
    PUT    /model/{model_name}/{id}     → update record
    DELETE /model/{model_name}/{id}     → delete record
    POST   /model/{model_name}/method   → call arbitrary method
    GET    /model/{model_name}/fields   → get field metadata
"""
from typing import Any

from fastapi import APIRouter, Query

from app.core.orm_adapter import (
    call_method,
    create_record,
    delete_record,
    get_fields_metadata,
    orm_call,
    read_record,
    search_read,
    write_record,
)
from app.schemas.common import (
    MethodCall,
    RecordCreate,
    RecordUpdate,
    SearchParams,
    SearchResult,
)

router = APIRouter(prefix="/model", tags=["generic"])

# Default UID for the PoC — in production this comes from JWT auth
DEFAULT_UID = 1


@router.post("/{model_name}", response_model=SearchResult)
async def list_records(model_name: str, params: SearchParams | None = None):
    """
    Search and read records from any model.

    The model_name uses dots: e.g., `res.partner`, `sale.order`.
    """
    p = params or SearchParams()
    result = await orm_call(
        search_read,
        model=model_name,
        domain=p.domain,
        fields=p.fields,
        offset=p.offset,
        limit=p.limit,
        order=p.order,
        uid=DEFAULT_UID,
    )
    return result


@router.get("/{model_name}/fields")
async def get_fields(
    model_name: str,
    attributes: str | None = Query(
        default=None,
        description="Comma-separated field attributes to return, e.g. 'string,type,required'",
    ),
):
    """Get field definitions for a model."""
    attrs = attributes.split(",") if attributes else None
    result = await orm_call(
        get_fields_metadata,
        model=model_name,
        attributes=attrs,
        uid=DEFAULT_UID,
    )
    return result


@router.get("/{model_name}/{record_id}")
async def get_record(
    model_name: str,
    record_id: int,
    fields: str | None = Query(
        default=None,
        description="Comma-separated field names to read.",
    ),
):
    """Read a single record by ID."""
    field_list = fields.split(",") if fields else None
    result = await orm_call(
        read_record,
        model=model_name,
        record_id=record_id,
        fields=field_list,
        uid=DEFAULT_UID,
    )
    if result is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"{model_name}({record_id}) not found")
    return result


@router.post("/{model_name}/create", status_code=201)
async def create(model_name: str, body: RecordCreate):
    """Create a new record."""
    result = await orm_call(
        create_record,
        model=model_name,
        vals=body.vals,
        uid=DEFAULT_UID,
    )
    return result


@router.put("/{model_name}/{record_id}")
async def update(model_name: str, record_id: int, body: RecordUpdate):
    """Update an existing record."""
    result = await orm_call(
        write_record,
        model=model_name,
        record_id=record_id,
        vals=body.vals,
        uid=DEFAULT_UID,
    )
    return result


@router.delete("/{model_name}/{record_id}")
async def delete(model_name: str, record_id: int):
    """Delete a record."""
    await orm_call(
        delete_record,
        model=model_name,
        record_id=record_id,
        uid=DEFAULT_UID,
    )
    return {"deleted": True, "model": model_name, "id": record_id}


@router.post("/{model_name}/call")
async def call_model_method(model_name: str, body: MethodCall):
    """
    Call an arbitrary method on a recordset.

    This is the escape hatch for business logic methods:
    - sale.order → action_confirm
    - account.move → action_post
    - stock.picking → button_validate
    """
    result = await orm_call(
        call_method,
        model=model_name,
        record_ids=body.record_ids,
        method=body.method,
        args=body.args,
        kwargs=body.kwargs,
        uid=DEFAULT_UID,
    )
    return {"result": result}
