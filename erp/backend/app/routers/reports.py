"""
Report/PDF generation endpoints.

Wraps Mashora's QWeb report engine to generate PDFs and HTML reports
via the REST API.
"""
import base64
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call, mashora_env

router = APIRouter(prefix="/reports", tags=["reports"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


def _get_available_reports(model: str | None = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    """List available reports, optionally filtered by model."""
    with mashora_env(uid=uid, context=context) as env:
        domain: list[Any] = []
        if model:
            domain.append(["model", "=", model])
        reports = env["ir.actions.report"].search(domain)
        data = reports.read(["id", "name", "report_name", "report_type", "model", "print_report_name"])
        return {"reports": data, "total": len(data)}


def _generate_report(report_name: str, record_ids: list[int], report_type: str = "pdf",
                      uid: int = 1, context: Optional[dict] = None) -> dict:
    """Generate a report and return it as base64-encoded content."""
    with mashora_env(uid=uid, context=context) as env:
        report_action = env["ir.actions.report"]._get_report_from_name(report_name)
        if not report_action:
            return {"error": f"Report '{report_name}' not found"}

        if report_type == "pdf":
            content, content_type = report_action._render_qweb_pdf(report_action, record_ids)
        elif report_type == "html":
            content, content_type = report_action._render_qweb_html(report_action, record_ids)
        else:
            content, content_type = report_action._render_qweb_pdf(report_action, record_ids)

        return {
            "content": base64.b64encode(content).decode("utf-8") if content else "",
            "content_type": content_type or "application/pdf",
            "report_name": report_name,
            "record_ids": record_ids,
        }


@router.get("/available")
async def list_reports(
    model: str | None = Query(default=None, description="Filter by model name"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """List available reports."""
    return await orm_call(_get_available_reports, model=model, uid=_uid(user), context=_ctx(user))


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
    result = await orm_call(_generate_report, report_name=report_name, record_ids=ids, report_type=report_type, uid=_uid(user), context=_ctx(user))
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


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
    result = await orm_call(_generate_report, report_name=report_name, record_ids=ids, report_type="pdf", uid=_uid(user), context=_ctx(user))
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    content = base64.b64decode(result["content"]) if result["content"] else b""
    filename = f"{report_name.replace('.', '_')}_{'-'.join(str(i) for i in ids)}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
