"""Project creation from templates, workspace switching, and history in ~/.config/cutandrun_web."""

from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol

from backend.config_parser import parse_experiment_config, serialize_experiment_config
from backend.models import ProjectCreatePayload
from backend.repositories import SAMPLESHEET_FIELDNAMES
from backend.services.template_manager import DEFAULT_RUN_SH, TemplateStore
from backend.settings import WorkspaceSettings

if TYPE_CHECKING:
    from fastapi import FastAPI

    from backend.dependencies import AppContainer

MAX_RECENT_PROJECTS = 15
SAFE_EXP_SANITIZE_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _derive_experiment_name(target_dir: Path) -> str:
    candidate = (
        target_dir.parent.name
        if target_dir.name == "Analysis_Run" and target_dir.parent.name
        else target_dir.name
    )
    sanitized = SAFE_EXP_SANITIZE_RE.sub("_", candidate).strip("._-")
    if not sanitized or not sanitized[0].isalnum():
        return f"exp_{sanitized or 'cutandrun'}"
    return sanitized[:128]


def _derive_project_label(workspace_dir: Path) -> str:
    if workspace_dir.parent.name:
        return f"{workspace_dir.parent.name}/{workspace_dir.name}"
    return workspace_dir.name


class WorkspaceRegistry(Protocol):
    """Persistence contract for remembered project history in ~/.config/cutandrun_web/projects.json."""

    def load_entries(self) -> list[dict[str, Any]]: ...
    def load_recent(self) -> list[str]: ...
    def record(
        self,
        workspace_dir: Path,
        *,
        experiment: str | None = None,
        template_id: str | None = None,
    ) -> None: ...
    def remove(self, workspace_dir: Path) -> None: ...


