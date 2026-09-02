"""
backend/api/routers/analytics.py

Wound Progression Analytics — longitudinal tracking across visits.

Endpoints:
  GET /api/v1/analytics/patient/{patient_id}/progression
      → Wound size trend across all visits (for doctor dashboard)

  GET /api/v1/analytics/patient/{patient_id}/summary
      → Full clinical summary with AI severity + measurements

  GET /api/v1/analytics/cohort/stats
      → Aggregate stats across all patients (for research dashboard)

Clinical value:
  - Detects healing vs deterioration trend
  - Flags patients whose wound area is growing (urgent referral signal)
  - Tracks HbA1c + wound size correlation over time
"""

import uuid
from datetime import datetime, date
from typing import Optional, List, Dict
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.database.models_clinical import (
    PatientProfile, PatientVisit, ClinicalPhoto,
    WoundMeasurement, PhotoTypeEnum,
)
from backend.database.session import get_db

router = APIRouter(prefix="/api/v1/analytics", tags=["Wound Progression Analytics"])


# ── Enums ─────────────────────────────────────────────────────────────────────

class HealingTrend(str, Enum):
    HEALING      = "healing"       # area decreasing consistently
    STABLE       = "stable"        # <10% change
    DETERIORATING = "deteriorating" # area increasing
    INSUFFICIENT  = "insufficient_data"  # < 2 measurements


# ── Response schemas ──────────────────────────────────────────────────────────

class VisitMeasurementPoint(BaseModel):
    visit_id:       str
    visit_number:   int
    visit_date:     str
    length_mm:      Optional[float]
    width_mm:       Optional[float]
    area_cm2:       Optional[float]
    perimeter_mm:   Optional[float]
    doctor_corrected: bool
    data_source:    str   # 'doctor' | 'ai'


class ProgressionResponse(BaseModel):
    patient_id:         str
    total_visits:       int
    measurements_found: int
    healing_trend:      HealingTrend
    trend_percent:      Optional[float]  # % change in area from first to last
    alert:              Optional[str]    # urgent message if deteriorating fast
    first_measurement:  Optional[VisitMeasurementPoint]
    latest_measurement: Optional[VisitMeasurementPoint]
    all_measurements:   List[VisitMeasurementPoint]
    recommendation:     str


class ClinicalSummaryResponse(BaseModel):
    patient_id:         str
    age:                int
    gender:             str
    diabetes_type:      str
    diabetes_years:     Optional[int]
    hba1c:              Optional[float]
    total_visits:       int
    first_visit_date:   Optional[str]
    latest_visit_date:  Optional[str]
    wound_progression:  Optional[ProgressionResponse]
    referral_needed:    bool
    referral_reason:    Optional[str]


class CohortStatsResponse(BaseModel):
    total_patients:         int
    total_visits:           int
    total_measurements:     int
    avg_age:                Optional[float]
    diabetes_type_breakdown: Dict[str, int]
    healing_trend_breakdown: Dict[str, int]
    avg_initial_area_cm2:   Optional[float]
    avg_latest_area_cm2:    Optional[float]
    patients_needing_referral: int
    generated_at:           str


# ══════════════════════════════════════════════════════════════════════════════
#  CORE ANALYTICS LOGIC
# ══════════════════════════════════════════════════════════════════════════════

def _get_measurements_for_patient(
    patient_id: uuid.UUID, db: Session
) -> List[VisitMeasurementPoint]:
    """
    Fetch all wound measurements for a patient, ordered by visit date.
    Uses doctor-corrected values where available.
    """
    rows = (
        db.query(WoundMeasurement, PatientVisit)
        .join(PatientVisit, WoundMeasurement.visit_id == PatientVisit.visit_id)
        .filter(PatientVisit.patient_id == patient_id)
        .filter(PatientVisit.is_deleted == False)
        .order_by(PatientVisit.visit_date, PatientVisit.visit_number)
        .all()
    )

    points = []
    for m, v in rows:
        # Use doctor-corrected values if available, else AI values
        if m.doctor_corrected:
            length = m.doctor_length_mm
            width  = m.doctor_width_mm
            area   = m.doctor_area_cm2
            perim  = m.doctor_perimeter_mm
            source = "doctor"
        else:
            length = m.ai_length_mm
            width  = m.ai_width_mm
            area   = m.ai_area_cm2
            perim  = m.ai_perimeter_mm
            source = "ai"

        points.append(VisitMeasurementPoint(
            visit_id         = str(v.visit_id),
            visit_number     = v.visit_number,
            visit_date       = str(v.visit_date),
            length_mm        = length,
            width_mm         = width,
            area_cm2         = area,
            perimeter_mm     = perim,
            doctor_corrected = m.doctor_corrected,
            data_source      = source,
        ))

    return points


