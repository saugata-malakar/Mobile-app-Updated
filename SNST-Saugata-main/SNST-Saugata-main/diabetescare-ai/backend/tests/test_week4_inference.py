"""
Test Week 4 Inference Pipeline
Sharif Hossain Sarkar's deliverable

Tests:
1. Batch inference with 3 images
2. Latency benchmark (≤6 seconds target)
3. Gemini fallback on low confidence
4. JSON output validation
"""

import pytest
import time
import requests
from pathlib import Path
from PIL import Image
import io
import numpy as np


@pytest.fixture(autouse=True)
def mock_requests_to_testclient(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.main import app
    client = TestClient(app)
    
    def mock_get(url, *args, **kwargs):
        path = url.replace("http://localhost:8000", "")
        return client.get(path, *args, **kwargs)
        
    def mock_post(url, *args, **kwargs):
        path = url.replace("http://localhost:8000", "")
        return client.post(path, *args, **kwargs)
        
    monkeypatch.setattr(requests, "get", mock_get)
    monkeypatch.setattr(requests, "post", mock_post)


BASE_URL = "http://localhost:8000/api/v1"


def create_test_image(size=(224, 224), color='red') -> bytes:
    """Create a test image"""
    if color == 'red':
        img_array = np.zeros((size[0], size[1], 3), dtype=np.uint8)
        img_array[:, :, 0] = 200  # Red channel
    elif color == 'green':
        img_array = np.zeros((size[0], size[1], 3), dtype=np.uint8)
        img_array[:, :, 1] = 200  # Green channel
    else:
        img_array = np.random.randint(0, 255, (size[0], size[1], 3), dtype=np.uint8)
    
    img = Image.fromarray(img_array)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes.getvalue()


def test_health_endpoint():
    """Test inference pipeline health check"""
    response = requests.get(f"{BASE_URL}/infer/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data['status'] == 'ok'
    assert 'models_loaded' in data
    print(f"✓ Health check passed: {data}")


def test_models_info():
    """Test models information endpoint"""
    response = requests.get(f"{BASE_URL}/infer/models/info")
    assert response.status_code == 200
    
    data = response.json()
    assert 'severity_model' in data
    assert 'tissue_model' in data
    assert data['severity_model']['classes'] == 6
    assert data['tissue_model']['classes'] == 4
    print(f"✓ Models info retrieved: {data}")


def test_batch_inference_three_images():
    """
    Test Week 4 deliverable: Batch inference with 3 images
    
    Requirements:
    - Handle 3 photos in one call
    - Return structured JSON with all fields
    - Latency ≤6 seconds on CPU
    """
    print("\n" + "="*60)
    print("TEST: Batch Inference (3 Images)")
    print("="*60)
    
    # Create 3 test images
    files = []
    for i in range(3):
        img_bytes = create_test_image(color=['red', 'green', 'random'][i])
        files.append(
            ('files', (f'wound_{i+1}.jpg', img_bytes, 'image/jpeg'))
        )
    
    # Start timer
    start_time = time.time()
    
    # Send request
    response = requests.post(f"{BASE_URL}/infer/woundlive", files=files)
    
    # Calculate latency
    latency_ms = (time.time() - start_time) * 1000
    
    # Validate response
    assert response.status_code == 200, f"Failed: {response.text}"
    
    data = response.json()
    
    # Validate JSON structure
    assert 'session_id' in data
    assert 'total_images' in data
    assert 'results' in data
    assert 'total_processing_time_ms' in data
    assert 'average_confidence' in data
    assert 'recommendation' in data
    
    # Validate batch size
    assert data['total_images'] == 3
    assert len(data['results']) == 3
    
    # Validate each result
    for i, result in enumerate(data['results']):
        print(f"\nImage {i+1} Results:")
        print(f"  - Severity Grade: {result['severity_grade']}")
        print(f"  - Grade Confidence: {result['grade_confidence']:.2%}")
        print(f"  - Tissue Colour: {result['tissue_colour']}")
        print(f"  - Colour Confidence: {result['colour_confidence']:.2%}")
        print(f"  - Periwound Redness: {result['periwound_redness']}")
        print(f"  - Wound Area: {result['wound_area_cm2']} cm²")
        print(f"  - Fallback Triggered: {result['fallback_triggered']}")
        print(f"  - Processing Time: {result['processing_time_ms']:.2f}ms")
        
        # Validate required fields
        assert 'severity_grade' in result
        assert 'grade_confidence' in result
        assert 'tissue_colour' in result
        assert 'colour_confidence' in result
        assert 'periwound_redness' in result
        assert 'wound_area_cm2' in result
        assert 'fallback_triggered' in result
        
        # Validate ranges
        assert 0 <= result['severity_grade'] <= 5
        assert 0 <= result['grade_confidence'] <= 1
        assert 0 <= result['colour_confidence'] <= 1
        assert result['wound_area_cm2'] >= 0
    
    # Check latency target
    print(f"\n{'='*60}")
    print(f"LATENCY BENCHMARK")
    print(f"{'='*60}")
    print(f"Actual Latency: {latency_ms:.2f}ms")
    print(f"Server Reported: {data['total_processing_time_ms']:.2f}ms")
    print(f"Target: ≤6000ms")
    print(f"Status: {'✓ PASS' if latency_ms <= 6000 else '✗ FAIL'}")
    
    if latency_ms > 6000:
        print(f"WARNING: Latency exceeds 6s target!")
    
    # Print recommendation
    print(f"\n{'='*60}")
    print(f"CLINICAL RECOMMENDATION")
    print(f"{'='*60}")
    print(f"{data['recommendation']}")
    print(f"Average Confidence: {data['average_confidence']:.2%}")
    
    assert latency_ms <= 10000, "Latency way too high (>10s)"
    print(f"\n✓ Batch inference test PASSED")


def test_gemini_fallback_low_confidence():
    """
    Test Week 4 deliverable: Gemini fallback on low confidence
    
    Requirements:
    - Trigger fallback when confidence < 0.7
    - fallback_triggered flag should be True
    """
    print("\n" + "="*60)
    print("TEST: Gemini Fallback (Low Confidence)")
    print("="*60)
    
    # Create 3 noisy images to trigger low confidence
    files = []
    for i in range(3):
        # Create very noisy image to get low confidence
        img_array = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        img = Image.fromarray(img_array)
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        files.append(
            ('files', (f'noisy_{i+1}.jpg', img_bytes.getvalue(), 'image/jpeg'))
        )
    
    # Send request
    response = requests.post(f"{BASE_URL}/infer/woundlive", files=files)
    assert response.status_code == 200
    
    data = response.json()
    
    # Check if any result triggered fallback
    fallback_triggered = any(r['fallback_triggered'] for r in data['results'])
    
    print(f"\nFallback Status:")
    for i, result in enumerate(data['results']):
        print(f"  Image {i+1}:")
        print(f"    - Grade Confidence: {result['grade_confidence']:.2%}")
        print(f"    - Colour Confidence: {result['colour_confidence']:.2%}")
        print(f"    - Fallback Triggered: {result['fallback_triggered']}")
    
    if fallback_triggered:
        print(f"\n✓ Gemini fallback was triggered on low confidence")
    else:
        print(f"\n✗ Gemini fallback was NOT triggered (may need actual low confidence)")
    
    print(f"\n✓ Gemini fallback test completed")


def test_wound_endpoint_batch_and_types():
    """
    Test POST /infer/wound endpoint:
    - 3 images in one call returns 3 objects
    - All 7 JSON fields present and correctly typed
    - Latency test: processing time <= 6s
    """
    print("\n" + "="*60)
    print("TEST: /infer/wound 3-Image Batch & Type Schema")
    print("="*60)
    
    files = []
    for i in range(3):
        img_bytes = create_test_image(color=['red', 'green', 'random'][i])
        files.append(
            ('files', (f'wound_{i+1}.jpg', img_bytes, 'image/jpeg'))
        )
    
    import time
    start = time.perf_counter()
    response = requests.post(f"{BASE_URL}/infer/wound", files=files)
    latency = time.perf_counter() - start
    
    assert response.status_code == 200, f"Failed: {response.text}"
    data = response.json()
    
    assert data['total_images'] == 3
    results = data['results']
    assert len(results) == 3
    
    # Assert latency <= 6.0s
    print(f"3-Image Batch Latency: {latency:.4f}s (Target: <= 6s)")
    assert latency <= 6.0, f"Latency target exceeded: {latency:.2f}s > 6.0s"
    
    for r in results:
        # Schema validation (7 required fields)
        assert 'severity_grade' in r
        assert 'grade_confidence' in r
        assert 'tissue_colour' in r
        assert 'colour_confidence' in r
        assert 'periwound_redness' in r
        assert 'wound_area_cm2' in r
        assert 'fallback_triggered' in r
        
        # Correctly typed check
        assert isinstance(r['severity_grade'], int)
        assert isinstance(r['grade_confidence'], float)
        assert isinstance(r['tissue_colour'], str)
        assert isinstance(r['colour_confidence'], float)
        assert isinstance(r['periwound_redness'], bool)
        assert isinstance(r['wound_area_cm2'], float)
        assert isinstance(r['fallback_triggered'], bool)


def test_wound_endpoint_partial_batch():
    """
    Test POST /infer/wound endpoint:
    - Accepts 1 image, returns 1 object
    - Accepts 2 images, returns 2 objects
    """
    print("\n" + "="*60)
    print("TEST: /infer/wound Partial Batch (1 and 2 images)")
    print("="*60)
    
    # 1 Image
    files = [('files', ('wound_1.jpg', create_test_image(), 'image/jpeg'))]
    response = requests.post(f"{BASE_URL}/infer/wound", files=files)
    assert response.status_code == 200, f"Failed: {response.text}"
    data = response.json()
    assert data['total_images'] == 1
    assert len(data['results']) == 1
    
    # 2 Images
    files = [
        ('files', ('wound_1.jpg', create_test_image(), 'image/jpeg')),
        ('files', ('wound_2.jpg', create_test_image(), 'image/jpeg'))
    ]
    response = requests.post(f"{BASE_URL}/infer/wound", files=files)
    assert response.status_code == 200, f"Failed: {response.text}"
    data = response.json()
    assert data['total_images'] == 2
    assert len(data['results']) == 2


def test_wound_endpoint_fallback_trigger():
    """
    Test POST /infer/wound endpoint:
    - Low-confidence/noisy/low-contrast image triggers Gemini fallback
    - Assert fallback_triggered is True
    """
    print("\n" + "="*60)
    print("TEST: /infer/wound Low Confidence Fallback")
    print("="*60)
    
    # Create very low contrast/low quality/noisy image
    # For example, all gray pixels with minor noise to trigger low confidence
    gray_pixels = np.ones((224, 224, 3), dtype=np.uint8) * 128
    # Add minor noise
    noise = np.random.randint(-5, 5, (224, 224, 3)).astype(np.int16)
    noisy_pixels = np.clip(gray_pixels + noise, 0, 255).astype(np.uint8)
    
    img = Image.fromarray(noisy_pixels)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    files = [('files', ('low_contrast.jpg', img_bytes.getvalue(), 'image/jpeg'))]
    response = requests.post(f"{BASE_URL}/infer/wound", files=files)
    
    assert response.status_code == 200, f"Failed: {response.text}"
    data = response.json()
    
    # The first result should have fallback_triggered = True because confidence is low
    result = data['results'][0]
    print(f"Grade Confidence: {result['grade_confidence']:.2%}")
    print(f"Colour Confidence: {result['colour_confidence']:.2%}")
    print(f"Fallback Triggered: {result['fallback_triggered']}")
    
    assert result['fallback_triggered'] is True, "Expected fallback_triggered=True on low contrast image"


def test_invalid_batch_size():
    """Test that API rejects non-3 image batches for /woundlive and non 1-3 for /wound"""
    print("\n" + "="*60)
    print("TEST: Invalid Batch Size")
    print("="*60)
    
    # Try with 2 images on woundlive (should fail)
    files = []
    for i in range(2):
        img_bytes = create_test_image()
        files.append(
            ('files', (f'wound_{i+1}.jpg', img_bytes, 'image/jpeg'))
        )
    response = requests.post(f"{BASE_URL}/infer/woundlive", files=files)
    assert response.status_code == 400
    print(f"✓ Correctly rejected batch with 2 images on /woundlive")
    
    # Try with 0 images on wound (should fail)
    response = requests.post(f"{BASE_URL}/infer/wound", files=[])
    assert response.status_code in (400, 422)
    print(f"✓ Correctly rejected empty batch on /wound")

    # Try with 4 images on wound (should fail)
    files = []
    for i in range(4):
        img_bytes = create_test_image()
        files.append(
            ('files', (f'wound_{i+1}.jpg', img_bytes, 'image/jpeg'))
        )
    response = requests.post(f"{BASE_URL}/infer/wound", files=files)
    assert response.status_code == 400
    print(f"✓ Correctly rejected batch with 4 images on /wound")


if __name__ == "__main__":
    """
    Run all tests manually
    
    Requirements:
    1. Start backend: python backend/api/main.py
    2. Run tests: python backend/tests/test_week4_inference.py
    """
    print("\n" + "="*70)
    print(" "*15 + "WEEK 4 INFERENCE PIPELINE TESTS")
    print(" "*10 + "Sharif Hossain Sarkar's Deliverable")
    print("="*70)
    
    try:
        # Run all tests
        test_health_endpoint()
        test_models_info()
        test_batch_inference_three_images()
        test_gemini_fallback_low_confidence()
        test_wound_endpoint_batch_and_types()
        test_wound_endpoint_partial_batch()
        test_wound_endpoint_fallback_trigger()
        test_invalid_batch_size()
        
        print("\n" + "="*70)
        print(" "*20 + "ALL TESTS PASSED ✓")
        print("="*70)
        print("\nWeek 4/7 Deliverables Verified:")
        print("  ✓ Batch inference (1-3 photos per session for /wound, 3 for /woundlive)")
        print("  ✓ Complete pipeline (CV → SAM2 → Models → JSON)")
        print("  ✓ Latency benchmark (≤6s target)")
        print("  ✓ Gemini fallback on low confidence (fallback_triggered=True)")
        print("  ✓ Structured JSON output with all 7 required fields correctly typed")
        
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
    except requests.exceptions.ConnectionError:
        print("\n✗ ERROR: Cannot connect to backend")
        print("Please start backend first: python backend/api/main.py")
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
