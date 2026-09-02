# Week 4 - Saugata's Part: Multimodal AI + Clinical NLP

**Owner:** Saugata Malakar  
**Week:** 4  
**Status:** ✅ Complete (Ready for Testing)

---

## Overview

Week 4 Saugata's deliverables focus on enhancing AI capabilities through:

1. **Multimodal Gemini Integration**: Combining wound photographs with clinical data (HbA1c, diabetes duration, blood pressure) for richer severity assessment
2. **Clinical NLP Pipeline**: Extracting structured entities from doctor's free-text consultation notes using spaCy

---

## Component 1: Multimodal AI with Gemini 1.5 Pro Vision

### Purpose
Current AI models analyze only wound photographs. This multimodal approach enriches the analysis by incorporating clinical data, providing more comprehensive and personalized assessments.

### Architecture

```
Input:
├── Wound Photograph (Image)
├── HbA1c Level (%)
├── Diabetes Duration (years)
├── Blood Pressure (systolic/diastolic mmHg)
└── Optional: Age, Gender

    ↓ [Gemini 1.5 Pro Vision API]

Output (Structured JSON):
├── Severity Grade (Wagner 0-5)
├── Confidence Score (0-1)
├── Tissue Assessment
├── Infection Risk (low/moderate/high/critical)
├── Healing Prognosis (excellent/good/fair/poor/very_poor)
├── Clinical Insights (list)
├── Risk Factors (list)
├── Immediate Actions (list)
├── Follow-up Days (1-30)
└── Specialist Referral Required (bool)
```

### Implementation

**Location:** `ml/multimodal/gemini_multimodal.py`

**Key Classes:**

1. **GeminiMultimodalAPI**
   - Initializes Gemini 1.5 Pro Vision model
   - Builds comprehensive prompt combining clinical context
   - Handles JSON parsing from model response
   - Provides mock mode when API key not available

2. **MultimodalAnalysisRequest**
   - Input data class
   - Validates clinical data ranges
   
3. **MultimodalAnalysisResponse**
   - Structured output data class
   - Complete assessment results

**Features:**

- ✅ Comprehensive prompt engineering considering:
  - HbA1c impact on healing (target <7% for diabetics)
  - Disease duration correlation with complications
  - Vascular health indicators from BP
  - Wagner grading system (0-5)
  
- ✅ Mock mode for testing without API key
- ✅ Batch processing support
- ✅ Detailed clinical insights generation
- ✅ Automatic risk stratification

### API Endpoint

**Router:** `backend/api/routers/multimodal.py`

**Endpoints:**

#### 1. POST /api/v1/multimodal/analyze

Analyze single case with photograph + clinical data.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  ```
  image: File (JPEG/PNG)
  patient_id: str (UUID)
  hba1c: float (4.0-15.0)
  diabetes_duration: int (0-60 years)
  systolic_bp: int (70-250 mmHg)
  diastolic_bp: int (40-150 mmHg)
  session_id: str (optional, UUID)
  age: int (optional)
  gender: str (optional)
  ```

