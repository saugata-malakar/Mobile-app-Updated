# Week 4 Quick Start Guide

**Components:** Multimodal AI + Clinical NLP  
**Owner:** Saugata Malakar

---

## Installation (5 minutes)

```bash
# 1. Install dependencies
pip install -r requirements_week4.txt

# 2. Download spaCy model (if not auto-installed)
python -m spacy download en_core_web_sm

# 3. Set up Gemini API key (optional, works without it in mock mode)
# Edit .env file:
GEMINI_API_KEY=your-key-here
```

---

## Quick Tests

### Test 1: Clinical NLP (No API key needed)

```bash
cd ml/clinical_nlp
python test_nlp_samples.py
```

**Expected:** Processes 10 doctor notes, extracts wound locations, infection signs, and treatment recommendations.

### Test 2: Multimodal Gemini (Works in mock mode without API key)

```bash
cd ml/multimodal
python test_gemini_20_cases.py
```

**Expected:** Processes 20 test cases, returns mock severity assessments.

---

## Start API Server

```bash
# From project root
cd backend
uvicorn api.main:app --reload --port 8000
```

**Note:** You may need to register the new routers in `backend/api/main.py`:

```python
from api.routers import multimodal, clinical_nlp

app.include_router(multimodal.router)
app.include_router(clinical_nlp.router)
```

---

## Test API Endpoints

### 1. Check Health

```bash
# Multimodal API
curl http://localhost:8000/api/v1/multimodal/health

# Clinical NLP API
curl http://localhost:8000/api/v1/nlp/health
```

### 2. Test Clinical NLP Extraction

```bash
curl -X POST "http://localhost:8000/api/v1/nlp/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "note_text": "Patient presents with ulcer on left foot with cellulitis. Start IV antibiotics and daily dressing changes.",
    "patient_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

### 3. Test Multimodal Analysis (requires image)

```bash
curl -X POST "http://localhost:8000/api/v1/multimodal/analyze" \
  -F "image=@wound_photo.jpg" \
  -F "patient_id=123e4567-e89b-12d3-a456-426614174000" \
  -F "hba1c=9.2" \
  -F "diabetes_duration=12" \
  -F "systolic_bp=145" \
  -F "diastolic_bp=92" \
  -F "age=58" \
  -F "gender=male"
```

---

## API Documentation

Visit: http://localhost:8000/docs

Interactive Swagger UI with all endpoints and examples.

---

## File Locations

```
ml/multimodal/              - Gemini multimodal AI
ml/clinical_nlp/            - spaCy NLP pipeline
backend/api/routers/        - API endpoints
  ├── multimodal.py
  └── clinical_nlp.py
backend/database/models.py  - Database models (ClinicalNote, MultimodalAnalysis)
```

---

## Next Steps

1. **Register routers** in main FastAPI app
2. **Run database migration** to create new tables
3. **Implement database storage** (currently mocked)
4. **Get Gemini API key** for production use
5. **Test end-to-end** with real data

---

## Need Help?

- See `WEEK4_SAUGATA.md` for complete documentation
- Check test scripts for usage examples
- Visit `/docs` for interactive API testing

**Status:** ✅ Ready for integration and testing
