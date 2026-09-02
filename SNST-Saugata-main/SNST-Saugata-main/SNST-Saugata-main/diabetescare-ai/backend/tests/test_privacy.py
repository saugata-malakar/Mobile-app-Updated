"""
Comprehensive test suite for privacy module.

Tests DPDP Act 2023 compliance:
- HMAC pseudonymisation with rotating salt
- Age and duration generalisation
- Village stripping
- k-anonymity verification
- Full dataset anonymisation

Owner: Saugata Malakar
"""

import pytest
import os
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database.privacy import (
    RotatingSaltManager,
    AnonymisationEngine,
    SensitivityLevel,
    PII_FIELD_MAP,
    get_anonymisation_engine
)


class TestRotatingSaltManager:
    """Test rotating salt management for HMAC."""
    
    def test_salt_generation(self):
        """Test salt generation is deterministic within epoch."""
        manager = RotatingSaltManager()
        
        salt1 = manager.get_current_salt()
        salt2 = manager.get_current_salt()
        
        assert salt1 == salt2
        assert len(salt1) == 16  # 16 hex chars
        assert isinstance(salt1, str)
    
    def test_salt_rotation(self):
        """Test salt changes between epochs."""
        manager = RotatingSaltManager()
        
        # Mock different dates
        with patch('database.privacy.datetime') as mock_datetime:
            # Epoch 0 (day 0)
            mock_datetime.utcnow.return_value.date.return_value.toordinal.return_value = 1
            salt_epoch_0 = manager._generate_salt()
            
            # Epoch 1 (day 90)
            mock_datetime.utcnow.return_value.date.return_value.toordinal.return_value = 91
            salt_epoch_1 = manager._generate_salt()
            
            assert salt_epoch_0 != salt_epoch_1
    
    def test_salt_for_specific_date(self):
        """Test getting salt for specific historical date."""
        manager = RotatingSaltManager()
        
        date1 = datetime(2024, 1, 1)
        date2 = datetime(2024, 4, 1)  # 90 days later
        
        salt1 = manager.get_salt_for_date(date1)
        salt2 = manager.get_salt_for_date(date2)
        
        assert salt1 != salt2
        assert len(salt1) == 16
        assert len(salt2) == 16