**Response:**
```json
{
  "analysis_id": "uuid",
  "patient_id": "uuid",
  "severity_grade": 3,
  "severity_label": "Grade 3: Deep ulcer with abscess or osteomyelitis",
  "confidence": 0.87,
  "tissue_assessment": "Mixed granulation and necrotic tissue",
  "infection_risk": "high",
  "healing_prognosis": "poor",
  "clinical_insights": [
    "HbA1c of 9.2% indicates poor glycemic control",
    "Long diabetes duration increases complication risk"
  ],
  "risk_factors": ["Elevated HbA1c", "Hypertension"],
  "immediate_actions": [
    "Start IV antibiotics immediately",
    "Surgical debridement required"
  ],
  "follow_up_days": 3,
  "specialist_referral": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### 2. GET /api/v1/multimodal/health

Check API status and availability.

**Response:**
```json
{
  "status": "ready",
  "gemini_available": true,
  "model_initialized": true,
  "model_name": "gemini-1.5-pro",
  "message": "Multimodal API is operational"
}
```

### Testing

**Test Script:** `ml/multimodal/test_gemini_20_cases.py`

- Tests 20 diverse sample cases
- Covers various severity grades (1-5)
- Tests different clinical scenarios:
  - Well-controlled diabetes
  - Poorly controlled diabetes
  - Young vs elderly patients
  - Various BP ranges
  - Short vs long disease duration

**Run Tests:**
```bash
cd ml/multimodal
python test_gemini_20_cases.py
```

**Expected Output:**
- ✓ All 20 cases processed successfully
- Severity distribution across grades
- Average confidence scores
- Mock mode confirmation (if API key not set)

### Configuration

**Environment Variable:**
```bash
GEMINI_API_KEY=your-google-ai-api-key-here
```

Add to `.env` file or set in environment.

**Get API Key:**
1. Visit: https://makersuite.google.com/app/apikey
2. Create new API key
3. Add to `.env` file

**Mock Mode:**
- If `GEMINI_API_KEY` not set, runs in mock mode
- Mock responses based on clinical data thresholds
- Useful for testing without API access

---

## Component 2: Clinical NLP Pipeline

### Purpose
Doctors write free-text consultation notes. This pipeline extracts structured entities to enable:
- Automated data entry
- Better searchability
- Trend analysis
- Clinical decision support

### Architecture

```
Input: Free-text doctor notes
    ↓
[spaCy NLP Pipeline]
    ├── Tokenization
    ├── POS Tagging
    ├── Dependency Parsing
    └── Custom Entity Ruler (60+ patterns)
    ↓
Output: Structured Entities
    ├── wound_location (e.g., "left foot", "plantar surface")
    ├── infection_sign (e.g., "cellulitis", "purulent discharge")
    └── treatment_recommendation (e.g., "IV antibiotics", "debridement")
```

### Implementation

**Location:** `ml/clinical_nlp/clinical_nlp_pipeline.py`

**Key Components:**

1. **ClinicalNLPPipeline Class**
   - Loads spaCy model (`en_core_web_sm`)
   - Adds custom entity ruler with 60+ medical patterns
   - Processes notes and extracts entities
   - Removes duplicates
   
2. **Custom Entity Patterns** (60+ patterns)

   **Wound Locations (30+ patterns):**
   - Specific: "left foot", "right toe", "heel"
   - Anatomical: "plantar surface", "dorsal surface", "medial malleolus"
   - Toes: "first toe", "great toe", "big toe"
   - Regions: "forefoot", "midfoot", "hindfoot"
   
   **Infection Signs (20+ patterns):**
   - Direct: "cellulitis", "erythema", "purulent discharge", "pus"
   - Descriptive: "foul odor", "malodorous", "spreading redness"
   - Clinical: "abscess", "necrosis", "gangrene", "osteomyelitis"
   - Systemic: "fever", "elevated wbc", "leukocytosis", "sepsis"
   
   **Treatment Recommendations (30+ patterns):**
   - Antibiotics: "IV antibiotics", "oral antibiotics", "broad spectrum"
   - Debridement: "sharp debridement", "surgical debridement"
   - Wound care: "daily dressing change", "hydrogel dressing", "VAC therapy"
   - Offloading: "cast boot", "wheelchair", "non-weight bearing"
   - Referrals: "vascular surgery consult", "podiatry referral"
   - Imaging: "X-ray foot", "MRI scan", "bone scan"

### API Endpoint

**Router:** `backend/api/routers/clinical_nlp.py`

**Endpoints:**

#### 1. POST /api/v1/nlp/extract

Extract entities from single clinical note.

**Request:**
```json
{
  "note_text": "Patient presents with ulcer on left foot...",
  "patient_id": "uuid (optional)",
  "session_id": "uuid (optional)",
  "doctor_id": "uuid (optional)"
}
```

**Response:**
```json
{
  "note_id": "uuid",
  "patient_id": "uuid",
  "original_text": "Patient presents with...",
  "wound_locations": ["left foot", "plantar surface"],
  "infection_signs": ["cellulitis", "purulent discharge", "fever"],
  "treatment_recommendations": [
    "IV antibiotics",
    "surgical debridement",
    "daily dressing changes"
  ],
  "entity_count": {
    "wound_locations": 2,
    "infection_signs": 3,
    "treatment_recommendations": 3
  },
  "extracted_at": "2024-01-15T10:30:00Z",
  "nlp_model_version": "en_core_web_sm"
}
```

#### 2. POST /api/v1/nlp/extract-batch

Batch extraction from multiple notes (up to 50).

**Request:**
```json
{
  "notes": [
    {
      "note_text": "Patient presents...",
      "patient_id": "uuid"
    }
  ]
}
```

**Response:**
```json
{
  "total_notes": 10,
  "successful": 10,
  "failed": 0,
  "results": [...]
}
```

#### 3. GET /api/v1/nlp/health

Check NLP API status.

**Response:**
```json
{
  "status": "ready",
  "model_loaded": true,
  "model_name": "en_core_web_sm",
  "pattern_count": 60,
  "message": "Clinical NLP API is operational"
}
```

### Testing

**Test Script:** `ml/clinical_nlp/test_nlp_samples.py`

**Features:**
- Tests 10 diverse clinical cases
- Covers various severity levels:
  - Case 1: Moderate ulcer with infection
  - Case 2: Severe gangrene requiring amputation
  - Case 3: Healing ulcer
  - Case 4: Acute infected ulcer
  - Case 5: Multiple ulcers, complex case
  - Case 6: Post-operative follow-up
  - Case 7: Early stage ulcer
  - Case 8: Chronic ulcer with osteomyelitis
  - Case 9: Good vascular supply
  - Case 10: Multiple comorbidities

**Run Tests:**
```bash
cd ml/clinical_nlp
python test_nlp_samples.py
```

**Expected Output:**
- Processes all 10 cases
- Displays extracted entities for each
- Summary statistics:
  - Total entities extracted
  - Average per case
- Saves detailed results to `nlp_test_results.json`

### Configuration

**spaCy Model Installation:**
```bash
# Install spaCy
pip install spacy

