"""
Common Pydantic schemas used across the ERP API.
"""
from typing import Any, Optional

from pydantic import BaseModel, Field


class SearchParams(BaseModel):
    """Parameters for search/list endpoints."""
    domain: list[Any] = Field(default_factory=list, description="Mashora domain filter, e.g. [['is_company','=',True]]")
    fields: Optional[list[str]] = Field(default=None, description="Fields to read. None = all fields.")
    offset: int = Field(default=0, ge=0, description="Number of records to skip.")
    limit: Optional[int] = Field(default=80, ge=1, le=1000, description="Max records to return.")
    order: Optional[str] = Field(default=None, description="Sort order, e.g. 'name asc, id desc'.")


class SearchResult(BaseModel):
    """Response for search/list endpoints."""
    records: list[dict[str, Any]]
    total: int


class RecordCreate(BaseModel):
    """Generic record creation payload."""
    vals: dict[str, Any] = Field(description="Field values for the new record.")


class RecordUpdate(BaseModel):
    """Generic record update payload."""
    vals: dict[str, Any] = Field(description="Field values to update.")


class MethodCall(BaseModel):
    """Payload for calling a model method."""
    record_ids: list[int] = Field(description="Record IDs to operate on.")
    method: str = Field(description="Method name to call, e.g. 'action_confirm'.")
    args: list[Any] = Field(default_factory=list, description="Positional arguments.")
    kwargs: dict[str, Any] = Field(default_factory=dict, description="Keyword arguments.")


class ErrorDetail(BaseModel):
    """Structured error response."""
    type: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Wrapper for error responses."""
    error: ErrorDetail
