# 📅 DAY 1 COMPLETION GUIDE

**Owner:** Sharif Hossain Sarkar (implemented by Saugata Malakar)  
**Date:** Week 1, Day 1  
**Estimated Time:** 5 hours

---

## 🎯 Objectives

Complete all Week 1 deliverables for wound severity model:

1. ✅ DataPipeline class (unit tested)
2. ✅ Class distribution charts
3. ✅ W&B project live and shared

---

## 📋 Prerequisites

### 1. Dataset
Ensure the DFU dataset is in place:
```
archive/DFU/
├── Patches/
│   ├── Abnormal(Ulcer)/     # 512 images
│   └── Normal(Healthy skin)/ # Normal images
├── Original Images/          # 493 images
└── TestSet/                  # 170+ images
```

### 2. Python Environment
```bash
# Create virtual environment (if not already done)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Navigate to wound_severity directory
cd ml/wound_severity
```

---

## 🚀 Quick Start (Automated)

### Option 1: Run Everything Automatically

```bash
# Install dependencies
pip install -r requirements.txt

# Run all Day 1 tasks
python run_day1.py
```

This will:
1. Test setup (dependencies, dataset)
2. Run data pipeline (generate charts)
3. Setup Weights & Biases

**Time:** ~15 minutes (including W&B setup)

---

## 🔧 Manual Steps (If Automated Fails)

### Step 1: Install Dependencies (10 minutes)

```bash
pip install -r requirements.txt
```

**Verify installation:**
```bash
python test_setup.py
```

Expected output:
```
✅ torch
✅ torchvision
✅ timm
✅ wandb
✅ numpy
✅ pandas
✅ PIL
✅ matplotlib
✅ seaborn
✅ sklearn
✅ tqdm
```

---

### Step 2: Run Data Pipeline (30 minutes)

```bash
python data_pipeline.py
```

**What it does:**
1. Loads DFU dataset from `archive/DFU/`
2. Splits into train (70%), val (15%), test (15%)
3. Applies augmentation (rotation, brightness, zoom, flip, noise)
4. Generates class distribution charts
5. Saves metadata to JSON
6. Runs unit tests

**Expected output:**
```
🚀 WOUND SEVERITY DATA PIPELINE - WEEK 1 DELIVERABLE
====================================================================

🧪 RUNNING UNIT TESTS FOR DATA PIPELINE
====================================================================

[Test 1] Loading dataset...
✅ Dataset loaded: 715 images

[Test 2] Checking image shape...
✅ Image shape correct: (3, 224, 224)

[Test 3] Validating labels...
✅ Label valid: 0 (Wagner Grade)

[Test 4] Checking normalization...
✅ Pixel values normalized: min=-2.12, max=2.64

[Test 5] Computing class distribution...
✅ Class distribution:
0    358
1    357
dtype: int64

[Test 6] Computing class weights...
✅ Class weights computed: tensor([1.0000, 1.0014])

[Test 7] Testing DataLoader...
✅ DataLoader works: batch shape (4, 3, 224, 224)

[Test 8] Testing all splits...
✅ All splits work:
   Train: 715 (70.0%)
   Val: 153 (15.0%)
   Test: 154 (15.0%)

====================================================================
✅ ALL TESTS PASSED!
====================================================================

📊 GENERATING DELIVERABLES
====================================================================

[1/4] Creating train/val/test splits...
TRAIN split: 715 images
VAL split: 153 images
TEST split: 154 images

[2/4] Plotting class distribution...
✅ Class distribution chart saved to outputs/class_distribution_train.png

[3/4] Saving dataset metadata...
✅ Dataset metadata saved to outputs/dataset_metadata.json

[4/4] Summary:
  Total images: 1022
  Train: 715 images
  Val: 153 images
  Test: 154 images

====================================================================
✅ WEEK 1 DELIVERABLES COMPLETE!
====================================================================

Generated files:
  1. outputs/class_distribution_train.png
  2. outputs/class_distribution_val.png
  3. outputs/class_distribution_test.png
  4. outputs/dataset_metadata.json
```

**Generated files:**
- `outputs/class_distribution_train.png` - Training set distribution
- `outputs/class_distribution_val.png` - Validation set distribution
- `outputs/class_distribution_test.png` - Test set distribution
- `outputs/dataset_metadata.json` - Dataset metadata

---

### Step 3: Setup Weights & Biases (15 minutes)

```bash
python setup_wandb.py
```

**What it does:**
1. Logs in to W&B (requires API key)
2. Initializes project `diabetescare-wound-severity`
3. Logs dataset metadata
4. Logs class distribution charts
5. Generates shareable project URL

**First-time setup:**
1. Go to https://wandb.ai/authorize
2. Copy your API key
3. Paste when prompted

