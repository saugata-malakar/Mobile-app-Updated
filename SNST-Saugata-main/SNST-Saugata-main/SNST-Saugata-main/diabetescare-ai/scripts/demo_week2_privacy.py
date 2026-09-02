#!/usr/bin/env python3
"""
Week 2 Privacy Module Demo Script

Demonstrates:
1. Patient data anonymisation (HMAC-SHA256)
2. Age/duration generalisation
3. k-anonymity verification (k >= 5)
4. Erasure pipeline overview
5. Data export with anonymisation

Usage:
    python scripts/demo_week2_privacy.py

Owner: Saugata Malakar
"""

import json
from datetime import datetime
from typing import List, Dict, Any
import sys

# Add backend to path
sys.path.insert(0, "/c/Users/trina/Downloads/SNST PROF KGP/diabetescare-ai")

from backend.database.privacy import (
    AnonymisationEngine,
    get_anonymisation_engine,
    PII_FIELD_MAP,
    SensitivityLevel,
)
from backend.database.erasure import ErasurePipeline


def print_section(title: str):
    """Print formatted section header."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def demo_pii_classification():
    """Demo 1: Show PII field map for patients table."""
    print_section("DEMO 1: PII Field Classification (Patients Table)")
    
    classifications = PII_FIELD_MAP.TABLE_CLASSIFICATIONS["patients"]
    
    print("\nPII Classifications:")
    print("-" * 80)
    
    direct_ids = []
    quasi_ids = []
    non_sensitive = []
    
    for field, sensitivity in sorted(classifications.items()):
        if sensitivity == SensitivityLevel.DIRECT_IDENTIFIER:
            direct_ids.append(field)
        elif sensitivity == SensitivityLevel.QUASI_IDENTIFIER:
            quasi_ids.append(field)
        else:
            non_sensitive.append(field)
    
    print(f"\n✗ DIRECT IDENTIFIERS (Remove from export):")
    for field in direct_ids:
        print(f"  - {field}")
    
    print(f"\n⚠ QUASI-IDENTIFIERS (Generalise):")
    for field in quasi_ids:
        print(f"  - {field}")
    
    print(f"\n✓ NON-SENSITIVE (Retain):")
    for field in non_sensitive:
        print(f"  - {field}")


def demo_pseudonymisation():
    """Demo 2: HMAC-SHA256 pseudonymisation with rotating salt."""
    print_section("DEMO 2: HMAC-SHA256 Pseudonymisation")
    
    engine = get_anonymisation_engine()
    
    print("\nPseudonymising patient IDs (deterministic, rotating salt):")
    print("-" * 80)
    
    test_ids = ["pat-001", "pat-002", "pat-003"]
    
    for patient_id in test_ids:
        pseudonym = engine.pseudonymise_id(patient_id)
        print(f"\n  Original:   {patient_id}")
        print(f"  Pseudonym:  {pseudonym[:16]}... (64-char hex)")
    
    # Show determinism
    print("\n\nDeterminism check (same input → same pseudonym):")
    print("-" * 80)
    pseudo1 = engine.pseudonymise_id("pat-001")
    pseudo2 = engine.pseudonymise_id("pat-001")
    print(f"  First call:  {pseudo1}")
    print(f"  Second call: {pseudo2}")
    print(f"  Match: {'✓ YES' if pseudo1 == pseudo2 else '✗ NO'}")


def demo_age_generalization():
    """Demo 3: Age band generalization."""
    print_section("DEMO 3: Age Band Generalization (5-year bands)")
    
    engine = get_anonymisation_engine()
    
    print("\nGeneralising ages to 5-year bands:")
    print("-" * 80)
    
    test_ages = [5, 15, 25, 35, 45, 55, 65, 75, 85]
    
    for age in test_ages:
        band = engine.generalise_age(age)
        print(f"  Age {age:2d}  →  {band}")


def demo_diabetes_duration_generalization():
    """Demo 4: Diabetes duration generalization."""
    print_section("DEMO 4: Diabetes Duration Generalization (2-year bands)")
    
    engine = get_anonymisation_engine()
    
    print("\nGeneralising diabetes duration to 2-year bands:")
    print("-" * 80)
    
    test_durations = [0, 1, 2, 3, 5, 10, 15, 20]
    
    for duration in test_durations:
        band = engine.generalise_diabetes_duration(duration)
        print(f"  {duration:2d} years  →  {band}")


def demo_record_anonymisation():
    """Demo 5: Full record anonymisation."""
    print_section("DEMO 5: Full Patient Record Anonymisation")
    
    engine = get_anonymisation_engine()
    
    original_record = {
        "patient_id": "pat-20240515-001",
        "name": "Rajesh Kumar",
        "phone": "9876543210",
        "age": 42,
        "gender": "Male",
        "village": "Kharagpur",
        "district": "Paschim Medinipur",
        "aadhar_id": "123456789012",
        "consent_given_at": "2024-01-15T10:30:45Z",
        "consent_version": 1,
        "created_at": "2024-01-10T08:00:00Z",
    }
    
    print("\nOriginal Record:")
    print("-" * 80)
    print(json.dumps(original_record, indent=2))
    
    anonymised = engine.anonymise_record("patients", original_record)
    
    print("\n\nAnonymised Record:")
    print("-" * 80)
    print(json.dumps(anonymised, indent=2))
    
    print("\n\nChanges Made:")
    print("-" * 80)
    print(f"  ✗ patient_id:      REMOVED (direct identifier)")
    print(f"  ✗ name:            REMOVED (direct identifier)")
    print(f"  ✗ phone:           REMOVED (direct identifier)")
    print(f"  ✗ aadhar_id:       REMOVED (direct identifier)")
    print(f"  ⚠ age:             GENERALISED ({original_record['age']} → {anonymised['age']})")
    print(f"  ✓ gender:          RETAINED (low risk, needed for stratification)")
    print(f"  ✗ village:         REMOVED (quasi-identifier, high re-id risk)")
    print(f"  ✓ district:        RETAINED (regional epidemiology)")
    print(f"  ⚠ consent_given_at: GENERALISED TO MONTH (timestamp precision reduced)")


def demo_k_anonymity():
    """Demo 6: k-anonymity verification (k >= 5)."""
    print_section("DEMO 6: k-Anonymity Verification (k ≥ 5)")
    
    engine = get_anonymisation_engine()
    
    # Create sample dataset
    print("\nCreating sample dataset (50 patients, 2 districts, 3 age bands)...")
    print("-" * 80)
    
    sample_records = []
    for i in range(50):
        district = "Paschim Medinipur" if i < 30 else "Jhargram"
        age_band = f"{30 + (i % 3) * 5}-{34 + (i % 3) * 5}"
        gender = "Male" if i % 2 == 0 else "Female"
        
        sample_records.append({
            "district": district,
            "age": age_band,
            "gender": gender,
            "wagner_grade": i % 6,
            "wound_area_cm2": 50 + (i % 50),
        })
    
    print(f"  Total records: {len(sample_records)}")
    print(f"  Quasi-identifiers for grouping: [district, age, gender]")
    
    # Verify k-anonymity
    is_k_anon, report = engine.verify_k_anonymity(
        sample_records, ["district", "age", "gender"]
    )
    
    print("\nk-Anonymity Report:")
    print("-" * 80)
    print(f"  Total records:           {report['total_records']}")
    print(f"  Total quasi-ID groups:   {report['total_groups']}")
    print(f"  k-anonymity threshold:   {report['k_anonymity_threshold']}")
    print(f"  Smallest group size:     {report['smallest_group_size']}")
    print(f"  Violations (groups < 5): {report['violations']}")
    print(f"\n  Result: {'✓ PASS' if is_k_anon else '✗ FAIL'}")
    
    if not is_k_anon:
        print(f"\n  ⚠ Export would be REJECTED if k-anonymity not met")
        print(f"  Reason: {report['violations']} groups have fewer than 5 records")
    else:
        print(f"\n  ✓ Dataset meets k-anonymity threshold (k ≥ 5)")
        print(f"  Safe for export to external researchers")


def demo_dataset_anonymisation():
    """Demo 7: Full dataset anonymisation with k-anonymity."""
    print_section("DEMO 7: Full Dataset Anonymisation + k-Anonymity Verification")
    
    engine = get_anonymisation_engine()
    
    # Create raw patient records
    raw_dataset = [
        {
            "patient_id": f"pat-{i:04d}",
            "name": f"Patient {i}",
            "phone": f"987654{i:04d}",
            "age": 25 + (i % 50),
            "gender": "M" if i % 2 == 0 else "F",
            "village": f"Village_{i % 5}",
            "district": "Paschim Medinipur" if i % 2 == 0 else "Jhargram",
            "aadhar_id": f"{i:012d}",
            "consent_given_at": "2024-01-15",
            "created_at": datetime.utcnow().isoformat(),
        }
        for i in range(20)
    ]
    
    print(f"\nRaw dataset: {len(raw_dataset)} patient records")
    print(f"First record (before anonymisation):")
    print(json.dumps(raw_dataset[0], indent=2))
    
    # Anonymise
    anonymised_dataset = engine.anonymise_dataset("patients", raw_dataset)
    
    print(f"\n\nAnonymised dataset: {len(anonymised_dataset)} records")
    print(f"First record (after anonymisation):")
    print(json.dumps(anonymised_dataset[0], indent=2))
    
    # Verify k-anonymity
    is_k_anon, report = engine.verify_k_anonymity(
        anonymised_dataset, ["district", "age", "gender"]
    )
    
    print(f"\n\nk-Anonymity Verification:")
    print("-" * 80)
    print(f"  k-Anonymous: {'✓ YES' if is_k_anon else '✗ NO'}")
    print(f"  Violations:  {report['violations']}")
    print(f"  Status:      {'Safe to export' if is_k_anon else 'EXPORT BLOCKED'}")


def demo_erasure_pipeline():
    """Demo 8: Erasure pipeline overview."""
    print_section("DEMO 8: Patient Erasure Pipeline (72-hour window)")
    
    class MockSession:
        def commit(self): pass
        def rollback(self): pass
    
    pipeline = ErasurePipeline(MockSession())
    
    print("\nDeletion order (respecting foreign key dependencies):")
    print("-" * 80)
    
    # Sort by priority
    tables_by_priority = sorted(
        pipeline.DELETION_ORDER.items(),
        key=lambda x: x[1].value
    )
    
    current_priority = None
    for table, priority in tables_by_priority:
        if priority.value != current_priority:
            print(f"\nLevel {priority.value}:")
            current_priority = priority.value
        print(f"  - {table}")
    
    print("\n\nErasure Request Workflow:")
    print("-" * 80)
    
    request = pipeline.request_erasure("pat-test-123")
    print(f"\n1. Request submitted:")
    print(f"   Patient ID: {request['patient_id']}")
    print(f"   Status:     {request['status']}")
    print(f"   Time:       {request['requested_at']}")
    
    print(f"\n2. 72-hour review window opens")
    print(f"   Patient can still withdraw during this period")
    
    print(f"\n3. If approved, execute_erasure() called")
    print(f"   Deletes all patient data in correct dependency order")
    print(f"   Returns verification report (should show 0 remaining records)")
    
    print(f"\n4. Audit trail created")
    print(f"   Logs erasure event with timestamp")
    print(f"   Cannot be undone (DPDP Act compliant)")


def main():
    """Run all demos."""
    print("\n" + "=" * 80)
    print("  DIABETESCARE AI - WEEK 2 PRIVACY MODULE DEMO")
    print("  Anonymisation, Erasure, Data Export, k-Anonymity")
    print("=" * 80)
    
    try:
        demo_pii_classification()
        demo_pseudonymisation()
        demo_age_generalization()
        demo_diabetes_duration_generalization()
        demo_record_anonymisation()
        demo_k_anonymity()
        demo_dataset_anonymisation()
        demo_erasure_pipeline()
        
        print_section("DEMO COMPLETE")
        print("\n✓ All Week 2 deliverables demonstrated successfully")
        print("\nNext steps:")
        print("  - Run pytest to execute full test suite")
        print("  - Review documentation: docs/PII_FIELD_MAP.md")
        print("  - Review compliance: docs/DPDP_COMPLIANCE.md")
        print("  - Proceed to Week 3: Federated Learning PoC")
        print("\n" + "=" * 80)
        
    except Exception as e:
        print(f"\n✗ Error during demo: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

