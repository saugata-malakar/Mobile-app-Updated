# Integration Tests (`tests/`)

Cross-module and API-level tests (not unit tests inside `cv/tests/`).

## Scope

| Area | Examples |
|------|----------|
| API | `GET /health`, schema validation |
| Pipeline | Mock end-to-end wound path (stub images) |
| Database | Migration smoke, model CRUD (with test DB) |

## Run

```bash
# All project tests
pytest tests/ cv/tests/ -v

# With coverage
pytest tests/ cv/tests/ --cov=cv --cov=ml --cov=backend
```

## Fixtures

Shared fixtures in `tests/conftest.py` and images in `tests/fixtures/`.

## CI

GitHub Actions runs this suite on every push/PR — see `.github/workflows/tests.yml`.
