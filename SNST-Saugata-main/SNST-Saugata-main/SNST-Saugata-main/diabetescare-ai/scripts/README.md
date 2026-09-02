# Scripts

## `integrate-existing-apps.sh`

Copies the existing product codebases into this monorepo **without overwriting** files that are already present.

| Source | Destination |
|--------|-------------|
| `HealthScreenApp/` | `mobile-app/` |
| `HealthScreeningApp/backend/` | `backend/legacy/` |
| `HealthScreeningApp/doctor-dashboard/` | `doctor-dashboard/` |

### Usage

```bash
cd /Users/dipak/diabetescare-ai
chmod +x scripts/integrate-existing-apps.sh

# Preview what would be copied
./scripts/integrate-existing-apps.sh --dry-run

# Run integration
./scripts/integrate-existing-apps.sh
```

### Custom paths

```bash
SRC_MOBILE=/path/to/HealthScreenApp \
SRC_BACKEND=/path/to/backend \
SRC_DOCTOR=/path/to/doctor-dashboard \
DEST_REPO=/path/to/diabetescare-ai \
./scripts/integrate-existing-apps.sh
```

### Excluded from copy

`node_modules/`, `venv/`, `.venv/`, `__pycache__/`, `.env`, `secrets/`, `.git/`, Android/iOS build dirs, and other caches (see script).

### Logs

Each run writes logs under `scripts/integration-logs/`.
