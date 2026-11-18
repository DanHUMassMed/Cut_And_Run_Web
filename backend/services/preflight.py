"""Extensible pre-flight environment validation checks."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from backend.models import ExperimentConfigModel, PreflightCheckResult
from backend.repositories import ConfigRepository
from backend.settings import WorkspaceSettings


@dataclass(frozen=True)
class PreflightContext:
    """Snapshot passed to each pre-flight check."""

    settings: WorkspaceSettings
    config: ExperimentConfigModel

    @property
    def input_dir(self) -> Path:
        return Path(self.config.input_dir) if self.config.input_dir else Path()


class PreflightCheck(Protocol):
    """Contract for an individual pre-flight validation check."""

    def run(self, ctx: PreflightContext) -> PreflightCheckResult: ...


class InputDirectoryCheck:
    def run(self, ctx: PreflightContext) -> PreflightCheckResult:
        if ctx.config.input_dir and ctx.input_dir.exists():
            return PreflightCheckResult(name="Input Directory", status="ok", detail=str(ctx.input_dir))
        return PreflightCheckResult(
            name="Input Directory",
            status="failed",
            detail=f"Path does not exist: {ctx.config.input_dir or '(unset)'}",
        )


class BamFilesCheck:
    def run(self, ctx: PreflightContext) -> PreflightCheckResult:
        bam_files = (
            list(ctx.input_dir.glob("06_index_bam/*.bam"))
            if ctx.config.input_dir and ctx.input_dir.exists()
            else []
        )
        if bam_files:
            return PreflightCheckResult(
                name="Input BAMs (06_index_bam)",
                status="ok",
                detail=f"Found {len(bam_files)} BAM file(s)",
            )
        return PreflightCheckResult(
            name="Input BAMs (06_index_bam)",
            status="warning",
            detail="No BAM files found in 06_index_bam/",
        )


class BigWigFilesCheck:
    def run(self, ctx: PreflightContext) -> PreflightCheckResult:
        active_dir = ctx.config.active_bigwig_dir or f"08_bigwig/{ctx.config.bigwig_source}"
        bw_files: list[Path] = []
        if ctx.config.input_dir and ctx.input_dir.exists():
            bw_files = list(ctx.input_dir.glob(f"{active_dir}/*.bw"))
            if not bw_files:
                # Fallback check for legacy 08_bigwig/<bigwig_source>/*.bw
                bw_files = list(ctx.input_dir.glob(f"08_bigwig/{ctx.config.bigwig_source}/*.bw"))
        if bw_files:
            return PreflightCheckResult(
                name=f"BigWigs ({active_dir})",
                status="ok",
                detail=f"Found {len(bw_files)} BigWig file(s)",
            )
        return PreflightCheckResult(
            name=f"BigWigs ({active_dir})",
            status="warning",
            detail=f"No BigWig files found in {active_dir}",
        )


class HomerTagDirsCheck:
    def run(self, ctx: PreflightContext) -> PreflightCheckResult:
        tag_dir_root = ctx.input_dir / "07_homer" / "tag_dir"
        tag_dirs = (
            [p for p in tag_dir_root.glob("*") if p.is_dir()]
            if ctx.config.input_dir and tag_dir_root.exists()
            else []
        )
        if tag_dirs:
            return PreflightCheckResult(
                name="HOMER Tag Dirs (07_homer/tag_dir)",
                status="ok",
                detail=f"Found {len(tag_dirs)} tag directory(ies)",
            )
        return PreflightCheckResult(
            name="HOMER Tag Dirs (07_homer/tag_dir)",
            status="warning",
            detail="No tag directories found in 07_homer/tag_dir",
        )


class RunScriptCheck:
    def run(self, ctx: PreflightContext) -> PreflightCheckResult:
        run_sh = ctx.settings.run_sh_path
        if run_sh.is_file():
            return PreflightCheckResult(
                name="Launch Script (run.sh)",
                status="ok",
                detail=f"Found {run_sh}",
            )
        return PreflightCheckResult(
            name="Launch Script (run.sh)",
            status="failed",
            detail=f"Missing run.sh in {ctx.settings.workspace_dir}",
        )


class NextflowBinaryCheck:
    def run(self, ctx: PreflightContext) -> PreflightCheckResult:
        nf_path = shutil.which("nextflow")
        if nf_path:
            return PreflightCheckResult(
                name="Nextflow Engine",
                status="ok",
                detail=f"Nextflow executable found at {nf_path}",
            )
        return PreflightCheckResult(
            name="Nextflow Engine",
            status="failed",
            detail="Nextflow not found in PATH",
        )


class NextflowLockCheck:
    def run(self, ctx: PreflightContext) -> PreflightCheckResult:
        cache_dir = ctx.settings.workspace_dir / ".nextflow" / "cache"
        locks = list(cache_dir.glob("*/db/LOCK")) if cache_dir.exists() else []
        if locks:
            return PreflightCheckResult(
                name="Nextflow Session Lock",
                status="warning",
                detail=f"{len(locks)} active/stale lock file(s) in .nextflow/cache/",
            )
        return PreflightCheckResult(
            name="Nextflow Session Lock",
            status="ok",
            detail="No active locks found",
        )


DEFAULT_PREFLIGHT_CHECKS: tuple[PreflightCheck, ...] = (
    InputDirectoryCheck(),
    BamFilesCheck(),
    BigWigFilesCheck(),
    HomerTagDirsCheck(),
    RunScriptCheck(),
    NextflowBinaryCheck(),
    NextflowLockCheck(),
)


class PreflightService:
    """Runs registered pre-flight checks against workspace settings and config."""

    def __init__(
        self,
        settings: WorkspaceSettings,
        config_repo: ConfigRepository,
        checks: tuple[PreflightCheck, ...] = DEFAULT_PREFLIGHT_CHECKS,
    ) -> None:
        self._settings = settings
        self._config_repo = config_repo
        self._checks = checks

    def run_checks(self) -> dict[str, object]:
        if not self._config_repo.exists():
            return {
                "ready": False,
                "checks": [
                    PreflightCheckResult(
                        name="Config file exists",
                        status="failed",
                        detail="experiment.config missing",
                    ).model_dump()
                ],
                "workspace": str(self._settings.workspace_dir),
            }

        cfg, _ = self._config_repo.load()
        ctx = PreflightContext(settings=self._settings, config=cfg)
        results = [check.run(ctx).model_dump() for check in self._checks]
        ready = all(item["status"] != "failed" for item in results)
        return {
            "ready": ready,
            "checks": results,
            "workspace": str(self._settings.workspace_dir),
        }
