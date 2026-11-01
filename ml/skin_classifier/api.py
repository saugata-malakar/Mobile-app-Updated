import io
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from .inference import get_skin_options, predict_skin

router = APIRouter(prefix="/api/v1/skin", tags=["Skin screening"])


@router.get("/options")
def skin_options():
    try:
        return get_skin_options()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/predict")
async def skin_prediction(
    image: UploadFile = File(...),
    body_part: str = Form(...),
    descriptors_json: str = Form(...),
):
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=415,
            detail="Upload an image file.",
        )

    try:
        descriptors = json.loads(descriptors_json)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="descriptors_json must be a JSON array of strings.",
        )

    if (
        not isinstance(descriptors, list)
        or not descriptors
        or not all(isinstance(item, str) for item in descriptors)
    ):
        raise HTTPException(
            status_code=400,
            detail="Select at least one valid descriptor.",
        )

    contents = await image.read()

    if not contents:
        raise HTTPException(status_code=400, detail="Image is empty.")

    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds the 15 MB upload limit.",
        )

    try:
        pil_image = Image.open(io.BytesIO(contents))
        pil_image.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )

    try:
        return predict_skin(
            image=pil_image,
            body_part=body_part,
            descriptors=descriptors,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        # Log the full exception server-side in a production deployment.
        raise HTTPException(
            status_code=500,
            detail="Skin inference failed. Check the backend logs.",
        ) from exc
