"""Repository protocols and file-system implementations for workspace artifacts."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Protocol

from backend.config_parser import parse_experiment_config, serialize_experiment_config
from backend.models import ContrastModel, ExperimentConfigModel
from backend.settings import WorkspaceSettings

SAMPLESHEET_FIELDNAMES = [
    "sample_id",
    "sample_name",
    "condition",
    "target",
    "peak_mode",
    "replicate",
    "control_id",
]

RESULTS_GLOBS = ("*.png", "*.svg", "*.tsv", "*.txt", "*.pdf", "*.html", "*.bed", "*.narrowPeak", "*.broadPeak", "*.csv", "*.md")


class ConfigRepository(Protocol):
    """Persistence contract for experiment configuration."""

    def exists(self) -> bool: ...
    def load(self) -> tuple[ExperimentConfigModel, str]: ...
    def save(self, model: ExperimentConfigModel) -> None: ...
    def update_contrasts(self, contrasts: list[ContrastModel]) -> ExperimentConfigModel: ...
    def get_bigwig_tools(self) -> dict[str, str]: ...


class SamplesheetRepository(Protocol):
    """Persistence contract for samplesheet rows."""

    def exists(self) -> bool: ...
    def load(self) -> list[dict[str, str]]: ...
    def save(self, rows: list[dict[str, Any]]) -> int: ...


class RunScriptRepository(Protocol):
    """Persistence contract for the project's run.sh script."""

    def exists(self) -> bool: ...
    def load(self) -> str: ...
    def save(self, content: str) -> None: ...


class ResultsRepository(Protocol):
    """Contract for pipeline output discovery, safe file access, and cleanup."""

    def results_dir_for(self, experiment: str) -> Path: ...
    def list_files(self, experiment: str) -> tuple[Path, bool, list[dict[str, Any]]]: ...
    def resolve_safe_file(self, experiment: str, file_path: str) -> Path | None: ...
    def delete_safe_file(self, experiment: str, file_path: str) -> bool: ...


class FileConfigRepository:
    """File-backed ConfigRepository reading/writing `experiment.config` with .bak backups."""

    def __init__(self, settings: WorkspaceSettings) -> None:
        self._settings = settings
        self._settings.load_bigwig_tools()

    def exists(self) -> bool:
        return self._settings.config_path.exists()

    def get_bigwig_tools(self) -> dict[str, str]:
        return self._settings.load_bigwig_tools()

    def load(self) -> tuple[ExperimentConfigModel, str]:
        path = self._settings.config_path
        if not path.exists():
            raise FileNotFoundError("experiment.config not found")
        raw = path.read_text(encoding="utf-8")
        return parse_experiment_config(raw), raw

    def save(self, model: ExperimentConfigModel) -> None:
        tools_map = self.get_bigwig_tools()
        resolved_dir = tools_map.get(model.active_bigwig_dir, model.active_bigwig_dir)
        resolved_source = "deepTools" if resolved_dir == tools_map.get("deepTools") or "deeptools" in resolved_dir.lower() else "UCSC"
        normalized_model = model.model_copy(
            update={"active_bigwig_dir": resolved_dir, "bigwig_source": resolved_source}
        )
        path = self._settings.config_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            bak_path = path.with_suffix(".config.bak")
            bak_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        path.write_text(serialize_experiment_config(normalized_model), encoding="utf-8")

    def update_contrasts(self, contrasts: list[ContrastModel]) -> ExperimentConfigModel:
        model, _ = self.load()
        updated = model.model_copy(update={"diff_contrasts": contrasts})
        self.save(updated)
        return updated


class FileSamplesheetRepository:
    """File-backed SamplesheetRepository reading/writing `samplesheet.csv` with .bak backups."""

    def __init__(self, settings: WorkspaceSettings) -> None:
        self._settings = settings

    def exists(self) -> bool:
        return self._settings.samplesheet_path.exists()

    def load(self) -> list[dict[str, str]]:
        path = self._settings.samplesheet_path
        if not path.exists():
            return []
        with open(path, encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            return [dict(row) for row in reader]

    def save(self, rows: list[dict[str, Any]]) -> int:
        path = self._settings.samplesheet_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            bak_path = path.with_suffix(".csv.bak")
            bak_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")

        with open(path, mode="w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=SAMPLESHEET_FIELDNAMES)
            writer.writeheader()
            for row in rows:
                cleaned = {key: row.get(key, "") for key in SAMPLESHEET_FIELDNAMES}
                writer.writerow(cleaned)
        return len(rows)


class FileRunScriptRepository:
    """File-backed RunScriptRepository reading/writing `run.sh` with executable permissions."""

    def __init__(self, settings: WorkspaceSettings) -> None:
        self._settings = settings

    def exists(self) -> bool:
        return self._settings.run_sh_path.exists()

    def load(self) -> str:
        path = self._settings.run_sh_path
        if not path.exists():
            raise FileNotFoundError("run.sh not found")
        return path.read_text(encoding="utf-8")

    def save(self, content: str) -> None:
        path = self._settings.run_sh_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            bak_path = path.with_suffix(".sh.bak")
            bak_path.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        normalized = content if content.endswith("\n") else content + "\n"
        path.write_text(normalized, encoding="utf-8")
        path.chmod(0o755)


class FileResultsRepository:
    """File-backed ResultsRepository with strict `is_relative_to` sandboxing."""

    def __init__(self, settings: WorkspaceSettings) -> None:
        self._settings = settings

    def results_dir_for(self, experiment: str) -> Path:
        base = self._settings.results_base_dir.resolve()
        candidate = (base / experiment).resolve()
        if not candidate.is_relative_to(base):
            raise ValueError("Invalid experiment results path")
        return candidate

    def list_files(self, experiment: str) -> tuple[Path, bool, list[dict[str, Any]]]:
        results_dir = self.results_dir_for(experiment)
        if not results_dir.exists():
            return results_dir, False, []

        matched_files: list[dict[str, Any]] = []
        seen: set[Path] = set()
        for ext in RESULTS_GLOBS:
            for file_path in results_dir.rglob(ext):
                resolved = file_path.resolve()
                if resolved in seen or not resolved.is_file() or not resolved.is_relative_to(results_dir):
                    continue
                seen.add(resolved)
                rel = file_path.relative_to(results_dir)
                stat = file_path.stat()
                matched_files.append(
                    {
                        "path": rel.as_posix(),
                        "name": file_path.name,
                        "category": rel.parts[0] if len(rel.parts) > 1 else "general",
                        "subfolder": rel.parent.as_posix() if rel.parent.as_posix() != "." else "",
                        "size": stat.st_size,
                        "mtime": stat.st_mtime,
                    }
                )
        matched_files.sort(key=lambda item: str(item["path"]))
        return results_dir, True, matched_files

    def resolve_safe_file(self, experiment: str, file_path: str) -> Path | None:
        if not file_path or file_path.startswith("/"):
            return None
        results_dir = self.results_dir_for(experiment)
        target = (results_dir / file_path).resolve()
        if not target.is_relative_to(results_dir) or not target.exists() or not target.is_file():
            return None
        return target

    def delete_safe_file(self, experiment: str, file_path: str) -> bool:
        target = self.resolve_safe_file(experiment, file_path)
        if target is None:
            return False
        target.unlink()
        return True
