"""
i18n/Translation endpoints.

Serves translated strings for the React frontend from Mashora's translation system.
Every UI string in Mashora passes through _() / LazyGettext with .po files.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.middleware.auth import get_current_user, get_optional_user, CurrentUser
from app.core.orm_adapter import orm_call, mashora_env

router = APIRouter(prefix="/i18n", tags=["i18n"])


def _uid(user: CurrentUser | None) -> int:
    return user.uid if user else 1

def _ctx(user: CurrentUser | None) -> dict | None:
    return user.get_context() if user else None


def _get_installed_languages(uid: int = 1, context: Optional[dict] = None) -> dict:
    with mashora_env(uid=uid, context=context) as env:
        langs = env["res.lang"].search([("active", "=", True)])
        return {"languages": langs.read(["id", "name", "code", "iso_code", "direction", "flag_image_url"])}


def _get_translations(lang: str, modules: Optional[list[str]] = None, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Load translations for a given language, optionally filtered by module."""
    with mashora_env(uid=uid, context=context or {"lang": lang}) as env:
        domain = [("lang", "=", lang), ("state", "=", "translated")]
        if modules:
            domain.append(("module", "in", modules))

        # Use ir.translation or the new translation system
        try:
            Trans = env["ir.translation"]
            records = Trans.search(domain, limit=5000)
            data = records.read(["name", "src", "value", "module", "type"])
            translations = {}
            for rec in data:
                key = rec.get("src", "")
                val = rec.get("value", "")
                if key and val:
                    translations[key] = val
            return {"lang": lang, "translations": translations, "count": len(translations)}
        except Exception:
            # Mashora 19 may use a different translation mechanism
            # Fallback: read from ir.module.module's loaded translations
            return {"lang": lang, "translations": {}, "count": 0, "note": "Translation model not available"}


def _get_field_translations(model: str, field: str, lang: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get translated field labels and selection values for a model."""
    with mashora_env(uid=uid, context={"lang": lang}) as env:
        Model = env[model]
        fields_data = Model.fields_get([field], attributes=["string", "selection", "help"])
        return {"model": model, "field": field, "lang": lang, "data": fields_data}


def _get_model_translations(model: str, lang: str, uid: int = 1, context: Optional[dict] = None) -> dict:
    """Get all translated field labels for a model in a given language."""
    with mashora_env(uid=uid, context={"lang": lang}) as env:
        Model = env[model]
        fields_data = Model.fields_get(attributes=["string", "help", "selection"])
        translations = {}
        for fname, fdata in fields_data.items():
            translations[fname] = {
                "label": fdata.get("string", fname),
                "help": fdata.get("help", ""),
            }
            if fdata.get("selection"):
                translations[fname]["selection"] = fdata["selection"]
        return {"model": model, "lang": lang, "fields": translations}


@router.get("/languages")
async def get_languages(user: CurrentUser = Depends(get_current_user)):
    """List all installed/active languages."""
    return await orm_call(_get_installed_languages, uid=_uid(user), context=_ctx(user))


@router.get("/translations/{lang}")
async def get_translations(
    lang: str,
    modules: str | None = Query(default=None, description="Comma-separated module names"),
    user: CurrentUser = Depends(get_current_user),
):
    """Get translations for a language, optionally filtered by modules."""
    module_list = modules.split(",") if modules else None
    return await orm_call(_get_translations, lang=lang, modules=module_list, uid=_uid(user), context=_ctx(user))


@router.get("/translations/{lang}/model/{model_name}")
async def get_model_translations(lang: str, model_name: str, user: CurrentUser = Depends(get_current_user)):
    """Get translated field labels for a model in a given language."""
    return await orm_call(_get_model_translations, model=model_name, lang=lang, uid=_uid(user), context=_ctx(user))
