"""
Import/Export endpoints for CSV/Excel bulk operations.

Wraps Mashora's base_import module and export functionality.
"""
import base64
import csv
import io
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.orm_adapter import orm_call, mashora_env

router = APIRouter(prefix="/import-export", tags=["import/export"])


class ImportPreview(BaseModel):
    model: str
    file_content: str = Field(description="Base64-encoded CSV/Excel content")
    file_type: str = Field(default="csv", description="csv or xlsx")


class ImportExecute(BaseModel):
    model: str
    file_content: str
    file_type: str = "csv"
    field_mapping: dict[str, str] = Field(
        default_factory=dict,
        description="Map CSV column names to model field names, e.g. {'Name': 'name', 'Email': 'email'}"
    )


def _export_records(model: str, domain: list, fields: list[str], format: str = "csv",
                     uid: int = 1, context: Optional[dict] = None) -> dict:
    """Export records to CSV format."""
    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        records = Model.search(domain, limit=10000)
        data = records.read(fields)

        if format == "csv":
            output = io.StringIO()
            if data:
                writer = csv.DictWriter(output, fieldnames=fields)
                writer.writeheader()
                for row in data:
                    clean_row = {}
                    for f in fields:
                        val = row.get(f, "")
                        if isinstance(val, (list, tuple)) and len(val) == 2:
                            val = val[1]  # Many2one: take display name
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
        return {"error": f"Unsupported format: {format}"}


def _import_preview(model: str, file_content: str, file_type: str = "csv",
                     uid: int = 1, context: Optional[dict] = None) -> dict:
    """Preview an import file — returns columns and first 5 rows."""
    content = base64.b64decode(file_content).decode("utf-8")

    if file_type == "csv":
        reader = csv.DictReader(io.StringIO(content))
        columns = reader.fieldnames or []
        rows = []
        for i, row in enumerate(reader):
            if i >= 5:
                break
            rows.append(row)

        # Get model fields for mapping suggestions
        with mashora_env(uid=uid, context=context) as env:
            Model = env[model]
            fields_data = Model.fields_get(attributes=["string", "type", "required"])

        return {
            "columns": columns,
            "preview_rows": rows,
            "model_fields": {k: {"label": v["string"], "type": v["type"], "required": v.get("required", False)}
                            for k, v in fields_data.items()
                            if v["type"] not in ("one2many", "many2many", "binary")},
            "row_count": len(rows),
        }
    return {"error": f"Unsupported file type: {file_type}"}


def _import_execute(model: str, file_content: str, file_type: str, field_mapping: dict,
                     uid: int = 1, context: Optional[dict] = None) -> dict:
    """Execute a CSV import with field mapping."""
    content = base64.b64decode(file_content).decode("utf-8")

    if file_type != "csv":
        return {"error": f"Unsupported file type: {file_type}"}

    reader = csv.DictReader(io.StringIO(content))
    created = 0
    errors = []

    with mashora_env(uid=uid, context=context) as env:
        Model = env[model]
        for i, row in enumerate(reader):
            try:
                vals = {}
                for csv_col, model_field in field_mapping.items():
                    if csv_col in row and row[csv_col]:
                        vals[model_field] = row[csv_col]
                if vals:
                    Model.create(vals)
                    created += 1
            except Exception as e:
                errors.append({"row": i + 2, "error": str(e)})
                if len(errors) >= 50:
                    errors.append({"row": -1, "error": "Too many errors, import stopped"})
                    break

    return {
        "created": created,
        "errors": errors,
        "total_rows": created + len(errors),
    }


@router.post("/export")
async def export_records(
    model: str = Query(description="Model name, e.g. 'res.partner'"),
    fields: str = Query(description="Comma-separated field names"),
    domain: str = Query(default="[]", description="JSON domain filter"),
    format: str = Query(default="csv", description="Export format: csv"),
):
    """Export records from any model as CSV."""
    import json
    field_list = [f.strip() for f in fields.split(",")]
    try:
        domain_list = json.loads(domain)
    except Exception:
        domain_list = []
    result = await orm_call(_export_records, model=model, domain=domain_list, fields=field_list, format=format)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/export/download")
async def export_download(
    model: str = Query(description="Model name"),
    fields: str = Query(description="Comma-separated field names"),
    domain: str = Query(default="[]", description="JSON domain filter"),
):
    """Download exported records as a CSV file."""
    import json
    field_list = [f.strip() for f in fields.split(",")]
    try:
        domain_list = json.loads(domain)
    except Exception:
        domain_list = []
    result = await orm_call(_export_records, model=model, domain=domain_list, fields=field_list, format="csv")
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    content = base64.b64decode(result["content"])
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{result["filename"]}"'},
    )


@router.post("/import/preview")
async def import_preview(body: ImportPreview):
    """Preview an import file — shows columns and sample rows for mapping."""
    return await orm_call(
        _import_preview, model=body.model, file_content=body.file_content, file_type=body.file_type,
    )


@router.post("/import/execute")
async def import_execute(body: ImportExecute):
    """Execute a CSV import with field mapping. Returns created count and errors."""
    return await orm_call(
        _import_execute, model=body.model, file_content=body.file_content,
        file_type=body.file_type, field_mapping=body.field_mapping,
    )
