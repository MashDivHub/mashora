from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any

router = APIRouter(prefix="/model", tags=["model"])

class SearchRequest(BaseModel):
    model: str
    domain: list = []
    fields: list[str] = []
    offset: int = 0
    limit: int = 80
    order: str = ""

class ReadRequest(BaseModel):
    model: str
    ids: list[int]
    fields: list[str] = []

class WriteRequest(BaseModel):
    model: str
    ids: list[int]
    values: dict[str, Any]

class CreateRequest(BaseModel):
    model: str
    values: dict[str, Any]

@router.post("/{db_name}/search_read")
async def search_read(db_name: str, body: SearchRequest):
    """Search and read records from a model."""
    try:
        from mashora.modules.registry import Registry
        import mashora
        registry = Registry(db_name)
        with registry.cursor() as cr:
            env = mashora.api.Environment(cr, mashora.SUPERUSER_ID, {})
            records = env[body.model].search_read(
                body.domain,
                body.fields or [],
                offset=body.offset,
                limit=body.limit,
                order=body.order or None,
            )
            total = env[body.model].search_count(body.domain)
            return {"records": records, "total": total, "offset": body.offset, "limit": body.limit}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Model '{body.model}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{db_name}/read")
async def read(db_name: str, body: ReadRequest):
    """Read specific records by IDs."""
    try:
        from mashora.modules.registry import Registry
        import mashora
        registry = Registry(db_name)
        with registry.cursor() as cr:
            env = mashora.api.Environment(cr, mashora.SUPERUSER_ID, {})
            records = env[body.model].browse(body.ids).read(body.fields or [])
            return {"records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{db_name}/{model_name}/fields")
async def get_fields(db_name: str, model_name: str):
    """Get field definitions for a model."""
    try:
        from mashora.modules.registry import Registry
        import mashora
        model_name = model_name.replace("-", ".")
        registry = Registry(db_name)
        with registry.cursor() as cr:
            env = mashora.api.Environment(cr, mashora.SUPERUSER_ID, {})
            fields = env[model_name].fields_get()
            return {"model": model_name, "fields": fields}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
