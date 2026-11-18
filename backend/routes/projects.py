"""Project creation, workspace switching, history, and directory browsing endpoints."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from backend.dependencies import get_workspace_service
from backend.models import (
    DirectoryCreatePayload,
    NativeFolderPickPayload,
    ProjectCreatePayload,
    WorkspaceSelectPayload,
)
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


@router.post("/api/projects/mkdir")
async def create_project_directory(
    payload: DirectoryCreatePayload,
    service: WorkspaceServiceDep,
) -> dict[str, Any]:
    try:
        return service.create_directory(payload.parent_dir, payload.name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/projects/pick-native-dir")
async def pick_native_directory(
    payload: NativeFolderPickPayload | None = None,
) -> dict[str, Any]:
    if sys.platform != "darwin":
        raise HTTPException(
            status_code=501,
            detail="Native Finder folder picker is only supported on macOS.",
        )

    options = payload or NativeFolderPickPayload()
    safe_prompt = options.prompt.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")

    default_loc_clause = ""
    if options.initial_path and options.initial_path.strip():
        candidate = Path(options.initial_path.strip()).expanduser()
        while not candidate.is_dir() and candidate.parent != candidate:
            candidate = candidate.parent
        if candidate.is_dir():
            escaped_dir = str(candidate.resolve()).replace("\\", "\\\\").replace('"', '\\"')
            default_loc_clause = f' default location (POSIX file "{escaped_dir}")'

    apple_script = (
        f'POSIX path of (choose folder with prompt "{safe_prompt}"{default_loc_clause})'
    )
    proc = await asyncio.create_subprocess_exec(
        "osascript",
        "-e",
        apple_script,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        err_text = stderr.decode("utf-8", errors="replace")
        if "-128" in err_text or "User canceled" in err_text:
            return {"cancelled": True, "path": None}
        raise HTTPException(
            status_code=500,
            detail=err_text.strip() or "Failed to open macOS Finder dialog",
        )

    chosen = stdout.decode("utf-8", errors="replace").strip().rstrip("/")
    return {"cancelled": False, "path": chosen or "/"}
