"""
i18n/Translation endpoints.

Serves translated strings for the React frontend from the database.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.services.base import async_search_read

router = APIRouter(prefix="/i18n", tags=["i18n"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1


@router.get("/languages")
async def get_languages(user: CurrentUser | None = Depends(get_optional_user)):
    """List all installed/active languages."""
    result = await async_search_read(
        "res.lang",
        domain=[["active", "=", True]],
        fields=["id", "name", "code", "direction"],
    )
    return {"languages": result["records"]}


@router.get("/translations/{lang}")
async def get_translations(
    lang: str,
    modules: str | None = Query(default=None, description="Comma-separated module names"),
    user: CurrentUser | None = Depends(get_optional_user),
):
    """Get translations for a language, optionally filtered by modules."""
    domain: list = [["lang", "=", lang], ["state", "=", "translated"]]
    if modules:
        domain.append(["module", "in", modules.split(",")])

    result = await async_search_read(
        "ir.translation",
        domain=domain,
        fields=["name", "src", "value", "module", "type"],
        limit=5000,
    )
    translations = {}
    for rec in result["records"]:
        key = rec.get("src", "")
        val = rec.get("value", "")
        if key and val:
            translations[key] = val
    return {"lang": lang, "translations": translations, "count": len(translations)}


@router.get("/translations/{lang}/model/{model_name}")
async def get_model_translations(lang: str, model_name: str, user: CurrentUser | None = Depends(get_optional_user)):
    """Get translated field labels for a model in a given language."""
    result = await async_search_read(
        "ir.translation",
        domain=[["lang", "=", lang], ["name", "ilike", model_name + ","]],
        fields=["name", "src", "value"],
        limit=1000,
    )
    return {"model": model_name, "lang": lang, "records": result["records"]}
