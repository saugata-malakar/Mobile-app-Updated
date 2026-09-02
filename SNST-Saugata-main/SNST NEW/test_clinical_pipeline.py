"""
tests/test_clinical_pipeline.py

Test suite for Phase 1 clinical data collection modules:
  - models_clinical.py  (DB schema validation)
  - image_quality.py    (quality checker)
  - calibration.py      (ArUco detection + measurement pipeline)
  - aruco_generator.py  (marker card generation)
  - analytics.py        (progression logic, no DB required)

Run:
    pytest tests/test_clinical_pipeline.py -v
"""

import io
import sys
import uuid
import math
import pytest
import numpy as np
import cv2
from PIL import Image
from pathlib import Path
from datetime import date

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


# ══════════════════════════════════════════════════════════════════════════════
#  IMAGE QUALITY CHECKER TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestImageQualityChecker:

    @pytest.fixture
    def checker(self):
        from cv.image_quality import ImageQualityChecker
        return ImageQualityChecker()

    def _make_image(self, w=1280, h=960, noise=30, brightness=128) -> bytes:
        """Generate a synthetic RGB image with controllable properties."""
        base  = np.ones((h, w, 3), dtype=np.uint8) * brightness
        noise_arr = np.random.randint(-noise, noise, (h, w, 3), dtype=np.int16)
        img   = np.clip(base.astype(np.int16) + noise_arr, 0, 255).astype(np.uint8)
        _, buf = cv2.imencode(".jpg", img)
        return bytes(buf)

    def _make_blurry_image(self, w=1280, h=960) -> bytes:
        """Solid colour image — zero texture = very low Laplacian variance."""
        img = np.ones((h, w, 3), dtype=np.uint8) * 128
        _, buf = cv2.imencode(".jpg", img)
        return bytes(buf)

    # ── Tests ─────────────────────────────────────────────────────────────────

    def test_good_image_passes(self, checker):
        img = self._make_image(brightness=128, noise=40)
        result = checker.check(img)
        assert result.passed, f"Expected pass, got: {result.failure_reason}"
        assert result.status.value == "pass"

    def test_dark_image_fails(self, checker):
        img = self._make_image(brightness=20, noise=5)
        result = checker.check(img)
        assert not result.passed
        assert "dark" in result.status.value or "bright" in result.status.value or "contrast" in result.status.value

    def test_bright_image_fails(self, checker):
        img = self._make_image(brightness=240, noise=5)
        result = checker.check(img)
        assert not result.passed

    def test_blurry_image_fails(self, checker):
        img = self._make_blurry_image()
        result = checker.check(img)
        assert not result.passed

    def test_low_resolution_fails(self, checker):
        img = self._make_image(w=320, h=240, noise=40)
        result = checker.check(img)
        assert not result.passed
        assert result.status.value == "fail_resolution"

    def test_result_has_metrics(self, checker):
        img = self._make_image()
        result = checker.check(img)
        assert result.width_px > 0
        assert result.height_px > 0
        assert result.blur_score >= 0
        assert result.brightness_mean >= 0

    def test_suggestions_non_empty_on_failure(self, checker):
        img = self._make_image(brightness=10, noise=2)
        result = checker.check(img)
        if not result.passed:
            assert len(result.suggestions) > 0

    def test_pil_image_input(self, checker):
        pil_img = Image.new("RGB", (1280, 960), color=(128, 128, 128))
        result  = checker.check(pil_img)
        # solid colour will fail blur, but should not crash
        assert result is not None

    def test_ndarray_input(self, checker):
        arr    = np.random.randint(50, 200, (960, 1280, 3), dtype=np.uint8)
        result = checker.check(arr)
        assert result is not None

    def test_corrupt_bytes_handled(self, checker):
        result = checker.check(b"not_an_image")
        assert result is not None
        assert not result.passed

    def test_batch_check_returns_list(self, checker):
        imgs   = [self._make_image() for _ in range(3)]
        results = checker.check_batch(imgs)
        assert len(results) == 3


