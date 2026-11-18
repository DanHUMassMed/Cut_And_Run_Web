.PHONY: install build dev start test lint clean

PORT ?= 8000
HOST ?= 127.0.0.1

install:
	uv sync
	cd frontend && npm install

build:
	cd frontend && npm run build

dev:
	@trap 'kill 0' INT TERM; \
	uv run uvicorn backend.app:app --host $(HOST) --port $(PORT) --reload & \
	cd frontend && npm run dev

start:
	uv run uvicorn backend.app:app --host $(HOST) --port $(PORT)

test:
	uv run pytest
	cd frontend && npm run test

lint:
	uv run ruff check backend
	uv run mypy backend
	cd frontend && npm run typecheck && npm run lint

clean:
	rm -rf .venv .pytest_cache .mypy_cache .ruff_cache frontend/node_modules
