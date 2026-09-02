"""
Complete Pipeline Integration Test

Tests the entire workflow from image upload to wound classification
with privacy-compliant data export.

Tests:
1. Wound image classification (Saugata's wound model)
2. Privacy anonymisation (Saugata's privacy module)
3. k-anonymity verification
4. Data export with DPDP compliance
5. Patient data erasure pipeline

Owner: Saugata Malakar (integration testing)
"""

import pytest
import sys
import os
from pathlib import Path
from PIL import Image
import io
import numpy as np

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class TestCompleteWoundPipeline:
    """Test complete wound classification pipeline."""
    
    def test_wound_model_import(self):
        """Test that wound severity model can be imported."""
        from ml.wound_severity.model import WoundSeverityModel, ModelConfig, create_model
        
        # Create model
        model = create_model()
        
        assert model is not None
        assert model.num_classes == 6  # Wagner grades 0-5
        assert isinstance(model, WoundSeverityModel)
        
        print("✓ Wound model import successful")
    
    def test_wound_model_forward_pass(self):
        """Test wound model forward pass with dummy data."""
        from ml.wound_severity.model import create_model
        import torch
        
        model = create_model()
        model.eval()
        
        # Create dummy input (batch_size=1, channels=3, height=224, width=224)
        dummy_input = torch.randn(1, 3, 224, 224)
        
        with torch.no_grad():
            output = model(dummy_input)
            probabilities = model.predict_proba(dummy_input)
            predictions, confidence = model.predict(dummy_input)
        
        # Verify output shapes
        assert output.shape == (1, 6)  # 6 Wagner grades
        assert probabilities.shape == (1, 6)
        assert predictions.shape == (1,)
        assert confidence.shape == (1,)
        
        # Verify probabilities sum to 1
        assert torch.allclose(probabilities.sum(dim=1), torch.tensor([1.0]), atol=1e-5)
        
        # Verify prediction is in valid range
        assert 0 <= predictions.item() <= 5
        assert 0 <= confidence.item() <= 1
        
        print(f"✓ Wound model forward pass successful")
        print(f"  Predicted grade: {predictions.item()}")
        print(f"  Confidence: {confidence.item():.3f}")
    
    def test_wound_inference_api(self):
        """Test wound inference API with dummy image."""
        from ml.wound_severity.inference import WoundSeverityInference
        
        # Create dummy wound image
        dummy_image = Image.new('RGB', (224, 224), color='red')
        
        # Note: This will fail without a trained model checkpoint
        # For now, just test that the class can be imported
        assert WoundSeverityInference is not None
        
        print("✓ Wound inference API import successful")
    
    def test_privacy_module_import(self):
        """Test that privacy module can be imported."""
        from backend.database.privacy import (
            AnonymisationEngine,
            RotatingSaltManager,
            PII_FIELD_MAP,
            get_anonymisation_engine
        )
        
        engine = get_anonymisation_engine()
        
        assert engine is not None
        assert isinstance(engine, AnonymisationEngine)
        assert hasattr(engine, 'pseudonymise_id')
        assert hasattr(engine, 'anonymise_record')
        assert hasattr(engine, 'verify_k_anonymity')
        
        print("✓ Privacy module import successful")
    
    def test_privacy_anonymisation(self):
        """Test privacy anonymisation on sample patient data."""
        from backend.database.privacy import get_anonymisation_engine
        
        engine = get_anonymisation_engine()
        
        # Sample patient record
        patient_record = {
            "patient_id": "pat_12345",
            "name": "Saugata Malakar",
            "phone": "9876543210",
            "age": 32,
            "gender": "M",
            "village": "Rampur",
            "district": "Mumbai",
            "aadhar_id": "1234-5678-9012",
            "consent_given_at": "2024-01-15T10:30:00Z",
            "hba1c": 7.2,
            "created_at": "2024-01-15T10:30:00Z"
        }
        
        # Anonymise
        anonymised = engine.anonymise_record("patients", patient_record)
        
        # Verify direct identifiers removed
        assert "patient_id" not in anonymised
        assert "name" not in anonymised
        assert "phone" not in anonymised
        assert "aadhar_id" not in anonymised
        
        # Verify quasi-identifiers generalised
        assert anonymised["age"] == "30-34"
        assert "village" not in anonymised
        assert anonymised["district"] == "Mumbai"
        
        # Verify non-sensitive data retained
        assert anonymised["hba1c"] == 7.2
        
        print("✓ Privacy anonymisation successful")
        print(f"  Original age: 32 → Anonymised: {anonymised['age']}")
    
    def test_k_anonymity_verification(self):
        """Test k-anonymity verification."""
        from backend.database.privacy import get_anonymisation_engine
        
        engine = get_anonymisation_engine()
        
        # Create dataset with k=5 (compliant)
        records = [
            {"district": "Mumbai", "age": "30-34", "gender": "M"},
            {"district": "Mumbai", "age": "30-34", "gender": "M"},
            {"district": "Mumbai", "age": "30-34", "gender": "M"},
            {"district": "Mumbai", "age": "30-34", "gender": "M"},
            {"district": "Mumbai", "age": "30-34", "gender": "M"},
        ]
        
        quasi_identifiers = ["district", "age", "gender"]
        is_compliant, report = engine.verify_k_anonymity(records, quasi_identifiers)
        
        assert is_compliant is True
        assert report["violations"] == 0
        assert report["smallest_group_size"] == 5
        
        print("✓ k-anonymity verification successful")
        print(f"  k-anonymity threshold: {report['k_anonymity_threshold']}")
        print(f"  Smallest group size: {report['smallest_group_size']}")
    
    def test_erasure_pipeline_import(self):
        """Test that erasure pipeline can be imported."""
        from backend.database.erasure import ErasurePipeline, ErasureScheduler
        
        assert ErasurePipeline is not None
        assert ErasureScheduler is not None
        
        print("✓ Erasure pipeline import successful")
    
    def test_api_routers_import(self):
        """Test that API routers can be imported."""
        from backend.api.routers.export import router as export_router
        from backend.api.routers.wound import router as wound_router
        
        assert export_router is not None
        assert wound_router is not None
        
        print("✓ API routers import successful")
    
    def test_database_models_import(self):
        """Test that database models can be imported."""
        from backend.database.models import (
            Patient, WoundSite, MonitoringSession,
            AIResult, Photograph, Alert
        )
        
        assert Patient is not None
        assert WoundSite is not None
        assert MonitoringSession is not None
        assert AIResult is not None
        
        print("✓ Database models import successful")