# ══════════════════════════════════════════════════════════════════════════════
#  ARUCO CALIBRATION PIPELINE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestCalibrationMarkerDetector:

    @pytest.fixture
    def detector(self):
        from cv.calibration import CalibrationMarkerDetector
        return CalibrationMarkerDetector(marker_size_mm=50.0)

    def _make_aruco_image(
        self, marker_id=0, img_size=800, marker_px=200
    ) -> np.ndarray:
        """Synthesize an image with an ArUco marker embedded."""
        aruco_dict  = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        marker_img  = cv2.aruco.generateImageMarker(aruco_dict, marker_id, marker_px)
        img         = np.ones((img_size, img_size, 3), dtype=np.uint8) * 200
        offset      = (img_size - marker_px) // 2
        img[offset:offset+marker_px, offset:offset+marker_px] = \
            cv2.cvtColor(np.stack([marker_img]*3, axis=-1), cv2.COLOR_BGR2RGB)
        return img

    def test_detects_aruco_marker(self, detector):
        img    = self._make_aruco_image(marker_id=0)
        result = detector.detect(img)
        assert result.detected, f"Marker not detected: {result.error}"
        assert result.marker_id == 0

    def test_pixels_per_mm_positive(self, detector):
        img    = self._make_aruco_image(marker_id=0)
        result = detector.detect(img)
        assert result.detected
        assert result.pixels_per_mm > 0

    def test_confidence_in_range(self, detector):
        img    = self._make_aruco_image(marker_id=0)
        result = detector.detect(img)
        assert result.detected
        assert 0.0 <= result.confidence <= 1.0

    def test_no_marker_returns_not_detected(self, detector):
        img    = np.ones((800, 800, 3), dtype=np.uint8) * 200
        result = detector.detect(img)
        assert not result.detected
        assert result.error is not None

    def test_different_marker_ids(self, detector):
        for mid in [0, 1, 5, 10]:
            img    = self._make_aruco_image(marker_id=mid)
            result = detector.detect(img)
            assert result.detected, f"Failed for marker ID {mid}"
            assert result.marker_id == mid


class TestMeasurementCalculator:

    @pytest.fixture
    def calculator(self):
        from cv.calibration import MeasurementCalculator
        return MeasurementCalculator()

    def _make_circle_contour(self, radius_px=100, center=(200, 200)):
        angles = np.linspace(0, 2 * np.pi, 360)
        pts    = np.array([
            [[int(center[0] + radius_px * np.cos(a)),
              int(center[1] + radius_px * np.sin(a))]]
            for a in angles
        ], dtype=np.int32)
        mask = np.zeros((400, 400), dtype=np.uint8)
        cv2.drawContours(mask, [pts], -1, 255, thickness=cv2.FILLED)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return mask, contours[0]

    def test_circle_area_approximately_correct(self, calculator):
        radius_px    = 100
        px_per_mm    = 10.0   # 10 px = 1 mm
        mask, contour = self._make_circle_contour(radius_px)
        result = calculator.compute(mask, contour, px_per_mm)

        # Expected area: π r² in mm² = π × (100/10)² = 314.16 mm² = 3.14 cm²
        expected_cm2 = math.pi * (radius_px / px_per_mm) ** 2 / 100.0
        assert result["area_cm2"] is not None
        assert abs(result["area_cm2"] - expected_cm2) < 0.5, \
            f"Area {result['area_cm2']:.3f} far from expected {expected_cm2:.3f}"

    def test_length_gte_width(self, calculator):
        mask, contour = self._make_circle_contour()
        result = calculator.compute(mask, contour, pixels_per_mm=10.0)
        if result["length_mm"] and result["width_mm"]:
            assert result["length_mm"] >= result["width_mm"]

    def test_zero_scale_returns_none(self, calculator):
        mask, contour = self._make_circle_contour()
        result = calculator.compute(mask, contour, pixels_per_mm=0.0)
        assert result["area_cm2"] is None

    def test_none_contour_returns_none(self, calculator):
        result = calculator.compute(None, None, pixels_per_mm=10.0)
        assert result["area_cm2"] is None

    def test_perimeter_positive(self, calculator):
        mask, contour = self._make_circle_contour()
        result = calculator.compute(mask, contour, pixels_per_mm=10.0)
        assert result["perimeter_mm"] is not None
        assert result["perimeter_mm"] > 0


class TestRLEEncoding:

    def test_encode_decode_roundtrip(self):
        from cv.calibration import WoundMeasurementPipeline
        pipeline = WoundMeasurementPipeline()

        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[25:75, 25:75] = 255   # centre square

        rle       = pipeline._rle_encode(mask)
        recovered = pipeline._rle_decode(rle)

        assert recovered.shape == mask.shape
        assert np.array_equal(mask, recovered), "RLE decode != original mask"

    def test_rle_has_shape_key(self):
        from cv.calibration import WoundMeasurementPipeline
        pipeline = WoundMeasurementPipeline()
        mask     = np.zeros((50, 60), dtype=np.uint8)
        rle      = pipeline._rle_encode(mask)
        assert "shape"  in rle
        assert "counts" in rle
        assert rle["shape"] == [50, 60]


