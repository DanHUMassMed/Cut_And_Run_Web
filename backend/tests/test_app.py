"""Unit and integration tests for CUT&RUN Control Center backend."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config_parser import (
    ContrastModel,
    ExperimentConfigModel,
    parse_experiment_config,
    serialize_experiment_config,
)
from backend.services.pipeline_runner import SubprocessHandle
from backend.services.task_tracker import PROCESS_STREAM_RE, TaskTracker
from backend.settings import WorkspaceSettings

SAMPLE_CONFIG = """
params {
    email                          = "test.user@umassmed.edu"
    experiment                     = "exp_test_01"
    input_dir                      = "/path/to/dropbox"
    active_bigwig_dir              = "08_deeptools/bw"
    outdir                         = "${launchDir}/results/${params.experiment}"
    samplesheet                    = "${launchDir}/config/samplesheet.csv"

    run_macs2_callpeak             = true
    run_homer_findpeaks            = false
    use_igg_control                = true
    run_merge_replicate_peaks      = true
    run_merge_master_peaks         = true
    run_homer_annotatepeaks        = true
    run_homer_diffpeaks            = true
    run_deeptools_metapeak         = false
    run_homer_findmotifs           = false
    run_meme_streme                = false
    run_summary_plots              = true

    active_peak_caller             = "macs2"
    min_replicate_overlap          = 3

    genome_name                    = "ce11"
    homer_dir                      = "${projectDir}/assets/homer_ce11"
    genome_fasta                   = "${projectDir}/assets/homer_ce11/data/genomes/ce11"
    chrom_sizes                    = "${projectDir}/assets/homer_ce11/data/genomes/ce11/chrom.sizes"

    macs2_gsize                    = "ce"
    macs2_format                   = "BAMPE"
    macs2_nomodel                  = false
    macs2_extsize                  = 147
    macs2_narrow_pvalue            = 1e-5
    macs2_narrow_qvalue            = 0.05
    macs2_broad_qvalue             = 0.01
    macs2_broad_cutoff             = 0.05

    homer_narrow_style             = "factor"
    homer_narrow_fold              = 2
    homer_narrow_local_fold        = 3
    homer_broad_style              = "histone"
    homer_broad_fold               = 3
    homer_broad_local_fold         = 1.5
    homer_broad_min_dist           = 1000
    annotatepeaks_size             = "given"

    diff_contrasts                 = [
        [ id: 'C1', treatment: 'T1', background: 'B1', target: 'H3K4me3' ],
        [ id: 'C2', treatment: 'T2', background: 'B2', target: 'H3K27me3' ]
    ]

    metapeak_upstream              = 1500
    metapeak_downstream            = 1500
    metapeak_reference_point       = "center"
    heatmap_colormap               = "viridis"
    heatmap_interpolation          = "bilinear"

    homer_motif_size               = "150"
    meme_slop_left                 = 60
    meme_slop_right                = 59
    meme_streme_nmotifs            = 15

    volcano_fdr_threshold          = 0.01
    volcano_log2fc_threshold       = 1.5
    volcano_top_n_labels           = 10
}
"""


class FakeRunner:
    """In-memory PipelineRunner stub for testing start/stop without spawning OS processes."""

    def __init__(self, return_code: int = 0) -> None:
        self.commands: list[list[str]] = []
        self.cwds: list[Path] = []
        self.interrupted: list[int] = []
        self.return_code = return_code
        self.release_event = asyncio.Event()

    async def spawn(self, cmd: list[str], cwd: Path) -> SubprocessHandle:
        self.commands.append(cmd)
        self.cwds.append(cwd)

        mock_proc = MagicMock()
        mock_proc.pid = 99999
        mock_proc.stdout = AsyncMock()
        mock_proc.stdout.readline = AsyncMock(return_value=b"")
        mock_proc.stderr = AsyncMock()
        mock_proc.stderr.readline = AsyncMock(return_value=b"")

        async def _wait() -> int:
            await self.release_event.wait()
            return self.return_code

        mock_proc.wait = _wait
        return mock_proc  # type: ignore[no-any-return]

    def interrupt(self, process: SubprocessHandle) -> None:
        self.interrupted.append(process.pid)
        self.release_event.set()


def make_test_settings(tmp_path: Path, port: int | None = 8000) -> WorkspaceSettings:
    workspace = tmp_path / "Analysis_Run"
    (workspace / "config").mkdir(parents=True, exist_ok=True)
    static_dir = tmp_path / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    (static_dir / "index.html").write_text("<!doctype html><html><body>SPA</body></html>", encoding="utf-8")
    return WorkspaceSettings(
        pipeline_dir=tmp_path / "Cut_And_Run_Analysis",
        workspace_dir=workspace,
        static_dir=static_dir,
        port=port,
        user_config_dir=tmp_path / ".config" / "cutandrun_web",
    )


def test_parse_experiment_config() -> None:
    model = parse_experiment_config(SAMPLE_CONFIG)
    assert model.email == "test.user@umassmed.edu"
    assert model.experiment == "exp_test_01"
    assert model.active_bigwig_dir == "08_deeptools/bw"
    assert model.bigwig_source == "deepTools"
    assert model.run_homer_findpeaks is False
    assert model.run_macs2_callpeak is True
    assert model.use_igg_control is True
    assert model.macs2_format == "BAMPE"
    assert model.macs2_narrow_pvalue == 1e-5
    assert model.macs2_broad_qvalue == 0.01
    assert model.macs2_broad_cutoff == 0.05
    assert model.homer_narrow_style == "factor"
    assert model.homer_narrow_fold == 2.0
    assert model.homer_narrow_local_fold == 3.0
    assert model.homer_broad_style == "histone"
    assert model.homer_broad_fold == 3.0
    assert model.homer_broad_local_fold == 1.5
    assert model.homer_broad_min_dist == 1000
    assert model.min_replicate_overlap == 3
    assert len(model.diff_contrasts) == 2
    assert model.diff_contrasts[0].id == "C1"
    assert model.diff_contrasts[1].target == "H3K27me3"


def test_parse_and_roundtrip_resource_limits() -> None:
    cfg_text = SAMPLE_CONFIG + """
