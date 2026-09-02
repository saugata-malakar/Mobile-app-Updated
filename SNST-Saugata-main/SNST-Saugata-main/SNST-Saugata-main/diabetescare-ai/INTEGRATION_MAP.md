# Week 4 Integration Map - How Everything Connects

**Date**: June 7, 2026  
**Status**: ✅ INTEGRATED

---

## 🔗 How Week 4 Reuses Existing Code

### Pipeline Flow

```
User uploads 3 images
       ↓
POST /api/v1/infer/woundlive (Week 4 endpoint)
       ↓
WoundInferencePipeline (Week 4 class)
       ↓
   ┌───────────────────────────────┐
   │  For Each Image:              │
   │                               │
   │  1. SAM2 Segmentation         │
   │     (Week 4 - new)            │
   │         ↓                     │
   │  2. Severity Prediction       │
   │     ├─→ WoundSeverityAPI      │
   │     │   (Week 2 - REUSED)     │
   │     │   ml/wound_severity/    │
   │     │   inference.py          │
   │     └─→ Returns Wagner grade  │
   │         & confidence           │
   │         ↓                     │
   │  3. Tissue Prediction         │
   │     ├─→ TissueInferenceAPI    │
   │     │   (Week 3 - REUSED)     │
   │     │   ml/wound_tissue/      │
   │     │   inference.py          │
   │     └─→ Returns tissue type   │
   │         & confidence           │
   │         ↓                     │
   │  4. Periwound Detection       │
   │     ├─→ TissueInferenceAPI    │
   │     │   (Week 3 - REUSED)     │
   │     │   infer_periwound()     │
   │     └─→ Returns redness bool  │
   │         ↓                     │
   │  5. Check Confidence          │
   │     ├─→ If < 0.7:             │
   │     │   Gemini Fallback       │
   │     │   (Week 4 - new)        │
   │     └─→ Improve confidence    │
   └───────────────────────────────┘
       ↓
  JSON Response with all 3 results
```

---

## 📂 File Integration

### Week 2 Files (Saugata - Wound Severity) - REUSED

```
ml/wound_severity/
├── model.py                    ← Model definition
├── inference.py                ← WoundSeverityAPI ✅ USED BY WEEK 4
│   └── classify_wound()        ← Returns Wagner grade
├── train.py
└── data_pipeline.py

backend/api/routers/
└── wound.py                    ← Original severity endpoint
    └── /api/v1/wound/classify  ← Single image prediction
```

**Week 4 Uses**:
- `ml.wound_severity.inference.WoundSeverityAPI`
- Method: `classify_wound(image_data=PIL.Image)`
- Returns: `{"wagner_grade": int, "confidence": float}`

---

### Week 3 Files (Sharif - Tissue Classification) - REUSED

```
ml/wound_tissue/
├── model.py                    ← WoundTissueCNN
├── inference.py                ← TissueInferenceAPI ✅ USED BY WEEK 4
│   ├── infer_tissue()          ← Returns tissue type
│   └── infer_periwound()       ← Returns redness bool
├── trainer.py
└── data_pipeline.py

backend/api/routers/
└── tissue.py                   ← Tissue endpoints
    ├── /api/v1/wound/tissue    ← Tissue classification
    └── /api/v1/wound/periwound ← Periwound detection
```

**Week 4 Uses**:
- `ml.wound_tissue.inference.TissueInferenceAPI`
- Methods:
  - `infer_tissue(image)` → tissue type & confidence
  - `infer_periwound(image)` → redness bool & confidence

---

### Week 4 Files (Sharif - Batch Pipeline) - NEW

```
backend/api/routers/
└── wound_inference.py          ← NEW: Week 4 pipeline
    ├── WoundInferencePipeline  ← Main pipeline class
    │   ├── __init__()          ← Initializes Week 2 & 3 APIs
    │   ├── segment_wound()     ← SAM2 segmentation (new)
    │   ├── predict_severity()  ← Calls Week 2 API
    │   ├── predict_tissue()    ← Calls Week 3 API
    │   ├── detect_periwound()  ← Calls Week 3 API
    │   ├── gemini_fallback()   ← New fallback logic
    │   ├── analyze_single()    ← Process 1 image
    │   └── analyze_batch()     ← Process 3 images
    │
    └── POST /api/v1/infer/woundlive  ← NEW endpoint
        └── Batch inference (3 photos)
```

---

## 🎯 API Endpoints Summary

### Week 2 Endpoint (Still Works)
```bash
POST /api/v1/wound/classify
- Input: 1 image
- Output: Wagner grade + confidence
- Owner: Saugata (Week 2)
```

### Week 3 Endpoints (Still Work)
```bash
POST /api/v1/wound/tissue
- Input: 1 image
- Output: Tissue type + confidence
- Owner: Sharif (Week 3)

POST /api/v1/wound/periwound
- Input: 1 image
- Output: Redness detection
- Owner: Sharif (Week 3)
```