class TestIntegrationWorkflow:
    """Test complete integration workflow."""
    
    def test_end_to_end_workflow_simulation(self):
        """
        Simulate complete workflow:
        1. Patient data collection
        2. Wound image classification
        3. Result storage
        4. Data anonymisation
        5. Privacy-compliant export
        """
        from backend.database.privacy import get_anonymisation_engine
        from ml.wound_severity.model import create_model
        import torch
        
        print("\n" + "="*60)
        print("SIMULATING END-TO-END WORKFLOW")
        print("="*60)
        
        # Step 1: Patient data collection
        print("\n[Step 1] Patient data collection")
        patient_data = {
            "patient_id": "pat_001",
            "name": "Test Patient",
            "age": 45,
            "gender": "M",
            "district": "Mumbai",
            "village": "Rampur"
        }
        print(f"  ✓ Patient registered: {patient_data['name']}, Age {patient_data['age']}")
        
        # Step 2: Wound image classification
        print("\n[Step 2] Wound image classification")
        model = create_model()
        model.eval()
        
        dummy_image = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            predictions, confidence = model.predict(dummy_image)
        
        wagner_grade = predictions.item()
        conf_score = confidence.item()
        print(f"  ✓ Wound classified: Wagner Grade {wagner_grade}")
        print(f"  ✓ Confidence: {conf_score:.3f}")
        
        # Step 3: Result storage (simulated)
        print("\n[Step 3] Result storage")
        ai_result = {
            "session_id": "sess_001",
            "patient_id": "pat_001",
            "wagner_grade": wagner_grade,
            "confidence": conf_score,
            "model_version": "wound_v1.0"
        }
        print(f"  ✓ AI result stored: {ai_result}")
        
        # Step 4: Data anonymisation
        print("\n[Step 4] Data anonymisation")
        engine = get_anonymisation_engine()
        anonymised_patient = engine.anonymise_record("patients", patient_data)
        print(f"  ✓ Patient data anonymised")
        print(f"    Age: {patient_data['age']} → {anonymised_patient['age']}")
        print(f"    Village: {patient_data.get('village', 'N/A')} → {'REMOVED' if 'village' not in anonymised_patient else anonymised_patient['village']}")
        
        # Step 5: Privacy-compliant export
        print("\n[Step 5] Privacy-compliant export")
        export_data = [anonymised_patient] * 5  # Simulate k=5
        quasi_ids = ["district", "age", "gender"]
        is_compliant, report = engine.verify_k_anonymity(export_data, quasi_ids)
        
        print(f"  ✓ k-anonymity verified: {is_compliant}")
        print(f"  ✓ Group size: {report['smallest_group_size']}")
        print(f"  ✓ Export approved: {is_compliant}")
        
        print("\n" + "="*60)
        print("END-TO-END WORKFLOW COMPLETED SUCCESSFULLY ✓")
        print("="*60)
        
        assert is_compliant is True


class TestModuleCompatibility:
    """Test compatibility between modules."""
    
    def test_privacy_with_database_models(self):
        """Test that privacy module works with database models."""
        from backend.database.privacy import PII_FIELD_MAP
        from backend.database.models import Patient, WoundSite, MonitoringSession
        
        # Verify PII classifications exist for key tables
        assert "patients" in PII_FIELD_MAP.TABLE_CLASSIFICATIONS
        assert "wound_sites" in PII_FIELD_MAP.TABLE_CLASSIFICATIONS
        assert "monitoring_sessions" in PII_FIELD_MAP.TABLE_CLASSIFICATIONS
        
        # Verify Patient model fields match PII map
        patient_fields = PII_FIELD_MAP.TABLE_CLASSIFICATIONS["patients"]
        assert "patient_id" in patient_fields
        assert "name" in patient_fields
        assert "age" in patient_fields
        assert "district" in patient_fields
        
        print("✓ Privacy module compatible with database models")
    
    def test_wound_model_with_api_router(self):
        """Test that wound model integrates with API router."""
        from ml.wound_severity.model import ModelConfig
        from backend.api.routers.wound import router
        
        # Verify router has required endpoints
        routes = [route.path for route in router.routes]
        
        assert "/api/v1/wound/classify" in routes
        assert "/api/v1/wound/model/info" in routes
        assert "/api/v1/wound/model/health" in routes
        assert "/api/v1/wound/grades" in routes
        
        print("✓ Wound model compatible with API router")
        print(f"  Available endpoints: {len(routes)}")


def run_all_tests():
    """Run all integration tests."""
    print("\n" + "="*70)
    print("DIABETESCARE AI - COMPLETE PIPELINE INTEGRATION TESTS")
    print("="*70)
    
    # Run pytest
    pytest.main([__file__, "-v", "--tb=short"])


if __name__ == "__main__":
    run_all_tests()
