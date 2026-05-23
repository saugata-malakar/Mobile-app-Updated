# Backend Utilities (`backend/utils/`)

Shared helpers used by `backend/api/` and training scripts.

## Planned modules

| Module | Purpose |
|--------|---------|
| `config.py` | Settings from environment (`pydantic-settings`) |
| `logging.py` | Structured logging (no PHI in log lines) |
| `image_io.py` | Safe load/save, temp file cleanup |
| `security.py` | API key / JWT validation stubs |
| `metrics.py` | Timing and inference latency hooks |

## Environment variables

See `.env.example` (to add) — never commit `.env`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `MODEL_DIR` | Path to gitignored `models/` |
| `API_KEY` | Service authentication (optional dev) |
