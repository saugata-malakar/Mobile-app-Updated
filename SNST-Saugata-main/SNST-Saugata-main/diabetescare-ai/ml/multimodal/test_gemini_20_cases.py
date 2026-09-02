"""
Test Gemini Multimodal on 20 Sample Cases
Week 4 - Saugata Malakar

Tests multimodal analysis with various clinical scenarios.
Generates structured JSON output for each case.
"""

import asyncio
import json
from pathlib import Path
from PIL import Image
import numpy as np
from datetime import datetime
from typing import List, Dict

from gemini_multimodal import (
    GeminiMultimodalAPI, 
    MultimodalAnalysisRequest,
    MultimodalAnalysisResponse
)


# 20 Test Cases with varied clinical profiles
TEST_CASES = [
    # Case 1-5: Low risk (good control)
    {"hba1c": 6.5, "duration": 3, "bp": (120, 80), "age": 45, "gender": "M"},
    {"hba1c": 6.8, "duration": 5, "bp": (125, 82), "age": 52, "gender": "F"},
    {"hba1c": 7.0, "duration": 4, "bp": (118, 78), "age": 48, "gender": "M"},
    {"hba1c": 6.9, "duration": 6, "bp": (130, 85), "age": 55, "gender": "F"},
    {"hba1c": 7.1, "duration": 7, "bp": (128, 83), "age": 50, "gender": "M"},
    
    # Case 6-10: Moderate risk
    {"hba1c": 8.2, "duration": 8, "bp": (135, 88), "age": 58, "gender": "F"},
    {"hba1c": 8.5, "duration": 10, "bp": (140, 90), "age": 60, "gender": "M"},
    {"hba1c": 8.0, "duration": 9, "bp": (138, 89), "age": 56, "gender": "F"},
    {"hba1c": 8.3, "duration": 11, "bp": (142, 91), "age": 62, "gender": "M"},
    {"hba1c": 8.1, "duration": 7, "bp": (136, 87), "age": 54, "gender": "F"},
    
    # Case 11-15: High risk (poor control)
    {"hba1c": 9.5, "duration": 12, "bp": (150, 95), "age": 65, "gender": "M"},
    {"hba1c": 10.2, "duration": 15, "bp": (155, 98), "age": 68, "gender": "F"},
    {"hba1c": 9.8, "duration": 14, "bp": (148, 94), "age": 64, "gender": "M"},
    {"hba1c": 11.0, "duration": 18, "bp": (160, 100), "age": 70, "gender": "F"},
    {"hba1c": 9.3, "duration": 13, "bp": (145, 92), "age": 63, "gender": "M"},
    
    # Case 16-20: Very high risk (critical)
    {"hba1c": 12.5, "duration": 20, "bp": (165, 105), "age": 72, "gender": "F"},
    {"hba1c": 11.8, "duration": 22, "bp": (170, 108), "age": 75, "gender": "M"},
    {"hba1c": 13.0, "duration": 25, "bp": (175, 110), "age": 78, "gender": "F"},
    {"hba1c": 12.0, "duration": 19, "bp": (168, 106), "age": 73, "gender": "M"},
    {"hba1c": 11.5, "duration": 21, "bp": (162, 104), "age": 71, "gender": "F"},
]


def create_test_image(case_idx: int) -> Image.Image:
    """
    Create a test wound image.
    
    In production, would use real wound photographs.
    For testing, creates placeholder images.
    """
    # Create a simple test image (placeholder)
    # In real use: load actual wound photos
    
    width, height = 224, 224
    
    # Vary color based on case severity
    if case_idx < 5:  # Low risk - healthier looking
        base_color = (200, 150, 150)  # Pink-ish (granulation)
    elif case_idx < 10:  # Moderate risk
        base_color = (180, 160, 100)  # Yellow-ish (slough)
    elif case_idx < 15:  # High risk
        base_color = (150, 100, 80)  # Dark red/brown
    else:  # Very high risk
        base_color = (100, 50, 40)  # Very dark (necrotic)
    
    # Add some variation
    img_array = np.random.randint(
        max(0, base_color[0] - 30), 
        min(255, base_color[0] + 30),
        (height, width, 3),
        dtype=np.uint8
    )
    
    for c in range(3):
        img_array[:, :, c] = np.clip(
            img_array[:, :, c].astype(np.int16) + (base_color[c] - 128),
            0, 255
        ).astype(np.uint8)
    
    return Image.fromarray(img_array)