# Download model
python -m spacy download en_core_web_sm
```

Or use `requirements_week4.txt`:
```bash
pip install -r requirements_week4.txt
```

---

## Database Models

### ClinicalNote Model

Stores doctor's notes and NLP output.

**Table:** `clinical_notes`

**Fields:**
- `note_id`: UUID (Primary Key)
- `patient_id`: UUID (Foreign Key → patients)
- `session_id`: UUID (Foreign Key → monitoring_sessions)
- `doctor_id`: UUID (Foreign Key → doctors)
- `original_text`: Text (free-text note)
- `wound_locations`: JSON (extracted locations)
- `infection_signs`: JSON (extracted signs)
- `treatment_recommendations`: JSON (extracted treatments)
- `extracted_at`: DateTime
- `nlp_model_version`: String
- `created_at`, `updated_at`: DateTime

### MultimodalAnalysis Model

Stores Gemini multimodal analysis results.

**Table:** `multimodal_analyses`

**Fields:**
- `analysis_id`: UUID (Primary Key)
- `patient_id`: UUID (Foreign Key → patients)
- `session_id`: UUID (Foreign Key → monitoring_sessions)
- Clinical inputs: `hba1c`, `diabetes_duration_years`, `systolic_bp`, `diastolic_bp`
- Gemini outputs: `severity_grade`, `severity_label`, `confidence`, `tissue_assessment`, `infection_risk`, `healing_prognosis`
- Structured data: `clinical_insights` (JSON), `risk_factors` (JSON), `immediate_actions` (JSON)
- Metadata: `follow_up_days`, `specialist_referral`, `raw_response`, `model_name`
- `created_at`: DateTime

**Location:** `backend/database/models.py`

**Migration Required:** Yes (add new tables to database)

---

## Installation & Setup

### 1. Install Dependencies

```bash
# Install Week 4 requirements
pip install -r requirements_week4.txt