process {
    resourceLimits = [
        cpus: 12, // max cores
        memory: '32 GB',
        time: 48.h
    ]
}
"""
    model = parse_experiment_config(cfg_text)
    assert model.resource_cpus == 12
    assert model.resource_memory == "32.GB"
    assert model.resource_time == "48.h"

    serialized = serialize_experiment_config(model)
    assert "process {" in serialized
    assert "cpus: 12," in serialized
    assert "memory: 32.GB," in serialized
    assert "time: 48.h" in serialized

    reparsed = parse_experiment_config(serialized)
    assert reparsed.resource_cpus == 12
    assert reparsed.resource_memory == "32.GB"
    assert reparsed.resource_time == "48.h"


def test_resource_limits_validation_rejects_injection_and_zero() -> None:
    with pytest.raises(ValueError):
        ExperimentConfigModel(experiment="exp_ok", resource_cpus=0)
    with pytest.raises(ValueError):
        ExperimentConfigModel(experiment="exp_ok", resource_memory="16.GB; System.exit(0)")
    with pytest.raises(ValueError):
        ExperimentConfigModel(experiment="exp_ok", resource_memory="0.GB")
    with pytest.raises(ValueError):
        ExperimentConfigModel(experiment="exp_ok", resource_time="72.h\nprintln 'hi'")
    with pytest.raises(ValueError):
        ExperimentConfigModel(experiment="exp_ok", resource_time="0.h")


def test_roundtrip_serialization() -> None:
    model = parse_experiment_config(SAMPLE_CONFIG)
    serialized = serialize_experiment_config(model)
    reparsed = parse_experiment_config(serialized)
    assert reparsed.email == model.email
    assert reparsed.experiment == model.experiment
    assert reparsed.active_bigwig_dir == model.active_bigwig_dir
    assert reparsed.diff_contrasts == model.diff_contrasts
    assert reparsed.macs2_format == model.macs2_format
    assert reparsed.macs2_narrow_pvalue == model.macs2_narrow_pvalue
    assert reparsed.macs2_broad_qvalue == model.macs2_broad_qvalue
    assert reparsed.macs2_broad_cutoff == model.macs2_broad_cutoff
    assert reparsed.homer_narrow_local_fold == model.homer_narrow_local_fold
    assert reparsed.homer_broad_fold == model.homer_broad_fold
    assert reparsed.homer_broad_min_dist == model.homer_broad_min_dist


def test_serializer_escapes_groovy_injection_and_validates_experiment() -> None:
    with pytest.raises(ValueError):
        ExperimentConfigModel(experiment="../escape")

    model = ExperimentConfigModel(
        experiment="safe_exp_01",
        input_dir='/data/"quoted"/${System.exit(0)}',
        diff_contrasts=[ContrastModel(id="A'B", treatment="T1", background="B1", target="H3K4me3")],
    )
    serialized = serialize_experiment_config(model)
    assert '\\"quoted\\"' in serialized
    assert "\\${System.exit(0)}" in serialized
    assert "id: 'A\\'B'" in serialized
    assert "${launchDir}/results/${params.experiment}" in serialized


def test_task_tracker_instances_do_not_share_state() -> None:
    t1 = TaskTracker()
    t2 = TaskTracker()
    t1.upsert_from_stream_line("[ab/123456] Submitted process > CUTANDRUN:FASTQC (s1)")
    assert len(t1.tasks) == 1
    assert len(t2.tasks) == 0


def test_pipeline_webhook_and_status(tmp_path: Path) -> None:
    app = create_app(settings=make_test_settings(tmp_path), runner=FakeRunner())
    service = app.state.container.pipeline_service

    asyncio.run(service.handle_webhook({"event": "started", "runName": "clever_curie"}))
    assert service.tracker.run_name == "clever_curie"

    asyncio.run(
        service.handle_webhook(
            {
                "event": "process_submitted",
                "runName": "clever_curie",
                "trace": {
                    "task_id": 1,
                    "name": "CUTANDRUN:PLOT_PEAK_COUNTS (summary)",
                    "process": "CUTANDRUN:PLOT_PEAK_COUNTS",
                    "tag": "summary",
                    "hash": "ab/123456",
                    "status": "SUBMITTED",
                },
            }
        )
    )
    assert "ab/123456" in service.tracker.tasks
    assert service.tracker.tasks["ab/123456"]["process_short"] == "PLOT_PEAK_COUNTS"
    assert service.tracker.stats["total"] == 1
    assert service.tracker.stats["submitted"] == 1

    asyncio.run(
        service.handle_webhook(
            {
                "event": "process_completed",
                "runName": "clever_curie",
                "trace": {
                    "task_id": 1,
                    "name": "CUTANDRUN:PLOT_PEAK_COUNTS (summary)",
                    "process": "CUTANDRUN:PLOT_PEAK_COUNTS",
                    "tag": "summary",
                    "hash": "ab/123456",
                    "status": "COMPLETED",
                    "exit": 0,
                    "realtime": 1500,
                },
            }
        )
    )
    status_resp = service.get_status()
    assert status_resp["run_name"] == "clever_curie"
    assert len(status_resp["tasks"]) == 1
    assert status_resp["stats"]["completed"] == 1
    assert status_resp["stats"]["percent"] == 100.0


def test_templates_and_project_creation_flow(tmp_path: Path) -> None:
    settings = make_test_settings(tmp_path)
    settings.config_path.write_text(SAMPLE_CONFIG, encoding="utf-8")
    settings.run_sh_path.write_text("#!/usr/bin/env bash\necho 'custom run'\n", encoding="utf-8")
    settings.samplesheet_path.write_text(
        "sample_id,sample_name,condition,target,peak_mode,replicate,control_id\n"
        "S1,S1_name,WT,H3K4me3,narrow,1,\n",
        encoding="utf-8",
    )

    app = create_app(settings=settings, runner=FakeRunner())
    with TestClient(app) as client:
        # 1. List templates (default_ce11 is auto-seeded in ~/.config/cutandrun_web/templates)
        tpl_list = client.get("/api/templates")
        assert tpl_list.status_code == 200
        templates = tpl_list.json()["templates"]
        assert any(t["id"] == "default_ce11" and t["built_in"] is True for t in templates)

        # 2. Save current project as a new template
        save_tpl = client.post(
            "/api/templates/from-project",
            json={
                "name": "Custom Worm Template",
                "description": "Saved from active project",
                "genome": "ce11",
                "include_samplesheet_rows": True,
            },
        )
        assert save_tpl.status_code == 200
        custom_tpl = save_tpl.json()["template"]
        assert custom_tpl["id"] == "custom_worm_template"
        assert "S1,S1_name,WT" in custom_tpl["samplesheet_csv"]

        # 3. Create a brand-new project from the saved template
        new_proj_dir = tmp_path / "Experiment_2026" / "Analysis_Run"
        created = client.post(
            "/api/projects/create",
            json={
                "target_dir": str(new_proj_dir),
                "experiment_name": "exp_from_template",
                "template_id": "custom_worm_template",
                "email": "new.researcher@umassmed.edu",
                "input_dir": "/data/cutrun_2026",
            },
        )
        assert created.status_code == 200
        proj_state = created.json()
        assert proj_state["current"]["path"] == str(new_proj_dir.resolve())
        assert proj_state["current"]["experiment"] == "exp_from_template"
        assert proj_state["current"]["has_config"] is True
        assert proj_state["current"]["has_samplesheet"] is True
        assert proj_state["current"]["has_run_sh"] is True

        # 4. Verify active config and run.sh in the new project
        cfg = client.get("/api/config").json()["config"]
        assert cfg["experiment"] == "exp_from_template"
        assert cfg["email"] == "new.researcher@umassmed.edu"
        assert cfg["input_dir"] == "/data/cutrun_2026"

        run_sh = client.get("/api/run-script").json()
        assert run_sh["exists"] is True
        assert "custom run" in run_sh["content"]

        # 5. Update and reset run.sh
        updated_sh = client.put("/api/run-script", json={"content": "#!/usr/bin/env bash\necho 'edited'\n"})
        assert updated_sh.status_code == 200
        assert "edited" in updated_sh.json()["content"]

        reset_sh = client.post("/api/run-script/reset", json={"template_id": "default_ce11"})
        assert reset_sh.status_code == 200
        assert "resolve_pipeline_dir" in reset_sh.json()["content"]

        # 6. Delete custom template (built-in cannot be deleted)
        assert client.delete("/api/templates/default_ce11").status_code == 400
        assert client.delete("/api/templates/custom_worm_template").status_code == 200

        # 7. Directory listing shortcuts & folder creation
        dirs_resp = client.get("/api/projects/list-dirs", params={"path": str(tmp_path)})
        assert dirs_resp.status_code == 200
        dirs_data = dirs_resp.json()
        assert any(s["label"] == "Projects Root" for s in dirs_data["shortcuts"])

        mkdir_resp = client.post(
            "/api/projects/mkdir",
            json={"parent_dir": str(tmp_path), "name": "New_Folder_2026"},
        )
        assert mkdir_resp.status_code == 200
        assert (tmp_path / "New_Folder_2026").is_dir()


def test_http_endpoints_config_samplesheet_preflight_and_results_sandbox(tmp_path: Path) -> None:
    settings = make_test_settings(tmp_path)
    settings.config_path.write_text(SAMPLE_CONFIG, encoding="utf-8")
    settings.run_sh_path.write_text("#!/usr/bin/env bash\necho ok\n", encoding="utf-8")

    input_dir = tmp_path / "dropbox_input"
    bam_dir = input_dir / "06_index_bam"
    bam_dir.mkdir(parents=True)
    (bam_dir / "sample_A.bam").write_text("bam", encoding="utf-8")

    exp_results = settings.results_base_dir / "exp_test_01" / "15_summary_plots"
    exp_results.mkdir(parents=True)
    (exp_results / "01_peak_counts.png").write_bytes(b"\x89PNG\r\n")

    sibling_secret_dir = settings.results_base_dir / "exp_test_01_secret"
    sibling_secret_dir.mkdir(parents=True)
    (sibling_secret_dir / "leak.txt").write_text("secret", encoding="utf-8")

    app = create_app(settings=settings, runner=FakeRunner())
    client = TestClient(app)

    idx = client.get("/")
    assert idx.status_code == 200
    assert "no-store" in idx.headers.get("cache-control", "")
    assert idx.headers.get("x-content-type-options") == "nosniff"

    cfg_resp = client.get("/api/config")
    assert cfg_resp.status_code == 200
    assert cfg_resp.json()["bigwig_tools"] == {
        "HOMER": "07_homer/ucsc_bw",
        "deepTools": "08_deeptools/bw",
    }
    assert settings.bigwig_tools_path.is_file()
    cfg = cfg_resp.json()["config"]
    cfg["input_dir"] = str(input_dir)
    cfg["active_bigwig_dir"] = "HOMER"
    cfg["resource_cpus"] = 16
    cfg["resource_memory"] = "64.GB"
    cfg["resource_time"] = "24.h"
    put_resp = client.put("/api/config", json=cfg)
    assert put_resp.status_code == 200
    assert put_resp.json()["config"]["active_bigwig_dir"] == "07_homer/ucsc_bw"
    assert settings.config_path.with_suffix(".config.bak").exists()

    patch_resp = client.patch(
        "/api/config/contrasts",
        json={"diff_contrasts": [{"id": "C_new", "treatment": "T", "background": "B", "target": "H3K4me3"}]},
    )
    assert patch_resp.status_code == 200
    assert len(patch_resp.json()["diff_contrasts"]) == 1

    ss_put = client.put(
        "/api/samplesheet",
        json={
            "rows": [
                {
                    "sample_id": "sample_A",
                    "sample_name": "Sample_A",
                    "condition": "WT",
                    "target": "H3K4me3",
                    "peak_mode": "narrow",
                    "replicate": "1",
                    "control_id": "",
                }
            ]
        },
    )
    assert ss_put.status_code == 200
    saved_row = client.get("/api/samplesheet").json()["rows"][0]
    assert saved_row["sample_id"] == "sample_A"

    pf_resp = client.post("/api/preflight")
    assert pf_resp.status_code == 200
    assert any(c["name"] == "Input Directory" and c["status"] == "ok" for c in pf_resp.json()["checks"])

    files_resp = client.get("/api/results/files")
    assert files_resp.status_code == 200
    assert files_resp.json()["exists"] is True
    assert files_resp.json()["files"][0]["name"] == "01_peak_counts.png"

    ok_file = client.get("/api/results/file/15_summary_plots/01_peak_counts.png")
    assert ok_file.status_code == 200

    traversal_attempt = client.get("/api/results/file/../exp_test_01_secret/leak.txt")
    assert traversal_attempt.status_code == 404

    del_resp = client.delete("/api/results/file/15_summary_plots/01_peak_counts.png")
    assert del_resp.status_code == 200
    assert client.get("/api/results/file/15_summary_plots/01_peak_counts.png").status_code == 404


def test_health_lifespan_and_shutdown_endpoints(tmp_path: Path) -> None:
    settings = make_test_settings(tmp_path)
    runner = FakeRunner()
    shutdown_calls: list[str] = []
    app = create_app(
        settings=settings,
        runner=runner,
        shutdown_callback=lambda: shutdown_calls.append("shutdown"),
    )

    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        start_resp = client.post("/api/pipeline/start", json={"resume": True})
        assert start_resp.status_code == 200

        blocked = client.post("/api/server/shutdown")
        assert blocked.status_code == 409
        assert shutdown_calls == []

    assert runner.interrupted == [99999]

    runner2 = FakeRunner()
    shutdown_calls2: list[str] = []
    app2 = create_app(
        settings=settings,
        runner=runner2,
        shutdown_callback=lambda: shutdown_calls2.append("shutdown"),
    )
    with TestClient(app2) as client2:
        assert client2.post("/api/pipeline/start", json={"resume": False}).status_code == 200
        forced = client2.post("/api/server/shutdown", json={"force": True})
        assert forced.status_code == 200
        time.sleep(0.25)

    assert runner2.interrupted == [99999]
    assert shutdown_calls2 == ["shutdown"]


def test_process_stream_regex() -> None:
    log_line = "[d0/96014c] Cached process > CUTANDRUN:PLOT_PEAK_COUNTS (peak_counts_summary)"
    m = PROCESS_STREAM_RE.search(log_line)
    assert m is not None
    task_hash, action, proc_full, tag = m.groups()
    assert task_hash == "d0/96014c"
    assert action == "Cached"
    assert proc_full == "CUTANDRUN:PLOT_PEAK_COUNTS"
    assert tag == "peak_counts_summary"


def test_built_react_spa_served_from_single_port(tmp_path: Path) -> None:
    real_static_dir = Path(__file__).resolve().parent.parent / "static"
    workspace = tmp_path / "Analysis_Run"
    (workspace / "config").mkdir(parents=True)
    (workspace / "config" / "experiment.config").write_text(SAMPLE_CONFIG, encoding="utf-8")

    settings = WorkspaceSettings(
        pipeline_dir=tmp_path / "Cut_And_Run_Analysis",
        workspace_dir=workspace,
        static_dir=real_static_dir,
        port=8000,
        user_config_dir=tmp_path / ".config" / "cutandrun_web",
    )
    app = create_app(settings=settings, runner=FakeRunner())
    client = TestClient(app)

    root_resp = client.get("/")
    assert root_resp.status_code == 200
    assert '<div id="root"></div>' in root_resp.text

    admin_resp = client.get("/admin")
    assert admin_resp.status_code == 200
    assert '<div id="root"></div>' in admin_resp.text

    # Asset bundle under /assets/... is served directly by the single-port app
    assets = list((real_static_dir / "assets").glob("*.js"))
    assert len(assets) >= 1
    asset_resp = client.get(f"/assets/{assets[0].name}")
    assert asset_resp.status_code == 200

