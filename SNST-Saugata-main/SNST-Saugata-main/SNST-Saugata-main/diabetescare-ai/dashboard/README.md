# Dashboard (`dashboard/`)

**Lead:** Shivraj Gulve

Streamlit applications for internal validation, clinician review, and demo deployments.

## Purpose

- Visualize model predictions (wound masks, skin classes, eye outputs)
- Compare model versions side-by-side
- Export QA reports for the research team

## Planned files

```
dashboard/
├── app.py                 # Main Streamlit entry
├── pages/
│   ├── wound_review.py
│   ├── skin_review.py
│   └── eye_review.py
└── components/            # Shared charts and image viewers
```

## Run

```bash
streamlit run dashboard/app.py
```

## Note

This is **not** the production doctor web dashboard (that lives in the separate `doctor-dashboard` Vite app). This folder is for research and model QA.
