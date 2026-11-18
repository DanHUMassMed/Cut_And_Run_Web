"""Project creation, workspace switching, history, and directory browsing endpoints."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from backend.dependencies import get_workspace_service
from backend.models import ProjectCreatePayload, WorkspaceSelectPayload
from backend.services.project_manager import WorkspaceService

router = APIRouter(tags=["projects"])

WorkspaceServiceDep = Annotated[WorkspaceService, Depends(get_workspace_service)]


@router.get("/api/projects")
@router.get("/api/workspace")
async def get_projects_state(service: WorkspaceServiceDep) -> dict[str, Any]:
    return service.get_state()


@router.post("/api/projects/create")
async def create_project(
    payload: ProjectCreatePayload,
    request: Request,
    service: WorkspaceServiceDep,
) -> dict[str, Any]:
    try:
        return service.create_project(request.app, payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/projects/open")
@router.post("/api/workspace/select")
async def open_project(
    payload: WorkspaceSelectPayload,
    request: Request,
    service: WorkspaceServiceDep,
) -> dict[str, Any]:
    try:
        return service.switch_workspace(
            request.app,
            payload.path,
            initialize=payload.initialize,
            experiment_name=payload.experiment_name,
            template_id=payload.template_id,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/api/projects/history")
async def remove_project_from_history(
    service: WorkspaceServiceDep,
    path: str = Query(...),
) -> dict[str, Any]:
    return service.remove_recent(path)


@router.get("/api/projects/list-dirs")
@router.get("/api/workspace/list-dirs")
async def list_project_directories(
    service: WorkspaceServiceDep,
    path: str | None = Query(default=None),
) -> dict[str, Any]:
    try:
        return service.list_directories(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
