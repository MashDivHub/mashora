"""
File attachment endpoints.

Handles file uploads/downloads for any model via ir.attachment.
"""
import base64
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
import io

from app.middleware.auth import get_optional_user, CurrentUser
from app.services.base import async_search_read, async_create, async_delete, async_get

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attachments", tags=["attachments"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


ATTACHMENT_FIELDS = [
    "id", "name", "file_size", "mimetype",
    "res_model", "res_id", "type", "create_date",
]


@router.get("/{model}/{res_id}")
async def list_attachments(model: str, res_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await async_search_read(
        "ir.attachment",
        domain=[["res_model", "=", model], ["res_id", "=", res_id]],
        fields=ATTACHMENT_FIELDS,
        order="create_date desc",
    )
    return {"records": result["records"], "total": result["total"]}


@router.post("/{model}/{res_id}")
async def upload_attachment(
    model: str,
    res_id: int,
    file: UploadFile = File(...),
    user: CurrentUser | None = Depends(get_optional_user),
):
    content = await file.read()
    vals = {
        "name": file.filename or "uploaded_file",
        "datas": base64.b64encode(content).decode(),
        "res_model": model,
        "res_id": res_id,
        "mimetype": file.content_type or "application/octet-stream",
    }
    result = await async_create("ir.attachment", vals=vals, uid=_uid(user), fields=ATTACHMENT_FIELDS)
    return result


@router.post("/upload")
async def upload_unbound(
    file: UploadFile = File(...),
    res_model: Optional[str] = Form(None),
    res_id: Optional[int] = Form(None),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Upload a file without (or optionally with) record context.

    Used by the email composer (which needs an attachment ID before the
    record context exists) and any other generic-uploader UIs.
    """
    content = await file.read()
    vals = {
        "name": file.filename or "uploaded_file",
        "datas": base64.b64encode(content).decode(),
        "mimetype": file.content_type or "application/octet-stream",
    }
    if res_model:
        vals["res_model"] = res_model
    if res_id:
        vals["res_id"] = res_id
    return await async_create("ir.attachment", vals=vals, uid=_uid(user), fields=ATTACHMENT_FIELDS)


@router.delete("/{attachment_id}")
async def delete_attachment(attachment_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    try:
        await async_delete("ir.attachment", attachment_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"deleted": True}


@router.get("/{attachment_id}/download")
async def download_attachment(attachment_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await async_get("ir.attachment", attachment_id, fields=["name", "datas", "mimetype"])
    if not result or not result.get("datas"):
        raise HTTPException(status_code=404, detail="Attachment not found")

    content_bytes = base64.b64decode(result["datas"])
    return StreamingResponse(
        io.BytesIO(content_bytes),
        media_type=result.get("mimetype", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{result["name"]}"'},
    )
