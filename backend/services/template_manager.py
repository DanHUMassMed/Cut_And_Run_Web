"""Project template management in $HOME/.config/cutandrun_web/templates."""

from __future__ import annotations

import json
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from backend.config_parser import serialize_experiment_config
from backend.models import ExperimentConfigModel, TemplateDetail, TemplateMetadata, TemplateSavePayload
from backend.repositories import SAMPLESHEET_FIELDNAMES

SAFE_TEMPLATE_ID_RE = re.compile(r"[^A-Za-z0-9._-]+")

DEFAULT_RUN_SH = """#!/usr/bin/env bash
set -euo pipefail

RESUME="-resume"
if [ "${1:-}" = "false" ] || [ "${1:-}" = "--no-resume" ]; then
    RESUME=""
    shift
elif [ "${1:-}" = "true" ] || [ "${1:-}" = "--resume" ]; then
    RESUME="-resume"
    shift
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

resolve_pipeline_dir() {
    if [ -n "${PIPELINE_DIR:-}" ] && [ -f "${PIPELINE_DIR}/main.nf" ]; then
        echo "${PIPELINE_DIR}"
        return 0
    fi
    if [ -f "${SCRIPT_DIR}/../../Cut_And_Run_Analysis/main.nf" ]; then
        (cd "${SCRIPT_DIR}/../../Cut_And_Run_Analysis" && pwd -P)
        return 0
    fi
    if [ -f "${SCRIPT_DIR}/../Cut_And_Run_Analysis/main.nf" ]; then
        (cd "${SCRIPT_DIR}/../Cut_And_Run_Analysis" && pwd -P)
        return 0
    fi
    if [ -f "${HOME}/.config/cutandrun_web/env" ]; then
        # shellcheck disable=SC1090
        source "${HOME}/.config/cutandrun_web/env"
        if [ -n "${PIPELINE_DIR:-}" ] && [ -f "${PIPELINE_DIR}/main.nf" ]; then
            echo "${PIPELINE_DIR}"
            return 0
        fi
    fi
    if [ -f "${HOME}/.config/cutandrun/env" ]; then
        # shellcheck disable=SC1090
        source "${HOME}/.config/cutandrun/env"
        if [ -n "${PIPELINE_DIR:-}" ] && [ -f "${PIPELINE_DIR}/main.nf" ]; then
            echo "${PIPELINE_DIR}"
            return 0
        fi
    fi
    echo "Error: Could not locate Cut_And_Run_Analysis pipeline directory. Set PIPELINE_DIR." >&2
    return 1
}

PIPELINE_PATH="$(resolve_pipeline_dir)"
email="$(sed -nE "s/^[[:space:]]*email[[:space:]]*=[[:space:]]*[\\"']([^\\"']+)[\\"'].*/\\1/p" config/experiment.config | head -n 1)"
nextflow -c config/experiment.config run "${PIPELINE_PATH}" -profile docker,arm64 ${RESUME} -N "${email}" "$@"
"""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _slugify_template_id(name: str) -> str:
    slug = SAFE_TEMPLATE_ID_RE.sub("_", name.strip().lower()).strip("._-")
    if not slug or not slug[0].isalnum():
        slug = f"tpl_{slug or 'custom'}"
    return slug[:64]


class TemplateStore(Protocol):
    """Persistence contract for project templates in ~/.config/cutandrun_web/templates."""

    def ensure_defaults(self) -> None: ...
    def list_templates(self) -> list[TemplateMetadata]: ...
    def get_template(self, template_id: str) -> TemplateDetail: ...
    def save_template(self, payload: TemplateSavePayload) -> TemplateDetail: ...
    def delete_template(self, template_id: str) -> bool: ...


