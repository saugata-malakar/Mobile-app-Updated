"""
cv/aruco_generator.py

Generates printable ArUco calibration marker cards for field use.
Each card includes:
  - ArUco marker (4x4_50 dictionary, ID 0 by default)
  - Physical size label (50mm × 50mm)
  - Colour calibration patches (white, grey, black)
  - Usage instructions for ASHA workers

Usage:
    from cv.aruco_generator import generate_calibration_card
    png_bytes = generate_calibration_card(marker_id=0, marker_size_mm=50)
    with open("calibration_card.png", "wb") as f:
        f.write(png_bytes)

    # Or generate a PDF sheet of 6 cards (A4)
    from cv.aruco_generator import generate_card_sheet_pdf
    pdf_bytes = generate_card_sheet_pdf()
"""

import io
from typing import Optional, Tuple
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ── Constants ─────────────────────────────────────────────────────────────────
DPI              = 300          # print resolution
MM_PER_INCH      = 25.4
PX_PER_MM        = DPI / MM_PER_INCH   # ~11.81 px/mm at 300 DPI

A4_W_MM          = 210
A4_H_MM          = 297
CARD_W_MM        = 90           # card width
CARD_H_MM        = 60           # card height
MARKER_SIZE_MM   = 50           # physical marker side length
PATCH_SIZE_MM    = 8            # colour calibration patch size
BORDER_MM        = 5            # card border

ARUCO_DICT_KEY   = cv2.aruco.DICT_4X4_50


def mm_to_px(mm: float) -> int:
    """Convert millimetres to pixels at DPI resolution."""
    return int(round(mm * PX_PER_MM))


def generate_calibration_card(
    marker_id:       int   = 0,
    marker_size_mm:  float = MARKER_SIZE_MM,
    card_w_mm:       float = CARD_W_MM,
    card_h_mm:       float = CARD_H_MM,
    dpi:             int   = DPI,
    output_format:   str   = "PNG",
) -> bytes:
    """
    Generate a single printable calibration card as PNG bytes.

    Card layout:
    ┌──────────────────────────────────────────┐
    │  [ArUco marker 50mm×50mm]  [colour pads] │
    │                                          │
    │  "Place flat next to wound before photo" │
    │  Marker ID: 0 | Size: 50mm               │
    └──────────────────────────────────────────┘

    Args:
        marker_id:      ArUco marker ID (0–49 for DICT_4X4_50)
        marker_size_mm: Physical side length of printed marker (mm)
        card_w_mm:      Card width in mm
        card_h_mm:      Card height in mm
        dpi:            Print resolution
        output_format:  'PNG' or 'JPEG'

    Returns:
        Image as bytes
    """
    px_per_mm = dpi / MM_PER_INCH
    W = int(card_w_mm * px_per_mm)
    H = int(card_h_mm * px_per_mm)

    # ── Background: white card ─────────────────────────────────────────────────
    card = np.ones((H, W, 3), dtype=np.uint8) * 255

    # ── Card border (black rectangle) ─────────────────────────────────────────
    bord = int(BORDER_MM * px_per_mm)
    cv2.rectangle(card, (bord, bord), (W - bord, H - bord), (0, 0, 0), 2)

    # ── ArUco marker ──────────────────────────────────────────────────────────
    aruco_dict = cv2.aruco.getPredefinedDictionary(ARUCO_DICT_KEY)
    marker_px  = int(marker_size_mm * px_per_mm)
    marker_img = cv2.aruco.generateImageMarker(aruco_dict, marker_id, marker_px)

    # Place marker: top-left with border offset
    m_x = int((BORDER_MM + 2) * px_per_mm)
    m_y = int((BORDER_MM + 2) * px_per_mm)
    # Ensure marker fits
    m_y2 = min(m_y + marker_px, H - bord)
    m_x2 = min(m_x + marker_px, W - bord)
    actual_h = m_y2 - m_y
    actual_w = m_x2 - m_x
    marker_resized = cv2.resize(marker_img, (actual_w, actual_h))
    card[m_y:m_y2, m_x:m_x2] = cv2.cvtColor(
        np.stack([marker_resized]*3, axis=-1), cv2.COLOR_BGR2RGB)

    # Physical size crosshairs (reference lines at exact marker corners)
    line_color = (180, 180, 180)
    cv2.line(card, (m_x, m_y - 8), (m_x, m_y + 8), line_color, 1)
    cv2.line(card, (m_x2, m_y - 8), (m_x2, m_y + 8), line_color, 1)
    cv2.line(card, (m_x - 8, m_y), (m_x + 8, m_y), line_color, 1)
    cv2.line(card, (m_x - 8, m_y2), (m_x + 8, m_y2), line_color, 1)

    # ── Colour calibration patches (right of marker) ──────────────────────────
    patch_px   = int(PATCH_SIZE_MM * px_per_mm)
    patch_x    = m_x2 + int(4 * px_per_mm)
    patches = [
        ("W", (255, 255, 255)),   # white
        ("G", (128, 128, 128)),   # mid grey
        ("K", (0,   0,   0)),     # black
    ]
    for i, (label, colour) in enumerate(patches):
        py = m_y + i * (patch_px + int(2 * px_per_mm))
        cv2.rectangle(card,
                      (patch_x, py),
                      (patch_x + patch_px, py + patch_px),
                      colour, thickness=-1)
        cv2.rectangle(card,
                      (patch_x, py),
                      (patch_x + patch_px, py + patch_px),
                      (0, 0, 0), thickness=1)

    # ── Text labels ───────────────────────────────────────────────────────────
    # Use PIL for text (better quality than cv2.putText)
    card_pil = Image.fromarray(card)
    draw     = ImageDraw.Draw(card_pil)

    text_x = bord + int(2 * px_per_mm)
    text_y = m_y2 + int(3 * px_per_mm)
    font_size_px = int(3.5 * px_per_mm)

    try:
        font       = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", font_size_px)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", int(2.8 * px_per_mm))
        font_bold  = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", int(3.5 * px_per_mm))
    except Exception:
        font = font_small = font_bold = ImageFont.load_default()

    # Main instruction
    draw.text((text_x, text_y),
              "Place flat next to wound before photographing.",
              fill=(0, 0, 0), font=font_small)
    draw.text((text_x, text_y + int(4.5 * px_per_mm)),
              f"Marker ID: {marker_id}  |  Physical size: {int(marker_size_mm)}mm × {int(marker_size_mm)}mm",
              fill=(80, 80, 80), font=font_small)
    draw.text((text_x, text_y + int(9 * px_per_mm)),
              "DiabetesCare AI — ORELA Lab, IIT Kharagpur",
              fill=(150, 150, 150), font=font_small)

    # ── Convert back and encode ───────────────────────────────────────────────
    card_np = np.array(card_pil)
    buf     = io.BytesIO()
    Image.fromarray(card_np).save(buf, format=output_format, dpi=(dpi, dpi))
    return buf.getvalue()


