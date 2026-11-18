"""Endpoints for viewing, editing, and resetting the project's run.sh script."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from backend.dependencies import get_container, get_run_script_repo, get_template_store
from backend.models import RunScriptPayload, RunScriptResetPayload
from backend.repositories import RunScriptRepository
from backend.services.template_manager import DEFAULT_RUN_SH, TemplateStore

router = APIRouter(prefix="/api/run-script", tags=["run_script"])

RunScriptRepoDep = Annotated[RunScriptRepository, Depends(get_run_script_repo)]
TemplateStoreDep = Annotated[TemplateStore, Depends(get_template_store)]


@router.get("")
async def get_run_script(
    repo: RunScriptRepoDep,
    container: Annotated[Any, Depends(get_container)],
) -> dict[str, Any]:
    exists = repo.exists()
    content = repo.load() if exists else DEFAULT_RUN_SH
    return {
        "exists": exists,
        "path": str(container.settings.run_sh_path),
        "content": content,
    }


@router.put("")
async def update_run_script(
    payload: RunScriptPayload,
    repo: RunScriptRepoDep,
    container: Annotated[Any, Depends(get_container)],
) -> dict[str, Any]:
    repo.save(payload.content)
    return {
        "status": "ok",
        "path": str(container.settings.run_sh_path),
        "content": repo.load(),
    }


@router.post("/reset")
async def reset_run_script(
    repo: RunScriptRepoDep,
    store: TemplateStoreDep,
    container: Annotated[Any, Depends(get_container)],
    payload: RunScriptResetPayload | None = None,
) -> dict[str, Any]:
    tpl_id = payload.template_id if payload else "default_ce11"
    try:
        tpl = store.get_template(tpl_id)
        script_text = tpl.run_sh
    except (FileNotFoundError, ValueError):
        script_text = DEFAULT_RUN_SH
    repo.save(script_text)
    return {
        "status": "ok",
        "path": str(container.settings.run_sh_path),
        "content": repo.load(),
    }
