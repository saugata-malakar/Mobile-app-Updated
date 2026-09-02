"""
Healthcare Privacy & Anonymisation Module

Implements DPDP Act 2023 compliance:
- HMAC-SHA256 pseudonymisation with rotating salt
- Age generalisation to 5-year bands
- Village name stripping
- k-anonymity (k ≥ 5) verification
- Data export path integration

Owner: Saugata Malakar
"""

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class SensitivityLevel(Enum):
    """PII classification levels."""
    DIRECT_IDENTIFIER = "direct_identifier"
    QUASI_IDENTIFIER = "quasi_identifier"
    NON_SENSITIVE = "non_sensitive"


class PII_FIELD_MAP:
    """
    Comprehensive PII classification for all 26 database tables.
    Matches docs/PII_FIELD_MAP.md
    """

    # Tables and their field classifications
    TABLE_CLASSIFICATIONS = {
        "users": {
            "user_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "email": SensitivityLevel.DIRECT_IDENTIFIER,
            "phone": SensitivityLevel.DIRECT_IDENTIFIER,
            "password_hash": SensitivityLevel.DIRECT_IDENTIFIER,
            "role": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
            "updated_at": SensitivityLevel.NON_SENSITIVE,
        },
        "patients": {
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "name": SensitivityLevel.DIRECT_IDENTIFIER,
            "phone": SensitivityLevel.DIRECT_IDENTIFIER,
            "email": SensitivityLevel.DIRECT_IDENTIFIER,
            "age": SensitivityLevel.QUASI_IDENTIFIER,
            "gender": SensitivityLevel.QUASI_IDENTIFIER,
            "village": SensitivityLevel.QUASI_IDENTIFIER,
            "district": SensitivityLevel.NON_SENSITIVE,
            "aadhar_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "consent_given_at": SensitivityLevel.QUASI_IDENTIFIER,
            "consent_version": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "patient_medical_history": {
            "history_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "hba1c": SensitivityLevel.NON_SENSITIVE,
            "diabetes_duration_years": SensitivityLevel.QUASI_IDENTIFIER,
            "blood_pressure": SensitivityLevel.NON_SENSITIVE,
            "prior_foot_problems": SensitivityLevel.NON_SENSITIVE,
            "current_medications": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "wound_sites": {
            "wound_site_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "location_code": SensitivityLevel.NON_SENSITIVE,
            "initial_date": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "monitoring_sessions": {
            "session_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "wound_site_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "session_date": SensitivityLevel.QUASI_IDENTIFIER,
            "asha_worker_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "notes": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "photographs": {
            "photo_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "session_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "file_path": SensitivityLevel.QUASI_IDENTIFIER,
            "file_hash": SensitivityLevel.NON_SENSITIVE,
            "encrypted": SensitivityLevel.NON_SENSITIVE,
            "taken_at": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "ai_results": {
            "result_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "session_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "model_name": SensitivityLevel.NON_SENSITIVE,
            "model_version": SensitivityLevel.NON_SENSITIVE,
            "wagner_grade": SensitivityLevel.NON_SENSITIVE,
            "tissue_type": SensitivityLevel.NON_SENSITIVE,
            "infection_probability": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "alerts": {
            "alert_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "severity": SensitivityLevel.NON_SENSITIVE,
            "message": SensitivityLevel.NON_SENSITIVE,
            "acknowledged_at": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "asha_workers": {
            "worker_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "name": SensitivityLevel.DIRECT_IDENTIFIER,
            "phone": SensitivityLevel.DIRECT_IDENTIFIER,
            "pin_hash": SensitivityLevel.DIRECT_IDENTIFIER,
            "village": SensitivityLevel.QUASI_IDENTIFIER,
            "district": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "asha_patient_assignments": {
            "assignment_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "asha_worker_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "assigned_at": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "asha_commissions": {
            "commission_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "asha_worker_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "amount": SensitivityLevel.NON_SENSITIVE,
            "period": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "asha_training_modules": {
            "module_id": SensitivityLevel.NON_SENSITIVE,
            "name": SensitivityLevel.NON_SENSITIVE,
            "content": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "doctors": {
            "doctor_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "name": SensitivityLevel.DIRECT_IDENTIFIER,
            "email": SensitivityLevel.DIRECT_IDENTIFIER,
            "nmc_number": SensitivityLevel.DIRECT_IDENTIFIER,
            "specialisation": SensitivityLevel.NON_SENSITIVE,
            "languages": SensitivityLevel.NON_SENSITIVE,
            "fee_per_consult": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "doctor_patient_assignments": {
            "assignment_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "doctor_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "assigned_at": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "teleconsult_requests": {
            "request_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "doctor_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "requested_at": SensitivityLevel.QUASI_IDENTIFIER,
            "completed_at": SensitivityLevel.QUASI_IDENTIFIER,
            "notes": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "prescriptions": {
            "prescription_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "doctor_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "medicine": SensitivityLevel.NON_SENSITIVE,
            "dosage": SensitivityLevel.NON_SENSITIVE,
            "duration_days": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "subscription_tiers": {
            "tier_id": SensitivityLevel.NON_SENSITIVE,
            "name": SensitivityLevel.NON_SENSITIVE,
            "price": SensitivityLevel.NON_SENSITIVE,
            "features": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "subscriptions": {
            "subscription_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "tier_id": SensitivityLevel.NON_SENSITIVE,
            "start_date": SensitivityLevel.QUASI_IDENTIFIER,
            "end_date": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "payment_transactions": {
            "transaction_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "amount": SensitivityLevel.NON_SENSITIVE,
            "transaction_date": SensitivityLevel.QUASI_IDENTIFIER,
            "status": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "session_schedule": {
            "schedule_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "asha_worker_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "scheduled_date": SensitivityLevel.QUASI_IDENTIFIER,
            "reminder_sent_at": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "notifications": {
            "notification_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "user_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "message": SensitivityLevel.NON_SENSITIVE,
            "read_at": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "notification_preferences": {
            "pref_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "user_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "sms_enabled": SensitivityLevel.NON_SENSITIVE,
            "email_enabled": SensitivityLevel.NON_SENSITIVE,
            "push_enabled": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "audit_logs": {
            "log_id": SensitivityLevel.NON_SENSITIVE,
            "user_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "action": SensitivityLevel.NON_SENSITIVE,
            "table_name": SensitivityLevel.NON_SENSITIVE,
            "record_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "timestamp": SensitivityLevel.NON_SENSITIVE,
        },
        "research_exports": {
            "export_id": SensitivityLevel.NON_SENSITIVE,
            "exported_by": SensitivityLevel.DIRECT_IDENTIFIER,
            "table_name": SensitivityLevel.NON_SENSITIVE,
            "row_count": SensitivityLevel.NON_SENSITIVE,
            "k_anonymity_verified": SensitivityLevel.NON_SENSITIVE,
            "export_date": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "consents": {
            "consent_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "patient_id": SensitivityLevel.DIRECT_IDENTIFIER,
            "consent_version": SensitivityLevel.NON_SENSITIVE,
            "data_use_category": SensitivityLevel.NON_SENSITIVE,
            "given_at": SensitivityLevel.QUASI_IDENTIFIER,
            "expires_at": SensitivityLevel.QUASI_IDENTIFIER,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
        "app_config": {
            "config_id": SensitivityLevel.NON_SENSITIVE,
            "key": SensitivityLevel.NON_SENSITIVE,
            "value": SensitivityLevel.NON_SENSITIVE,
            "created_at": SensitivityLevel.NON_SENSITIVE,
        },
    }


class RotatingSaltManager:
    """Manages 90-day rotating salt for HMAC pseudonymisation."""

    def __init__(self, salt_key: str = "ANONYMISATION_SALT"):
        """
        Initialize with salt key from environment.
        
        Args:
            salt_key: Environment variable name for master salt
        """
        self.master_salt = os.getenv(salt_key, "default-dev-salt-change-in-production")
        self.rotation_days = 90
        self.current_salt = self._generate_salt()

    def _generate_salt(self) -> str:
        """Generate salt based on current rotation epoch."""
        epoch = datetime.utcnow().date()
        rotation_epoch = (epoch.toordinal() - 1) // self.rotation_days
        salt_input = f"{self.master_salt}:{rotation_epoch}"
        return hashlib.sha256(salt_input.encode()).hexdigest()[:16]

    def get_current_salt(self) -> str:
        """Return current active salt."""
        return self.current_salt

    def get_salt_for_date(self, date: datetime) -> str:
        """Get salt that was active on a specific date."""
        rotation_epoch = (date.date().toordinal() - 1) // self.rotation_days
        salt_input = f"{self.master_salt}:{rotation_epoch}"
        return hashlib.sha256(salt_input.encode()).hexdigest()[:16]


class AnonymisationEngine:
    """
    Core anonymisation logic.
    Implements DPDP Act 2023 requirements.
    """

    K_ANONYMITY_THRESHOLD = 5  # Minimum records per quasi-identifier group

    def __init__(self):
        self.salt_manager = RotatingSaltManager()

    def pseudonymise_id(self, identifier: str, id_type: str = "patient") -> str:
        """
        Pseudonymise an identifier using HMAC-SHA256 with rotating salt.

        Args:
            identifier: The ID to pseudonymise (patient_id, user_id, etc.)
            id_type: Type of ID (for domain separation)

        Returns:
            64-character hex string
        """
        salt = self.salt_manager.get_current_salt()
        key = f"{id_type}:{salt}".encode()
        pseudonym = hmac.new(
            key, identifier.encode(), hashlib.sha256
        ).hexdigest()
        return pseudonym

    def generalise_age(self, age: int) -> str:
        """
        Generalise age to 5-year bands.

        Args:
            age: Age in years

        Returns:
            Age band as string, e.g., "35-39"
        """
        if age < 0 or age > 150:
            return "unknown"
        band_start = (age // 5) * 5
        band_end = band_start + 4
        if band_start >= 75:
            return "75+"
        return f"{band_start}-{band_end}"


    def generalise_diabetes_duration(self, years: int) -> str:
        """
        Generalise diabetes duration to 2-year bands.

        Args:
            years: Duration in years

        Returns:
            Duration band, e.g., "2-3 years"
        """
        if years < 0:
            return "unknown"
        band_start = (years // 2) * 2
        band_end = band_start + 1
        return f"{band_start}-{band_end} years"

    def strip_village(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove village field from record; keep district.

        Args:
            record: Database record

        Returns:
            Record with village removed
        """
        record_copy = record.copy()
        if "village" in record_copy:
            del record_copy["village"]
        return record_copy

    def generalise_timestamp(
        self, timestamp: datetime, precision: str = "hour"
    ) -> datetime:
        """
        Generalise timestamp to reduce re-identification risk.

        Args:
            timestamp: Original timestamp
            precision: 'hour', 'day', or 'month'

        Returns:
            Generalised timestamp
        """
        if not timestamp:
            return None

        if precision == "hour":
            return timestamp.replace(minute=0, second=0, microsecond=0)
        elif precision == "day":
            return timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
        elif precision == "month":
            return timestamp.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            return timestamp

    def anonymise_record(
        self, table_name: str, record: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Anonymise a single database record.

        Args:
            table_name: Name of the table
            record: Database record as dict

        Returns:
            Anonymised record
        """
        if table_name not in PII_FIELD_MAP.TABLE_CLASSIFICATIONS:
            logger.warning(f"Unknown table: {table_name}")
            return record

        classifications = PII_FIELD_MAP.TABLE_CLASSIFICATIONS[table_name]
        anonymised = {}

        for field, value in record.items():
            if field not in classifications:
                logger.warning(f"Unknown field {table_name}.{field}")
                anonymised[field] = value
                continue

            sensitivity = classifications[field]

            if sensitivity == SensitivityLevel.DIRECT_IDENTIFIER:
                # Remove direct identifiers from export
                continue

            elif sensitivity == SensitivityLevel.QUASI_IDENTIFIER:
                # Generalise quasi-identifiers
                if field == "age" and isinstance(value, int):
                    anonymised[field] = self.generalise_age(value)
                elif field == "diabetes_duration_years" and isinstance(value, int):
                    anonymised[field] = self.generalise_diabetes_duration(value)
                elif field == "village":
                    continue  # Strip village
                elif field in [
                    "consent_given_at",
                    "initial_date",
                    "taken_at",
                    "requested_at",
                    "completed_at",
                    "acknowledged_at",
                    "assigned_at",
                    "read_at",
                    "given_at",
                    "expires_at",
                    "session_date",
                    "start_date",
                    "end_date",
                    "transaction_date",
                    "reminder_sent_at",
                    "scheduled_date",
                    "export_date",
                ]:
                    if isinstance(value, str):
                        try:
                            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                        except:
                            dt = value
                    else:
                        dt = value

                    # Generalise timestamps
                    if field in ["taken_at", "requested_at", "completed_at"]:
                        anonymised[field] = str(
                            self.generalise_timestamp(dt, precision="hour")
                        )
                    elif field in [
                        "acknowledged_at",
                        "read_at",
                        "reminder_sent_at",
                        "session_date",
                    ]:
                        anonymised[field] = str(
                            self.generalise_timestamp(dt, precision="day")
                        )
                    else:
                        anonymised[field] = str(
                            self.generalise_timestamp(dt, precision="month")
                        )
                elif field == "file_path":
                    # Anonymise file path
                    anonymised[field] = f"photo_{self.pseudonymise_id(value, 'file')[:8]}"
                else:
                    anonymised[field] = value

            else:  # NON_SENSITIVE
                anonymised[field] = value

        return anonymised

    def anonymise_dataset(
        self, table_name: str, records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Anonymise a full dataset (multiple records).

        Args:
            table_name: Name of the table
            records: List of database records

        Returns:
            List of anonymised records
        """
        return [self.anonymise_record(table_name, record) for record in records]

    def verify_k_anonymity(
        self, records: List[Dict[str, Any]], quasi_identifiers: List[str]
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Verify that dataset meets k-anonymity threshold (k ≥ 5).

        Groups records by quasi-identifiers and checks that each group has
        at least K_ANONYMITY_THRESHOLD records.

        Args:
            records: List of (anonymised) records
            quasi_identifiers: Fields to group by (e.g., ['district', 'age', 'gender'])

        Returns:
            (is_k_anonymous, report_dict)
        """
        if not records:
            return True, {
                "total_records": 0,
                "total_groups": 0,
                "quasi_identifiers": quasi_identifiers,
                "k_anonymity_threshold": self.K_ANONYMITY_THRESHOLD,
                "violations": 0,
                "violation_keys": [],
                "smallest_group_size": 0,
                "is_k_anonymous": True
            }

        # Group records
        groups = {}
        for record in records:
            key = tuple(record.get(qi, "unknown") for qi in quasi_identifiers)
            if key not in groups:
                groups[key] = []
            groups[key].append(record)

        # Check k-anonymity threshold
        violations = 0
        violation_keys = []
        for key, group_records in groups.items():
            if len(group_records) < self.K_ANONYMITY_THRESHOLD:
                violations += 1
                violation_keys.append(key)

        is_k_anonymous = violations == 0

        report = {
            "total_records": len(records),
            "total_groups": len(groups),
            "quasi_identifiers": quasi_identifiers,
            "k_anonymity_threshold": self.K_ANONYMITY_THRESHOLD,
            "violations": violations,
            "violation_keys": violation_keys[:10],  # First 10
            "smallest_group_size": min(len(g) for g in groups.values()) if groups else 0,
            "is_k_anonymous": is_k_anonymous,
        }

        return is_k_anonymous, report


def get_anonymisation_engine() -> AnonymisationEngine:
    """Factory function to get anonymisation engine."""
    return AnonymisationEngine()

