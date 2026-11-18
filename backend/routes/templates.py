"""Template management endpoints ($HOME/.config/cutandrun_web/templates)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from backend.dependencies import (
    get_config_repo,
    get_run_script_repo,
    get_samplesheet_repo,
    get_template_store,
)
from backend.models import TemplateSavePayload
from backend.repositories import (
    SAMPLESHEET_FIELDNAMES,
    ConfigRepository,
    RunScriptRepository,
    SamplesheetRepository,
)
from backend.services.template_manager import DEFAULT_RUN_SH, TemplateStore

router = APIRouter(prefix="/api/templates", tags=["templates"])

TemplateStoreDep = Annotated[TemplateStore, Depends(get_template_store)]
ConfigRepoDep = Annotated[ConfigRepository, Depends(get_config_repo)]
SamplesheetRepoDep = Annotated[SamplesheetRepository, Depends(get_samplesheet_repo)]
RunScriptRepoDep = Annotated[RunScriptRepository, Depends(get_run_script_repo)]


@router.get("")
async def list_templates(store: TemplateStoreDep) -> dict[str, Any]:
    return {"templates": [t.model_dump() for t in store.list_templates()]}


@router.get("/{template_id}")
async def get_template(template_id: str, store: TemplateStoreDep) -> dict[str, Any]:
    try:
        detail = store.get_template(template_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"template": detail.model_dump()}


@router.post("")
async def save_template(
    payload: TemplateSavePayload,
    store: TemplateStoreDep,
) -> dict[str, Any]:
    try:
        saved = store.save_template(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "ok", "template": saved.model_dump()}


@router.post("/from-project")
async def save_template_from_current_project(
    payload: TemplateSavePayload,
    store: TemplateStoreDep,
    config_repo: ConfigRepoDep,
    samplesheet_repo: SamplesheetRepoDep,
    run_script_repo: RunScriptRepoDep,
) -> dict[str, Any]:
    if not config_repo.exists():
        raise HTTPException(status_code=400, detail="Current project does not have an experiment.config")

    cfg_model, raw_cfg = config_repo.load()
    run_sh = run_script_repo.load() if run_script_repo.exists() else DEFAULT_RUN_SH

    if payload.include_samplesheet_rows and samplesheet_repo.exists():
        rows = samplesheet_repo.load()
        lines = [",".join(SAMPLESHEET_FIELDNAMES)]
        for row in rows:
            lines.append(",".join(str(row.get(col, "")) for col in SAMPLESHEET_FIELDNAMES))
        csv_text = "\n".join(lines) + "\n"
    else:
        csv_text = ",".join(SAMPLESHEET_FIELDNAMES) + "\n"

    enriched = TemplateSavePayload(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        genome=payload.genome or cfg_model.genome_name,
        experiment_config=payload.experiment_config or raw_cfg,
        samplesheet_csv=payload.samplesheet_csv or csv_text,
        run_sh=payload.run_sh or run_sh,
        include_samplesheet_rows=payload.include_samplesheet_rows,
    )
    saved = store.save_template(enriched)
    return {"status": "ok", "template": saved.model_dump()}


@router.delete("/{template_id}")
async def delete_template(template_id: str, store: TemplateStoreDep) -> dict[str, Any]:
    try:
        deleted = store.delete_template(template_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")
    return {"status": "ok", "deleted": template_id}
