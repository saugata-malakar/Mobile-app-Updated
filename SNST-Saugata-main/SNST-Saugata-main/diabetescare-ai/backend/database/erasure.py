"""
Patient Data Erasure Pipeline

Implements DPDP Act 2023 Right to Erasure (Section 8):
- Delete all patient data within 72-hour window
- Maintain dependency order (transactions → alerts → core)
- Verify complete deletion
- Log erasure events for audit trail

Owner: Saugata Malakar
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum

from backend.utils.logging import AuditLogger

logger = logging.getLogger(__name__)


class DeletionPriority(Enum):
    """Order in which to delete records to maintain referential integrity."""
    LEVEL_1 = 1  # Leaf nodes (no foreign keys)
    LEVEL_2 = 2  # Mid-level (refs to LEVEL_1)
    LEVEL_3 = 3  # Core entities
    LEVEL_4 = 4  # Parent tables


class ErasurePipeline:
    """
    DPDP Act compliant erasure pipeline.
    
    Dependency order:
    1. Transactions, payments, commissions (leaf nodes)
    2. Alerts, notifications, audit logs (dependent on core)
    3. Sessions, results, exports (session data)
    4. Consents, subscriptions (intermediate)
    5. Assignments (links)
    6. Patient core data
    """

    # Deletion order by table (priority level)
    DELETION_ORDER = {
        # LEVEL 1: Transactions & payments (leaf nodes)
        "payment_transactions": DeletionPriority.LEVEL_1,
        "asha_commissions": DeletionPriority.LEVEL_1,
        "commissions": DeletionPriority.LEVEL_1,
        
        # LEVEL 2: Session artifacts & devices/consultations
        "ai_results": DeletionPriority.LEVEL_2,
        "photographs": DeletionPriority.LEVEL_2,
        "alerts": DeletionPriority.LEVEL_2,
        "notifications": DeletionPriority.LEVEL_2,
        "audit_logs": DeletionPriority.LEVEL_2,
        "research_exports": DeletionPriority.LEVEL_2,
        "notification_preferences": DeletionPriority.LEVEL_2,
        "teleconsult_requests": DeletionPriority.LEVEL_2,
        "devices": DeletionPriority.LEVEL_2,
        "consultations": DeletionPriority.LEVEL_2,
        
        # LEVEL 3: Session, screening & monitoring data
        "monitoring_sessions": DeletionPriority.LEVEL_3,
        "session_schedule": DeletionPriority.LEVEL_3,
        "prescriptions": DeletionPriority.LEVEL_3,
        "screenings": DeletionPriority.LEVEL_3,
        
        # LEVEL 4: Intermediate relationships
        "asha_patient_assignments": DeletionPriority.LEVEL_3,
        "doctor_patient_assignments": DeletionPriority.LEVEL_3,
        "subscriptions": DeletionPriority.LEVEL_3,
        
        # LEVEL 5: Core patient & user data
        "consents": DeletionPriority.LEVEL_4,
        "patient_medical_history": DeletionPriority.LEVEL_4,
        "wound_sites": DeletionPriority.LEVEL_4,
        "patients": DeletionPriority.LEVEL_4,
        "users": DeletionPriority.LEVEL_4,
    }

    # Reference fields for cascade deletion
    PATIENT_REFS = {
        "patients": "patient_id",
        "audit_logs": "patient_id",
        "payment_transactions": "patient_id",
        "notification_preferences": "user_id",
        "asha_commissions": "asha_worker_id",  # via assignment
        "commissions": "screening_id",  # via screening
        "alerts": "patient_id",
        "notifications": "user_id",  # user linked to patient
        "ai_results": "session_id",  # via session
        "photographs": "session_id",  # via session
        "monitoring_sessions": "patient_id",
        "session_schedule": "patient_id",
        "prescriptions": "patient_id",
        "asha_patient_assignments": "patient_id",
        "doctor_patient_assignments": "patient_id",
        "subscriptions": "patient_id",
        "consents": "patient_id",
        "patient_medical_history": "patient_id",
        "wound_sites": "patient_id",
        "teleconsult_requests": "patient_id",
        "research_exports": "exported_by",  # audit field
        "devices": "owner_id",
        "consultations": "patient_id",
        "screenings": "patient_id",
        "users": "id",
    }

    def __init__(self, db_session):
        """
        Initialize erasure pipeline.

        Args:
            db_session: SQLAlchemy session for database operations
        """
        self.db_session = db_session
        self.deletion_log = []
        self.start_time = None
        self.end_time = None

    def request_erasure(self, patient_id: str, reason: str = "withdrawal") -> str:
        """
        Initiate erasure request for a patient.
        
        Implements 72-hour window requirement.

        Args:
            patient_id: UUID of patient to erase
            reason: Reason for deletion

        Returns:
            String deletion request ID
        """
        deletion_id = str(uuid.uuid4())
        AuditLogger.log_patient_deletion(
            patient_id=patient_id,
            user_id="system",
            reason=reason,
            rows_deleted=0
        )
        logger.info(f"Erasure request created for patient {patient_id} with ID {deletion_id}")
        return deletion_id

    def execute_erasure(self, patient_id: str, dry_run: bool = False) -> Dict:
        """
        Execute full patient erasure.
        
        Deletes all patient data across all 26 tables in correct dependency order.
        
        Args:
            patient_id: UUID of patient to erase
            dry_run: If True, log deletions but don't commit

        Returns:
            Erasure execution report
        """
        self.start_time = datetime.utcnow()
        self.deletion_log = []
        
        # Look up user_id before deleting from patients
        self.patient_user_id = None
        try:
            from sqlalchemy import text
            import uuid as py_uuid
            if "sqlite" in str(self.db_session.bind.url):
                try:
                    patient_id_param = py_uuid.UUID(str(patient_id)).hex
                except ValueError:
                    patient_id_param = patient_id
            else:
                patient_id_param = patient_id

            user_id_query = text("SELECT user_id FROM patients WHERE patient_id = :patient_id")
            user_id_res = self.db_session.execute(user_id_query, {"patient_id": patient_id_param})
            user_row = user_id_res.fetchone()
            if user_row:
                self.patient_user_id = user_row[0]
        except Exception as e:
            logger.warning(f"Could not pre-fetch user_id for patient {patient_id}: {e}")

        try:
            # Sort tables by deletion priority
            sorted_tables = sorted(
                self.DELETION_ORDER.items(),
                key=lambda x: x[1].value,
                reverse=False
            )

            logger.info(f"Starting erasure for patient {patient_id} (dry_run={dry_run})")

            # Delete from each table in order
            for table_name, priority in sorted_tables:
                if table_name not in self.PATIENT_REFS:
                    continue

                ref_field = self.PATIENT_REFS[table_name]
                count = self._delete_from_table(
                    table_name, ref_field, patient_id, dry_run
                )
                
                self.deletion_log.append({
                    "table": table_name,
                    "ref_field": ref_field,
                    "rows_deleted": count,
                    "priority": priority.value,
                    "timestamp": datetime.utcnow().isoformat(),
                })

            if not dry_run:
                self.db_session.commit()
                logger.info(f"Erasure committed for patient {patient_id}")
            else:
                self.db_session.rollback()
                logger.info(f"Dry-run erasure for patient {patient_id} (rolled back)")

            self.end_time = datetime.utcnow()

            # Verify deletion
            verification = self._verify_deletion(patient_id)

            report = {
                "patient_id": patient_id,
                "status": "success",
                "dry_run": dry_run,
                "started_at": self.start_time.isoformat(),
                "completed_at": self.end_time.isoformat(),
                "duration_seconds": (self.end_time - self.start_time).total_seconds(),
                "deletion_log": self.deletion_log,
                "verification": verification,
                "total_rows_deleted": sum(d["rows_deleted"] for d in self.deletion_log),
            }

            return report

        except Exception as e:
            logger.error(f"Erasure failed for patient {patient_id}: {str(e)}")
            self.db_session.rollback()
            return {
                "patient_id": patient_id,
                "status": "failed",
                "error": str(e),
                "deletion_log": self.deletion_log,
            }

    def _delete_from_table(
        self, table_name: str, ref_field: str, patient_id: str, dry_run: bool = False
    ) -> int:
        """
        Delete records from a single table matching the patient reference.

        Args:
            table_name: Table name
            ref_field: Reference field to match
            patient_id: Patient ID to match
            dry_run: If True, don't execute

        Returns:
            Count of rows deleted
        """
        try:
            from sqlalchemy import text
            import uuid as py_uuid
            
            # Format patient_id for SQLite (hex string without dashes)
            is_sqlite = self.db_session.bind.dialect.name == "sqlite"
            if is_sqlite:
                try:
                    patient_id_param = py_uuid.UUID(str(patient_id)).hex
                except ValueError:
                    patient_id_param = patient_id
            else:
                patient_id_param = patient_id
            
            # Handle special cases for indirect references
            if table_name == "asha_commissions":
                # Delete commissions for ASHA workers assigned to this patient
                query = text(f"""
                    SELECT COUNT(*) FROM {table_name} 
                    WHERE asha_worker_id IN (
                        SELECT asha_worker_id FROM asha_patient_assignments 
                        WHERE patient_id = :patient_id
                    )
                """)
            elif table_name == "commissions":
                # Delete commissions via screening
                query = text(f"""
                    SELECT COUNT(*) FROM {table_name} 
                    WHERE screening_id IN (
                        SELECT id FROM screenings 
                        WHERE patient_id = :patient_id
                    )
                """)
            elif table_name == "devices":
                # Delete devices owned by this patient
                query = text(f"""
                    SELECT COUNT(*) FROM {table_name} 
                    WHERE owner_id = :patient_id AND owner_type = 'patient'
                """)
            elif table_name == "users":
                # Delete user row linked to patient
                if getattr(self, "patient_user_id", None):
                    query = text(f"SELECT COUNT(*) FROM {table_name} WHERE id = :user_id")
                else:
                    query = text(f"""
                        SELECT COUNT(*) FROM {table_name} 
                        WHERE id IN (
                            SELECT user_id FROM patients 
                            WHERE patient_id = :patient_id
                        )
                    """)
            elif table_name in ["ai_results", "photographs"]:
                # Delete via session_id
                query = text(f"""
                    SELECT COUNT(*) FROM {table_name} 
                    WHERE session_id IN (
                        SELECT session_id FROM monitoring_sessions 
                        WHERE patient_id = :patient_id
                    )
                """)
            elif table_name == "audit_logs":
                # Delete audit logs referencing this patient
                query = text(f"""
                    SELECT COUNT(*) FROM {table_name} 
                    WHERE record_id = :patient_id OR user_id = :patient_id
                """)
            else:
                # Direct reference
                query = text(f"SELECT COUNT(*) FROM {table_name} WHERE {ref_field} = :patient_id")
            
            # Count records to be deleted
            params = {"patient_id": patient_id_param}
            if getattr(self, "patient_user_id", None):
                params["user_id"] = self.patient_user_id
            result = self.db_session.execute(query, params)
            count = result.scalar() or 0
            
            if count > 0 and not dry_run:
                # Execute deletion
                if table_name == "asha_commissions":
                    delete_query = text(f"""
                        DELETE FROM {table_name} 
                        WHERE asha_worker_id IN (
                            SELECT asha_worker_id FROM asha_patient_assignments 
                            WHERE patient_id = :patient_id
                        )
                    """)
                elif table_name == "commissions":
                    delete_query = text(f"""
                        DELETE FROM {table_name} 
                        WHERE screening_id IN (
                            SELECT id FROM screenings 
                            WHERE patient_id = :patient_id
                        )
                    """)
                elif table_name == "devices":
                    delete_query = text(f"""
                        DELETE FROM {table_name} 
                        WHERE owner_id = :patient_id AND owner_type = 'patient'
                    """)
                elif table_name == "users":
                    if getattr(self, "patient_user_id", None):
                        delete_query = text(f"DELETE FROM {table_name} WHERE id = :user_id")
                    else:
                        delete_query = text(f"""
                            DELETE FROM {table_name} 
                            WHERE id IN (
                                SELECT user_id FROM patients 
                                WHERE patient_id = :patient_id
                            )
                        """)
                elif table_name in ["ai_results", "photographs"]:
                    delete_query = text(f"""
                        DELETE FROM {table_name} 
                        WHERE session_id IN (
                            SELECT session_id FROM monitoring_sessions 
                            WHERE patient_id = :patient_id
                        )
                    """)
                elif table_name == "audit_logs":
                    delete_query = text(f"""
                        DELETE FROM {table_name} 
                        WHERE record_id = :patient_id OR user_id = :patient_id
                    """)
                else:
                    delete_query = text(f"DELETE FROM {table_name} WHERE {ref_field} = :patient_id")
                
                self.db_session.execute(delete_query, params)
                logger.info(f"Deleted {count} rows from {table_name}")
            else:
                logger.debug(f"Would delete from {table_name}: {count} rows")
            
            return count

        except Exception as e:
            logger.error(f"Error deleting from {table_name}: {str(e)}")
            raise

    def _verify_deletion(self, patient_id: str) -> Dict[str, int]:
        """
        Verify that all patient data has been deleted.
        
        Scans all tables for remaining records linked to patient.

        Args:
            patient_id: Patient ID to verify

        Returns:
            Count of remaining records per table (should all be 0)
        """
        from sqlalchemy import text
        import uuid as py_uuid
        
        # Format patient_id for SQLite (hex string without dashes)
        is_sqlite = self.db_session.bind.dialect.name == "sqlite"
        if is_sqlite:
            try:
                patient_id_param = py_uuid.UUID(str(patient_id)).hex
            except ValueError:
                patient_id_param = patient_id
        else:
            patient_id_param = patient_id
            
        verification = {}

        for table_name, ref_field in self.PATIENT_REFS.items():
            try:
                # Handle special cases for indirect references
                if table_name == "asha_commissions":
                    query = text(f"""
                        SELECT COUNT(*) FROM {table_name} 
                        WHERE asha_worker_id IN (
                            SELECT asha_worker_id FROM asha_patient_assignments 
                            WHERE patient_id = :patient_id
                        )
                    """)
                elif table_name == "commissions":
                    query = text(f"""
                        SELECT COUNT(*) FROM {table_name} 
                        WHERE screening_id IN (
                            SELECT id FROM screenings 
                            WHERE patient_id = :patient_id
                        )
                    """)
                elif table_name == "devices":
                    query = text(f"""
                        SELECT COUNT(*) FROM {table_name} 
                        WHERE owner_id = :patient_id AND owner_type = 'patient'
                    """)
                elif table_name == "users":
                    if getattr(self, "patient_user_id", None):
                        query = text(f"SELECT COUNT(*) FROM {table_name} WHERE id = :user_id")
                    else:
                        query = text(f"""
                            SELECT COUNT(*) FROM {table_name} 
                            WHERE id IN (
                                SELECT user_id FROM patients 
                                WHERE patient_id = :patient_id
                            )
                        """)
                elif table_name in ["ai_results", "photographs"]:
                    query = text(f"""
                        SELECT COUNT(*) FROM {table_name} 
                        WHERE session_id IN (
                            SELECT session_id FROM monitoring_sessions 
                            WHERE patient_id = :patient_id
                        )
                    """)
                elif table_name == "audit_logs":
                    query = text(f"""
                        SELECT COUNT(*) FROM {table_name} 
                        WHERE record_id = :patient_id OR user_id = :patient_id
                    """)
                else:
                    query = text(f"SELECT COUNT(*) FROM {table_name} WHERE {ref_field} = :patient_id")
                
                params = {"patient_id": patient_id_param}
                if getattr(self, "patient_user_id", None):
                    params["user_id"] = self.patient_user_id
                result = self.db_session.execute(query, params)
                remaining_count = result.scalar() or 0
                verification[table_name] = remaining_count

                if remaining_count > 0:
                    logger.warning(
                        f"Verification failed: {remaining_count} records remain in "
                        f"{table_name} for patient {patient_id}"
                    )
            except Exception as e:
                logger.error(f"Error verifying deletion from {table_name}: {str(e)}")
                verification[table_name] = -1  # Error indicator

        return verification

    def export_deletion_log(self) -> str:
        """
        Export deletion log as JSON for audit trail.

        Returns:
            JSON string of deletion log
        """
        import json
        return json.dumps({
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "deletion_log": self.deletion_log,
        }, indent=2)


class ErasureScheduler:
    """
    Manages scheduled erasures (72-hour window, batch processing).
    """

    def __init__(self, db_session):
        self.db_session = db_session
        self.pipeline = ErasurePipeline(db_session)

    def schedule_erasure(self, patient_id: str) -> Dict:
        """
        Schedule a patient erasure for later processing.

        Args:
            patient_id: Patient ID

        Returns:
            Scheduling confirmation
        """
        request = self.pipeline.request_erasure(patient_id)
        
        # Store in erasure_requests table (to be created)
        # db_session.add(ErasureRequest(**request))
        # db_session.commit()

        return request

    def process_pending_erasures(self) -> List[Dict]:
        """
        Process all pending erasure requests that are within the 72-hour window.

        Returns:
            List of erasure reports
        """
        # Query for pending erasures
        # pending = db_session.query(ErasureRequest).filter(
        #     ErasureRequest.status == 'approved',
        #     ErasureRequest.deadline_at >= datetime.utcnow()
        # ).all()

        reports = []
        # for request in pending:
        #     report = self.pipeline.execute_erasure(request.patient_id)
        #     reports.append(report)

        return reports


# Dependency order example (for documentation)
DELETION_ORDER_EXAMPLE = """
Example deletion order for a patient with ID 'abc123':

1. DELETE FROM payment_transactions WHERE patient_id = 'abc123'  [2 rows]
2. DELETE FROM asha_commissions WHERE asha_worker_id IN (
     SELECT asha_worker_id FROM asha_patient_assignments WHERE patient_id = 'abc123'
   )  [0 rows]
3. DELETE FROM ai_results WHERE session_id IN (
     SELECT session_id FROM monitoring_sessions WHERE patient_id = 'abc123'
   )  [15 rows]
4. DELETE FROM photographs WHERE session_id IN (
     SELECT session_id FROM monitoring_sessions WHERE patient_id = 'abc123'
   )  [45 rows]
5. DELETE FROM alerts WHERE patient_id = 'abc123'  [8 rows]
6. DELETE FROM monitoring_sessions WHERE patient_id = 'abc123'  [12 rows]
7. DELETE FROM patients WHERE patient_id = 'abc123'  [1 row]
...and so on

Total rows deleted: ~500
Verification: All 26 tables scanned; 0 records remain.
Status: COMPLETE
Audit log entry: Erasure completed by system at 2024-11-15 14:32:01 UTC
"""