# ══════════════════════════════════════════════════════════════════════════════
#  ARUCO GENERATOR TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestArucoGenerator:

    def test_generates_png_bytes(self):
        from cv.aruco_generator import generate_calibration_card
        png = generate_calibration_card(marker_id=0, dpi=72)   # low DPI for speed
        assert isinstance(png, bytes)
        assert len(png) > 1000   # non-trivial output

    def test_png_is_valid_image(self):
        from cv.aruco_generator import generate_calibration_card
        png = generate_calibration_card(marker_id=0, dpi=72)
        img = Image.open(io.BytesIO(png))
        assert img.size[0] > 0
        assert img.size[1] > 0

    def test_different_marker_ids_produce_different_cards(self):
        from cv.aruco_generator import generate_calibration_card
        png0 = generate_calibration_card(marker_id=0, dpi=72)
        png1 = generate_calibration_card(marker_id=1, dpi=72)
        assert png0 != png1   # different markers → different images

    def test_pdf_sheet_generates(self):
        from cv.aruco_generator import generate_card_sheet_pdf
        pdf = generate_card_sheet_pdf(marker_ids=[0, 1], dpi=72)
        assert isinstance(pdf, bytes)
        assert len(pdf) > 100


# ══════════════════════════════════════════════════════════════════════════════
#  ANALYTICS LOGIC TESTS (no DB — pure unit tests)
# ══════════════════════════════════════════════════════════════════════════════

class TestHealingTrendLogic:

    def _make_points(self, areas):
        """Helper: create VisitMeasurementPoint list from area values."""
        from backend.api.routers.analytics import VisitMeasurementPoint
        return [
            VisitMeasurementPoint(
                visit_id=str(uuid.uuid4()),
                visit_number=i+1,
                visit_date=f"2026-0{i+1}-01",
                length_mm=50.0,
                width_mm=30.0,
                area_cm2=a,
                perimeter_mm=150.0,
                doctor_corrected=False,
                data_source="ai",
            )
            for i, a in enumerate(areas)
        ]

    def _compute(self, areas):
        from backend.api.routers.analytics import _compute_healing_trend
        points = self._make_points(areas)
        return _compute_healing_trend(points)

    def test_healing_detected(self):
        from backend.api.routers.analytics import HealingTrend
        trend, pct, alert = self._compute([10.0, 8.0, 6.0, 4.0])
        assert trend == HealingTrend.HEALING
        assert pct < 0

    def test_deteriorating_detected(self):
        from backend.api.routers.analytics import HealingTrend
        trend, pct, alert = self._compute([4.0, 6.0, 8.0, 10.0])
        assert trend == HealingTrend.DETERIORATING
        assert pct > 0

    def test_stable_detected(self):
        from backend.api.routers.analytics import HealingTrend
        trend, pct, alert = self._compute([5.0, 5.1, 4.95, 5.05])
        assert trend == HealingTrend.STABLE
        assert abs(pct) < 10

    def test_insufficient_data_single_point(self):
        from backend.api.routers.analytics import HealingTrend
        trend, pct, alert = self._compute([5.0])
        assert trend == HealingTrend.INSUFFICIENT
        assert pct is None

    def test_urgent_alert_on_large_increase(self):
        from backend.api.routers.analytics import HealingTrend
        trend, pct, alert = self._compute([4.0, 12.0])   # +200%
        assert trend == HealingTrend.DETERIORATING
        assert alert is not None
        assert "URGENT" in alert

    def test_no_alert_on_healing(self):
        trend, pct, alert = self._compute([10.0, 5.0])
        assert alert is None

    def test_trend_percent_calculation(self):
        _, pct, _ = self._compute([10.0, 8.0])
        assert abs(pct - (-20.0)) < 0.1   # exactly -20%

    def test_ignores_none_areas(self):
        from backend.api.routers.analytics import VisitMeasurementPoint, _compute_healing_trend, HealingTrend
        points = [
            VisitMeasurementPoint(
                visit_id=str(uuid.uuid4()), visit_number=1,
                visit_date="2026-01-01", length_mm=50, width_mm=30,
                area_cm2=None,  # ← no area data
                perimeter_mm=None, doctor_corrected=False, data_source="ai"),
            VisitMeasurementPoint(
                visit_id=str(uuid.uuid4()), visit_number=2,
                visit_date="2026-02-01", length_mm=50, width_mm=30,
                area_cm2=None,
                perimeter_mm=None, doctor_corrected=False, data_source="ai"),
        ]
        trend, pct, _ = _compute_healing_trend(points)
        assert trend == HealingTrend.INSUFFICIENT


