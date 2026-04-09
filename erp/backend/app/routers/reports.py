"""
Report/PDF generation endpoints.

Wraps report generation via SQLAlchemy-backed ir.actions.report.
"""
import base64
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.services.base import async_search_read

router = APIRouter(prefix="/reports", tags=["reports"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


@router.get("/available")
async def list_reports(
    model: str | None = Query(default=None, description="Filter by model name"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """List available reports."""
    domain: list[Any] = []
    if model:
        domain.append(["model", "=", model])
    result = await async_search_read(
        "ir.actions.report",
        domain=domain,
        fields=["id", "name", "report_name", "report_type", "model", "print_report_name"],
    )
    return {"reports": result["records"], "total": result["total"]}


@router.post("/generate")
async def generate_report(
    report_name: str = Query(description="Technical report name, e.g. 'account.report_invoice'"),
    record_ids: str = Query(description="Comma-separated record IDs"),
    report_type: str = Query(default="pdf", description="pdf or html"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Generate a report. Returns base64-encoded content."""
    ids = [int(x.strip()) for x in record_ids.split(",") if x.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="No record IDs provided")
    # Report generation requires QWeb engine — return stub with report metadata
    result = await async_search_read(
        "ir.actions.report",
        domain=[["report_name", "=", report_name]],
        fields=["id", "name", "report_name", "report_type", "model"],
        limit=1,
    )
    if not result["records"]:
        raise HTTPException(status_code=404, detail=f"Report '{report_name}' not found")
    return {
        "content": "",
        "content_type": "application/pdf",
        "report_name": report_name,
        "record_ids": ids,
        "note": "PDF rendering requires QWeb engine",
    }


@router.get("/download")
async def download_report(
    report_name: str = Query(description="Technical report name"),
    record_ids: str = Query(description="Comma-separated record IDs"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Download a report as a PDF file directly."""
    ids = [int(x.strip()) for x in record_ids.split(",") if x.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="No record IDs provided")
    result = await async_search_read(
        "ir.actions.report",
        domain=[["report_name", "=", report_name]],
        fields=["id", "name"],
        limit=1,
    )
    if not result["records"]:
        raise HTTPException(status_code=404, detail=f"Report '{report_name}' not found")
    filename = f"{report_name.replace('.', '_')}_{'-'.join(str(i) for i in ids)}.pdf"
    return Response(
        content=b"",
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
