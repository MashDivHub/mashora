"""
Import/Export endpoints for CSV bulk operations.
"""
import base64
import csv
import io
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.services.base import async_search_read, async_create

router = APIRouter(prefix="/import-export", tags=["import/export"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


class ImportPreview(BaseModel):
    model: str
    file_content: str = Field(description="Base64-encoded CSV content")
    file_type: str = Field(default="csv", description="csv or xlsx")


class ImportExecute(BaseModel):
    model: str
    file_content: str
    file_type: str = "csv"
    field_mapping: dict[str, str] = Field(
        default_factory=dict,
        description="Map CSV column names to model field names",
    )


@router.post("/export")
async def export_records(
    model: str = Query(description="Model name, e.g. 'res.partner'"),
    fields: str = Query(description="Comma-separated field names"),
    domain: str = Query(default="[]", description="JSON domain filter"),
    format: str = Query(default="csv", description="Export format: csv"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Export records from any model as CSV."""
    import json
    field_list = [f.strip() for f in fields.split(",")]
    try:
        domain_list = json.loads(domain)
    except Exception:
        domain_list = []

    result = await async_search_read(model, domain=domain_list, fields=field_list, limit=10000)
    data = result["records"]

    output = io.StringIO()
    if data:
        writer = csv.DictWriter(output, fieldnames=field_list)
        writer.writeheader()
        for row in data:
            clean_row = {}
            for f in field_list:
                val = row.get(f, "")
                if isinstance(val, (list, tuple)) and len(val) == 2:
                    val = val[1]
                elif isinstance(val, (list, tuple)):
                    val = ", ".join(str(v) for v in val)
                elif val is False:
                    val = ""
                clean_row[f] = val
            writer.writerow(clean_row)
    csv_content = output.getvalue()
    return {
        "content": base64.b64encode(csv_content.encode("utf-8")).decode("utf-8"),
        "content_type": "text/csv",
        "filename": f"{model.replace('.', '_')}_export.csv",
        "record_count": len(data),
    }


@router.post("/export/download")
async def export_download(
    model: str = Query(description="Model name"),
    fields: str = Query(description="Comma-separated field names"),
    domain: str = Query(default="[]", description="JSON domain filter"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Download exported records as a CSV file."""
    import json
    field_list = [f.strip() for f in fields.split(",")]
    try:
        domain_list = json.loads(domain)
    except Exception:
        domain_list = []

    result = await async_search_read(model, domain=domain_list, fields=field_list, limit=10000)
    data = result["records"]

    output = io.StringIO()
    if data:
        writer = csv.DictWriter(output, fieldnames=field_list)
        writer.writeheader()
        for row in data:
            clean_row = {f: row.get(f, "") for f in field_list}
            writer.writerow(clean_row)
    csv_bytes = output.getvalue().encode("utf-8")
    filename = f"{model.replace('.', '_')}_export.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/preview")
async def import_preview(body: ImportPreview, user: CurrentUser | None = Depends(get_optional_user)):
    """Preview an import file — shows columns and sample rows for mapping."""
    if body.file_type != "csv":
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {body.file_type}")

    content = base64.b64decode(body.file_content).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    columns = list(reader.fieldnames or [])
    rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        rows.append(dict(row))

    # Get model fields for mapping suggestions
    field_result = await async_search_read(
        "ir.model.fields",
        domain=[["model", "=", body.model], ["ttype", "not in", ["one2many", "many2many", "binary"]]],
        fields=["name", "field_description", "ttype", "required"],
        limit=200,
    )
    model_fields = {
        r["name"]: {"label": r["field_description"], "type": r["ttype"], "required": r.get("required", False)}
        for r in field_result["records"]
    }
    return {"columns": columns, "preview_rows": rows, "model_fields": model_fields, "row_count": len(rows)}


@router.post("/import/execute")
async def import_execute(body: ImportExecute, user: CurrentUser | None = Depends(get_optional_user)):
    """Execute a CSV import with field mapping. Returns created count and errors."""
    if body.file_type != "csv":
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {body.file_type}")

    content = base64.b64decode(body.file_content).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            vals = {}
            for csv_col, model_field in body.field_mapping.items():
                if csv_col in row and row[csv_col]:
                    vals[model_field] = row[csv_col]
            if vals:
                await async_create(body.model, vals=vals, uid=_uid(user))
                created += 1
        except Exception as e:
            errors.append({"row": i + 2, "error": str(e)})
            if len(errors) >= 50:
                errors.append({"row": -1, "error": "Too many errors, import stopped"})
                break

    return {"created": created, "errors": errors, "total_rows": created + len(errors)}
