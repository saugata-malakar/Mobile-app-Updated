# API (`backend/api/`)

**Leads:** Sahil Kumar Gupta, Shivraj Gulve

FastAPI application exposing REST endpoints for ML inference and research data collection.

## Planned structure

```
api/
├── main.py              # FastAPI app factory
├── routers/
│   ├── health.py        # GET /health
│   ├── wound.py         # POST /v1/wound/*
│   ├── skin.py          # POST /v1/skin/classify
│   └── eye.py           # POST /v1/eye/*
└── schemas/             # Pydantic request/response models
```

## Planned endpoints (Wound)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/wound/preprocess` | Denoise + CLAHE |
| POST | `/v1/wound/detect-coin` | Coin localization |
| POST | `/v1/wound/segment` | SAM2 mask + area cm² |
| POST | `/v1/wound/classify` | Wagner + tissue + infection |

## Auth

JWT or API-key for service-to-service calls from the clinical platform (TBD Week 2).

## Docs

Interactive OpenAPI: `http://localhost:8000/docs`