class TestAnonymisationEngine:
    """Test core anonymisation functionality."""
    
    @pytest.fixture
    def engine(self):
        """Create anonymisation engine for testing."""
        return AnonymisationEngine()
    
    def test_pseudonymise_id_deterministic(self, engine):
        """Test pseudonymisation is deterministic."""
        id1 = "patient_12345"
        
        pseudo1 = engine.pseudonymise_id(id1, "patient_id")
        pseudo2 = engine.pseudonymise_id(id1, "patient_id")
        
        assert pseudo1 == pseudo2
        assert len(pseudo1) == 64  # SHA256 hex
        assert pseudo1 != id1  # Actually pseudonymised
    
    def test_pseudonymise_id_domain_separation(self, engine):
        """Test different ID types produce different pseudonyms."""
        identifier = "12345"
        
        pseudo_patient = engine.pseudonymise_id(identifier, "patient_id")
        pseudo_doctor = engine.pseudonymise_id(identifier, "doctor_id")
        pseudo_phone = engine.pseudonymise_id(identifier, "phone")
        
        assert pseudo_patient != pseudo_doctor
        assert pseudo_patient != pseudo_phone
        assert pseudo_doctor != pseudo_phone
    
    def test_generalise_age_bands(self, engine):
        """Test age generalisation to 5-year bands."""
        test_cases = [
            (0, "0-4"),
            (4, "0-4"),
            (5, "5-9"),
            (32, "30-34"),
            (99, "75+"),
            (105, "75+"),
            (-5, "unknown"),
            (200, "unknown")
        ]
        
        for age, expected in test_cases:
            result = engine.generalise_age(age)
            assert result == expected, f"Age {age} should be {expected}, got {result}"
    
    def test_generalise_diabetes_duration(self, engine):
        """Test diabetes duration generalisation."""
        test_cases = [
            (0, "0-1 years"),
            (1, "0-1 years"),
            (2, "2-3 years"),
            (3, "2-3 years"),
            (10, "10-11 years"),
            (25, "24-25 years"),
            (-1, "unknown")
        ]
        
        for duration, expected in test_cases:
            result = engine.generalise_diabetes_duration(duration)
            assert result == expected, f"Duration {duration} should be {expected}, got {result}"
    
    def test_strip_village(self, engine):
        """Test village field removal."""
        record_with_village = {
            "patient_id": "pat_123",
            "name": "John Doe",
            "village": "Rampur",
            "district": "Mumbai",
            "age": 45
        }
        
        result = engine.strip_village(record_with_village)
        
        assert "village" not in result
        assert result["district"] == "Mumbai"  # District preserved
        assert result["patient_id"] == "pat_123"
        assert result["age"] == 45
    
    def test_generalise_timestamp(self, engine):
        """Test timestamp generalisation."""
        timestamp = datetime(2024, 3, 15, 14, 30, 45, 123456)
        
        # Hour precision
        hour_result = engine.generalise_timestamp(timestamp, "hour")
        expected_hour = datetime(2024, 3, 15, 14, 0, 0, 0)
        assert hour_result == expected_hour
        
        # Day precision
        day_result = engine.generalise_timestamp(timestamp, "day")
        expected_day = datetime(2024, 3, 15, 0, 0, 0, 0)
        assert day_result == expected_day
        
        # Month precision
        month_result = engine.generalise_timestamp(timestamp, "month")
        expected_month = datetime(2024, 3, 1, 0, 0, 0, 0)
        assert month_result == expected_month
    
    def test_anonymise_record_patients_table(self, engine):
        """Test full record anonymisation for patients table."""
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
        
        result = engine.anonymise_record("patients", patient_record)
        
        # Direct identifiers should be removed
        assert "patient_id" not in result
        assert "name" not in result
        assert "phone" not in result
        assert "aadhar_id" not in result
        
        # Quasi-identifiers should be generalised
        assert result["age"] == "30-34"
        assert "village" not in result  # Stripped
        assert result["district"] == "Mumbai"  # Preserved
        assert result["consent_given_at"].startswith("2024-01-01")  # Month precision
        
        # Non-sensitive data preserved
        assert result["hba1c"] == 7.2
        assert result["created_at"] == "2024-01-15T10:30:00Z"
    
    def test_anonymise_record_unknown_table(self, engine):
        """Test handling of unknown table."""
        record = {"field1": "value1", "field2": "value2"}
        
        with patch('database.privacy.logger') as mock_logger:
            result = engine.anonymise_record("unknown_table", record)
            
            # Should return original record with warning
            assert result == record
            mock_logger.warning.assert_called_once()
    
    def test_anonymise_dataset(self, engine):
        """Test dataset anonymisation."""
        records = [
            {
                "patient_id": "pat_1",
                "name": "Patient One",
                "age": 25,
                "district": "Mumbai"
            },
            {
                "patient_id": "pat_2", 
                "name": "Patient Two",
                "age": 35,
                "district": "Delhi"
            }
        ]
        
        result = engine.anonymise_dataset("patients", records)
        
        assert len(result) == 2
        
        # Check first record
        assert "patient_id" not in result[0]
        assert "name" not in result[0]
        assert result[0]["age"] == "25-29"
        assert result[0]["district"] == "Mumbai"
        
        # Check second record
        assert "patient_id" not in result[1]
        assert "name" not in result[1]
        assert result[1]["age"] == "35-39"
        assert result[1]["district"] == "Delhi"


