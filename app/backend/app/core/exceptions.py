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

    if isinstance(exc, RecordNotFoundError):
        return MashoraErrorResponse(status_code=404, error_type="missing_error", message=str(exc))
    if isinstance(exc, ValueError):
        return MashoraErrorResponse(status_code=422, error_type="validation_error", message=str(exc))
    if isinstance(exc, PermissionError):
        return MashoraErrorResponse(status_code=403, error_type="access_error", message=str(exc))
    if isinstance(exc, RuntimeError):
        return MashoraErrorResponse(status_code=422, error_type="user_error", message=str(exc))

    _logger.exception("Unhandled exception: %s", exc)
    return MashoraErrorResponse(status_code=500, error_type="server_error", message="Internal server error.")


async def mashora_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """FastAPI exception handler."""
    return map_exception(exc).to_json_response()
