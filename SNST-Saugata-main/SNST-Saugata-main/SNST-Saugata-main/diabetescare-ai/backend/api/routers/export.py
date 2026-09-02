"""
Data Export API Endpoint

Exposes /export endpoint that:
- Filters data by query parameters
- Runs anonymisation pipeline
- Verifies k-anonymity (k ≥ 5)
- Returns anonymised dataset or rejects if k-anon not met
- Logs export event to audit_logs

Owner: Saugata Malakar (privacy) + Sahil Kumar Gupta (API)
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import json
from sqlalchemy.orm import Session

from backend.database.privacy import (
    AnonymisationEngine,
    get_anonymisation_engine,
)
from backend.database.session import get_db
from backend.database.models import (
    Patient, MonitoringSession, AIResult, WoundSite,
    Consent, AshaWorker, AuditLog
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["data-export"])


# Request/Response Models

class ExportFilterQuery(BaseModel):
    """Filter parameters for data export."""
    table: str = Field(..., description="Table name to export")
    district: Optional[str] = Field(None, description="Filter by district")
    age_min: Optional[int] = Field(None, description="Minimum age")
    age_max: Optional[int] = Field(None, description="Maximum age")
    start_date: Optional[str] = Field(None, description="Start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date (YYYY-MM-DD)")
    include_photos: bool = Field(False, description="Include photograph paths")
    dry_run: bool = Field(False, description="Validate without exporting")


class KAnonymityReport(BaseModel):
    """k-Anonymity verification report."""
    is_k_anonymous: bool
    k_threshold: int
    total_records: int
    total_groups: int
    violations: int
    smallest_group_size: int
    quasi_identifiers: List[str]


class ExportResponse(BaseModel):
    """Export response with anonymised data and k-anonymity stamp."""
    export_id: str
    table: str
    record_count: int
    k_anonymity: KAnonymityReport
    exported_at: str
    exported_by: str
    data: List[Dict[str, Any]]
    warning: Optional[str] = None


class ExportRejectionResponse(BaseModel):
    """Export rejection response."""
    status: str = "rejected"
    reason: str
    k_anonymity: KAnonymityReport
    details: str


# Endpoints

@router.post("/export", response_model=ExportResponse)
async def export_data(
    query: ExportFilterQuery,
    db_session: Session = Depends(get_db),
    # current_user = Depends(),  # TODO: Add authentication middleware
) -> ExportResponse:
    """
    Export anonymised data from a table.
    
    Process:
    1. Fetch records matching filter criteria
    2. Anonymise all records
    3. Verify k-anonymity (k ≥ 5)
    4. Return if k-anonymous; reject if not
    5. Log export event to audit_logs
    
    Args:
        query: Export filter parameters
        db_session: Database session
        current_user: Authenticated user (TODO: implement auth)
    
    Returns:
        Anonymised dataset with k-anonymity verification
    
    Raises:
        HTTPException 400 if k-anonymity not met
        HTTPException 403 if user not authorized
        HTTPException 404 if table not found
    """
    
    # Validate table name (prevent SQL injection)
    TABLE_MODEL_MAP = {
        "patients": Patient,
        "monitoring_sessions": MonitoringSession,
        "ai_results": AIResult,
        "wound_sites": WoundSite,
        "consents": Consent,
        "asha_workers": AshaWorker,
    }
    
    if query.table not in TABLE_MODEL_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Table '{query.table}' not found or not exportable"
        )
    
    # Get the SQLAlchemy model
    model_class = TABLE_MODEL_MAP[query.table]
    
    # Build query
    db_query = db_session.query(model_class)
    
    # Apply filters based on table type
    if query.table == "patients":
        if query.district:
            db_query = db_query.filter(Patient.district == query.district)
        if query.age_min:
            db_query = db_query.filter(Patient.age >= query.age_min)
        if query.age_max:
            db_query = db_query.filter(Patient.age <= query.age_max)
    
    elif query.table == "monitoring_sessions":
        if query.start_date:
            db_query = db_query.filter(MonitoringSession.session_date >= query.start_date)
        if query.end_date:
            db_query = db_query.filter(MonitoringSession.session_date <= query.end_date)
    
    elif query.table == "wound_sites":
        if query.district:
            # Join with patient to filter by district
            db_query = db_query.join(Patient).filter(Patient.district == query.district)
    
    # Execute query
    records_orm = db_query.all()
    
    if not records_orm:
        raise HTTPException(
            status_code=400,
            detail="No records found matching filter criteria"
        )
    
    # Convert ORM objects to dictionaries
    records = []
    for record in records_orm:
        record_dict = {}
        for column in record.__table__.columns:
            value = getattr(record, column.name)
            # Convert datetime to ISO string
            if isinstance(value, datetime):
                value = value.isoformat()
            record_dict[column.name] = value
        records.append(record_dict)
    
    # Anonymise
    engine = get_anonymisation_engine()
    anonymised_records = engine.anonymise_dataset(query.table, records)
    
    # Define quasi-identifiers for k-anonymity check
    quasi_identifiers_map = {
        "patients": ["district", "age", "gender"],
        "monitoring_sessions": ["district"],
        "wound_sites": ["district"],
        "asha_workers": ["district"],
        "consents": ["district"],
        "ai_results": ["district"],
    }
    
    quasi_ids = quasi_identifiers_map.get(query.table, ["district"])
    
    # Verify k-anonymity
    is_k_anonymous, k_report = engine.verify_k_anonymity(
        anonymised_records, quasi_ids
    )
    
    k_anon_response = KAnonymityReport(
        is_k_anonymous=is_k_anonymous,
        k_threshold=engine.K_ANONYMITY_THRESHOLD,
        total_records=len(anonymised_records),
        total_groups=k_report.get("total_groups", 0),
        violations=k_report.get("violations", 0),
        smallest_group_size=k_report.get("smallest_group_size", 0),
        quasi_identifiers=quasi_ids,
    )
    
    if not is_k_anonymous:
        logger.warning(
            f"Export rejected for {query.table}: k-anonymity not met. "
            f"Violations: {k_report['violations']}"
        )
        raise HTTPException(
            status_code=400,
            detail={
                "status": "rejected",
                "reason": "k-anonymity threshold not met (k < 5)",
                "k_anonymity": k_anon_response.dict(),
                "details": f"{k_report['violations']} quasi-identifier groups have < 5 records",
            }
        )
    
    # Log export event
    export_id = _generate_export_id()
    current_user_id = "system"  # TODO: Get from authenticated user
    _log_export_event(
        db_session,
        export_id=export_id,
        table=query.table,
        user_id=current_user_id,
        row_count=len(anonymised_records),
        k_anonymity_verified=True,
    )
    
    # Build response
    response = ExportResponse(
        export_id=export_id,
        table=query.table,
        record_count=len(anonymised_records),
        k_anonymity=k_anon_response,
        exported_at=datetime.utcnow().isoformat(),
        exported_by=current_user_id,
        data=anonymised_records,
        warning=(
            "Data has been anonymised and verified for k-anonymity (k ≥ 5). "
            "All direct identifiers have been removed."
        ) if is_k_anonymous else None,
    )
    
    logger.info(
        f"Export completed: {export_id} | Table: {query.table} | "
        f"Records: {len(anonymised_records)} | k-anonymous: {is_k_anonymous}"
    )
    
    return response


@router.get("/export/schema/{table}")
async def get_export_schema(table: str) -> Dict[str, Any]:
    """
    Get the schema of an exportable table (field names, types, sensitivity).
    
    Args:
        table: Table name
    
    Returns:
        Schema with field sensitivity information
    """
    from backend.database.privacy import PII_FIELD_MAP, SensitivityLevel
    
    if table not in PII_FIELD_MAP.TABLE_CLASSIFICATIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Table '{table}' not found"
        )
    
    classifications = PII_FIELD_MAP.TABLE_CLASSIFICATIONS[table]
    
    schema = {
        "table": table,
        "fields": {}
    }
    
    for field, sensitivity in classifications.items():
        schema["fields"][field] = {
            "sensitivity": sensitivity.value,
            "action_on_export": (
                "removed" if sensitivity == SensitivityLevel.DIRECT_IDENTIFIER
                else "generalised" if sensitivity == SensitivityLevel.QUASI_IDENTIFIER
                else "retained"
            )
        }
    
    return schema


@router.post("/export/dry-run")
async def dry_run_export(
    query: ExportFilterQuery,
    db_session: Session = Depends(get_db),
    # current_user = Depends(),  # TODO: Add authentication
) -> Dict[str, Any]:
    """
    Dry-run export: validate without returning data.
    
    Checks:
    1. Filter criteria return records
    2. Anonymisation succeeds
    3. k-anonymity is met
    
    Args:
        query: Export filter parameters
        db_session: Database session
        current_user: Authenticated user
    
    Returns:
        Validation report
    """
    query.dry_run = True
    
    try:
        # Attempt export (will raise if k-anonymity fails)
        response = await export_data(query, db_session, current_user)
        
        return {
            "status": "valid",
            "record_count": response.record_count,
            "k_anonymity_met": response.k_anonymity.is_k_anonymous,
            "message": "Export would succeed"
        }
    
    except HTTPException as e:
        return {
            "status": "invalid",
            "error": e.detail,
            "message": "Export would be rejected"
        }


# Helper functions

def _generate_export_id() -> str:
    """Generate unique export ID."""
    import uuid
    return f"export_{uuid.uuid4().hex[:12]}"


def _log_export_event(
    db_session: Session,
    export_id: str,
    table: str,
    user_id: str,
    row_count: int,
    k_anonymity_verified: bool,
) -> None:
    """
    Log data export event to audit_logs table.
    
    Args:
        db_session: Database session
        export_id: Export ID
        table: Table name
        user_id: User who triggered export
        row_count: Number of rows exported
        k_anonymity_verified: Whether k-anonymity was verified
    """
    from datetime import datetime
    
    log_entry = AuditLog(
        log_id=_generate_export_id(),
        user_id=user_id,
        action="data_export",
        table_name=table,
        record_id=export_id,
        timestamp=datetime.utcnow(),
        meta_data=json.dumps({
            "row_count": row_count,
            "k_anonymity_verified": k_anonymity_verified,
        })
    )
    
    db_session.add(log_entry)
    db_session.commit()
    
    logger.info(f"Export logged: {export_id} | {table} | {row_count} rows")


# Integration with main app

def register_export_routes(app):
    """Register export routes with FastAPI app."""
    app.include_router(router)