class TestKAnonymityVerification:
    """Test k-anonymity verification."""
    
    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()
    
    def test_k_anonymity_compliant_dataset(self, engine):
        """Test dataset that meets k-anonymity threshold."""
        # 5 records with same quasi-identifiers (meets k=5)
        records = [
            {"patient_id": f"pat_{i}", "district": "Mumbai", "age": "30-34", "gender": "M"}
            for i in range(5)
        ]
        
        quasi_identifiers = ["district", "age", "gender"]
        is_compliant, report = engine.verify_k_anonymity(records, quasi_identifiers)
        
        assert is_compliant is True
        assert report["total_records"] == 5
        assert report["total_groups"] == 1
        assert report["violations"] == 0
        assert report["smallest_group_size"] == 5
    
    def test_k_anonymity_violation(self, engine):
        """Test dataset that violates k-anonymity."""
        records = [
            # Group 1: 5 records (compliant)
            *[{"district": "Mumbai", "age": "30-34", "gender": "M"} for _ in range(5)],
            # Group 2: 2 records (violation - less than k=5)
            *[{"district": "Delhi", "age": "40-44", "gender": "F"} for _ in range(2)]
        ]
        
        quasi_identifiers = ["district", "age", "gender"]
        is_compliant, report = engine.verify_k_anonymity(records, quasi_identifiers)
        
        assert is_compliant is False
        assert report["total_records"] == 7
        assert report["total_groups"] == 2
        assert report["violations"] == 1
        assert report["smallest_group_size"] == 2
        assert len(report["violation_keys"]) == 1
    
    def test_k_anonymity_empty_dataset(self, engine):
        """Test k-anonymity with empty dataset."""
        records = []
        quasi_identifiers = ["district", "age"]
        
        is_compliant, report = engine.verify_k_anonymity(records, quasi_identifiers)
        
        assert is_compliant is True
        assert report["total_records"] == 0
        assert report["total_groups"] == 0
        assert report["violations"] == 0
    
    def test_k_anonymity_multiple_violations(self, engine):
        """Test dataset with multiple k-anonymity violations."""
        records = [
            # Group 1: 1 record (violation)
            {"district": "Mumbai", "age": "20-24", "gender": "M"},
            # Group 2: 2 records (violation)
            *[{"district": "Delhi", "age": "30-34", "gender": "F"} for _ in range(2)],
            # Group 3: 6 records (compliant)
            *[{"district": "Kolkata", "age": "40-44", "gender": "M"} for _ in range(6)]
        ]
        
        quasi_identifiers = ["district", "age", "gender"]
        is_compliant, report = engine.verify_k_anonymity(records, quasi_identifiers)
        
        assert is_compliant is False
        assert report["violations"] == 2
        assert report["smallest_group_size"] == 1


class TestPIIFieldMap:
    """Test PII field classification mapping."""
    
    def test_pii_field_map_structure(self):
        """Test PII field map has correct structure."""
        assert hasattr(PII_FIELD_MAP, 'TABLE_CLASSIFICATIONS')
        assert isinstance(PII_FIELD_MAP.TABLE_CLASSIFICATIONS, dict)
        
        # Check key tables exist
        required_tables = ["patients", "doctors", "asha_workers", "monitoring_sessions"]
        for table in required_tables:
            assert table in PII_FIELD_MAP.TABLE_CLASSIFICATIONS
    
    def test_patients_table_classification(self):
        """Test patients table has correct PII classifications."""
        patients_fields = PII_FIELD_MAP.TABLE_CLASSIFICATIONS["patients"]
        
        # Direct identifiers
        direct_ids = ["patient_id", "name", "phone", "aadhar_id"]
        for field in direct_ids:
            assert patients_fields[field] == SensitivityLevel.DIRECT_IDENTIFIER
        
        # Quasi-identifiers
        quasi_ids = ["age", "gender", "village", "consent_given_at"]
        for field in quasi_ids:
            assert patients_fields[field] == SensitivityLevel.QUASI_IDENTIFIER
        
        # Non-sensitive
        non_sensitive = ["district", "created_at"]
        for field in non_sensitive:
            assert patients_fields[field] == SensitivityLevel.NON_SENSITIVE
    
    def test_all_tables_have_classifications(self):
        """Test all 26 tables have PII classifications."""
        expected_tables = [
            "users", "patients", "patient_medical_history", "wound_sites",
            "monitoring_sessions", "photographs", "ai_results", "alerts",
            "asha_workers", "asha_patient_assignments", "asha_commissions",
            "asha_training_modules", "doctors", "doctor_patient_assignments",
            "teleconsult_requests", "prescriptions", "subscription_tiers",
            "subscriptions", "payment_transactions", "session_schedule",
            "notifications", "notification_preferences", "audit_logs",
            "research_exports", "consents", "app_config"
        ]
        
        for table in expected_tables:
            assert table in PII_FIELD_MAP.TABLE_CLASSIFICATIONS, f"Missing table: {table}"


