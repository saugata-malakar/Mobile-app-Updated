"""
Structured logging for FastAPI and audit trail integration.

Integrates with privacy module (backend/database/privacy.py) for audit logging.

Owner: Saugata Malakar (privacy) + Sahil Kumar Gupta (logging)
"""

import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any
import uuid

from backend.utils.config import settings


# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)

logger = logging.getLogger("diabetescare")


class AuditLogger:
    """
    Structured audit logging for DPDP Act compliance.
    
    Logs all data access, export, deletion, and sensitive operations.
    Integrates with backend/database/AuditLog model.
    """
    
    @staticmethod
    def log_data_export(
        user_id: str,
        user_type: str,
        table: str,
        record_count: int,
        k_anonymity_verified: bool,
        export_id: Optional[str] = None,
    ) -> str:
        """
        Log data export event (DPDP compliance).
        
        Args:
            user_id: User making the export request
            user_type: "patient", "doctor", "researcher", etc.
            table: Table name being exported
            record_count: Number of records exported
            k_anonymity_verified: Whether k-anonymity threshold met
            export_id: Unique export transaction ID
        
        Returns:
            export_id for audit trail tracking
        """
        if export_id is None:
            export_id = str(uuid.uuid4())
        
        log_entry = {
            "event": "data_export",
            "export_id": export_id,
            "user_id": user_id,
            "user_type": user_type,
            "table": table,
            "record_count": record_count,
            "k_anonymity_verified": k_anonymity_verified,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        logger.info(f"DATA_EXPORT: {json.dumps(log_entry)}")
        
        # TODO: Write to backend/database/AuditLog model
        # audit_log = AuditLog(
        #     action="data_export",
        #     record_id=export_id,
        #     user_id=user_id,
        #     metadata=json.dumps(log_entry),
        # )
        # db.add(audit_log)
        # db.commit()
        
        return export_id
    
    @staticmethod
    def log_patient_deletion(
        patient_id: str,
        user_id: str,
        reason: str,
        rows_deleted: int,
    ) -> str:
        """
        Log patient data deletion (DPDP Section 8 - Right to Erasure).
        
        Args:
            patient_id: Patient being deleted
            user_id: User requesting deletion
            reason: Reason for deletion ("withdrawal", "DPDP_request", "admin")
            rows_deleted: Total rows deleted across all tables
        
        Returns:
            deletion_id for tracking
        """
        deletion_id = str(uuid.uuid4())
        
        log_entry = {
            "event": "patient_deletion",
            "deletion_id": deletion_id,
            "patient_id": patient_id,
            "user_id": user_id,
            "reason": reason,
            "rows_deleted": rows_deleted,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        logger.warning(f"PATIENT_DELETION: {json.dumps(log_entry)}")
        
        return deletion_id
    
    @staticmethod
    def log_consent_change(
        patient_id: str,
        old_version: int,
        new_version: int,
        change_type: str,  # "new", "withdrawal", "update"
    ) -> None:
        """
        Log consent change for audit trail.
        
        Args:
            patient_id: Patient ID
            old_version: Previous consent version
            new_version: New consent version
            change_type: Type of change
        """
        log_entry = {
            "event": "consent_change",
            "patient_id": patient_id,
            "old_version": old_version,
            "new_version": new_version,
            "change_type": change_type,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        logger.info(f"CONSENT_CHANGE: {json.dumps(log_entry)}")
    
    @staticmethod
    def log_inference(
        model_name: str,
        model_version: str,
        input_hash: str,
        output: Dict[str, Any],
        confidence: float,
        latency_ms: float,
    ) -> None:
        """
        Log ML inference for model tracking.
        
        Args:
            model_name: "wound_severity", "skin_classifier", "eye_anemia"
            model_version: Semantic version of model
            input_hash: Hash of input image (for deduplication)
            output: Model output (Wagner grade, confidence, etc.)
            confidence: Overall confidence score
            latency_ms: Inference time in milliseconds
        """
        log_entry = {
            "event": "inference",
            "model": model_name,
            "version": model_version,
            "input_hash": input_hash,
            "confidence": confidence,
            "latency_ms": latency_ms,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        logger.info(f"INFERENCE: {json.dumps(log_entry)}")
    
    @staticmethod
    def log_error(
        error_type: str,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log errors with context for debugging.
        
        Args:
            error_type: "auth_failed", "validation_error", "db_error", etc.
            message: Error message
            context: Additional context
        """
        log_entry = {
            "event": "error",
            "error_type": error_type,
            "message": message,
            "context": context,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        logger.error(f"ERROR: {json.dumps(log_entry)}")


def get_logger(name: str) -> logging.Logger:
    """Get logger instance for a module."""
    return logging.getLogger(name)
