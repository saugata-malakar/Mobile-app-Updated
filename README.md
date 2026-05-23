# DiabetesCare AI

IIT Kharagpur research project for early detection of diabetic complications using smartphone imaging and machine learning.

**Clinical focus:** diabetic foot wounds (DFU), periwound skin disease, and contributing factors (pallor, external eye triage).

**Repository:** [github.com/diabetescare-ai/diabetescare-ai](https://github.com/diabetescare-ai/diabetescare-ai)

**Duration:** 6 weeks (Week 1 — setup & scaffolding)

---

## Team

| Intern | Focus | Folder |
|--------|--------|--------|
| Adreesh Mitra | Wound CV & segmentation | `cv/` |
| Kousttav Paul | Skin AI & mobile integration | `ml/skin_classifier/` |
| Shivraj Gulve | Eye models & deployment | `ml/eye_models/`, `backend/api/`, `deployment/` |
| Saugata Malakar | Privacy, DB, RAG | `backend/database/` |
| Sharif Hossain Sarkar | Wound severity AI | `ml/wound_severity/` |
| Sahil Kumar Gupta | Backend API & PostgreSQL | `backend/api/`, `backend/database/` |
| Prof. Dipak Kumar Das | PI / reviews | — |

---

## Repository layout

```
diabetescare-ai/
├── cv/                    # Computer vision (preprocessing, SAM2, coin detection)
├── ml/                    # Trained models (skin, eye, wound severity)
├── backend/               # FastAPI, database schemas, utilities
├── dashboard/             # Streamlit / internal review UIs
├── deployment/            # Docker, Cloud Run, CI deploy configs
├── docs/                  # Architecture, datasets, API contracts
├── tests/                 # Integration & cross-module tests
└── .github/workflows/     # CI (pytest on every PR)
```

**Datasets and weights are not stored in git.** Place data under `data/` and model checkpoints under `models/` (both gitignored).

---

## Quick start

```bash
# Clone
git clone https://github.com/diabetescare-ai/diabetescare-ai.git
cd diabetescare-ai

# Virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Dependencies
pip install -r requirements.txt

# Run tests
pytest tests/ cv/tests/ -v

# (Later) Start API
uvicorn backend.api.main:app --reload --port 8000

# (Later) Streamlit dashboard
streamlit run dashboard/app.py
```

---

## Git workflow

See branch naming, commit tags (`[FEATURE]`, `[BUGFIX]`, …), and PR template in team onboarding docs under `docs/`.

1. `git checkout main && git pull origin main`
2. `git checkout -b feature/your-feature-name`
3. Commit with tagged messages; run `black` and `flake8` before push
4. Open PR → request review from Prof. Dipak → CI must pass

---

## Related product codebase

The production **React Native** mobile app and **Flask** clinical API live in separate repositories (`HealthScreenApp` / `HealthScreeningApp`). This repo supplies CV/ML inference and research APIs that integrate at session submit time.

---

## Status (Week 1)

- [x] Repository scaffold
- [ ] Coin detection & preprocessing (Adreesh)
- [ ] SAM2 wound segmentation (Adreesh)
- [ ] Skin classifier EfficientNet-B3 (Kousttav)
- [ ] Eye models 3a/3b/3c (Shivraj)
- [ ] Wound severity EfficientNet-B0 (Sharif)
- [ ] FastAPI + PostgreSQL (Sahil)
- [ ] DPDP / federated PoC (Saugata)

---

*DiabetesCare AI · IIT Kharagpur · 2026*
