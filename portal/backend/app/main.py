from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, licenses, tenants
from app.routers.health import router as health_router
from app.routers.subscriptions import router as subscriptions_router
from app.routers.webhooks import router as webhooks_router
from app.routers.addons import router as addons_router
from app.routers.publisher import router as publisher_router
from app.routers.upgrades import router as upgrades_router
from app.routers.support import router as support_router
from app.routers.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Mashora Platform API",
    version="1.0.0",
    description="Mashora SaaS Platform - Licensing, Tenants, Addons",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(licenses.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1")
app.include_router(subscriptions_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(addons_router, prefix="/api/v1")
app.include_router(publisher_router, prefix="/api/v1")
app.include_router(upgrades_router, prefix="/api/v1")
app.include_router(support_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "Mashora Platform API",
        "version": "1.0.0",
        "docs": "/docs",
    }