# Or install individually
pip install google-generativeai spacy Pillow
python -m spacy download en_core_web_sm
```

### 2. Configure Environment

Edit `.env` file:
```bash
# Week 4 - Multimodal AI
GEMINI_API_KEY=your-google-ai-api-key-here
```

### 3. Database Migration

```bash
# Run migrations to add new tables
# (Migration script to be created)
alembic revision --autogenerate -m "Add Week 4 tables"
alembic upgrade head
```

### 4. Test Components

**Test Multimodal AI:**
```bash
cd ml/multimodal
python test_gemini_20_cases.py
```

**Test Clinical NLP:**
```bash
cd ml/clinical_nlp
python test_nlp_samples.py
```

### 5. Start API Server

```bash
cd backend
uvicorn api.main:app --reload --port 8000
```

**Access API Docs:** http://localhost:8000/docs

---

## API Integration Examples

### Example 1: Multimodal Analysis

```python
import requests

# Upload image + clinical data
files = {'image': open('wound_photo.jpg', 'rb')}
data = {
    'patient_id': '123e4567-e89b-12d3-a456-426614174000',
    'hba1c': 9.2,
    'diabetes_duration': 12,
    'systolic_bp': 145,
    'diastolic_bp': 92,
    'age': 58,
    'gender': 'male'
}

response = requests.post(
    'http://localhost:8000/api/v1/multimodal/analyze',
    files=files,
    data=data
)

result = response.json()
print(f"Severity: Grade {result['severity_grade']}")
print(f"Infection Risk: {result['infection_risk']}")
print(f"Specialist Referral: {result['specialist_referral']}")
```

### Example 2: Clinical NLP Extraction

```python
import requests

note = """
Patient presents with ulcer on left foot, plantar surface. 
Signs of cellulitis with purulent discharge noted.
Recommendations: Start IV antibiotics, surgical debridement required.
"""

response = requests.post(
    'http://localhost:8000/api/v1/nlp/extract',
    json={
        'note_text': note,
        'patient_id': '123e4567-e89b-12d3-a456-426614174000'
    }
)

result = response.json()
print(f"Wound Locations: {result['wound_locations']}")
print(f"Infection Signs: {result['infection_signs']}")
print(f"Treatments: {result['treatment_recommendations']}")
```

---

## File Structure

```
diabetescare-ai/
├── ml/
│   ├── multimodal/
│   │   ├── __init__.py
│   │   ├── gemini_multimodal.py         # Gemini API integration
│   │   └── test_gemini_20_cases.py      # Test script (20 cases)
│   │
│   └── clinical_nlp/
│       ├── __init__.py
│       ├── clinical_nlp_pipeline.py     # spaCy NLP pipeline
│       └── test_nlp_samples.py          # Test script (10 cases)
│
├── backend/
│   ├── api/
│   │   └── routers/
│   │       ├── multimodal.py            # Multimodal API endpoints
│   │       └── clinical_nlp.py          # Clinical NLP API endpoints
│   │
│   ├── database/
│   │   └── models.py                    # Added: ClinicalNote, MultimodalAnalysis
│   │
│   └── utils/
│       └── config.py                    # Added: GEMINI_API_KEY
│
├── requirements_week4.txt                # Week 4 dependencies
└── WEEK4_SAUGATA.md                     # This documentation
```

---

## Performance Considerations

### Multimodal AI
- **Latency:** ~2-5 seconds per analysis (depends on Gemini API)
- **Cost:** ~$0.001 per image analysis (Gemini pricing)
- **Concurrency:** Rate limits apply (check Google AI quotas)
- **Mock Mode:** Instant response for testing without API key

### Clinical NLP
- **Latency:** <100ms per note
- **Throughput:** 100+ notes/second
- **Memory:** ~500MB for spaCy model
- **Scaling:** Highly parallel, no external API calls

---

## Integration with Week 4 Sharif's Part

Week 4 consists of two complementary parts:

**Sharif's Part (Inference Pipeline):**
- Batch inference endpoint
- CV preprocessing → SAM2 → severity → tissue
- Week 2 & 3 API integration
- Gemini fallback for low confidence

**Saugata's Part (This Document):**
- Multimodal Gemini (photo + clinical data)
- Clinical NLP for doctor notes

**How They Work Together:**

```
Monitoring Session:
├── 1. ASHA worker takes 3 photos
│   ↓
├── 2. Sharif's Pipeline: /api/v1/infer/woundlive
│   ├── CV preprocessing
│   ├── SAM2 segmentation
│   ├── Severity + Tissue classification
│   └── Output: severity_grade, tissue_colour, wound_area
│       ↓
├── 3. Saugata's Multimodal: /api/v1/multimodal/analyze
│   ├── Take best photo + clinical data (HbA1c, BP, duration)
│   ├── Gemini 1.5 Pro Vision analysis
│   └── Output: infection_risk, healing_prognosis, clinical_insights
│       ↓
├── 4. Doctor reviews, writes notes
│   ↓
└── 5. Saugata's NLP: /api/v1/nlp/extract
    ├── Extract entities from doctor's notes
    └── Store structured data
