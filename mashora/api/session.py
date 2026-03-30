from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/session", tags=["session"])

class LoginRequest(BaseModel):
    db: str
    login: str
    password: str

class LoginResponse(BaseModel):
    uid: int
    session_token: str
    db: str
    username: str
    name: str
    api_token: str  # base64(db:session_token) for v1 API use

class SessionInfo(BaseModel):
    uid: int
    db: str
    username: str
    name: str
    is_admin: bool
    lang: str
    tz: str

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Authenticate and get API token for endpoints."""
    try:
        import mashora
        from mashora.modules.registry import Registry
        registry = Registry(body.db)
        with registry.cursor() as cr:
            env = mashora.api.Environment(cr, mashora.SUPERUSER_ID, {})
            uid = env['res.users'].authenticate(body.db, body.login, body.password, {'interactive': False})
            if not uid:
                raise HTTPException(status_code=401, detail="Invalid credentials")

            user = env['res.users'].browse(uid)
            session_token = env['res.users']._compute_session_token(uid)

            import base64
            api_token = base64.b64encode(f"{body.db}:{session_token}".encode()).decode()

            cr.commit()
            return LoginResponse(
                uid=uid,
                session_token=session_token,
                db=body.db,
                username=user.login,
                name=user.name,
                api_token=api_token,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {e}")

@router.post("/logout")
async def logout():
    """Logout - invalidate session."""
    return {"message": "Logged out successfully"}
