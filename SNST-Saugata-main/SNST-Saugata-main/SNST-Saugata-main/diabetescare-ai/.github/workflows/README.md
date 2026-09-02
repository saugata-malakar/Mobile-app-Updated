# GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `tests.yml` | Push/PR to `main`, `develop` | `flake8` + `pytest` on `tests/` and `cv/tests/` |

CI installs CPU-only PyTorch to keep runs fast. Full GPU training happens locally or on cloud VMs.