class TestFactoryFunction:
    """Test factory function."""
    
    def test_get_anonymisation_engine(self):
        """Test factory function returns correct instance."""
        engine = get_anonymisation_engine()
        
        assert isinstance(engine, AnonymisationEngine)
        assert hasattr(engine, 'salt_manager')
        assert hasattr(engine, 'pseudonymise_id')
        assert hasattr(engine, 'anonymise_record')


class TestIntegrationScenarios:
    """Integration tests with realistic scenarios."""
    
    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()
    
    def test_full_patient_export_scenario(self, engine):
        """Test complete patient data export scenario."""
        # Realistic patient records
        patient_records = [
            {
                "patient_id": "pat_001",
                "name": "Rajesh Kumar",
                "phone": "9876543210",
                "age": 44,
                "gender": "M",
                "village": "Rampur",
                "district": "Mumbai",
                "aadhar_id": "1234-5678-9012",
                "consent_given_at": "2024-01-15T10:30:00Z",
                "hba1c": 8.5,
                "diabetes_duration_years": 12,
                "created_at": "2024-01-15T10:30:00Z"
            },
            {
                "patient_id": "pat_002",
                "name": "Priya Sharma",
                "phone": "9876543211",
                "age": 44,
                "gender": "M",
                "village": "Rampur",
                "district": "Mumbai",
                "aadhar_id": "1234-5678-9013",
                "consent_given_at": "2024-01-16T11:00:00Z",
                "hba1c": 7.2,
                "diabetes_duration_years": 8,
                "created_at": "2024-01-16T11:00:00Z"
            },
            # Add 3 more similar records to meet k-anonymity
            *[
                {
                    "patient_id": f"pat_00{i}",
                    "name": f"Patient {i}",
                    "phone": f"987654321{i}",
                    "age": 44,  # Same age band as others
                    "gender": "M",
                    "village": "Rampur",
                    "district": "Mumbai",
                    "aadhar_id": f"1234-5678-901{i}",
                    "consent_given_at": f"2024-01-1{i}T10:00:00Z",
                    "hba1c": 7.5,
                    "diabetes_duration_years": 10,
                    "created_at": f"2024-01-1{i}T10:00:00Z"
                }
                for i in range(3, 6)
            ]
        ]
        
        # Anonymise dataset
        anonymised_records = engine.anonymise_dataset("patients", patient_records)
        
        # Verify anonymisation
        assert len(anonymised_records) == 5
        
        for record in anonymised_records:
            # Direct identifiers removed
            assert "patient_id" not in record
            assert "name" not in record
            assert "phone" not in record
            assert "aadhar_id" not in record
            
            # Quasi-identifiers generalised
            assert record["age"] in ["40-44", "45-49"]
            assert "village" not in record
            assert record["district"] == "Mumbai"
            
            # Non-sensitive preserved
            assert "hba1c" in record
            assert "created_at" in record
        
        # Verify k-anonymity
        quasi_identifiers = ["district", "age", "gender"]
        is_compliant, report = engine.verify_k_anonymity(anonymised_records, quasi_identifiers)
        
        assert is_compliant is True
        assert report["violations"] == 0
    
    def test_mixed_sensitivity_wound_data(self, engine):
        """Test wound monitoring data with mixed sensitivity levels."""
        wound_records = [
            {
                "session_id": "sess_001",
                "patient_id": "pat_001",
                "wound_site_id": "wound_001",
                "session_date": "2024-01-15T14:30:00Z",
                "asha_worker_id": "asha_001",
                "notes": "Wound healing well",
                "created_at": "2024-01-15T14:30:00Z"
            }
        ]
        
        anonymised = engine.anonymise_dataset("monitoring_sessions", wound_records)
        
        assert len(anonymised) == 1
        record = anonymised[0]
        
        # Check anonymisation based on PII classification
        # (This would depend on the actual classification in PII_FIELD_MAP)
        assert "notes" in record  # Non-sensitive preserved
        assert "created_at" in record


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])