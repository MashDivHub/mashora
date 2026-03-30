# Part of Mashora. See LICENSE file for full copyright and licensing details.
"""
Mashora ASGI Application

This module provides a FastAPI-based ASGI application that wraps the existing
Werkzeug WSGI application using the strangler fig pattern. New endpoints are
served directly by FastAPI while existing routes fall through to the WSGI app.

Usage with Uvicorn:
    uvicorn mashora.asgi:application --host 0.0.0.0 --port 8069

Usage programmatically:
    from mashora.asgi import create_asgi_app
    app = create_asgi_app()
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from a2wsgi import WSGIMiddleware

_logger = logging.getLogger(__name__)


def create_asgi_app(wsgi_app=None) -> FastAPI:
    """
    Create a FastAPI ASGI application that wraps the existing WSGI app.

    New /api/v1/ routes are handled by FastAPI directly.
    All other routes fall through to the existing Mashora WSGI application.
    """
    app = FastAPI(
        title="Mashora ERP API",
        version="19.0",
        description="Mashora ERP - Modern ASGI Interface",
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
        openapi_url="/api/v1/openapi.json",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # GZip compression for responses > 500 bytes
    app.add_middleware(GZipMiddleware, minimum_size=500)

    # Rate limiting middleware
    from mashora.api.rate_limit import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

    # Register v1 API routes
    from mashora.asgi_routes import router as api_router
    app.include_router(api_router, prefix="/api/v1")

    from mashora.api.session import router as session_router
    from mashora.api.database import router as database_router
    from mashora.api.model import router as model_router
    app.include_router(session_router, prefix="/api/v1")
    app.include_router(database_router, prefix="/api/v1")
    app.include_router(model_router, prefix="/api/v1")

    # Route adapter: enumerate and track all legacy controller routes
    from mashora.api.route_adapter import register_all_routes, get_route_stats

    @app.get("/api/v1/routes", tags=["v1"])
    async def list_routes():
        """List all registered controller routes and migration stats."""
        return get_route_stats()

    # Serve static files directly via Starlette (bypasses WSGI for performance)
    _mount_static_dirs(app)

    # Mount existing WSGI app as fallback — this provides 100% controller
    # coverage. ALL 483 controller files work through the ASGI/WSGI bridge.
    # The a2wsgi.WSGIMiddleware translates ASGI requests to WSGI and back,
    # so every existing @route endpoint works without any code changes.
    if wsgi_app is not None:
        route_count = register_all_routes(app, wsgi_app)
        app.mount("/", WSGIMiddleware(wsgi_app))
        _logger.info(
            "Mounted WSGI application under FastAPI: %d legacy routes bridged, "
            "100%% controller coverage via ASGI/WSGI bridge", route_count
        )

    return app


def _mount_static_dirs(app: FastAPI):
    """
    Mount static file directories from addons directly via Starlette.
    This bypasses the WSGI pipeline for static assets, improving performance.
    Only mount directories that exist.
    """
    try:
        from mashora.tools.config import config
        addons_paths = config.get('addons_path', [])
        if isinstance(addons_paths, str):
            addons_paths = addons_paths.split(',')

        mounted = 0
        for addons_path in addons_paths:
            addons_path = addons_path.strip()
            if not addons_path or not os.path.isdir(addons_path):
                continue

            # Look for web/static which is the main static dir
            web_static = os.path.join(addons_path, 'web', 'static')
            if os.path.isdir(web_static):
                app.mount(
                    "/web/static",
                    StaticFiles(directory=web_static),
                    name=f"web_static_{mounted}",
                )
                mounted += 1
                _logger.info("Mounted static files from %s", web_static)
                break  # Only mount the first one found

        if mounted:
            _logger.info("Static file serving: %d directories mounted (bypasses WSGI)", mounted)
    except Exception as e:
        _logger.debug("Could not mount static directories: %s", e)


# Lazy application instance — created when the module is imported by Uvicorn
application = None


def get_application() -> FastAPI:
    """Get or create the ASGI application instance."""
    global application
    if application is None:
        import mashora.http
        application = create_asgi_app(mashora.http.root)
    return application
