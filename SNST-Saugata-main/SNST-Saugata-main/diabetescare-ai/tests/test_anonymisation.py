"""
Unit tests for anonymisation module.

Tests:
- HMAC pseudonymisation determinism
- Age band generalization  
- Village stripping
- Timestamp generalization
- k-anonymity verification (k >= 5)
- Full record anonymisation

Owner: Saugata Malakar
"""

import pytest
from datetime import datetime, timedelta
from backend.database.privacy import (
    AnonymisationEngine,
    PII_FIELD_MAP,
    SensitivityLevel,
    RotatingSaltManager,
)


class TestRotatingSalt:
    """Test rotating salt generation and determinism."""

    def test_salt_generation(self):
        """Salt should be generated deterministically."""
        manager1 = RotatingSaltManager()
        manager2 = RotatingSaltManager()
        
        assert manager1.get_current_salt() == manager2.get_current_salt()

    def test_salt_is_valid_hex(self):
        """Salt should be valid hex string."""
        manager = RotatingSaltManager()
        salt = manager.get_current_salt()
        
        assert len(salt) == 16
        assert all(c in '0123456789abcdef' for c in salt)

    def test_salt_for_date(self):
        """Salt should be consistent for same date."""
        manager = RotatingSaltManager()
        today = datetime.utcnow()
        
        salt1 = manager.get_salt_for_date(today)
        salt2 = manager.get_salt_for_date(today)
        
        assert salt1 == salt2


class TestPseudonymisation:
    """Test HMAC-SHA256 pseudonymisation."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_pseudonymise_id_length(self, engine):
        """Pseudonym should be 64-character hex."""
        pseudonym = engine.pseudonymise_id("patient-123")
        
        assert len(pseudonym) == 64
        assert all(c in '0123456789abcdef' for c in pseudonym)

    def test_pseudonymise_id_deterministic(self, engine):
        """Same input should produce same pseudonym."""
        id1 = "patient-123"
        pseudonym1 = engine.pseudonymise_id(id1)
        pseudonym2 = engine.pseudonymise_id(id1)
        
        assert pseudonym1 == pseudonym2

    def test_pseudonymise_different_ids(self, engine):
        """Different inputs should produce different pseudonyms."""
        pseudonym1 = engine.pseudonymise_id("patient-123")
        pseudonym2 = engine.pseudonymise_id("patient-124")
        
        assert pseudonym1 != pseudonym2

    def test_pseudonymise_id_type_separation(self, engine):
        """Different ID types should produce different pseudonyms."""
        id_str = "123456"
        pseudonym_patient = engine.pseudonymise_id(id_str, id_type="patient")
        pseudonym_user = engine.pseudonymise_id(id_str, id_type="user")
        
        assert pseudonym_patient != pseudonym_user


class TestAgeGeneralization:
    """Test age band generalization."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_age_bands(self, engine):
        """Age should be generalized to correct 5-year band."""
        test_cases = [
            (0, "0-4"),
            (4, "0-4"),
            (5, "5-9"),
            (9, "5-9"),
            (35, "35-39"),
            (50, "50-54"),
            (75, "75+"),
            (100, "75+"),
            (150, "75+"),
        ]
        
        for age, expected_band in test_cases:
            band = engine.generalise_age(age)
            assert band == expected_band, f"Age {age} should be {expected_band}, got {band}"

    def test_negative_age(self, engine):
        """Negative age should return 'unknown'."""
        assert engine.generalise_age(-1) == "unknown"

    def test_invalid_age(self, engine):
        """Invalid age should return 'unknown'."""
        assert engine.generalise_age(200) == "unknown"


