"""Application service container and FastAPI dependency providers."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request

from backend.repositories import (
    ConfigRepository,
    FileConfigRepository,
    FileResultsRepository,
    FileRunScriptRepository,
    FileSamplesheetRepository,
    ResultsRepository,
    RunScriptRepository,
    SamplesheetRepository,
)
from backend.services.pipeline_runner import (
    NextflowSubprocessRunner,
    PipelineRunner,
    PipelineService,
)
from backend.services.preflight import PreflightService
from backend.services.project_manager import (
    FileWorkspaceRegistry,
    WorkspaceRegistry,
    WorkspaceService,
)
from backend.services.task_tracker import LogBroadcaster, TaskTracker
from backend.services.template_manager import FileTemplateStore, TemplateStore
from backend.settings import WorkspaceSettings


@dataclass
class AppContainer:
    """Dependency container holding workspace services and repositories."""

    settings: WorkspaceSettings
    config_repo: ConfigRepository
    samplesheet_repo: SamplesheetRepository
    run_script_repo: RunScriptRepository
    results_repo: ResultsRepository
    template_store: TemplateStore
    tracker: TaskTracker
    broadcaster: LogBroadcaster
    runner: PipelineRunner
    preflight_service: PreflightService
    pipeline_service: PipelineService
    workspace_service: WorkspaceService

    @classmethod
    def build(
        cls,
        settings: WorkspaceSettings | None = None,
        runner: PipelineRunner | None = None,
        workspace_registry: WorkspaceRegistry | None = None,
        template_store: TemplateStore | None = None,
    ) -> AppContainer:
        resolved_settings = settings or WorkspaceSettings.from_env()
        config_repo = FileConfigRepository(resolved_settings)
        samplesheet_repo = FileSamplesheetRepository(resolved_settings)
        run_script_repo = FileRunScriptRepository(resolved_settings)
        results_repo = FileResultsRepository(resolved_settings)
        resolved_templates = template_store or FileTemplateStore(resolved_settings.templates_dir)
        tracker = TaskTracker()
        broadcaster = LogBroadcaster()
        resolved_runner = runner or NextflowSubprocessRunner(
            pipeline_dir=resolved_settings.pipeline_dir
        )
        preflight_service = PreflightService(resolved_settings, config_repo)
        pipeline_service = PipelineService(
            settings=resolved_settings,
            config_repo=config_repo,
            tracker=tracker,
            broadcaster=broadcaster,
            runner=resolved_runner,
        )
        resolved_registry = workspace_registry or FileWorkspaceRegistry(
            resolved_settings.user_config_dir
        )
        workspace_service = WorkspaceService(
            resolved_settings,
            resolved_registry,
            resolved_templates,
        )
        return cls(
            settings=resolved_settings,
            config_repo=config_repo,
            samplesheet_repo=samplesheet_repo,
            run_script_repo=run_script_repo,
            results_repo=results_repo,
            template_store=resolved_templates,
            tracker=tracker,
            broadcaster=broadcaster,
            runner=resolved_runner,
            preflight_service=preflight_service,
            pipeline_service=pipeline_service,
            workspace_service=workspace_service,
        )


def get_container(request: Request) -> AppContainer:
    return request.app.state.container  # type: ignore[no-any-return]


def get_config_repo(request: Request) -> ConfigRepository:
    return get_container(request).config_repo


def get_samplesheet_repo(request: Request) -> SamplesheetRepository:
    return get_container(request).samplesheet_repo


def get_run_script_repo(request: Request) -> RunScriptRepository:
    return get_container(request).run_script_repo


def get_results_repo(request: Request) -> ResultsRepository:
    return get_container(request).results_repo


def get_template_store(request: Request) -> TemplateStore:
    return get_container(request).template_store


def get_preflight_service(request: Request) -> PreflightService:
    return get_container(request).preflight_service


def get_pipeline_service(request: Request) -> PipelineService:
    return get_container(request).pipeline_service


def get_workspace_service(request: Request) -> WorkspaceService:
    return get_container(request).workspace_service