**Expected output:**
```
🔧 WEIGHTS & BIASES SETUP
====================================================================

[1/5] Logging in to W&B...
✅ Logged in to W&B

[2/5] Initializing W&B project...
✅ Project initialized: diabetescare-wound-severity
   Run URL: https://wandb.ai/your-entity/diabetescare-wound-severity/runs/abc123

[3/5] Logging dataset metadata...
✅ Dataset metadata logged

[4/5] Logging class distribution charts...
✅ Logged outputs/class_distribution_train.png
✅ Logged outputs/class_distribution_val.png
✅ Logged outputs/class_distribution_test.png

[5/5] Sharing project...

📊 W&B Project URL: https://wandb.ai/your-entity/diabetescare-wound-severity/runs/abc123
   Project: diabetescare-wound-severity
   Entity: your-entity

🔗 Share this link with the analytics engineer:
   https://wandb.ai/your-entity/diabetescare-wound-severity

✅ Project info saved to outputs/wandb_project_info.json

====================================================================
✅ W&B SETUP COMPLETE!
====================================================================
```

**Generated files:**
- `outputs/wandb_project_info.json` - W&B project details

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] `outputs/` directory exists with 5 files:
  - [ ] `class_distribution_train.png`
  - [ ] `class_distribution_val.png`
  - [ ] `class_distribution_test.png`
  - [ ] `dataset_metadata.json`
  - [ ] `wandb_project_info.json`

- [ ] W&B project is live and accessible

- [ ] All unit tests passed

- [ ] Dataset split is correct:
  - [ ] Train: ~70%
  - [ ] Val: ~15%
  - [ ] Test: ~15%

---

## 📊 Deliverables Summary

### 1. DataPipeline Class ✅
**File:** `data_pipeline.py`

**Features:**
- Loads DFU dataset from `archive/DFU/`
- 70/15/15 train/val/test split
- Augmentation: rotation ±30°, brightness ±20%, zoom 0.8-1.2×, flip, noise
- ImageNet normalization
- Weighted loss calculation
- Unit tested (8 tests)

**Usage:**
```python
from data_pipeline import WoundDataPipeline

train_dataset = WoundDataPipeline(split="train")
val_dataset = WoundDataPipeline(split="val")
test_dataset = WoundDataPipeline(split="test")
```

### 2. Class Distribution Charts ✅
**Files:**
- `outputs/class_distribution_train.png`
- `outputs/class_distribution_val.png`
- `outputs/class_distribution_test.png`

**Shows:**
- Number of images per Wagner grade
- Visual representation of class imbalance
- Used for weighted loss calculation

### 3. W&B Project ✅
**Project:** `diabetescare-wound-severity`

**Logged:**
- Dataset metadata (total images, split sizes)
- Class distributions (train/val/test)
- Augmentation parameters
- Normalization parameters

**Share with analytics engineer:**
```
https://wandb.ai/[your-entity]/diabetescare-wound-severity
```

---

## 🐛 Troubleshooting

### Issue: Dataset not found
**Error:** `FileNotFoundError: Abnormal directory not found`

**Solution:**
```bash
# Check dataset location
ls -la ../../archive/DFU/Patches/

# Expected structure:
# archive/DFU/Patches/Abnormal(Ulcer)/
# archive/DFU/Patches/Normal(Healthy skin)/
```

### Issue: W&B login fails
**Error:** `wandb.errors.UsageError: api_key not configured`

**Solution:**
```bash
# Login manually
wandb login

# Or set API key
export WANDB_API_KEY=your_api_key_here
```

### Issue: Out of memory
**Error:** `RuntimeError: CUDA out of memory`

**Solution:**
```python
# Reduce batch size in data_pipeline.py
# Change num_workers=4 to num_workers=0
loader = DataLoader(dataset, batch_size=16, num_workers=0)
```

### Issue: Missing dependencies
**Error:** `ModuleNotFoundError: No module named 'timm'`

**Solution:**
```bash
pip install -r requirements.txt
```

---

## 📝 Next Steps

After completing Day 1:

1. **Share W&B project** with analytics engineer
   - Send project URL from `outputs/wandb_project_info.json`

2. **Review class distribution**
   - Check `outputs/class_distribution_*.png`
   - Note class imbalance (will use weighted loss)

3. **Verify dataset split**
   - Check `outputs/dataset_metadata.json`
   - Confirm train/val/test sizes

4. **Prepare for Week 2**
   - Model training (EfficientNet-B0)
   - Target: ≥75% top-1 accuracy
   - Export TFLite + ONNX

---

## 📞 Support

**Issues?** Contact:
- **Owner:** Sharif Hossain Sarkar (implemented by Saugata Malakar)
- **PI:** Prof. Dipak Kumar Das
- **Repository:** github.com/dkg-diabetescare-ai/diabetescare-ai

---

## 🎉 Completion

Once all deliverables are complete:

```bash
# Verify everything
python test_setup.py

# Check outputs
ls -la outputs/

# Expected files:
# - class_distribution_train.png
# - class_distribution_val.png
# - class_distribution_test.png
# - dataset_metadata.json
# - wandb_project_info.json
```

**Status:** ✅ Week 1 Complete! Ready for Week 2 training.