```

---

## Testing Checklist

### Multimodal AI
- [ ] Install google-generativeai package
- [ ] Set GEMINI_API_KEY in .env (or test in mock mode)
- [ ] Run test_gemini_20_cases.py
- [ ] Verify 20 cases processed successfully
- [ ] Test API endpoint with curl/Postman
- [ ] Check /health endpoint returns "ready"
- [ ] Upload test image and verify response structure

### Clinical NLP
- [ ] Install spacy and en_core_web_sm model
- [ ] Run test_nlp_samples.py
- [ ] Verify all 10 cases processed
- [ ] Check nlp_test_results.json created
- [ ] Test API endpoint with sample note
- [ ] Check /health endpoint shows 60+ patterns
- [ ] Verify entities extracted correctly

### Database
- [ ] Add new models to models.py (✓ Done)
- [ ] Create database migration
- [ ] Run migration
- [ ] Verify tables created: clinical_notes, multimodal_analyses
- [ ] Test database storage (currently mocked)

### Integration
- [ ] Register multimodal router in main FastAPI app
- [ ] Register clinical_nlp router in main FastAPI app
- [ ] Test end-to-end flow
- [ ] Verify API documentation at /docs
- [ ] Test error handling (invalid inputs)

---

## Known Limitations & Future Work

### Current Limitations

1. **Database Storage:** Currently mocked, needs implementation
2. **Batch Analysis:** Endpoint defined but not fully implemented
3. **Image Storage:** Multimodal analysis doesn't store images permanently
4. **Authentication:** No auth on new endpoints yet
5. **Rate Limiting:** No rate limiting on Gemini API calls

### Future Enhancements

1. **Expand NLP Patterns:** Add more medical terminology
2. **Multi-language Support:** Hindi/regional language notes
3. **Confidence Scoring:** Add confidence to NLP extractions
4. **Entity Relationships:** Extract relationships between entities
5. **Temporal Analysis:** Track entity changes over time
6. **Integration with EHR:** Export to standard formats (HL7 FHIR)

---

## Troubleshooting

### Gemini API Issues

**Problem:** "Gemini not available" error  
**Solution:** 
```bash
pip install google-generativeai
export GEMINI_API_KEY=your-key-here
```

**Problem:** API quota exceeded  
**Solution:** Check Google AI Studio quotas, upgrade plan if needed

**Problem:** JSON parsing errors  
**Solution:** Check prompt response format, may need to adjust extraction logic

### spaCy NLP Issues

**Problem:** "Model en_core_web_sm not found"  
**Solution:**
```bash
python -m spacy download en_core_web_sm
```

**Problem:** Low entity extraction accuracy  
**Solution:** Review and add more patterns to entity ruler

**Problem:** Slow processing  
**Solution:** Reduce max_length or use GPU acceleration

---

## Credits

**Developer:** Saugata Malakar  
**Week:** 4  
**Project:** DiabetesCare AI - Diabetic Foot Ulcer Detection System  
**Institution:** IIT Kharagpur  

**Components:**
1. Multimodal Gemini Integration (Gemini 1.5 Pro Vision)
2. Clinical NLP Pipeline (spaCy)

**Testing:** 20 multimodal cases + 10 NLP sample notes

---

## Appendix: API Response Examples

### Multimodal Analysis Response (Full)

```json
{
  "analysis_id": "323e4567-e89b-12d3-a456-426614174002",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "session_id": "223e4567-e89b-12d3-a456-426614174001",
  "severity_grade": 3,
  "severity_label": "Grade 3: Deep ulcer with abscess or osteomyelitis",
  "confidence": 0.87,
  "tissue_assessment": "Mixed granulation tissue (40%) with yellow slough (40%) and black necrotic tissue (20%). Signs of infection present with periph cellulitis.",
  "infection_risk": "high",
  "healing_prognosis": "poor",
  "clinical_insights": [
    "HbA1c of 9.2% indicates poor glycemic control, significantly impairing wound healing capacity",
    "Diabetes duration of 12 years suggests advanced microvascular complications and neuropathy",
    "Blood pressure 145/92 mmHg indicates inadequate vascular health, contributing to poor perfusion",
    "Combination of poor glycemic control and hypertension creates high-risk scenario for complications",
    "Urgent optimization of both glucose and BP control is critical for healing"
  ],
  "risk_factors": [
    "Severely elevated HbA1c (9.2%)",
    "Long-standing diabetes (12 years)",
    "Uncontrolled hypertension (145/92)",
    "Likely peripheral neuropathy",
    "Microvascular complications",
    "Impaired wound healing capacity"
  ],
  "immediate_actions": [
    "Start broad-spectrum IV antibiotics immediately",
    "Arrange urgent surgical debridement of necrotic tissue",
    "Initiate aggressive glycemic control protocol (target <7%)",
    "Optimize blood pressure management",
    "Daily wound dressings with antimicrobial agents",
    "Strict non-weight bearing on affected limb",
    "Monitor for systemic infection signs"
  ],
  "follow_up_days": 3,
  "specialist_referral": true,
  "timestamp": "2024-01-15T10:30:00.123456Z",
  "model_name": "gemini-1.5-pro"
}
```

### Clinical NLP Extraction Response (Full)

```json
{
  "note_id": "423e4567-e89b-12d3-a456-426614174003",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "session_id": "223e4567-e89b-12d3-a456-426614174001",
  "doctor_id": "323e4567-e89b-12d3-a456-426614174002",
  "original_text": "58-year-old male diabetic patient presents with chronic ulcer on left foot, plantar surface near the first toe. Wound measuring 3x2 cm with surrounding cellulitis extending approximately 4 cm. Purulent discharge noted with foul odor. Patient reports fever since yesterday.\n\nPhysical exam reveals erythema, warmth, and tenderness. Wound probing shows depth extending to tendon level. No exposed bone palpable.\n\nAssessment: Wagner Grade 2 diabetic foot ulcer with signs of active infection.\n\nPlan:\n- Start broad spectrum IV antibiotics (Piperacillin-Tazobactam)\n- Arrange surgical debridement for tomorrow\n- Daily dressing changes with silver foam dressing\n- Non-weight bearing on left foot, wheelchair for mobility\n- X-ray left foot to rule out osteomyelitis\n- Optimize glycemic control, target HbA1c <7%\n- Refer to vascular surgery for arterial assessment",
  "wound_locations": [
    "left foot",
    "plantar surface",
    "first toe"
  ],
  "infection_signs": [
    "cellulitis",
    "purulent discharge",
    "foul odor",
    "fever",
    "erythema",
    "warmth"
  ],
  "treatment_recommendations": [
    "IV antibiotics",
    "surgical debridement",
    "daily dressing changes",
    "silver dressing",
    "non weight bearing",
    "wheelchair",
    "X-ray foot",
    "optimize glycemic control",
    "refer to vascular"
  ],
  "entity_count": {
    "wound_locations": 3,
    "infection_signs": 6,
    "treatment_recommendations": 9
  },
  "extracted_at": "2024-01-15T10:30:00.123456Z",
  "nlp_model_version": "en_core_web_sm"
}
```

---

**End of Week 4 Saugata's Documentation**
