from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/database", tags=["database"])

class DatabaseCreate(BaseModel):
    name: str
    lang: str = "en_US"
    password: str = ""
    demo: bool = False

class DatabaseInfo(BaseModel):
    name: str
    exists: bool

@router.get("/list")
async def list_databases():
    """List all available databases."""
    try:
        from mashora.service import db as db_service
        databases = db_service.list_dbs()
        return {"databases": databases, "count": len(databases)}
    except Exception as e:
        return {"databases": [], "count": 0, "error": str(e)}

@router.get("/{db_name}/exists")
async def database_exists(db_name: str):
    """Check if a database exists."""
    try:
        from mashora.service import db as db_service
        databases = db_service.list_dbs()
        return DatabaseInfo(name=db_name, exists=db_name in databases)
    except Exception as e:
        return DatabaseInfo(name=db_name, exists=False)

@router.get("/{db_name}/modules")
async def list_modules(db_name: str):
    """List installed modules in a database."""
    try:
        from mashora.modules.registry import Registry
        import mashora
        registry = Registry(db_name)
        with registry.cursor() as cr:
            env = mashora.api.Environment(cr, mashora.SUPERUSER_ID, {})
            modules = env['ir.module.module'].search_read(
                [('state', '=', 'installed')],
                ['name', 'shortdesc', 'state', 'latest_version'],
                order='name',
            )
            return {"modules": modules, "count": len(modules)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list modules: {e}")

@router.get("/{db_name}/server-info")
async def server_info(db_name: str):
    """Get server information for a specific database."""
    try:
        import mashora.release
        from mashora.modules.registry import Registry
        registry = Registry(db_name)
        return {
            "db": db_name,
            "server_version": mashora.release.version,
            "server_serie": mashora.release.series,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
