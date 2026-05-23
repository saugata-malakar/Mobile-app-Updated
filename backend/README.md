# Backend (`backend/`)

**Leads:** Sahil Kumar Gupta (API + DB), Shivraj Gulve (inference routes), Saugata Malakar (privacy / compliance / wound severity ML)

FastAPI service layer, PostgreSQL schemas, and shared utilities for the research and inference platform.

## Subfolders

| Folder | Purpose |
|--------|---------|
| `api/` | FastAPI app, routers, request/response models |
| `database/` | SQLAlchemy models, Alembic migrations, seed scripts |
| `utils/` | Auth helpers, logging, image I/O, config |

## Run locally (after implementation)

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/diabetescare
uvicorn backend.api.main:app --reload --port 8000
```

## Alignment with product API

The production mobile app uses a separate Flask API (`HealthScreeningApp`). This FastAPI service should expose **compatible inference contracts** (wound submit, skin classify, eye predict) for eventual integration or sidecar deployment.