def print_case_summary(case_idx: int, request: MultimodalAnalysisRequest, response: MultimodalAnalysisResponse):
    """Print formatted summary of analysis"""
    print(f"\n{'='*80}")
    print(f"CASE {case_idx + 1}/20")
    print(f"{'='*80}")
    print(f"\n📊 CLINICAL DATA:")
    print(f"  HbA1c: {request.hba1c}%")
    print(f"  Diabetes Duration: {request.diabetes_duration} years")
    print(f"  Blood Pressure: {request.systolic_bp}/{request.diastolic_bp} mmHg")
    print(f"  Age: {request.age}, Gender: {request.gender}")
    
    print(f"\n🔍 ANALYSIS RESULTS:")
    print(f"  Severity: Grade {response.severity_grade} - {response.severity_label}")
    print(f"  Confidence: {response.confidence:.2%}")
    print(f"  Tissue: {response.tissue_assessment}")
    print(f"  Infection Risk: {response.infection_risk.upper()}")
    print(f"  Healing Prognosis: {response.healing_prognosis.upper()}")
    
    print(f"\n💡 CLINICAL INSIGHTS:")
    for insight in response.clinical_insights:
        print(f"  • {insight}")
    
    print(f"\n⚠️ RISK FACTORS:")
    for risk in response.risk_factors:
        print(f"  • {risk}")
    
    print(f"\n🚨 IMMEDIATE ACTIONS:")
    for action in response.immediate_actions:
        print(f"  • {action}")
    
    print(f"\n📅 FOLLOW-UP: {response.follow_up_days} days")
    print(f"🏥 SPECIALIST REFERRAL: {'YES' if response.specialist_referral else 'NO'}")


async def run_20_case_test():
    """Run multimodal analysis on all 20 test cases"""
    
    print("="*80)
    print("GEMINI MULTIMODAL TEST - 20 SAMPLE CASES")
    print("Week 4 - Saugata Malakar")
    print("="*80)
    
    # Initialize API
    api = GeminiMultimodalAPI()
    
    # Results storage
    all_results = []
    
    # Process each case
    for idx, case_data in enumerate(TEST_CASES):
        # Create request
        request = MultimodalAnalysisRequest(
            image=create_test_image(idx),
            hba1c=case_data["hba1c"],
            diabetes_duration=case_data["duration"],
            systolic_bp=case_data["bp"][0],
            diastolic_bp=case_data["bp"][1],
            patient_id=f"TEST_{idx+1:03d}",
            age=case_data["age"],
            gender=case_data["gender"]
        )
        
        # Analyze
        try:
            response = await api.analyze_multimodal(request)
            
            # Print summary
            print_case_summary(idx, request, response)
            
            # Store result
            result_dict = {
                "case_id": idx + 1,
                "patient_id": request.patient_id,
                "clinical_data": {
                    "hba1c": request.hba1c,
                    "diabetes_duration": request.diabetes_duration,
                    "blood_pressure": f"{request.systolic_bp}/{request.diastolic_bp}",
                    "age": request.age,
                    "gender": request.gender
                },
                "analysis": {
                    "severity_grade": response.severity_grade,
                    "severity_label": response.severity_label,
                    "confidence": response.confidence,
                    "tissue_assessment": response.tissue_assessment,
                    "infection_risk": response.infection_risk,
                    "healing_prognosis": response.healing_prognosis,
                    "clinical_insights": response.clinical_insights,
                    "risk_factors": response.risk_factors,
                    "immediate_actions": response.immediate_actions,
                    "follow_up_days": response.follow_up_days,
                    "specialist_referral": response.specialist_referral
                },
                "timestamp": response.timestamp
            }
            
            all_results.append(result_dict)
            
        except Exception as e:
            print(f"\n❌ ERROR analyzing case {idx+1}: {e}")
            all_results.append({
                "case_id": idx + 1,
                "error": str(e)
            })
    
    # Save results to JSON
    output_file = Path("gemini_20_cases_results.json")
    with open(output_file, "w") as f:
        json.dump({
            "test_date": datetime.now().isoformat(),
            "total_cases": len(TEST_CASES),
            "successful": sum(1 for r in all_results if "error" not in r),
            "failed": sum(1 for r in all_results if "error" in r),
            "results": all_results
        }, f, indent=2)
    
    print(f"\n{'='*80}")
    print(f"TEST COMPLETE")
    print(f"{'='*80}")
    print(f"Results saved to: {output_file}")
    print(f"Total cases: {len(TEST_CASES)}")
    print(f"Successful: {sum(1 for r in all_results if 'error' not in r)}")
    print(f"Failed: {sum(1 for r in all_results if 'error' in r)}")
    
    # Summary statistics
    successful_results = [r for r in all_results if "error" not in r]
    if successful_results:
        avg_grade = np.mean([r["analysis"]["severity_grade"] for r in successful_results])
        avg_confidence = np.mean([r["analysis"]["confidence"] for r in successful_results])
        referral_rate = sum(r["analysis"]["specialist_referral"] for r in successful_results) / len(successful_results)
        
        print(f"\n📊 STATISTICS:")
        print(f"  Average Severity Grade: {avg_grade:.2f}")
        print(f"  Average Confidence: {avg_confidence:.2%}")
        print(f"  Specialist Referral Rate: {referral_rate:.1%}")


if __name__ == "__main__":
    asyncio.run(run_20_case_test())
