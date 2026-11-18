"""Samplesheet management endpoints."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from backend.dependencies import get_samplesheet_repo
from backend.models import SamplesheetPayload
from backend.repositories import SamplesheetRepository

router = APIRouter(prefix="/api/samplesheet", tags=["samplesheet"])

SamplesheetRepoDep = Annotated[SamplesheetRepository, Depends(get_samplesheet_repo)]


@router.get("")
async def get_samplesheet(repo: SamplesheetRepoDep) -> dict[str, Any]:
    return {"rows": repo.load()}


@router.put("")
async def update_samplesheet(
    payload: SamplesheetPayload,
    repo: SamplesheetRepoDep,
) -> dict[str, Any]:
    count = repo.save(payload.rows)
    return {"status": "ok", "count": count}