# ══════════════════════════════════════════════════════════════════════════════
#  DATABASE MODEL SCHEMA TESTS (SQLite in-memory)
# ══════════════════════════════════════════════════════════════════════════════

class TestDatabaseModels:

    @pytest.fixture
    def db(self):
        """Spin up an in-memory SQLite DB and create all tables."""
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from backend.database.models_clinical import Base

        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        session = Session()
        yield session
        session.close()

    def test_patient_profile_creates(self, db):
        from backend.database.models_clinical import PatientProfile, GenderEnum, DiabetesTypeEnum
        p = PatientProfile(
            patient_id     = uuid.uuid4(),
            age            = 55,
            gender         = GenderEnum.MALE,
            diabetes_type  = DiabetesTypeEnum.TYPE2,
            hba1c          = 8.5,
        )
        db.add(p); db.commit()
        assert db.query(PatientProfile).count() == 1

    def test_visit_links_to_patient(self, db):
        from backend.database.models_clinical import (
            PatientProfile, PatientVisit, GenderEnum, DiabetesTypeEnum)
        pid = uuid.uuid4()
        p   = PatientProfile(patient_id=pid, age=60,
                              gender=GenderEnum.FEMALE,
                              diabetes_type=DiabetesTypeEnum.TYPE2)
        db.add(p); db.commit()

        v = PatientVisit(patient_id=pid, visit_date=date.today(), visit_number=1)
        db.add(v); db.commit()

        loaded = db.query(PatientProfile).first()
        assert len(loaded.visits) == 1

    def test_consent_records_created(self, db):
        from backend.database.models_clinical import (
            PatientProfile, PatientConsent, GenderEnum, DiabetesTypeEnum, ConsentTypeEnum)
        pid = uuid.uuid4()
        p   = PatientProfile(patient_id=pid, age=45,
                              gender=GenderEnum.MALE,
                              diabetes_type=DiabetesTypeEnum.TYPE1)
        db.add(p)
        c = PatientConsent(patient_id=pid,
                           consent_type=ConsentTypeEnum.RESEARCH,
                           version=1, granted=True)
        db.add(c); db.commit()
        assert db.query(PatientConsent).count() == 1

    def test_wound_measurement_final_values_use_doctor_correction(self, db):
        from backend.database.models_clinical import (
            PatientProfile, PatientVisit, ClinicalPhoto, WoundMeasurement,
            GenderEnum, DiabetesTypeEnum, PhotoTypeEnum, ImageQualityEnum)

        pid = uuid.uuid4()
        db.add(PatientProfile(patient_id=pid, age=50,
                               gender=GenderEnum.MALE,
                               diabetes_type=DiabetesTypeEnum.TYPE2))
        db.commit()

        vid = uuid.uuid4()
        db.add(PatientVisit(visit_id=vid, patient_id=pid,
                             visit_date=date.today(), visit_number=1))
        db.commit()

        phid = uuid.uuid4()
        db.add(ClinicalPhoto(
            photo_id=phid, visit_id=vid, patient_id=pid,
            photo_type=PhotoTypeEnum.MEASUREMENT,
            image_data_enc=b"enc_gcm:dummybytes",
            quality_status=ImageQualityEnum.PASS,
        ))
        db.commit()

        m = WoundMeasurement(
            photo_id=phid, visit_id=vid, patient_id=pid,
            ai_length_mm=45.0, ai_width_mm=30.0,
            ai_area_cm2=10.0, ai_perimeter_mm=130.0,
            doctor_corrected=True,
            doctor_length_mm=42.0, doctor_width_mm=28.0,
            doctor_area_cm2=9.0,  doctor_perimeter_mm=125.0,
        )
        db.add(m); db.commit()
        db.refresh(m)

        # Doctor values should take priority
        assert m.final_length_mm == 42.0
        assert m.final_area_cm2  == 9.0
        assert m.final_width_mm  == 28.0
