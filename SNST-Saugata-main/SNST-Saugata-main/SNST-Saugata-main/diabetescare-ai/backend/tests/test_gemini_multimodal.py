"""
Unit and integration tests for Multimodal Gemini Integration (Part 10).

Validates:
- Pydantic validation on well-formed responses.
- 2-retry mechanism on malformed JSON outputs.
- 3-case live integration check (gated by GEMINI_API_KEY env).
- 20-case test harness verification.
"""

import os
import json
import base64
import pytest
import asyncio
from unittest.mock import MagicMock, patch
from pydantic import ValidationError
import numpy as np

from ml.multimodal.gemini_multimodal import GeminiMultimodalAPI, GeminiWoundAssessment


# Dummy base64 single-pixel image (JPEG)
MOCK_BASE64_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

# Sample clinical metadata
MOCK_METADATA = {
    "hba1c": 8.5,
    "diabetes_duration_years": 10,
    "systolic_bp": 140,
    "diastolic_bp": 85
}


@pytest.mark.asyncio
async def test_pydantic_validation_well_formed():
    """Test that well-formed response parses successfully into GeminiWoundAssessment model."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "wound_severity_assessment": "Wagner Grade 2 deep ulcer with tendon exposure.",
        "confidence_level": "high",
        "recommended_action": "Urgent referral to podiatrist within 24 hours.",
        "clinical_flags": ["peripheral_neuropathy", "tendon_exposure"]
    })
    
    api = GeminiMultimodalAPI(api_key="fake_key")
    
    # Mock generate_content
    with patch.object(api, 'model') as mock_model:
        mock_model.generate_content.return_value = mock_response
        
        assessment = await api.analyze_base64_and_metadata(MOCK_BASE64_IMAGE, MOCK_METADATA)
        
        assert isinstance(assessment, GeminiWoundAssessment)
        assert assessment.confidence_level == "high"
        assert assessment.clinical_flags == ["peripheral_neuropathy", "tendon_exposure"]
        assert mock_model.generate_content.call_count == 1


@pytest.mark.asyncio
async def test_retry_on_malformed_json_recovery():
    """Test that a malformed JSON response triggers retry and recovers successfully on subsequent try."""
    mock_response_malformed = MagicMock()
    mock_response_malformed.text = "This is not valid JSON string"
    
    mock_response_well_formed = MagicMock()
    mock_response_well_formed.text = json.dumps({
        "wound_severity_assessment": "Wagner Grade 1 superficial ulcer.",
        "confidence_level": "medium",
        "recommended_action": "Clean wound base and apply foam dressing.",
        "clinical_flags": ["erythema"]
    })
    
    api = GeminiMultimodalAPI(api_key="fake_key")
    
    # Mock generate_content to return malformed first, then well-formed
    with patch.object(api, 'model') as mock_model:
        mock_model.generate_content.side_effect = [
            mock_response_malformed,
            mock_response_well_formed
        ]
        
        # Patch sleep to keep tests fast
        with patch("asyncio.sleep", return_value=None):
            assessment = await api.analyze_base64_and_metadata(MOCK_BASE64_IMAGE, MOCK_METADATA)
            
            assert isinstance(assessment, GeminiWoundAssessment)
            assert assessment.confidence_level == "medium"
            assert mock_model.generate_content.call_count == 2  # 1 initial + 1 retry


@pytest.mark.asyncio
async def test_retry_failure_exhaustion():
    """Test that retry loop throws after 3 failed attempts."""
    mock_response_malformed = MagicMock()
    mock_response_malformed.text = "Malformed output"
    
    api = GeminiMultimodalAPI(api_key="fake_key")
    
    with patch.object(api, 'model') as mock_model:
        mock_model.generate_content.return_value = mock_response_malformed
        
        with patch("asyncio.sleep", return_value=None):
            with pytest.raises(Exception):
                await api.analyze_base64_and_metadata(MOCK_BASE64_IMAGE, MOCK_METADATA)
                
            assert mock_model.generate_content.call_count == 3  # 1 initial + 2 retries


@pytest.mark.asyncio
async def test_live_api_integration_gate():
    """Integration test on real Gemini API gated by GEMINI_API_KEY presence."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        pytest.skip("Skipping live integration test (GEMINI_API_KEY not set).")
        
    api = GeminiMultimodalAPI(api_key=api_key)
    
    # Test cases representing 3 real clinical scenarios
    scenarios = [
        {"hba1c": 6.2, "diabetes_duration_years": 2, "systolic_bp": 120, "diastolic_bp": 80},
        {"hba1c": 8.0, "diabetes_duration_years": 9, "systolic_bp": 138, "diastolic_bp": 88},
        {"hba1c": 11.5, "diabetes_duration_years": 20, "systolic_bp": 160, "diastolic_bp": 100}
    ]
    
    for idx, sc in enumerate(scenarios):
        assessment = await api.analyze_base64_and_metadata(MOCK_BASE64_IMAGE, sc)
        assert isinstance(assessment, GeminiWoundAssessment)
        assert assessment.confidence_level in ["low", "medium", "high"]
        assert len(assessment.wound_severity_assessment) > 0
        print(f"✓ Scenario {idx + 1} passed: {assessment.confidence_level} confidence")


@pytest.mark.asyncio
async def test_20_case_test_harness(capsys):
    """
    20-case test harness running various patient profiles.
    Asserts valid JSON returned for all 20 and logs cases where confidence_level=low.
    """
    api = GeminiMultimodalAPI()  # Will run in mock mode if key not set
    
    # Generate 20 diverse patient profiles
    test_cases = []
    for i in range(20):
        test_cases.append({
            "case_id": f"CASE_{i+1:03d}",
            "metadata": {
                "hba1c": float(np.round(5.5 + (i * 0.4), 1)),  # 5.5 to 13.1
                "diabetes_duration_years": int(1 + (i * 1.2)),  # 1 to 23
                "systolic_bp": int(115 + (i * 3)),  # 115 to 172
                "diastolic_bp": int(75 + (i * 1.5))  # 75 to 103
            }
        })
        
    low_confidence_cases = []
    
    for case in test_cases:
        assessment = await api.analyze_base64_and_metadata(MOCK_BASE64_IMAGE, case["metadata"])
        
        # Verify JSON schema conformity
        assert isinstance(assessment, GeminiWoundAssessment)
        assert assessment.confidence_level in ["low", "medium", "high"]
        
        if assessment.confidence_level == "low":
            low_confidence_cases.append(case["case_id"])
            
    # Log low confidence cases to stdout for capsys capture
    if low_confidence_cases:
        print(f"Low confidence flags logged for cases: {low_confidence_cases}")
    else:
        print("No low confidence cases flagged.")
        
    captured = capsys.readouterr()
    assert "No low confidence" in captured.out or "Low confidence flags" in captured.out
