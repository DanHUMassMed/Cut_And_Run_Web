#!/bin/bash
set -e

# ==================================================
# CUT&RUN Control Center Launcher
# Double-click in Finder or execute from Terminal:
#   ./start.command
# ==================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
DEFAULT_PORT="${PORT:-8000}"
PY_VERSION="${PY_VERSION:-3.12}"
PID_FILE="$HOME/.cutandrun-web.pid"
LOG_FILE="$SCRIPT_DIR/server.log"

# Ensure common user binary locations are on PATH when launched from Finder
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

pick_free_port() {
    local start_port="$1"
    for port in $(seq "$start_port" 8100); do
        if ! lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            echo "$port"
            return 0
        fi
    done
    echo "$start_port"
}

stop_previous_instance() {
    if [ -f "$PID_FILE" ]; then
        local old_pid
        old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
        if [ -n "$old_pid" ] && ps -p "$old_pid" >/dev/null 2>&1; then
            local cmd
            cmd="$(ps -p "$old_pid" -o args= 2>/dev/null || true)"
            if echo "$cmd" | grep -qi "backend.app:app"; then
                log "Stopping previous CUT&RUN Control Center instance (PID $old_pid)..."
                kill "$old_pid" 2>/dev/null || true
                for _ in {1..10}; do
                    if ! ps -p "$old_pid" >/dev/null 2>&1; then
                        break
                    fi
                    sleep 0.3
                done
            fi
        fi
        rm -f "$PID_FILE"
    fi
}

ensure_uv() {
    if ! command -v uv >/dev/null 2>&1; then
        log "Installing uv package manager..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    fi
}

sync_backend() {
    log "Syncing Python environment (Python $PY_VERSION)..."
    uv python install "$PY_VERSION"
    uv sync --no-dev
}

ensure_frontend_bundle() {
    if [ ! -f "$SCRIPT_DIR/backend/static/index.html" ]; then
        if command -v npm >/dev/null 2>&1; then
            log "Frontend bundle missing; building frontend..."
            (cd "$SCRIPT_DIR/frontend" && npm install && npm run build)
        else
            log "ERROR: backend/static/index.html is missing and npm is not installed."
            exit 1
        fi
    fi
}

cleanup() {
    if [ -n "${SERVER_PID:-}" ] && ps -p "$SERVER_PID" >/dev/null 2>&1; then
        log "Shutting down CUT&RUN Control Center (PID $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
}

trap cleanup EXIT INT TERM

log "=================================================="
log "Starting CUT&RUN Control Center"
log "Directory: $SCRIPT_DIR"
log "=================================================="

ensure_uv
sync_backend
ensure_frontend_bundle
stop_previous_instance

PORT="$(pick_free_port "$DEFAULT_PORT")"
export PORT
URL="http://${HOST}:${PORT}"

log "Launching FastAPI server at $URL ..."
: > "$LOG_FILE"
uv run --no-dev uvicorn backend.app:app --host "$HOST" --port "$PORT" > >(tee -a "$LOG_FILE") 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# Wait for server readiness before opening the browser
for _ in {1..30}; do
    if curl -fsS "${URL}/api/health" >/dev/null 2>&1; then
        break
    fi
    if ! ps -p "$SERVER_PID" >/dev/null 2>&1; then
        log "ERROR: Server exited unexpectedly. Check $LOG_FILE for details."
        exit 1
    fi
    sleep 0.3
done

if [[ "$(uname)" == "Darwin" ]]; then
    log "Opening $URL in default browser..."
    open "$URL"
fi

log "Server is running (PID $SERVER_PID). Close this window or press Ctrl+C to stop."
wait "$SERVER_PID"
