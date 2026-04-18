"""
Mashora ERP API.

FastAPI application with SQLAlchemy 2.0 async ORM.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
_logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialize SQLAlchemy engine. Shutdown: dispose."""
    settings = get_settings()
    settings.validate_production()
    _logger.info("Starting Mashora ERP API...")

    from app.db.engine import get_engine
    from app.core.model_registry import rebuild_registry
    import app.models  # noqa: F401
    get_engine()
    rebuild_registry()
    _logger.info("SQLAlchemy ORM initialized successfully.")

    from app.routers.bus import manager as bus_manager
    from app.services.bus_events import set_bus_manager
    set_bus_manager(bus_manager)
    _logger.info("WebSocket bus manager registered.")

    yield

    from app.db.engine import dispose_engine
    await dispose_engine()
    _logger.info("Mashora ERP API shut down.")


settings = get_settings()

app = FastAPI(
    title="Mashora ERP API",
    version="1.0.0",
    description="Mashora ERP — FastAPI + SQLAlchemy 2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.middleware.security import SecurityAuditMiddleware
app.add_middleware(SecurityAuditMiddleware)


# Register exception handlers at module-load time so uvicorn --reload picks them up
# (lifespan events don't re-fire on module reload).
def _register_exception_handlers():
    """Register exception handlers."""
    from app.services.base import RecordNotFoundError
    from app.core.exceptions import mashora_exception_handler
    from sqlalchemy.exc import IntegrityError, NoResultFound, DataError, ProgrammingError

    app.add_exception_handler(RecordNotFoundError, mashora_exception_handler)
    app.add_exception_handler(ValueError, mashora_exception_handler)
    app.add_exception_handler(RuntimeError, mashora_exception_handler)
    app.add_exception_handler(IntegrityError, mashora_exception_handler)
    app.add_exception_handler(NoResultFound, mashora_exception_handler)
    app.add_exception_handler(DataError, mashora_exception_handler)
    app.add_exception_handler(ProgrammingError, mashora_exception_handler)
    app.add_exception_handler(AttributeError, mashora_exception_handler)


_register_exception_handlers()


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
from app.routers.email import router as email_router
from app.routers.calendar_sync import router as calendar_sync_router
from app.routers.permissions import router as permissions_router
from app.routers.saved_searches import router as saved_searches_router
from app.routers.daily_activity import router as daily_activity_router

app.include_router(health_router, prefix="/api/v1")
app.include_router(generic_router, prefix="/api/v1")
app.include_router(saved_searches_router, prefix="/api/v1")
app.include_router(daily_activity_router, prefix="/api/v1")
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
app.include_router(email_router, prefix="/api/v1")
app.include_router(calendar_sync_router, prefix="/api/v1")
app.include_router(permissions_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "Mashora ERP API",
        "version": "1.0.0",
        "orm": "sqlalchemy-2.0-async",
        "docs": "/docs",
    }