class FileTemplateStore:
    """File-system backed template store in ~/.config/cutandrun_web/templates."""

    def __init__(self, templates_dir: Path) -> None:
        self._templates_dir = templates_dir
        self.ensure_defaults()

    def ensure_defaults(self) -> None:
        self._templates_dir.mkdir(parents=True, exist_ok=True)
        default_dir = self._templates_dir / "default_ce11"
        meta_path = default_dir / "template.json"
        if meta_path.exists():
            return

        default_dir.mkdir(parents=True, exist_ok=True)
        now = _now_iso()
        default_model = ExperimentConfigModel(
            email="user@example.org",
            experiment="cut_run_experiment",
            input_dir="",
            active_bigwig_dir="07_homer/ucsc_bw",
            genome_name="ce11",
            macs2_gsize="ce",
        )
        meta = TemplateMetadata(
            id="default_ce11",
            name="C. elegans (ce11) Standard CUT&RUN",
            description="Default CUT&RUN downstream peak analysis template configured for C. elegans (ce11) with MACS2 + HOMER + deepTools + STREME.",
            genome="ce11",
            created_at=now,
            updated_at=now,
            built_in=True,
        )
        meta_path.write_text(json.dumps(meta.model_dump(), indent=2) + "\n", encoding="utf-8")
        (default_dir / "experiment.config").write_text(
            serialize_experiment_config(default_model), encoding="utf-8"
        )
        (default_dir / "samplesheet.csv").write_text(
            ",".join(SAMPLESHEET_FIELDNAMES) + "\n", encoding="utf-8"
        )
        run_sh_path = default_dir / "run.sh"
        run_sh_path.write_text(DEFAULT_RUN_SH, encoding="utf-8")
        run_sh_path.chmod(0o755)

    def _resolve_template_dir(self, template_id: str) -> Path:
        base = self._templates_dir.resolve()
        candidate = (base / template_id).resolve()
        if not candidate.is_relative_to(base):
            raise ValueError("Invalid template ID")
        return candidate

    def list_templates(self) -> list[TemplateMetadata]:
        self.ensure_defaults()
        items: list[TemplateMetadata] = []
        for entry in sorted(self._templates_dir.iterdir(), key=lambda p: p.name.lower()):
            if not entry.is_dir():
                continue
            meta_file = entry / "template.json"
            if not meta_file.is_file():
                continue
            try:
                raw = json.loads(meta_file.read_text(encoding="utf-8"))
                items.append(TemplateMetadata(**raw))
            except (OSError, json.JSONDecodeError, ValueError):
                continue
        items.sort(key=lambda t: (not t.built_in, t.name.lower()))
        return items

    def get_template(self, template_id: str) -> TemplateDetail:
        self.ensure_defaults()
        tpl_dir = self._resolve_template_dir(template_id)
        meta_file = tpl_dir / "template.json"
        if not tpl_dir.is_dir() or not meta_file.is_file():
            raise FileNotFoundError(f"Template not found: {template_id}")

        raw_meta = json.loads(meta_file.read_text(encoding="utf-8"))
        meta = TemplateMetadata(**raw_meta)

        cfg_path = tpl_dir / "experiment.config"
        csv_path = tpl_dir / "samplesheet.csv"
        run_path = tpl_dir / "run.sh"

        cfg_text = (
            cfg_path.read_text(encoding="utf-8")
            if cfg_path.is_file()
            else serialize_experiment_config(
                ExperimentConfigModel(email="user@example.org", experiment="cut_run_experiment")
            )
        )
        csv_text = (
            csv_path.read_text(encoding="utf-8")
            if csv_path.is_file()
            else ",".join(SAMPLESHEET_FIELDNAMES) + "\n"
        )
        run_text = run_path.read_text(encoding="utf-8") if run_path.is_file() else DEFAULT_RUN_SH

        return TemplateDetail(
            **meta.model_dump(),
            experiment_config=cfg_text,
            samplesheet_csv=csv_text,
            run_sh=run_text,
        )

    def save_template(self, payload: TemplateSavePayload) -> TemplateDetail:
        self.ensure_defaults()
        template_id = _slugify_template_id(payload.id or payload.name)
        tpl_dir = self._resolve_template_dir(template_id)
        tpl_dir.mkdir(parents=True, exist_ok=True)

        now = _now_iso()
        existing_created = now
        built_in = template_id == "default_ce11"
        meta_file = tpl_dir / "template.json"
        if meta_file.is_file():
            try:
                old = json.loads(meta_file.read_text(encoding="utf-8"))
                existing_created = str(old.get("created_at") or now)
                built_in = bool(old.get("built_in", built_in))
            except (OSError, json.JSONDecodeError):
                pass

        meta = TemplateMetadata(
            id=template_id,
            name=payload.name,
            description=payload.description,
            genome=payload.genome,
            created_at=existing_created,
            updated_at=now,
            built_in=built_in,
        )
        meta_file.write_text(json.dumps(meta.model_dump(), indent=2) + "\n", encoding="utf-8")

        default_detail = self.get_template("default_ce11") if template_id != "default_ce11" else None
        cfg_text = payload.experiment_config or (
            default_detail.experiment_config
            if default_detail
            else serialize_experiment_config(
                ExperimentConfigModel(email="user@example.org", experiment="cut_run_experiment")
            )
        )
        csv_text = payload.samplesheet_csv or (",".join(SAMPLESHEET_FIELDNAMES) + "\n")
        run_text = payload.run_sh or DEFAULT_RUN_SH

        (tpl_dir / "experiment.config").write_text(cfg_text, encoding="utf-8")
        (tpl_dir / "samplesheet.csv").write_text(csv_text, encoding="utf-8")
        run_sh_path = tpl_dir / "run.sh"
        run_sh_path.write_text(run_text, encoding="utf-8")
        run_sh_path.chmod(0o755)

        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> bool:
        if template_id == "default_ce11":
            raise ValueError("Cannot delete the built-in default template")
        tpl_dir = self._resolve_template_dir(template_id)
        if not tpl_dir.is_dir():
            return False
        shutil.rmtree(tpl_dir)
        return True
