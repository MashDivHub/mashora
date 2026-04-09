"""
Mashora ERP API.

FastAPI application with dual ORM support:
- Legacy: Mashora ORM via thread pool (USE_NEW_ORM=false)
- New: SQLAlchemy 2.0 async (USE_NEW_ORM=true)

Toggle via USE_NEW_ORM environment variable.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
_logger = logging.getLogger(__name__)

USE_NEW_ORM = os.environ.get("USE_NEW_ORM", "false").lower() in ("true", "1", "yes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize ORM backend. Shutdown: cleanup."""
    settings = get_settings()
    _logger.info("Starting Mashora ERP API...")

    if USE_NEW_ORM:
        # SQLAlchemy 2.0 async backend
        from app.db.engine import get_engine, dispose_engine
        from app.core.model_registry import rebuild_registry
        import app.models  # noqa: F401 — register all models with Base
        get_engine()
        rebuild_registry()
        _logger.info("SQLAlchemy ORM initialized successfully.")
    else:
        # Legacy Mashora ORM backend
        from app.core.orm_adapter import init_mashora
        init_mashora()
        _logger.info("Mashora ORM initialized successfully.")

    _register_exception_handlers()
    _logger.info("Exception handlers registered.")

    yield

    # Cleanup
    if USE_NEW_ORM:
        from app.db.engine import dispose_engine
        await dispose_engine()
    else:
        from app.core.orm_adapter import shutdown
        shutdown()
    _logger.info("Mashora ERP API shut down.")


app = FastAPI(
    title="Mashora ERP API",
    version="1.0.0",
    description="Mashora ERP — FastAPI + SQLAlchemy 2.0",
    lifespan=lifespan,
)

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.middleware.security import SecurityAuditMiddleware
app.add_middleware(SecurityAuditMiddleware)


def _register_exception_handlers():
    """Register exception handlers for ORM exception types."""
    if USE_NEW_ORM:
        from app.core.orm_adapter_v2 import RecordNotFoundError
        from fastapi import Request
        from fastapi.responses import JSONResponse

        async def not_found_handler(request: Request, exc: RecordNotFoundError):
            return JSONResponse(status_code=404, content={"detail": str(exc)})

        app.add_exception_handler(RecordNotFoundError, not_found_handler)
    else:
        try:
            from mashora.exceptions import (
                AccessDenied,
                AccessError,
                CacheMiss,
                ConcurrencyError,
                LockError,
                MissingError,
                RedirectWarning,
                UserError,
                ValidationError,
            )
            from app.core.exceptions import mashora_exception_handler

            for exc_class in (
                UserError, AccessError, AccessDenied, MissingError,
                ValidationError, LockError, ConcurrencyError,
                RedirectWarning, CacheMiss,
            ):
                app.add_exception_handler(exc_class, mashora_exception_handler)
        except ImportError:
            _logger.warning("Mashora exceptions not available — skipping handlers")


# --- Routers ---
from app.routers.health import router as health_router
from app.routers.generic import router as generic_router
from app.routers.partner import router as partner_router
from app.routers.auth import router as auth_router
from app.routers.onchange import router as onchange_router
from app.routers.wizard import router as wizard_router
from app.routers.account import router as account_router
from app.routers.sale import router as sale_router
from app.routers.purchase import router as purchase_router
from app.routers.stock import router as stock_router
from app.routers.crm import router as crm_router
from app.routers.website import router as website_router
from app.routers.hr import router as hr_router
from app.routers.project import router as project_router
from app.routers.secondary import router as secondary_router
from app.routers.i18n import router as i18n_router
from app.routers.bus import router as bus_router
from app.routers.chatter import router as chatter_router
from app.routers.reports import router as reports_router
from app.routers.import_export import router as import_export_router
from app.routers.views import router as views_router
from app.routers.actions import router as actions_router
from app.routers.menus import router as menus_router
from app.routers.settings import router as settings_router
from app.routers.attachments import router as attachments_router

app.include_router(health_router, prefix="/api/v1")
app.include_router(generic_router, prefix="/api/v1")
app.include_router(partner_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(onchange_router, prefix="/api/v1")
app.include_router(wizard_router, prefix="/api/v1")
app.include_router(account_router, prefix="/api/v1")
app.include_router(sale_router, prefix="/api/v1")
app.include_router(purchase_router, prefix="/api/v1")
app.include_router(stock_router, prefix="/api/v1")
app.include_router(crm_router, prefix="/api/v1")
app.include_router(website_router, prefix="/api/v1")
app.include_router(hr_router, prefix="/api/v1")
app.include_router(project_router, prefix="/api/v1")
app.include_router(secondary_router, prefix="/api/v1")
app.include_router(i18n_router, prefix="/api/v1")
app.include_router(bus_router, prefix="/api/v1")
app.include_router(chatter_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(import_export_router, prefix="/api/v1")
app.include_router(views_router, prefix="/api/v1")
app.include_router(actions_router, prefix="/api/v1")
app.include_router(menus_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(attachments_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "Mashora ERP API",
        "version": "1.0.0",
        "orm": "sqlalchemy" if USE_NEW_ORM else "mashora-legacy",
        "docs": "/docs",
    }
