# CV Tests (`cv/tests/`)

Unit tests for the computer vision pipeline.

## Scope

- Coin detection (success, missing coin, invalid path)
- Preprocessing (output shape, dtype)
- Segmentation helpers (mask area sanity checks with synthetic fixtures)

## Run

```bash
pytest cv/tests/ -v
pytest cv/tests/test_coin_detection.py -v   # single file
```

## Fixtures

Place small synthetic or anonymized images in `tests/fixtures/` at repo root (not full DFUC dataset).

CI runs these via `.github/workflows/tests.yml`.