class TestDiabetesDurationGeneralization:
    """Test diabetes duration band generalization."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_duration_bands(self, engine):
        """Duration should be generalized to correct 2-year band."""
        test_cases = [
            (0, "0-1 years"),
            (1, "0-1 years"),
            (2, "2-3 years"),
            (3, "2-3 years"),
            (5, "4-5 years"),
            (10, "10-11 years"),
        ]
        
        for years, expected_band in test_cases:
            band = engine.generalise_diabetes_duration(years)
            assert band == expected_band

    def test_negative_duration(self, engine):
        """Negative duration should return 'unknown'."""
        assert engine.generalise_diabetes_duration(-1) == "unknown"


class TestTimestampGeneralization:
    """Test timestamp generalization."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_hour_precision(self, engine):
        """Hour precision should remove minutes/seconds."""
        ts = datetime(2024, 11, 15, 14, 32, 45, 123456)
        generalized = engine.generalise_timestamp(ts, precision="hour")
        
        assert generalized.hour == 14
        assert generalized.minute == 0
        assert generalized.second == 0
        assert generalized.microsecond == 0

    def test_day_precision(self, engine):
        """Day precision should remove time of day."""
        ts = datetime(2024, 11, 15, 14, 32, 45)
        generalized = engine.generalise_timestamp(ts, precision="day")
        
        assert generalized.hour == 0
        assert generalized.minute == 0
        assert generalized.second == 0

    def test_month_precision(self, engine):
        """Month precision should remove day and time."""
        ts = datetime(2024, 11, 15, 14, 32, 45)
        generalized = engine.generalise_timestamp(ts, precision="month")
        
        assert generalized.day == 1
        assert generalized.hour == 0

    def test_none_timestamp(self, engine):
        """None timestamp should return None."""
        assert engine.generalise_timestamp(None) is None


class TestVillageStripping:
    """Test village field removal."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_strip_village(self, engine):
        """Village field should be removed."""
        record = {
            "patient_id": "123",
            "village": "Kharagpur",
            "district": "Paschim Medinipur",
        }
        
        stripped = engine.strip_village(record)
        
        assert "village" not in stripped
        assert "district" in stripped
        assert stripped["district"] == "Paschim Medinipur"

    def test_strip_village_no_village_field(self, engine):
        """Record without village should not raise error."""
        record = {
            "patient_id": "123",
            "district": "Paschim Medinipur",
        }
        
        stripped = engine.strip_village(record)
        assert "village" not in stripped


class TestRecordAnonymisation:
    """Test full record anonymisation."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_anonymise_patient_record(self, engine):
        """Patient record should be anonymised correctly."""
        record = {
            "patient_id": "pat-123",
            "name": "John Doe",
            "phone": "9876543210",
            "age": 35,
            "gender": "Male",
            "village": "Kharagpur",
            "district": "Paschim Medinipur",
            "aadhar_id": "123456789012",
            "consent_given_at": "2024-01-15T10:30:00",
        }
        
        anonymised = engine.anonymise_record("patients", record)
        
        # Direct identifiers should be removed
        assert "patient_id" not in anonymised
        assert "name" not in anonymised
        assert "phone" not in anonymised
        assert "aadhar_id" not in anonymised
        
        # Quasi-identifiers should be generalised
        assert anonymised["age"] == "35-39"
        assert anonymised["gender"] == "Male"  # Retained (2-value, low risk)
        assert "village" not in anonymised
        assert anonymised["district"] == "Paschim Medinipur"
        assert "2024-01" in anonymised["consent_given_at"]  # Month precision

    def test_anonymise_session_record(self, engine):
        """Monitoring session should be anonymised."""
        record = {
            "session_id": "sess-456",
            "patient_id": "pat-123",
            "wound_site_id": "site-789",
            "session_date": "2024-11-15",
            "notes": "Wound shows improvement",
        }
        
        anonymised = engine.anonymise_record("monitoring_sessions", record)
        
        assert "session_id" not in anonymised
        assert "patient_id" not in anonymised
        assert "wound_site_id" not in anonymised
        assert anonymised["notes"] == "Wound shows improvement"
        assert "2024-11" in anonymised["session_date"]  # Month precision


