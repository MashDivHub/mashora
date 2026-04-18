"""
Exception mapping for FastAPI HTTP responses.
"""
import logging
from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse

_logger = logging.getLogger(__name__)


class MashoraErrorResponse:
    """Structured error response."""
    def __init__(self, status_code: int, error_type: str, message: str, details: Optional[dict[str, Any]] = None):
        self.status_code = status_code
        self.error_type = error_type
        self.message = message
        self.details = details or {}

    def to_json_response(self) -> JSONResponse:
        return JSONResponse(
            status_code=self.status_code,
            content={"error": {"type": self.error_type, "message": self.message, "details": self.details}},
        )


def map_exception(exc: Exception) -> MashoraErrorResponse:
    """Map an exception to an HTTP error response."""
    from app.services.base import RecordNotFoundError
    from sqlalchemy.exc import IntegrityError, NoResultFound, DataError, ProgrammingError

    if isinstance(exc, RecordNotFoundError):
        return MashoraErrorResponse(status_code=404, error_type="missing_error", message=str(exc))
    if isinstance(exc, NoResultFound):
        return MashoraErrorResponse(status_code=404, error_type="missing_error", message="Record not found")
    if isinstance(exc, ProgrammingError):
        # Any SQL programming error (missing column/table, type mismatch, bad cast,
        # etc.) — we log the full detail for the developer and return 501 so the
        # UI can show "feature unavailable" instead of a generic 500.
        _logger.error("SQL programming error — %s", exc)
        msg = str(getattr(exc, "orig", exc))
        if "relation" in msg and "does not exist" in msg:
            return MashoraErrorResponse(status_code=501, error_type="feature_not_available", message="This feature is not available in the current database setup.")
        if "column" in msg and "does not exist" in msg:
            return MashoraErrorResponse(status_code=501, error_type="feature_not_available", message="This feature references a field not present in the current database.")
        if "operator does not exist" in msg:
            return MashoraErrorResponse(status_code=501, error_type="feature_not_available", message="This report query is not compatible with the current schema.")
        return MashoraErrorResponse(status_code=501, error_type="feature_not_available", message="This feature is not available in the current database setup.")
    if isinstance(exc, IntegrityError):
        # Extract the helpful DETAIL line from asyncpg errors
        msg = str(getattr(exc, "orig", exc))
        # Common pattern: "Key (x)=(y) is not present in table ..."
        if "is not present in table" in msg:
            return MashoraErrorResponse(status_code=400, error_type="foreign_key_violation", message="Referenced record does not exist.")
        if "duplicate key" in msg.lower():
            return MashoraErrorResponse(status_code=409, error_type="duplicate_key", message="A record with these values already exists.")
        if "violates not-null" in msg.lower():
            return MashoraErrorResponse(status_code=400, error_type="missing_required_field", message="A required field is missing.")
        return MashoraErrorResponse(status_code=400, error_type="integrity_error", message="Data integrity constraint violated.")
    if isinstance(exc, DataError):
        return MashoraErrorResponse(status_code=400, error_type="data_error", message="Invalid data for one or more fields.")
    if isinstance(exc, ValueError):
        return MashoraErrorResponse(status_code=422, error_type="validation_error", message=str(exc))
    if isinstance(exc, PermissionError):
        return MashoraErrorResponse(status_code=403, error_type="access_error", message=str(exc))
    if isinstance(exc, RuntimeError):
        return MashoraErrorResponse(status_code=422, error_type="user_error", message=str(exc))
    # Windows asyncio proactor race condition when the event loop is tearing down mid-query
    if isinstance(exc, AttributeError) and "'NoneType' object has no attribute 'send'" in str(exc):
        return MashoraErrorResponse(status_code=503, error_type="transient_error", message="Database connection unavailable, please retry.")

    _logger.exception("Unhandled exception: %s", exc)
    return MashoraErrorResponse(status_code=500, error_type="server_error", message="Internal server error.")


async def mashora_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """FastAPI exception handler."""
    return map_exception(exc).to_json_response()
