import json
import os
import re
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from PIL import Image, ImageOps
from torchvision import models, transforms


DEFAULT_MODEL_DIR = (
    Path(__file__).resolve().parents[2]
    / "models"
    / "multimodal_efficientnetb3_v1"
)

MODEL_DIR = Path(os.environ.get("SKIN_MODEL_DIR", DEFAULT_MODEL_DIR))


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


class MultimodalEfficientNetB3(nn.Module):
    def __init__(self, metadata_dim: int, num_classes: int):
        super().__init__()

        self.backbone = models.efficientnet_b3(weights=None)
        image_dim = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Identity()

        self.image_branch = nn.Sequential(
            nn.Linear(image_dim, 512),
            nn.ReLU(),
            nn.Dropout(0.30),
        )

        self.metadata_branch = nn.Sequential(
            nn.Linear(metadata_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.30),
            nn.Linear(256, 128),
            nn.ReLU(),
        )

        self.classifier = nn.Sequential(
            nn.Linear(512 + 128, 256),
            nn.ReLU(),
            nn.Dropout(0.40),
            nn.Linear(256, num_classes),
        )

    def forward(self, images, metadata):
        image_features = self.image_branch(self.backbone(images))
        metadata_features = self.metadata_branch(metadata)

        combined = torch.cat(
            [image_features, metadata_features], dim=1
        )
        return self.classifier(combined)


@lru_cache(maxsize=1)
def load_skin_model():
    """Load model assets once per backend process."""
    metadata_path = MODEL_DIR / "model_metadata.json"
    checkpoint_path = MODEL_DIR / "checkpoints" / "best_model.pt"
    preprocessor_path = MODEL_DIR / "tabular_preprocessor.joblib"

    for path in (metadata_path, checkpoint_path, preprocessor_path):
        if not path.is_file():
            raise FileNotFoundError(
                f"Required skin model asset is missing: {path}"
            )

    with open(metadata_path, encoding="utf-8") as f:
        metadata = json.load(f)

    checkpoint = torch.load(
        checkpoint_path,
        map_location="cpu",
        weights_only=False,
    )

    feature_columns = checkpoint["feature_columns"]
    classes = checkpoint["classes"]
    metadata_dim = int(checkpoint["tabular_dim"])
    image_size = int(checkpoint["image_size"])

    if feature_columns != metadata["feature_columns"]:
        raise RuntimeError("Checkpoint and metadata feature lists differ.")

    if classes != metadata["classes"]:
        raise RuntimeError("Checkpoint and metadata class lists differ.")

    if metadata_dim != int(metadata["tabular_dim"]):
        raise RuntimeError("Checkpoint and metadata dimensions differ.")

    model = MultimodalEfficientNetB3(
        metadata_dim=metadata_dim,
        num_classes=len(classes),
    )
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model.eval()

    preprocessor = joblib.load(preprocessor_path)

    image_transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])

    return {
        "model": model,
        "preprocessor": preprocessor,
        "feature_columns": feature_columns,
        "classes": classes,
        "image_transform": image_transform,
        "body_part_columns": [
            c for c in feature_columns
            if c.startswith("Body_part_")
        ],
        "descriptor_columns": [
            c for c in feature_columns
            if c.startswith("Descriptor_")
        ],
        "image_size": image_size,
        "metadata_dim": metadata_dim,
    }


def get_skin_options():
    assets = load_skin_model()
    return {
        "body_parts": [
            c[len("Body_part_"):]
            for c in assets["body_part_columns"]
        ],
        "descriptors": [
            c[len("Descriptor_"):]
            for c in assets["descriptor_columns"]
        ],
    }


def build_metadata_row(body_part: str, descriptors: list[str]):
    """
    Generate the 99 raw features expected by the saved preprocessor.
    The five remaining features are left missing and handled by the
    fitted preprocessor. No user values are fabricated.
    """
    assets = load_skin_model()
    columns = assets["feature_columns"]
    body_columns = assets["body_part_columns"]
    descriptor_columns = assets["descriptor_columns"]

    if not isinstance(body_part, str) or not body_part.strip():
        raise ValueError("Select a body part.")

    if not descriptors or not all(
        isinstance(d, str) and d.strip() for d in descriptors
    ):
        raise ValueError("Select at least one descriptor.")

    row = {column: np.nan for column in columns}

    # Body part: exactly one binary column becomes 1.
    for column in body_columns:
        row[column] = 0

    body_matches = [
        column for column in body_columns
        if normalize(column[len("Body_part_"):]) == normalize(body_part)
    ]

    if len(body_matches) != 1:
        raise ValueError(
            "Unrecognized body part. Fetch the valid choices from "
            "GET /api/v1/skin/options."
        )

    row[body_matches[0]] = 1

    # Descriptors: each selected descriptor becomes 1.
    # Multiple descriptors are allowed.
    for column in descriptor_columns:
        row[column] = 0

    seen = set()
    for descriptor in descriptors:
        matches = [
            column for column in descriptor_columns
            if normalize(column[len("Descriptor_"):])
            == normalize(descriptor)
        ]

        if len(matches) != 1:
            raise ValueError(
                f"Unrecognized descriptor: {descriptor!r}. "
                "Fetch valid choices from GET /api/v1/skin/options."
            )

        if matches[0] in seen:
            continue

        row[matches[0]] = 1
        seen.add(matches[0])

    return pd.DataFrame([row], columns=columns)


def predict_skin(image: Image.Image, body_part: str,
                 descriptors: list[str]) -> dict:
    assets = load_skin_model()

    raw_metadata = build_metadata_row(body_part, descriptors)
    encoded = assets["preprocessor"].transform(raw_metadata)

    if hasattr(encoded, "toarray"):
        encoded = encoded.toarray()

    encoded = np.asarray(encoded, dtype=np.float32)

    if encoded.shape != (1, assets["metadata_dim"]):
        raise RuntimeError(
            f"Unexpected metadata shape: {encoded.shape}"
        )

    if not np.isfinite(encoded).all():
        raise RuntimeError("Metadata preprocessing produced non-finite values.")

    image = ImageOps.exif_transpose(image).convert("RGB")
    image_tensor = assets["image_transform"](image).unsqueeze(0)
    metadata_tensor = torch.from_numpy(encoded)

    with torch.inference_mode():
        logits = assets["model"](image_tensor, metadata_tensor)
        probabilities = torch.softmax(logits, dim=1)[0].cpu().numpy()

    order = np.argsort(probabilities)[::-1]
    predicted_index = int(order[0])

    return {
        "predicted_class": assets["classes"][predicted_index],
        "model_score": float(probabilities[predicted_index]),
        "class_scores": {
            assets["classes"][int(i)]: float(probabilities[int(i)])
            for i in order
        },
        "disclaimer": (
            "Experimental screening support only. This output is not "
            "a diagnosis. Model scores are not calibrated clinical "
            "probabilities; consult a qualified healthcare professional."
        ),
    }
