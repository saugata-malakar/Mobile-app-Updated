# Deployment (`deployment/`)

**Lead:** Shivraj Gulve

Container images, Cloud Run configs, and production deployment scripts.

## Planned contents

```
deployment/
├── Dockerfile.api         # FastAPI inference service
├── Dockerfile.dashboard   # Streamlit (optional)
├── docker-compose.yml     # Local stack: API + Postgres
├── cloudrun/
│   ├── service.yaml
│   └── README.md
└── scripts/
    ├── deploy.sh
    └── push_models.sh     # Upload weights to GCS (not git)
```

## Targets

- **Google Cloud Run** — API autoscaling
- **Cloud SQL** — PostgreSQL (or managed equivalent)
- **GCS** — Model artifacts and preprocessed images

## Secrets

Use GCP Secret Manager or environment injection — never commit credentials.

## CI/CD

Build and deploy workflows can be added under `.github/workflows/deploy.yml` after tests stabilize.
