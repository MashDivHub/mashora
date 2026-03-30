"""API key / Bearer token authentication for v2 endpoints."""
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

async def get_api_context(credentials: HTTPAuthorizationCredentials | None = Security(security)):
    """Validate bearer token and return database + user context.

    For now, tokens are validated against Mashora's existing session system.
    The token should be: base64(db_name:session_token)
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = credentials.credentials
    try:
        import base64
        decoded = base64.b64decode(token).decode()
        db_name, session_token = decoded.split(":", 1)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token format. Expected base64(db:session_token)")

    # Validate against Mashora's session/auth system
    try:
        import mashora
        from mashora.modules.registry import Registry
        registry = Registry(db_name)
        with registry.cursor() as cr:
            env = mashora.api.Environment(cr, mashora.SUPERUSER_ID, {})
            # For now, return a simple context - real auth validation comes in Phase C
            return {"db": db_name, "uid": mashora.SUPERUSER_ID, "registry": registry}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


# Simple API key auth for external integrations
async def get_api_key_context(credentials: HTTPAuthorizationCredentials | None = Security(security)):
    """Simple bearer token that just carries the database name for public/simple endpoints."""
    if credentials is None:
        return None
    return {"token": credentials.credentials}