def _compute_healing_trend(
    points: List[VisitMeasurementPoint]
) -> tuple:
    """
    Compute healing trend from wound area measurements.

    Returns:
        (HealingTrend, trend_percent, alert_message)
        trend_percent: % change from first to last measurement
                       negative = healing, positive = deteriorating
    """
    # Filter to points with area data
    area_points = [p for p in points if p.area_cm2 is not None]

    if len(area_points) < 2:
        return HealingTrend.INSUFFICIENT, None, None

    first_area = area_points[0].area_cm2
    last_area  = area_points[-1].area_cm2

    if first_area <= 0:
        return HealingTrend.INSUFFICIENT, None, None

    pct_change = ((last_area - first_area) / first_area) * 100.0

    alert = None
    if pct_change <= -10:
        trend = HealingTrend.HEALING
    elif pct_change >= 10:
        trend = HealingTrend.DETERIORATING
        if pct_change >= 50:
            alert = (
                f"⚠️ URGENT: Wound area has increased by {pct_change:.0f}% "
                f"since first visit ({first_area:.2f} → {last_area:.2f} cm²). "
                f"Immediate referral recommended."
            )
        elif pct_change >= 25:
            alert = (
                f"⚠️ WARNING: Wound area has grown by {pct_change:.0f}% "
                f"({first_area:.2f} → {last_area:.2f} cm²). "
                f"Consider escalation."
            )
    else:
        trend = HealingTrend.STABLE

    return trend, round(pct_change, 2), alert


def _generate_recommendation(
    trend:    HealingTrend,
    pct:      Optional[float],
    n_visits: int,
    hba1c:    Optional[float],
) -> str:
    """Generate a plain-English clinical recommendation."""
    if trend == HealingTrend.INSUFFICIENT:
        return "Insufficient wound measurements for trend analysis. Ensure calibration marker is present in photographs."

    if trend == HealingTrend.HEALING:
        rec = f"Wound is healing (area reduced by {abs(pct):.0f}%). Continue current treatment plan."
        if hba1c and hba1c > 8.0:
            rec += f" Note: HbA1c is {hba1c:.1f}% (above target). Glycaemic control improvement may accelerate healing."
        return rec

    if trend == HealingTrend.STABLE:
        rec = f"Wound area is stable (<10% change over {n_visits} visits). Review dressing protocol."
        if hba1c and hba1c > 9.0:
            rec += f" HbA1c of {hba1c:.1f}% may be impeding healing — urgent diabetes management review."
        return rec

    if trend == HealingTrend.DETERIORATING:
        rec = f"Wound is deteriorating (area increased {pct:.0f}%). "
        if pct and pct >= 50:
            rec += "Immediate specialist referral required."
        else:
            rec += "Review wound care protocol. Consider referral to wound specialist."
        return rec

    return "Unable to generate recommendation."


# ══════════════════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/patient/{patient_id}/progression", response_model=ProgressionResponse)
async def get_wound_progression(
    patient_id: str,
    db: Session = Depends(get_db),
):
    """
    Wound size trend across all visits for a patient.
    Returns healing/stable/deteriorating classification with % change.
    Flags urgent cases where wound area has grown >50%.
    """
    pid = uuid.UUID(patient_id)
    patient = db.query(PatientProfile).filter_by(
        patient_id=pid, is_deleted=False).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    total_visits = db.query(PatientVisit).filter_by(
        patient_id=pid, is_deleted=False).count()

    points = _get_measurements_for_patient(pid, db)
    trend, pct, alert = _compute_healing_trend(points)
    recommendation = _generate_recommendation(
        trend, pct, total_visits, patient.hba1c)

    return ProgressionResponse(
        patient_id          = patient_id,
        total_visits        = total_visits,
        measurements_found  = len(points),
        healing_trend       = trend,
        trend_percent       = pct,
        alert               = alert,
        first_measurement   = points[0]  if len(points) >= 1 else None,
        latest_measurement  = points[-1] if len(points) >= 1 else None,
        all_measurements    = points,
        recommendation      = recommendation,
    )


