"""
Mashora ERP API — Phase 0.0 Proof of Concept.

FastAPI application that wraps the Mashora ORM to provide REST API endpoints.
This PoC proves that Mashora's ORM can run inside FastAPI's async context
via a thread pool executor.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.orm_adapter import init_mashora, shutdown

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
_logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize Mashora ORM. Shutdown: cleanup."""
    settings = get_settings()
    _logger.info("Starting Mashora ERP API...")

    # Bootstrap Mashora ORM — loads Registry, initializes connection pool
    init_mashora()
    _logger.info("Mashora ORM initialized successfully.")

    yield

    # Cleanup
    shutdown()
    _logger.info("Mashora ERP API shut down.")


app = FastAPI(
    title="Mashora ERP API",
    version="0.0.1",
    description="Phase 0.0 — ORM Adapter Proof of Concept",
    lifespan=lifespan,
)

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.middleware.security import SecurityAuditMiddleware
app.add_middleware(SecurityAuditMiddleware)

# Register Mashora exception handlers
# We do this lazily after Mashora is importable
@app.on_event("startup")
async def _register_exception_handlers():
    """Register exception handlers for Mashora exception types."""
    settings = get_settings()
    settings.setup_mashora_path()

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
        UserError,
        AccessError,
        AccessDenied,
        MissingError,
        ValidationError,
        LockError,
        ConcurrencyError,
        RedirectWarning,
        CacheMiss,
    ):
        app.add_exception_handler(exc_class, mashora_exception_handler)


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


@app.get("/")
async def root():
    return {
        "name": "Mashora ERP API",
        "version": "0.0.1",
        "phase": "0.0 — ORM Adapter PoC",
        "docs": "/docs",
    }
