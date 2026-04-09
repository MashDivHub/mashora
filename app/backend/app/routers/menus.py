"""Menu tree REST endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_optional_user, CurrentUser
from app.core.menus import get_menu_tree, get_menu_action

router = APIRouter(prefix="/menus", tags=["menus"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


@router.get("")
async def get_menus(user: CurrentUser | None = Depends(get_optional_user)):
    """Get the full menu tree for the sidebar."""
    return await get_menu_tree()


@router.get("/{menu_id}/action")
async def get_menu_action_endpoint(menu_id: int, user: CurrentUser | None = Depends(get_optional_user)):
    """Get the action for a specific menu item."""
    result = await get_menu_action(menu_id=menu_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No action found for menu {menu_id}")
    return result
