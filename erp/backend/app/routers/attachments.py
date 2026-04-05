"""
File attachment endpoints.

Handles file uploads/downloads for any model via ir.attachment.
"""
import base64
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
import io

from app.middleware.auth import get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call, mashora_env

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attachments", tags=["attachments"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


ATTACHMENT_FIELDS = [
    "id", "name", "datas_fname", "file_size", "mimetype",
    "res_model", "res_id", "type", "create_date", "create_uid",
]


def _list_attachments(model: str, res_id: int, uid: int = 1, context: Optional[dict] = None):
    with mashora_env(uid=uid, context=context) as env:
        if 'ir.attachment' not in env.registry:
            return {"records": [], "total": 0}
        attachments = env['ir.attachment'].search([
            ('res_model', '=', model),
            ('res_id', '=', res_id),
        ], order='create_date desc')

        safe_fields = [f for f in ATTACHMENT_FIELDS if f in env['ir.attachment']._fields]
        data = attachments.read(safe_fields)
        return {"records": data, "total": len(data)}


def _upload_attachment(model: str, res_id: int, name: str, content: bytes, mimetype: str, uid: int = 1, context: Optional[dict] = None):
    with mashora_env(uid=uid, context=context) as env:
        vals = {
            'name': name,
            'datas': base64.b64encode(content).decode(),
            'res_model': model,
            'res_id': res_id,
            'mimetype': mimetype,
        }
        attachment = env['ir.attachment'].create(vals)
        safe_fields = [f for f in ATTACHMENT_FIELDS if f in env['ir.attachment']._fields]
        return attachment.read(safe_fields)[0]


def _delete_attachment(attachment_id: int, uid: int = 1, context: Optional[dict] = None):
    with mashora_env(uid=uid, context=context) as env:
        attachment = env['ir.attachment'].browse(attachment_id)
        if not attachment.exists():
            return False
        attachment.unlink()
        return True


def _download_attachment(attachment_id: int, uid: int = 1, context: Optional[dict] = None):
    with mashora_env(uid=uid, context=context) as env:
        attachment = env['ir.attachment'].browse(attachment_id)
        if not attachment.exists():
            return None
        data = attachment.read(['name', 'datas', 'mimetype'])[0]
        if not data.get('datas'):
            return None
        return {
            'name': data['name'],
            'content': data['datas'],
            'mimetype': data.get('mimetype', 'application/octet-stream'),
        }


@router.get("/{model}/{res_id}")
async def list_attachments(model: str, res_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    return await orm_call(_list_attachments, model=model, res_id=res_id, uid=_uid(user), context=_ctx(user))


@router.post("/{model}/{res_id}")
async def upload_attachment(
    model: str,
    res_id: int,
    file: UploadFile = File(...),
    user: CurrentUser | None = Depends(get_optional_user),
):
    content = await file.read()
    return await orm_call(
        _upload_attachment,
        model=model,
        res_id=res_id,
        name=file.filename or "uploaded_file",
        content=content,
        mimetype=file.content_type or "application/octet-stream",
        uid=_uid(user),
        context=_ctx(user),
    )


@router.delete("/{attachment_id}")
async def delete_attachment(attachment_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await orm_call(_delete_attachment, attachment_id=attachment_id, uid=_uid(user), context=_ctx(user))
    if not result:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"deleted": True}


@router.get("/{attachment_id}/download")
async def download_attachment(attachment_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    result = await orm_call(_download_attachment, attachment_id=attachment_id, uid=_uid(user), context=_ctx(user))
    if not result:
        raise HTTPException(status_code=404, detail="Attachment not found")

    content_bytes = base64.b64decode(result['content'])
    return StreamingResponse(
        io.BytesIO(content_bytes),
        media_type=result['mimetype'],
        headers={"Content-Disposition": f'attachment; filename="{result["name"]}"'},
    )
