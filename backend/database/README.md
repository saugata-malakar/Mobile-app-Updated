# Database (`backend/database/`)

**Leads:** Sahil Kumar Gupta (schema), Saugata Malakar (privacy, DPDP, `ml/wound_severity/` integration)

PostgreSQL schema, migrations, and DPDP-aware data handling.

## Core tables (research schema)

| Table | Purpose |
|-------|---------|
| `patients` | Patient metadata (de-identified research IDs) |
| `wound_sessions` | Wound monitoring visits |
| `wound_measurements` | Area, depth, Wagner grade per visit |
| `skin_checks` | Skin screening records |
| `eye_exams` | Pallor / eye assessment records |
| `model_predictions` | All AI outputs + model version |

## Constraints

- `wound_site_id` required on every wound session
- Timestamps for longitudinal progression
- No raw PHI in logs; consent flags on patient rows

## Tools

- **SQLAlchemy 2.x** ORM
- **Alembic** migrations (`alembic upgrade head`)

## Files (to add)

```
database/
├── models.py
├── session.py          # engine + SessionLocal
├── migrations/         # Alembic versions
└── seed.py             # dev seed data
```

## Privacy (Saugata)

Document retention, export, and anonymization policies in `docs/DPDP.md`.
