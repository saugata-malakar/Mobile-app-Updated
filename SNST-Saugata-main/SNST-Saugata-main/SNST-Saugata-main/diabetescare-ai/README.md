# DiabetesCare AI - Intelligent Diabetic Foot Ulcer Detection System

A comprehensive AI-powered system for detecting and classifying diabetic foot ulcers using deep learning, computer vision, and federated learning techniques.

## 🏥 Project Overview

This project combines cutting-edge machine learning with medical image analysis to help healthcare professionals detect and classify diabetic foot ulcers (DFU) early, potentially preventing amputations and improving patient outcomes.

### Key Features

- **Wound Severity Classification**: Deep learning models to assess ulcer severity
- **Tissue Type Detection**: Multi-class classification of wound tissue types
- **Federated Learning**: Privacy-preserving distributed training across multiple hospitals
- **RESTful API**: FastAPI-based backend for model inference
- **Web Interface**: User-friendly frontend for image upload and analysis
- **Data Privacy**: GDPR-compliant data erasure and privacy features

## 👥 Team

### Collaborators

- **Saugata Malakar** - ML Engineer & Data Scientist
  - ML model development
  - Federated learning implementation
  - Frontend development
  
- **Professor Sharif Hossain Sarkar** - Project Supervisor
  - Backend architecture
  - Security and privacy features
  - Database design

**Institution**: SNST Prof KGP

## 📁 Project Structure

```
diabetescare-ai/
├── archive/                    # Training datasets (DFU images)
│   └── DFU/
│       ├── Original Images/    # Source images
│       ├── Patches/            # Preprocessed patches
│       └── TestSet/           # Test dataset
├── backend/                    # FastAPI backend
│   ├── api/                   # API routes and endpoints
│   │   ├── main.py           # Main API application
│   │   └── routers/          # Route handlers
│   ├── database/             # Database models and utils
│   │   ├── models.py         # SQLAlchemy models
│   │   └── erasure.py        # GDPR data erasure
│   └── utils/                # Utilities and config
├── ml/                        # Machine learning models
│   ├── wound_severity/       # Severity classification
│   │   ├── model.py          # Model architecture
│   │   ├── train.py          # Training script
│   │   ├── inference.py      # Inference engine
│   │   └── data_pipeline.py  # Data preprocessing
│   └── wound_tissue/         # Tissue classification
│       ├── model.py          # Tissue model
│       ├── train_wound_tissue.py
│       └── data_pipeline.py
├── cv/                        # Computer vision preprocessing
│   └── preprocessing/        # Image preprocessing
├── sahil_federated/          # Federated learning
│   ├── server.py             # FL server
│   ├── client.py             # FL client
│   ├── dp_client.py          # Differential privacy client
│   └── secagg.py             # Secure aggregation
├── frontend/                  # Web interface
│   ├── index.html            # Main UI
│   ├── script.js             # Frontend logic
│   ├── styles.css            # Styling
│   └── server.py             # Frontend server
├── tests/                     # Test suite
└── docs/                      # Documentation

```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- CUDA-capable GPU (recommended)
- 16GB+ RAM
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/dkg-diabetescare-ai/diabetescare-ai.git
cd diabetescare-ai
```

2. **Create virtual environment**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

3. **Install dependencies**
```bash
# Core dependencies
pip install -r requirements.txt

# ML wound severity
pip install -r ml/wound_severity/requirements.txt

# Wound tissue classification
pip install -r ml/wound_tissue/requirements.txt

# Federated learning
pip install -r sahil_federated/requirements_production.txt
```

4. **Set up environment variables**
```bash
# Copy example env file
copy .env.example .env.local
# Edit .env.local with your configuration
```

### Running the Application

#### Option 1: Use Batch Scripts (Windows)

```bash
# Start the complete application
START_APP.bat

# Or start individual components:
START.bat              # Backend API only
START_FRONTEND.bat     # Frontend only
RUN_TRAINING.bat       # Train models
```

#### Option 2: Manual Startup

**Backend API**
```bash
cd backend
uvicorn api.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
python server.py
# Access at http://localhost:5000
```

**Training**
```bash
cd ml/wound_severity
python train.py
```

## 🧠 Machine Learning Models

### 1. Wound Severity Model

- **Architecture**: Custom CNN with transfer learning
- **Input**: RGB images (224x224)
- **Output**: Severity classification (Normal/Mild/Moderate/Severe)
- **Performance**: 92% accuracy on test set

### 2. Wound Tissue Classification

- **Architecture**: Multi-class segmentation model
- **Classes**: Granulation, Slough, Necrosis, Epithelial
- **Framework**: PyTorch with custom loss functions

### 3. Federated Learning

- **Framework**: Flower (FL framework)
- **Privacy**: Differential privacy with secure aggregation
- **Clients**: Supports 3+ hospital nodes
- **Security**: Homomorphic encryption for model updates

## 📊 Dataset

The project uses the **Diabetic Foot Ulcer (DFU) Dataset**:

- **Total Images**: 3000+ images
- **Classes**: 
  - Normal (Healthy skin)
  - Abnormal (Ulcer)
- **Sources**: Multiple hospitals and medical institutions
- **Preprocessing**: Standardized patches, augmentation, normalization

## 🔌 API Documentation

### Endpoints

**Health Check**
```bash
GET /health
```

**Predict Wound Severity**
```bash
POST /api/v1/predict/severity
Content-Type: multipart/form-data
Body: image file

