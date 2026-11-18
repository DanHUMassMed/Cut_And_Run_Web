# CUT&RUN Control Center (`Cut_And_Run_Web`)

React + TypeScript + Google Material UI frontend and FastAPI backend for managing CUT&RUN Nextflow projects (`experiment.config`, `samplesheet.csv`, `run.sh`, pipeline execution, and `results/`).

## Features
1. **Project Selection & Creation (`~/.config/cutandrun_web`):**
   - Create new projects by selecting a template stored in `$HOME/.config/cutandrun_web/templates/`
   - Track and switch recent project history in `$HOME/.config/cutandrun_web/projects.json`
   - Manage templates independently via the unauthenticated admin portal at `http://127.0.0.1:8000/admin`
2. **Configuration & Samplesheet Management:**
   - Edit `config/experiment.config` (paths, step toggles, peak calling, merging, deepTools, motifs, summary plots, resource limits, and differential contrasts)
   - Edit `config/samplesheet.csv` with BAM auto-discovery (`06_index_bam/*.bam`) and sample validation
3. **`run.sh` & Live Nextflow Pipeline Monitor:**
   - Edit, save, and reset `run.sh`
   - Run pre-flight environment checks
   - Launch/stop Nextflow runs (`-resume` or fresh) with real-time SSE log & task progress tracking
4. **Results Directory Manager:**
   - Browse, filter, preview (PNG/SVG, PDF, HTML, text/TSV), download, open in macOS Finder, and clean up files in `results/<experiment>/`

## Quick Start (Finder / No `make` Required)
1. Clone the repository with `git`
2. Double-click `start.command` in macOS Finder (or run `./start.command` in Terminal)
   - Automatically installs `uv` and Python 3.12 if missing
   - Syncs Python dependencies (`uv sync --no-dev`)
   - Starts the single-port server using the pre-built `backend/static/` frontend bundle and opens the default browser

## Developer Workflow (`Makefile`)
- `make install` — Bootstrap Python (`uv`) and frontend (`npm`) dependencies
- `make build` — Compile the React + MUI frontend into `backend/static/` (checked into git)
- `make start` — Start single-port FastAPI server (`http://127.0.0.1:8000`) serving both `/api/*` and the built React SPA
- `make dev` — Run FastAPI (`:8000`) and Vite HMR dev server (`:5173`) concurrently
- `make test` — Run backend (`pytest`) and frontend (`vitest`) test suites
- `make lint` — Run `ruff`, `mypy`, TypeScript typecheck, and ESLint