@router.get("/patient/{patient_id}/summary", response_model=ClinicalSummaryResponse)
async def get_patient_clinical_summary(
    patient_id: str,
    db: Session = Depends(get_db),
):
    """
    Full clinical summary for a patient including wound progression.
    Designed for the doctor dashboard — one call to get everything.
    """
    pid = uuid.UUID(patient_id)
    patient = db.query(PatientProfile).filter_by(
        patient_id=pid, is_deleted=False).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    visits = (db.query(PatientVisit)
              .filter_by(patient_id=pid, is_deleted=False)
              .order_by(PatientVisit.visit_date)
              .all())

    first_visit = visits[0]  if visits else None
    last_visit  = visits[-1] if visits else None

    # Check if any visit has referral_needed
    referral_needed = any(v.referral_needed for v in visits)
    referral_reason = next(
        (v.referral_reason for v in reversed(visits) if v.referral_needed), None)

    # Get progression
    progression = None
    points = _get_measurements_for_patient(pid, db)
    if points:
        trend, pct, alert = _compute_healing_trend(points)
        rec = _generate_recommendation(trend, pct, len(visits), patient.hba1c)
        progression = ProgressionResponse(
            patient_id          = patient_id,
            total_visits        = len(visits),
            measurements_found  = len(points),
            healing_trend       = trend,
            trend_percent       = pct,
            alert               = alert,
            first_measurement   = points[0]  if points else None,
            latest_measurement  = points[-1] if points else None,
            all_measurements    = points,
            recommendation      = rec,
        )

    return ClinicalSummaryResponse(
        patient_id          = patient_id,
        age                 = patient.age,
        gender              = patient.gender.value,
        diabetes_type       = patient.diabetes_type.value,
        diabetes_years      = patient.diabetes_years,
        hba1c               = patient.hba1c,
        total_visits        = len(visits),
        first_visit_date    = str(first_visit.visit_date) if first_visit else None,
        latest_visit_date   = str(last_visit.visit_date)  if last_visit  else None,
        wound_progression   = progression,
        referral_needed     = referral_needed,
        referral_reason     = referral_reason,
    )


@router.get("/cohort/stats", response_model=CohortStatsResponse)
async def get_cohort_stats(
    district: Optional[str] = Query(None, description="Filter by district"),
    db: Session = Depends(get_db),
):
    """
    Aggregate statistics across all patients — for research dashboard.
    Optionally filter by district.
    """
    q = db.query(PatientProfile).filter_by(is_deleted=False)
    if district:
        q = q.filter(PatientProfile.district.ilike(f"%{district}%"))
    patients = q.all()

    if not patients:
        raise HTTPException(status_code=404, detail="No patients found.")

    patient_ids = [p.patient_id for p in patients]

    # Visit count
    total_visits = db.query(PatientVisit).filter(
        PatientVisit.patient_id.in_(patient_ids),
        PatientVisit.is_deleted == False
    ).count()

    # Measurement count
    total_measurements = db.query(WoundMeasurement).filter(
        WoundMeasurement.patient_id.in_(patient_ids)
    ).count()

    # Avg age
    avg_age = db.query(func.avg(PatientProfile.age)).filter(
        PatientProfile.patient_id.in_(patient_ids)
    ).scalar()

    # Diabetes type breakdown
    dt_rows = (db.query(PatientProfile.diabetes_type, func.count())
               .filter(PatientProfile.patient_id.in_(patient_ids))
               .group_by(PatientProfile.diabetes_type)
               .all())
    dt_breakdown = {row[0].value: row[1] for row in dt_rows}

    # Healing trend breakdown
    trend_breakdown = {t.value: 0 for t in HealingTrend}
    for p in patients:
        pts   = _get_measurements_for_patient(p.patient_id, db)
        trend, _, _ = _compute_healing_trend(pts)
        trend_breakdown[trend.value] += 1

    # Average initial and latest wound area
    first_areas, last_areas = [], []
    for p in patients:
        pts = [x for x in _get_measurements_for_patient(p.patient_id, db)
               if x.area_cm2 is not None]
        if pts:
            first_areas.append(pts[0].area_cm2)
            last_areas.append(pts[-1].area_cm2)

    avg_initial = round(sum(first_areas) / len(first_areas), 3) if first_areas else None
    avg_latest  = round(sum(last_areas)  / len(last_areas),  3) if last_areas  else None

    # Referral count
    referral_count = sum(
        1 for p in patients
        if db.query(PatientVisit).filter_by(
            patient_id=p.patient_id,
            referral_needed=True,
            is_deleted=False
        ).count() > 0
    )

    return CohortStatsResponse(
        total_patients              = len(patients),
        total_visits                = total_visits,
        total_measurements          = total_measurements,
        avg_age                     = round(float(avg_age), 1) if avg_age else None,
        diabetes_type_breakdown     = dt_breakdown,
        healing_trend_breakdown     = trend_breakdown,
        avg_initial_area_cm2        = avg_initial,
        avg_latest_area_cm2         = avg_latest,
        patients_needing_referral   = referral_count,
        generated_at                = datetime.utcnow().isoformat() + "Z",
    )
