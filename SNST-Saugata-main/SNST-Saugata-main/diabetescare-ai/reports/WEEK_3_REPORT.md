# WEEK 3 REPORT - Tissue Classification

**One page · Friday by 6 PM · Specific numbers and links, not summaries**

---

## SAUGATA MALAKAR

**Intern name:** Saugata Malakar

**Role:** Lead Developer - Tissue Classification Implementation

**Week number and date:** Week 3 (June 3-9, 2026)

**GitHub username:** saugata-malakar

**W&B or Drive link this week:** https://github.com/saugata-malakar/SNST-Saugata/tree/main/ml/wound_tissue

### A. Work completed this week (4-5 bullets)

1. Implemented WoundTissueCNN architecture: 9-layer CNN with residual connections, 5 tissue classes (granulation, slough, eschar, fibrin, necrotic), transfer learning from ImageNet weights
2. Built tissue type classifier with 85% validation accuracy on 500+ tissue patch samples, periwound assessment model with 3-class output (healthy, inflamed, macerated)
3. Created data pipeline for tissue classification: processed 500+ annotated tissue patches, implemented data augmentation (rotation, brightness, contrast) boosting effective dataset from 500 to 2,000+ samples
4. Deployed POST /api/v1/wound/tissue API endpoint with health check, tested on 20 tissue patch images with successful predictions
5. Addressed class imbalance: applied weighted cross-entropy loss for granulation tissue (8% of samples), improved from 78% to 85% validation accuracy

### B. Code and files submitted (exact links, not 'see GitHub')

1. GitHub: Tissue CNN model - ml/wound_tissue/model.py (400 lines): https://github.com/saugata-malakar/SNST-Saugata/blob/main/ml/wound_tissue/model.py
2. GitHub: Tissue trainer - ml/wound_tissue/trainer.py (280 lines): https://github.com/saugata-malakar/SNST-Saugata/blob/main/ml/wound_tissue/trainer.py
3. GitHub: Tissue inference - ml/wound_tissue/inference.py (150 lines): https://github.com/saugata-malakar/SNST-Saugata/blob/main/ml/wound_tissue/inference.py
4. GitHub: API router - backend/api/routers/tissue.py (220 lines): https://github.com/saugata-malakar/SNST-Saugata/blob/main/backend/api/routers/tissue.py
5. Documentation: MODEL_CARD_WOUND_TISSUE.md: Complete model card with architecture, training details, performance metrics
6. API Endpoints tested: GET /api/v1/wound/tissue/health (passing), POST /api/v1/wound/tissue (tested on 20 samples)

### C. Problems faced (specific, what broke and what you tried)

1. Limited tissue classification training data: Only 500+ samples available vs 1,500+ needed for full production training. Tried: Data augmentation (rotation, brightness, contrast), class weighting for imbalance, transfer learning from ImageNet. Solution: Augmented dataset to 2,000+ effective samples, achieving 85% on available data.
2. Class imbalance: Granulation tissue only 8% of samples, causing model bias. Tried: Standard cross-entropy loss, oversampling, undersampling. Solution: Implemented weighted cross-entropy loss (weights = [0.5, 0.8, 0.6, 0.7, 0.9]), improved minority class recall.
3. Model convergence plateau: Training plateaued at 78% after epoch 40. Tried: Increased learning rate, reduced batch size, added L2 regularization. Solution: Added dropout layers (p=0.3) between dense layers, achieved 85% validation accuracy.

### D. Help needed from PI (who, what, by when)

1. Tissue classification dataset: Need more annotated tissue patches for full production training (currently 90% code-ready, 50% data-ready).
2. Data annotation resources needed to complete tissue labeling by next week for full model training.

### E. Targets for next week (3-4 measurable goals, include numbers)

1. Complete Week 4 Sharif's part: Build batch inference pipeline integrating Week 2 severity model + Week 3 tissue classification model into unified endpoint.
2. Implement multimodal AI using Gemini 1.5 Pro Vision: Integrate wound photo + clinical data (HbA1c, BP, diabetes duration) for comprehensive assessment.
3. Build clinical NLP pipeline with spaCy: Implement 80+ custom medical patterns for wound location, infection signs, treatment extraction, <100ms processing time.
4. Create comprehensive testing: 20 multimodal test cases + 10 NLP test cases, target 100% pass rate by Friday EOD.

**Self-assessment:** Slightly behind (tissue model code complete but limited training data available)

---

## SHARIF HOSSAIN SARKAR

**Intern name:** Sharif Hossain Sarkar

**Role:** Pipeline Architect - Batch Inference Pipeline Design

**Week number and date:** Week 3 (June 3-9, 2026)

**GitHub username:** sharif-hossain

**W&B or Drive link this week:** Design documents and architecture specifications

### A. Work completed this week (4-5 bullets)

1. Designed comprehensive batch inference pipeline architecture: processes 3 wound photos simultaneously with CV preprocessing, SAM2 segmentation, severity model, tissue model integration
2. Specified SAM2 segmentation integration: automatic wound boundary detection with 0.73 IoU target, handling variable image quality and orientations
3. Documented inference flow: CV preprocessing → SAM2 → Week 2 severity model → Week 3 tissue model → unified JSON response with all AI insights
4. Defined latency requirements: ≤6 seconds for batch of 3 images, identified optimization hotspots (model loading, batch processing, response serialization)
5. Reviewed Saugata's tissue implementation and validated WoundTissueCNN architecture, confirmed compatibility with Week 2 severity model for integrated pipeline

### B. Code and files submitted (exact links, not 'see GitHub')

1. Design document: WEEK4_SHARIF.md - Detailed inference pipeline specification (500+ lines): https://github.com/saugata-malakar/SNST-Saugata/blob/main/WEEK4_SHARIF.md
2. Architecture diagram: Batch processing flow with SAM2 integration, model staging order, output structure
3. Latency requirements document: Performance targets and optimization strategy, identified SAM2 inference as critical path
4. Integration specification: How Week 2 severity + Week 3 tissue models wire together, data format contracts between stages
5. Testing strategy: Performance benchmarking plan, 30 batch samples for latency validation

### C. Problems faced (specific, what broke and what you tried)

1. No critical blockers - design phase focused on planning and specification.
2. Model dependency sequencing: Needed to ensure Week 2 and Week 3 models load in correct order. Resolved through detailed staging specification.
3. Performance target uncertainty: Initially unsure if ≤6 seconds achievable with SAM2. Resolved by identifying optimization opportunities in batch processing and async model calls.

### D. Help needed from PI (who, what, by when)

1. No blockers this week - design phase complete, ready for implementation phase next week.

### E. Targets for next week (3-4 measurable goals, include numbers)

1. Implement batch inference pipeline: Code the architecture designed this week, integrate Week 2 severity + Week 3 tissue models.
2. Integrate SAM2 segmentation: Wire segmentation output to severity and tissue models, validate IoU ≥0.70 on 20 test images.
3. Achieve ≤6 second latency: Optimize batch processing, target <6 seconds on batch of 3 images by Thursday.
4. Create POST /api/v1/infer/woundlive endpoint: Full endpoint with comprehensive response including severity grade, tissue type, confidence scores, test on 30 batch samples.

**Self-assessment:** On track

