"""Configuration endpoints."""

from __future__ import annotations

import asyncio
import sys
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from backend.dependencies import AppContainer, get_config_repo, get_container
from backend.models import ContrastsUpdatePayload, ExperimentConfigModel
from backend.repositories import ConfigRepository

router = APIRouter(prefix="/api/config", tags=["config"])

ContainerDep = Annotated[AppContainer, Depends(get_container)]
ConfigRepoDep = Annotated[ConfigRepository, Depends(get_config_repo)]


@router.get("")
async def get_config(repo: ConfigRepoDep) -> dict[str, Any]:
    try:
        model, raw = repo.load()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="experiment.config not found") from exc
    return {
        "config": model.model_dump(),
        "raw": raw,
        "bigwig_tools": repo.get_bigwig_tools(),
    }


@router.put("")
async def update_config(
    model: ExperimentConfigModel,
    repo: ConfigRepoDep,
) -> dict[str, Any]:
    repo.save(model)
    saved_model, raw = repo.load()
    return {
        "status": "ok",
        "config": saved_model.model_dump(),
        "raw": raw,
        "bigwig_tools": repo.get_bigwig_tools(),
    }


@router.patch("/contrasts")
async def update_contrasts(
    payload: ContrastsUpdatePayload,
    repo: ConfigRepoDep,
) -> dict[str, Any]:
    try:
        updated = repo.update_contrasts(payload.diff_contrasts)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="experiment.config not found") from exc
    return {
        "status": "ok",
        "diff_contrasts": [c.model_dump() for c in updated.diff_contrasts],
    }


@router.post("/reveal-finder")
async def reveal_config_in_finder(
    request_container: ContainerDep,
    repo: ConfigRepoDep,
) -> dict[str, str]:
    if sys.platform != "darwin":
        raise HTTPException(status_code=501, detail="Finder integration is only supported on macOS")
    if not repo.exists():
        raise HTTPException(status_code=404, detail="experiment.config not found")

    config_path = request_container.settings.config_path.resolve()
    proc = await asyncio.create_subprocess_exec(
        "open",
        "-R",
        str(config_path),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=stderr.decode("utf-8", errors="replace") or "Failed to reveal file in Finder",
        )
    return {"status": "ok", "path": str(config_path)}