class TestDatasetAnonymisation:
    """Test anonymisation of full datasets."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_anonymise_dataset(self, engine):
        """Dataset should be anonymised record by record."""
        records = [
            {
                "patient_id": "pat-1",
                "age": 35,
                "village": "Kharagpur",
                "district": "Paschim Medinipur",
            },
            {
                "patient_id": "pat-2",
                "age": 45,
                "village": "Midnapore",
                "district": "Paschim Medinipur",
            },
        ]
        
        anonymised = engine.anonymise_dataset("patients", records)
        
        assert len(anonymised) == 2
        assert all("patient_id" not in r for r in anonymised)
        assert all("village" not in r for r in anonymised)


class TestKAnonymityVerification:
    """Test k-anonymity verification (k >= 5)."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_k_anonymity_met(self, engine):
        """Dataset should pass k-anonymity if all groups have >= 5 records."""
        # Create 6 records with same quasi-identifiers
        records = [
            {"district": "Paschim Medinipur", "age": "35-39", "gender": "Male"}
            for _ in range(6)
        ]
        
        is_k_anon, report = engine.verify_k_anonymity(
            records, ["district", "age", "gender"]
        )
        
        assert is_k_anon is True
        assert report["violations"] == 0
        assert report["smallest_group_size"] == 6

    def test_k_anonymity_not_met(self, engine):
        """Dataset should fail k-anonymity if any group has < 5 records."""
        records = [
            {"district": "Paschim Medinipur", "age": "35-39", "gender": "Male"},
            {"district": "Paschim Medinipur", "age": "35-39", "gender": "Male"},
            {"district": "Paschim Medinipur", "age": "40-44", "gender": "Female"},
        ]
        
        is_k_anon, report = engine.verify_k_anonymity(
            records, ["district", "age", "gender"]
        )
        
        assert is_k_anon is False
        assert report["violations"] == 2
        assert report["smallest_group_size"] == 1

    def test_k_anonymity_edge_case_five_records(self, engine):
        """Exactly 5 records should pass k-anonymity threshold."""
        records = [
            {"district": "Paschim Medinipur", "age": "35-39", "gender": "Male"}
            for _ in range(5)
        ]
        
        is_k_anon, report = engine.verify_k_anonymity(
            records, ["district", "age", "gender"]
        )
        
        assert is_k_anon is True
        assert report["smallest_group_size"] == 5

    def test_k_anonymity_edge_case_four_records(self, engine):
        """Only 4 records should fail k-anonymity threshold."""
        records = [
            {"district": "Paschim Medinipur", "age": "35-39", "gender": "Male"}
            for _ in range(4)
        ]
        
        is_k_anon, report = engine.verify_k_anonymity(
            records, ["district", "age", "gender"]
        )
        
        assert is_k_anon is False
        assert report["violations"] == 1

    def test_k_anonymity_empty_dataset(self, engine):
        """Empty dataset should pass (no violations possible)."""
        is_k_anon, report = engine.verify_k_anonymity([], ["district"])
        
        assert is_k_anon is True
        assert report["total_records"] == 0
        assert report["violations"] == 0

    def test_k_anonymity_with_multiple_groups(self, engine):
        """Mixed groups: some passing, some failing."""
        records = [
            # Group 1: 6 records (passes)
            *[{"district": "A", "age": "35-39"} for _ in range(6)],
            # Group 2: 3 records (fails)
            *[{"district": "B", "age": "40-44"} for _ in range(3)],
            # Group 3: 5 records (passes)
            *[{"district": "C", "age": "45-49"} for _ in range(5)],
        ]
        
        is_k_anon, report = engine.verify_k_anonymity(
            records, ["district", "age"]
        )
        
        assert is_k_anon is False
        assert report["violations"] == 1
        assert report["total_groups"] == 3


class TestPIIClassification:
    """Test PII field map coverage."""

    def test_all_26_tables_classified(self):
        """All 26 tables should be in PII map."""
        expected_tables = 26
        actual_count = len(PII_FIELD_MAP.TABLE_CLASSIFICATIONS)
        
        assert actual_count >= expected_tables, \
            f"Expected at least {expected_tables} tables, got {actual_count}"

    def test_no_unclassified_fields(self):
        """All fields in PII map should have valid classification."""
        for table, fields in PII_FIELD_MAP.TABLE_CLASSIFICATIONS.items():
            for field, sensitivity in fields.items():
                assert isinstance(sensitivity, SensitivityLevel), \
                    f"{table}.{field} has invalid sensitivity: {sensitivity}"


class TestIntegration:
    """Integration tests for full anonymisation workflow."""

    @pytest.fixture
    def engine(self):
        return AnonymisationEngine()

    def test_export_workflow(self, engine):
        """Full export workflow: filter -> anonymise -> verify k-anon."""
        # Simulated dataset (10 records, 2 districts, 3 age bands)
        dataset = [
            {"patient_id": f"pat-{i}", "age": 35 + (i % 30), 
             "district": "A" if i < 5 else "B", "gender": "M" if i % 2 == 0 else "F"}
            for i in range(10)
        ]
        
        # Anonymise
        anonymised = engine.anonymise_dataset("patients", dataset)
        
        # Verify k-anonymity
        is_k_anon, report = engine.verify_k_anonymity(
            anonymised, ["district", "age", "gender"]
        )
        
        # This dataset is likely to fail k-anonymity due to small size
        # but the workflow should complete without errors
        assert len(anonymised) == 10
        assert report["total_records"] == 10


# Pytest fixtures and configuration

@pytest.fixture(scope="session")
def engine():
    """Provide anonymisation engine for all tests."""
    return AnonymisationEngine()

