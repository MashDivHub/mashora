# Part of Mashora. See LICENSE file for full copyright and licensing details.
"""
Mashora ERP v1 API Routes

New REST API endpoints served directly by FastAPI.
These run alongside the existing WSGI routes during the migration period.
"""

from __future__ import annotations

import platform
import sys
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["v1"])


@router.get("/health")
async def health():
    """Health check endpoint for the ERP instance."""
    import mashora.release
    return {
        "status": "ok",
        "service": "mashora-erp",
        "version": mashora.release.version,
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "platform": platform.system(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/info")
async def server_info():
    """Server information endpoint."""
    import mashora.release
    from mashora.tools.config import config
    return {
        "product": mashora.release.product_name,
        "version": mashora.release.version,
        "series": mashora.release.series,
        "api_version": "v1",
        "server_mode": "asgi",
        "addons_paths": config.get("addons_path", "").split(",") if isinstance(config.get("addons_path"), str) else [],
    }


@router.get("/ping")
async def ping():
    """Simple ping endpoint for monitoring."""
    return {"pong": True}


@router.get("/databases")
async def list_databases():
    """List available databases."""
    try:
        from mashora.service import db as db_service
        dbs = db_service.list_dbs()
        return {"databases": dbs}
    except Exception as e:
        return {"databases": [], "error": str(e)}


@router.get("/version")
async def version():
    import mashora.release
    return {
        "server_version": mashora.release.version,
        "server_serie": mashora.release.series,
        "product_name": mashora.release.product_name,
    }