def generate_card_sheet_pdf(
    marker_ids:     list = None,
    marker_size_mm: float = MARKER_SIZE_MM,
    dpi:            int   = DPI,
) -> bytes:
    """
    Generate an A4 PDF sheet containing multiple calibration cards.
    Default: 6 cards (2 columns × 3 rows) with marker IDs 0–5.

    Args:
        marker_ids:     List of marker IDs to generate (default: 0–5)
        marker_size_mm: Physical marker size in mm
        dpi:            Print resolution

    Returns:
        PDF bytes
    """
    if marker_ids is None:
        marker_ids = list(range(6))

    px_per_mm = dpi / MM_PER_INCH
    A4_W = int(A4_W_MM * px_per_mm)
    A4_H = int(A4_H_MM * px_per_mm)

    sheet = Image.new("RGB", (A4_W, A4_H), (240, 240, 240))

    COLS     = 2
    MARGIN_MM = 10
    GAP_MM    = 5
    avail_w  = A4_W_MM - 2 * MARGIN_MM - (COLS - 1) * GAP_MM
    card_w   = avail_w / COLS
    card_h   = min(CARD_H_MM, (A4_H_MM - 2 * MARGIN_MM) / 3 - GAP_MM)

    for idx, mid in enumerate(marker_ids):
        col = idx % COLS
        row = idx // COLS

        x_mm = MARGIN_MM + col * (card_w + GAP_MM)
        y_mm = MARGIN_MM + row * (card_h + GAP_MM)
        x_px = int(x_mm * px_per_mm)
        y_px = int(y_mm * px_per_mm)

        card_bytes = generate_calibration_card(
            marker_id=mid,
            marker_size_mm=marker_size_mm,
            card_w_mm=card_w,
            card_h_mm=card_h,
            dpi=dpi,
        )
        card_img = Image.open(io.BytesIO(card_bytes))
        sheet.paste(card_img, (x_px, y_px))

    # Title
    draw = ImageDraw.Draw(sheet)
    try:
        font_title = ImageFont.truetype(
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            int(5 * px_per_mm))
    except Exception:
        font_title = ImageFont.load_default()

    draw.text(
        (int(MARGIN_MM * px_per_mm), int(3 * px_per_mm)),
        "DiabetesCare AI — Calibration Card Sheet  |  Print at 100% scale, no scaling",
        fill=(50, 50, 50), font=font_title
    )

    buf = io.BytesIO()
    sheet.save(buf, format="PDF", resolution=dpi, save_all=True)
    return buf.getvalue()


# ── FastAPI endpoint helper ───────────────────────────────────────────────────

def get_aruco_router():
    """Returns a FastAPI router with marker generation endpoints."""
    from fastapi import APIRouter
    from fastapi.responses import Response

    router = APIRouter(prefix="/api/v1/calibration", tags=["Calibration Markers"])

    @router.get("/marker/{marker_id}.png")
    async def download_marker_png(
        marker_id:      int   = 0,
        size_mm:        float = 50.0,
        dpi:            int   = 300,
    ):
        """Download a single ArUco calibration card as PNG."""
        png = generate_calibration_card(
            marker_id=marker_id,
            marker_size_mm=size_mm,
            dpi=dpi,
        )
        return Response(
            content=png,
            media_type="image/png",
            headers={
                "Content-Disposition": f"attachment; filename=calibration_marker_{marker_id}.png"
            }
        )

    @router.get("/sheet.pdf")
    async def download_marker_sheet(
        size_mm: float = 50.0,
        dpi:     int   = 300,
    ):
        """Download A4 PDF sheet of 6 calibration cards (IDs 0–5) for printing."""
        pdf = generate_card_sheet_pdf(marker_size_mm=size_mm, dpi=dpi)
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=diabetescare_calibration_sheet.pdf"
            }
        )

    return router