class FileWorkspaceRegistry:
    """JSON-backed project history store in user_config_dir/projects.json."""

    def __init__(self, user_config_dir: Path) -> None:
        self._user_config_dir = user_config_dir
        self._registry_path = user_config_dir / "projects.json"

    def _read_payload(self) -> dict[str, Any]:
        if not self._registry_path.exists():
            # Fallback migration from legacy workspaces.json if present
            legacy_path = self._user_config_dir / "workspaces.json"
            if legacy_path.exists():
                try:
                    data = json.loads(legacy_path.read_text(encoding="utf-8"))
                    if isinstance(data, dict):
                        return data
                except (OSError, json.JSONDecodeError):
                    pass
            return {}
        try:
            data = json.loads(self._registry_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _write_payload(self, payload: dict[str, Any]) -> None:
        self._registry_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self._registry_path.with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        os.replace(tmp_path, self._registry_path)

    def load_entries(self) -> list[dict[str, Any]]:
        data = self._read_payload()
        raw_projects = data.get("recent_projects")
        if isinstance(raw_projects, list):
            entries: list[dict[str, Any]] = []
            for item in raw_projects:
                if isinstance(item, dict) and isinstance(item.get("path"), str):
                    entries.append(dict(item))
            return entries

        # Legacy list of strings fallback
        raw_recent = data.get("recent_workspaces", [])
        if isinstance(raw_recent, list):
            return [
                {
                    "path": str(p),
                    "name": _derive_project_label(Path(p)),
                    "experiment": "",
                    "template_id": "default_ce11",
                    "last_opened_at": "",
                    "pinned": False,
                }
                for p in raw_recent
                if isinstance(p, str) and p.strip()
            ]
        return []

    def load_recent(self) -> list[str]:
        return [str(entry["path"]) for entry in self.load_entries() if entry.get("path")]

    def record(
        self,
        workspace_dir: Path,
        *,
        experiment: str | None = None,
        template_id: str | None = None,
    ) -> None:
        resolved = str(workspace_dir.resolve())
        existing_entries = self.load_entries()
        previous = next((item for item in existing_entries if item.get("path") == resolved), {})

        entry: dict[str, Any] = {
            "name": _derive_project_label(workspace_dir.resolve()),
            "path": resolved,
            "experiment": experiment or previous.get("experiment") or _derive_experiment_name(workspace_dir),
            "template_id": template_id or previous.get("template_id") or "default_ce11",
            "last_opened_at": _now_iso(),
            "pinned": bool(previous.get("pinned", False)),
        }
        remaining = [item for item in existing_entries if item.get("path") != resolved]
        updated = [entry, *remaining][:MAX_RECENT_PROJECTS]

        payload = {
            "last_project_path": resolved,
            "last_workspace": resolved,
            "recent_projects": updated,
            "recent_workspaces": [item["path"] for item in updated],
        }
        self._write_payload(payload)

    def remove(self, workspace_dir: Path) -> None:
        resolved = str(workspace_dir.resolve())
        existing_entries = [
            item for item in self.load_entries() if item.get("path") not in (resolved, str(workspace_dir))
        ]
        data = self._read_payload()
        last_path = data.get("last_project_path") or data.get("last_workspace") or ""
        if last_path == resolved:
            last_path = existing_entries[0]["path"] if existing_entries else ""
        payload = {
            "last_project_path": last_path,
            "last_workspace": last_path,
            "recent_projects": existing_entries,
            "recent_workspaces": [item["path"] for item in existing_entries],
        }
        self._write_payload(payload)


class WorkspaceService:
    """Inspects, creates from templates, initializes, and switches active Analysis_Run projects."""

    def __init__(
        self,
        settings: WorkspaceSettings,
        registry: WorkspaceRegistry,
        template_store: TemplateStore,
    ) -> None:
        self._settings = settings
        self._registry = registry
        self._template_store = template_store

    @staticmethod
    def inspect_workspace(workspace_dir: Path, meta: dict[str, Any] | None = None) -> dict[str, Any]:
        exists = workspace_dir.is_dir()
        label = _derive_project_label(workspace_dir)
        config_file = workspace_dir / "config" / "experiment.config"
        has_config = config_file.is_file() if exists else False
        has_samplesheet = (workspace_dir / "config" / "samplesheet.csv").is_file() if exists else False
        has_run_sh = (workspace_dir / "run.sh").is_file() if exists else False

        experiment = (meta or {}).get("experiment", "")
        if has_config:
            try:
                parsed = parse_experiment_config(config_file.read_text(encoding="utf-8"))
                experiment = parsed.experiment
            except Exception:  # noqa: BLE001
                pass

        return {
            "path": str(workspace_dir),
            "label": label,
            "name": (meta or {}).get("name") or label,
            "experiment": experiment or _derive_experiment_name(workspace_dir),
            "template_id": (meta or {}).get("template_id") or "default_ce11",
            "last_opened_at": (meta or {}).get("last_opened_at") or "",
            "pinned": bool((meta or {}).get("pinned", False)),
            "exists": exists,
            "has_config": has_config,
            "has_samplesheet": has_samplesheet,
            "has_run_sh": has_run_sh,
        }

    def get_state(self) -> dict[str, Any]:
        entries = self._registry.load_entries()
        current_meta = next(
            (e for e in entries if e.get("path") == str(self._settings.workspace_dir)), None
        )
        current_info = self.inspect_workspace(self._settings.workspace_dir, current_meta)
        if current_info["has_config"] and current_meta is None:
            self._registry.record(
                self._settings.workspace_dir,
                experiment=current_info["experiment"],
            )
            entries = self._registry.load_entries()

        recent = [
            self.inspect_workspace(Path(entry["path"]), entry)
            for entry in entries
            if Path(entry["path"]).is_dir()
        ]
        return {
            "current": current_info,
            "pipeline_dir": str(self._settings.pipeline_dir),
            "user_config_dir": str(self._settings.user_config_dir),
            "recent": recent,
        }

    def list_directories(self, raw_path: str | None = None) -> dict[str, Any]:
        """List non-hidden subdirectories of the target path for in-UI folder browsing."""
        if raw_path and raw_path.strip():
            target = Path(raw_path.strip()).expanduser().resolve()
        elif self._settings.workspace_dir != self._settings.pipeline_dir:
            target = self._settings.workspace_dir.parent.resolve()
        else:
            target = self._settings.pipeline_dir.parent.resolve()

        if not target.exists():
            raise FileNotFoundError(f"Directory does not exist: {target}")
        if not target.is_dir():
            raise ValueError(f"Path is not a directory: {target}")

        directories: list[dict[str, Any]] = []
        permission_error: str | None = None
        try:
            entries = sorted(
                (p for p in target.iterdir() if p.is_dir() and not p.name.startswith(".")),
                key=lambda p: p.name.lower(),
            )
            for entry in entries:
                try:
                    has_config = (entry / "config" / "experiment.config").is_file()
                    has_run_sh = (entry / "run.sh").is_file()
                except OSError:
                    has_config = False
                    has_run_sh = False
                directories.append(
                    {
                        "name": entry.name,
                        "path": str(entry),
                        "has_config": has_config,
                        "has_run_sh": has_run_sh,
                    }
                )
        except PermissionError:
            permission_error = f"Permission denied reading contents of {target}"

        parent_path = str(target.parent) if target.parent != target else None
        return {
            "current": str(target),
            "parent": parent_path,
            "home": str(Path.home().resolve()),
            "pipeline_parent": str(self._settings.pipeline_dir.parent.resolve()),
            "directories": directories,
            "error": permission_error,
        }

    def initialize_workspace(
        self,
        target_dir: Path,
        experiment_name: str | None = None,
        template_id: str = "default_ce11",
        email: str | None = None,
        input_dir: str | None = None,
        overwrite: bool = False,
    ) -> None:
        try:
            tpl = self._template_store.get_template(template_id)
        except FileNotFoundError:
            tpl = self._template_store.get_template("default_ce11")

        target_dir.mkdir(parents=True, exist_ok=True)
        config_dir = target_dir / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / "results").mkdir(parents=True, exist_ok=True)

        config_path = config_dir / "experiment.config"
        if overwrite or not config_path.exists():
            exp_name = experiment_name or _derive_experiment_name(target_dir)
            model = parse_experiment_config(tpl.experiment_config)
            updates: dict[str, Any] = {"experiment": exp_name}
            if email is not None and email.strip():
                updates["email"] = email.strip()
            if input_dir is not None:
                updates["input_dir"] = input_dir.strip()
            updated_model = model.model_copy(update=updates)
            config_path.write_text(serialize_experiment_config(updated_model), encoding="utf-8")

        samplesheet_path = config_dir / "samplesheet.csv"
        if overwrite or not samplesheet_path.exists():
            csv_content = tpl.samplesheet_csv or (",".join(SAMPLESHEET_FIELDNAMES) + "\n")
            samplesheet_path.write_text(csv_content, encoding="utf-8")

        run_sh_path = target_dir / "run.sh"
        if overwrite or not run_sh_path.exists():
            run_content = tpl.run_sh or DEFAULT_RUN_SH
            run_sh_path.write_text(run_content, encoding="utf-8")
            run_sh_path.chmod(0o755)

    def create_project(
        self,
        application: FastAPI,
        payload: ProjectCreatePayload,
    ) -> dict[str, Any]:
        resolved = Path(payload.target_dir).expanduser().resolve()
        if resolved == self._settings.pipeline_dir.resolve():
            raise ValueError(
                "Cannot create a project inside the Nextflow pipeline repository; choose a separate folder."
            )
        if (resolved / "config" / "experiment.config").exists() and not payload.overwrite:
            raise ValueError(
                f"Project already exists at {resolved}. Enable overwrite or open the existing project."
            )

        self.initialize_workspace(
            resolved,
            experiment_name=payload.experiment_name,
            template_id=payload.template_id,
            email=payload.email,
            input_dir=payload.input_dir,
            overwrite=payload.overwrite,
        )
        return self.switch_workspace(
            application,
            str(resolved),
            initialize=False,
            experiment_name=payload.experiment_name,
            template_id=payload.template_id,
        )

    def switch_workspace(
        self,
        application: FastAPI,
        raw_path: str,
        *,
        initialize: bool = False,
        experiment_name: str | None = None,
        template_id: str = "default_ce11",
    ) -> dict[str, Any]:
        from backend.dependencies import AppContainer
        from backend.services.pipeline_runner import NextflowSubprocessRunner

        current: AppContainer = application.state.container
        if (
            current.pipeline_service.process is not None
            and current.pipeline_service.tracker.status == "running"
        ):
            raise RuntimeError("Cannot switch project while a pipeline run is active")

        resolved = Path(raw_path).expanduser().resolve()
        if resolved.exists() and not resolved.is_dir():
            raise ValueError(f"Path is not a directory: {resolved}")
        if not resolved.exists() and not initialize:
            raise FileNotFoundError(f"Directory does not exist: {resolved}")

        if initialize:
            if resolved == current.settings.pipeline_dir.resolve():
                raise ValueError(
                    "Cannot initialize an experiment inside the pipeline repository; choose a separate Analysis_Run folder."
                )
            self.initialize_workspace(
                resolved,
                experiment_name=experiment_name,
                template_id=template_id,
            )
        elif not resolved.is_dir():
            raise FileNotFoundError(f"Directory does not exist: {resolved}")

        new_settings = WorkspaceSettings(
            pipeline_dir=current.settings.pipeline_dir,
            workspace_dir=resolved,
            static_dir=current.settings.static_dir,
            port=current.settings.port,
            user_config_dir=current.settings.user_config_dir,
        )
        preserved_runner = (
            None if isinstance(current.runner, NextflowSubprocessRunner) else current.runner
        )
        new_container = AppContainer.build(
            settings=new_settings,
            runner=preserved_runner,
            workspace_registry=self._registry,
            template_store=self._template_store,
        )
        inspected = self.inspect_workspace(resolved)
        self._registry.record(
            resolved,
            experiment=experiment_name or inspected.get("experiment"),
            template_id=template_id,
        )
        application.state.container = new_container
        return new_container.workspace_service.get_state()

    def remove_recent(self, raw_path: str) -> dict[str, Any]:
        self._registry.remove(Path(raw_path).expanduser())
        return self.get_state()