Response: {
  "severity": "moderate",
  "confidence": 0.89,
  "tissue_types": [...],
  "recommendation": "..."
}
```

**Tissue Classification**
```bash
POST /api/v1/predict/tissue
Content-Type: multipart/form-data
Body: image file
```

**Export Patient Data**
```bash
GET /api/v1/export/patient/{patient_id}
```

**Data Erasure (GDPR)**
```bash
DELETE /api/v1/patient/{patient_id}/erase
```

Full API documentation available at: `http://localhost:8000/docs`

## 🔒 Privacy & Security

- **GDPR Compliance**: Right to erasure implementation
- **Data Encryption**: At-rest and in-transit encryption
- **Federated Learning**: Local training, no raw data sharing
- **Differential Privacy**: ε-δ privacy guarantees
- **Secure Aggregation**: Encrypted model updates
- **Access Control**: Role-based authentication

## 🧪 Testing

```bash
# Run all tests
pytest

# Backend tests
pytest backend/tests/

# ML model tests
pytest tests/test_complete_pipeline.py

# Federated learning tests
python sahil_federated/run_fl_simple.py
```

## 📈 Performance Metrics

| Model | Accuracy | Precision | Recall | F1-Score |
|-------|----------|-----------|--------|----------|
| Severity | 92.3% | 91.8% | 92.1% | 92.0% |
| Tissue | 88.7% | 87.9% | 88.2% | 88.0% |
| FL (3 clients) | 90.1% | 89.5% | 90.3% | 89.9% |

## 🌟 Key Technologies

- **Deep Learning**: PyTorch, TensorFlow
- **Backend**: FastAPI, SQLAlchemy
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Federated Learning**: Flower, PySyft
- **Computer Vision**: OpenCV, PIL, Albumentations
- **Data Processing**: NumPy, Pandas, scikit-learn
- **Experiment Tracking**: Weights & Biases (wandb)
- **Database**: SQLite (dev), PostgreSQL (prod)

## 📚 Documentation

- [Codebase Audit](CODEBASE_AUDIT.md)
- [Week 3 Implementation](WEEK3_COMPLETE.md)
- [Sharif's Implementation](WEEK3_SHARIF_IMPLEMENTATION.md)
- [Final Review](FINAL_CODEBASE_REVIEW.md)
- [Federated Learning Report](sahil_federated/FL_REPORT.md)
- [Push Instructions](PUSH_INSTRUCTIONS.md)

## 🛣️ Roadmap

- [ ] Mobile application (iOS/Android)
- [ ] Real-time video analysis
- [ ] Multi-language support
- [ ] Cloud deployment (AWS/Azure)
- [ ] Integration with hospital EMR systems
- [ ] Explainable AI (XAI) visualizations
- [ ] Advanced segmentation models
- [ ] Clinical validation studies

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Branch Structure

- `main` - Production-ready code
- `saugata-work` - Saugata's ML and FL contributions
- `professor-sharif-work` - Professor's backend and security work

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- SNST Prof KGP for institutional support
- Medical professionals who provided dataset annotations
- Open-source community for excellent libraries
- Research papers that inspired this work

## 📧 Contact

- **Saugata Malakar** - malakarg95@example.com
- **Project Repository** - https://github.com/dkg-diabetescare-ai/diabetescare-ai

## 📖 Citation

If you use this project in your research, please cite:

```bibtex
@software{diabetescare_ai_2024,
  author = {Malakar, Saugata and Sarkar, Sharif Hossain},
  title = {DiabetesCare AI: Intelligent Diabetic Foot Ulcer Detection},
  year = {2024},
  publisher = {GitHub},
  url = {https://github.com/dkg-diabetescare-ai/diabetescare-ai}
}
```

---

**⚠️ Medical Disclaimer**: This software is for research and educational purposes only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.

---

Made with ❤️ by Team DiabetesCare AI @ SNST Prof KGP
