"""Workspace, project, and runtime settings for CUT&RUN Control Center."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_BIGWIG_TOOLS: dict[str, str] = {
    "HOMER": "07_homer/ucsc_bw",
    "deepTools": "08_deeptools/bw",
}


def _default_user_config_dir() -> Path:
    override = (
        os.environ.get("CUTANDRUN_WEB_CONFIG_DIR", "").strip()
        or os.environ.get("CUTANDRUN_CONFIG_DIR", "").strip()
    )
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".config" / "cutandrun_web"


def _read_last_project(user_config_dir: Path) -> Path | None:
    for filename in ("projects.json", "workspaces.json"):
        registry_path = user_config_dir / filename
        if not registry_path.exists():
            continue
        try:
            payload = json.loads(registry_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        raw_last = payload.get("last_project_path") or payload.get("last_workspace")
        if isinstance(raw_last, str) and raw_last.strip():
            candidate = Path(raw_last).expanduser()
            if candidate.is_dir():
                return candidate.resolve()
    return None


def _default_pipeline_dir(repo_root: Path) -> Path:
    override = os.environ.get("PIPELINE_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    sibling_pipeline = repo_root.parent / "Cut_And_Run_Analysis"
    if sibling_pipeline.is_dir():
        return sibling_pipeline.resolve()
    return repo_root.resolve()


def _discover_initial_workspace(repo_root: Path, user_config_dir: Path, pipeline_dir: Path) -> Path:
    raw_analysis_dir = os.environ.get("ANALYSIS_DIR", "").strip()
    if raw_analysis_dir:
        return Path(raw_analysis_dir).expanduser().resolve()

    remembered = _read_last_project(user_config_dir)
    if remembered is not None:
        return remembered

    # Check sibling Experiment_* folders for an existing Analysis_Run
    parent_dir = repo_root.parent
    if parent_dir.is_dir():
        for candidate in sorted(parent_dir.glob("Experiment_*/Analysis_Run")):
            if (candidate / "config" / "experiment.config").is_file():
                return candidate.resolve()

    return pipeline_dir


@dataclass(frozen=True, slots=True)
class WorkspaceSettings:
    """Immutable workspace, template, and server configuration paths."""

    pipeline_dir: Path
    workspace_dir: Path
    static_dir: Path
    port: int | None = None
    user_config_dir: Path = field(default_factory=_default_user_config_dir)

    @classmethod
    def from_env(cls) -> WorkspaceSettings:
        """Build settings from environment variables, remembered project, or defaults."""
        backend_dir = Path(__file__).resolve().parent
        repo_root = backend_dir.parent
        user_config_dir = _default_user_config_dir()
        pipeline_dir = _default_pipeline_dir(repo_root)
        workspace_dir = _discover_initial_workspace(repo_root, user_config_dir, pipeline_dir)

        raw_port = os.environ.get("PORT")
        port = int(raw_port) if raw_port and raw_port.isdigit() else None
        return cls(
            pipeline_dir=pipeline_dir,
            workspace_dir=workspace_dir,
            static_dir=backend_dir / "static",
            port=port,
            user_config_dir=user_config_dir,
        )

    @property
    def config_path(self) -> Path:
        return self.workspace_dir / "config" / "experiment.config"

    @property
    def samplesheet_path(self) -> Path:
        return self.workspace_dir / "config" / "samplesheet.csv"

    @property
    def run_sh_path(self) -> Path:
        return self.workspace_dir / "run.sh"

    @property
    def weblog_config_path(self) -> Path:
        return self.workspace_dir / ".nextflow" / "weblog.config"

    @property
    def results_base_dir(self) -> Path:
        return self.workspace_dir / "results"

    @property
    def projects_registry_path(self) -> Path:
        return self.user_config_dir / "projects.json"

    @property
    def templates_dir(self) -> Path:
        return self.user_config_dir / "templates"

    @property
    def bigwig_tools_path(self) -> Path:
        return self.user_config_dir / "bigwig_tools.json"

    def load_bigwig_tools(self) -> dict[str, str]:
        """Load tool-to-BigWig-subdirectory mapping from ~/.config/cutandrun_web/bigwig_tools.json, seeding defaults if absent."""
        path = self.bigwig_tools_path
        if not path.exists():
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(DEFAULT_BIGWIG_TOOLS, indent=2) + "\n", encoding="utf-8")
            except OSError:
                return dict(DEFAULT_BIGWIG_TOOLS)

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return dict(DEFAULT_BIGWIG_TOOLS)

        if not isinstance(payload, dict):
            return dict(DEFAULT_BIGWIG_TOOLS)

        merged = dict(DEFAULT_BIGWIG_TOOLS)
        for key, value in payload.items():
            if isinstance(key, str) and isinstance(value, str) and key.strip() and value.strip():
                merged[key.strip()] = value.strip()
        return merged
