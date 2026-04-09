"""
Generic CRUD endpoints for any model.

Endpoints:
    POST   /model/{model_name}          → search + read (list)
    GET    /model/{model_name}/{id}     → read single record
    POST   /model/{model_name}/create   → create record
    PUT    /model/{model_name}/{id}     → update record
    DELETE /model/{model_name}/{id}     → delete record
    POST   /model/{model_name}/call     → call arbitrary method
    GET    /model/{model_name}/fields   → get field metadata
    POST   /model/{model_name}/read_group   → read_group aggregation
    POST   /model/{model_name}/defaults     → get default values
    POST   /model/{model_name}/name_search  → name search for M2O
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_optional_user, CurrentUser
from app.core.orm_adapter_v2 import (
    search_read, read_record, create_record, write_record,
    delete_record, read_group, default_get, name_search,
    get_fields_metadata, call_method,
)
from app.schemas.common import (
    DefaultGetParams, MethodCall, NameSearchParams, ReadGroupParams,
    RecordCreate, RecordUpdate, SearchParams, SearchResult,
)

router = APIRouter(prefix="/model", tags=["generic"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


@router.post("/{model_name}", response_model=SearchResult)
async def list_records(model_name: str, params: SearchParams | None = None, user: CurrentUser | None = Depends(get_optional_user)):
    p = params or SearchParams()
    return await search_read(
        model=model_name, domain=p.domain, fields=p.fields,
        offset=p.offset, limit=p.limit, order=p.order, uid=_uid(user), context=_ctx(user),
    )


@router.get("/{model_name}/fields")
async def get_fields(model_name: str, attributes: str | None = Query(default=None), user: CurrentUser | None = Depends(get_optional_user)):
    attrs = attributes.split(",") if attributes else None
    return await get_fields_metadata(model=model_name, attributes=attrs, uid=_uid(user), context=_ctx(user))


@router.get("/{model_name}/{record_id}")
async def get_record(model_name: str, record_id: int, fields: str | None = Query(default=None), user: CurrentUser | None = Depends(get_optional_user)):
    field_list = fields.split(",") if fields else None
    result = await read_record(model=model_name, record_id=record_id, fields=field_list, uid=_uid(user), context=_ctx(user))
    if result is None:
        raise HTTPException(status_code=404, detail=f"{model_name}({record_id}) not found")
    return result


@router.post("/{model_name}/create", status_code=201)
async def create(model_name: str, body: RecordCreate, user: CurrentUser | None = Depends(get_optional_user)):
    return await create_record(model=model_name, vals=body.vals, uid=_uid(user), context=_ctx(user))


@router.put("/{model_name}/{record_id}")
async def update(model_name: str, record_id: int, body: RecordUpdate, user: CurrentUser | None = Depends(get_optional_user)):
    return await write_record(model=model_name, record_id=record_id, vals=body.vals, uid=_uid(user), context=_ctx(user))


@router.delete("/{model_name}/{record_id}")
async def delete(model_name: str, record_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    await delete_record(model=model_name, record_id=record_id, uid=_uid(user), context=_ctx(user))
    return {"deleted": True, "model": model_name, "id": record_id}


@router.post("/{model_name}/call")
async def call_model_method(model_name: str, body: MethodCall, user: CurrentUser | None = Depends(get_optional_user)):
    result = await call_method(
        model=model_name, record_ids=body.record_ids, method=body.method,
        args=body.args, kwargs=body.kwargs, uid=_uid(user), context=_ctx(user),
    )
    return {"result": result}


@router.post("/{model_name}/read_group")
async def read_group_endpoint(model_name: str, params: ReadGroupParams, user: CurrentUser | None = Depends(get_optional_user)):
    result = await read_group(model=model_name, **params.model_dump(), uid=_uid(user), context=_ctx(user))
    return {"groups": result}


@router.post("/{model_name}/defaults")
async def get_defaults(model_name: str, params: DefaultGetParams, user: CurrentUser | None = Depends(get_optional_user)):
    return await default_get(model=model_name, fields_list=params.fields, uid=_uid(user), context=_ctx(user))


@router.post("/{model_name}/name_search")
async def name_search_endpoint(model_name: str, params: NameSearchParams, user: CurrentUser | None = Depends(get_optional_user)):
    result = await name_search(model=model_name, **params.model_dump(), uid=_uid(user), context=_ctx(user))
    return {"results": result}