### Week 4 Endpoint (NEW - Combines Everything)
```bash
POST /api/v1/infer/woundlive
- Input: 3 images (batch)
- Output: Complete analysis for all 3
  - Severity grade (from Week 2 API)
  - Tissue type (from Week 3 API)
  - Periwound redness (from Week 3 API)
  - Wound area (new - SAM2)
  - Gemini fallback flag (new)
- Owner: Sharif (Week 4)
- Latency: ≤6 seconds for all 3 images
```

---

## 🔧 Configuration (backend/utils/config.py)

```python
class Settings:
    # Week 2 - Severity model
    WOUND_MODEL_PATH: str = "./models/wound_severity_best.pth"
    
    # Week 3 - Tissue models
    WOUND_TISSUE_MODEL_PATH: str = "./models/wound_tissue_best.pth"
    PERIWOUND_MODEL_PATH: str = "./models/periwound_best.pth"
    
    # Common
    INFERENCE_DEVICE: str = "cpu"
    ENABLE_INFERENCE: bool = True
```

---

## 🧩 How Integration Works

### 1. Week 4 Initializes Week 2 & 3 APIs

```python
# In wound_inference.py
class WoundInferencePipeline:
    def __init__(self):
        # Load Week 2 API
        from ml.wound_severity.inference import WoundSeverityAPI
        self.severity_api = WoundSeverityAPI(...)
        
        # Load Week 3 API
        from ml.wound_tissue.inference import TissueInferenceAPI
        self.tissue_api = TissueInferenceAPI(...)
```

### 2. Week 4 Calls Existing APIs

```python
# Predict severity using Week 2
async def predict_severity(self, image):
    result = self.severity_api.classify_wound(image_data=image)
    return result["wagner_grade"], result["confidence"]

# Predict tissue using Week 3
async def predict_tissue(self, image):
    result = self.tissue_api.infer_tissue(image)
    return result["prediction"]["class_name"], result["prediction"]["confidence"]

# Detect periwound using Week 3
async def detect_periwound(self, image):
    result = self.tissue_api.infer_periwound(image)
    return result["prediction"]["is_redness"]
```

### 3. Week 4 Adds New Features

- **SAM2 Segmentation**: Wound boundary detection & area calculation
- **Batch Processing**: Handle 3 images at once
- **Gemini Fallback**: Low-confidence improvement
- **Combined JSON**: All results in one response

---

## 📊 What Each Week Contributes

| Week | Owner | Contribution | Status |
|------|-------|--------------|--------|
| **Week 2** | Saugata | Severity model + API | ✅ Done - REUSED by Week 4 |
| **Week 3** | Sharif | Tissue/periwound + API | ✅ Done - REUSED by Week 4 |
| **Week 4** | Sharif | Batch pipeline + integration | ✅ Done - USES Week 2 & 3 |

---

## 🚀 Testing Integration

```bash
# 1. Start backend
python backend/api/main.py

# Should see:
# [router] ✓ Wound inference router registered (Week 2)
# [router] ✓ Wound tissue router registered (Week 3)
# [router] ✓ Week 4 wound inference pipeline registered

# 2. Test Week 2 endpoint (still works)
curl -X POST http://localhost:8000/api/v1/wound/classify \
  -F "image=@wound1.jpg"

# 3. Test Week 3 endpoint (still works)
curl -X POST http://localhost:8000/api/v1/wound/tissue \
  -F "image=@wound1.jpg"

# 4. Test Week 4 endpoint (NEW - uses both)
curl -X POST http://localhost:8000/api/v1/infer/woundlive \
  -F "files=@wound1.jpg" \
  -F "files=@wound2.jpg" \
  -F "files=@wound3.jpg"
```

---

## ✅ Integration Benefits

1. **No Code Duplication**: Week 4 reuses Week 2 & 3 inference logic
2. **Backward Compatible**: Old endpoints still work
3. **Modular**: Each week's code is independent
4. **Testable**: Can test each week separately
5. **Maintainable**: Changes to Week 2/3 automatically benefit Week 4

---

## 🎯 Key Integration Points

```python
# Week 4 depends on:
from ml.wound_severity.inference import WoundSeverityAPI  # Week 2
from ml.wound_tissue.inference import TissueInferenceAPI  # Week 3

# Week 4 does NOT duplicate:
- Model architectures (uses existing)
- Preprocessing logic (uses existing)
- Inference code (calls existing APIs)

# Week 4 ADDS:
- Batch processing (3 images at once)
- SAM2 segmentation
- Combined JSON response
- Gemini fallback
- Latency optimization
```

---

## 📝 Summary

**Week 4 is NOT a replacement** - it's an **integration layer** that:

1. ✅ Uses Week 2's severity model via `WoundSeverityAPI`
2. ✅ Uses Week 3's tissue models via `TissueInferenceAPI`
3. ✅ Adds batch processing (3 photos)
4. ✅ Adds SAM2 segmentation
5. ✅ Adds Gemini fallback
6. ✅ Combines everything into one endpoint

**All 3 weeks work together** - no conflicts, proper integration!

---

**Status**: ✅ FULLY INTEGRATED  
**Tested**: ✅ All endpoints work  
**On GitHub**: ✅ Pushed to diabetescare-ai-complete branch
