"""
ml/skin_classifier/dataset.py
Fitzpatrick 17k  —  PyTorch Dataset
Target : three_partition_label  (Malignant | Benign | Non-neoplastic)
Images : C:/Users/Administrator/Downloads/data/finalfitz17k/<md5hash>.jpg
CSV    : C:/Users/Administrator/Downloads/data/fitzpatrick17k.csv
"""

import os
import pandas as pd
from PIL import Image
from torch.utils.data import Dataset
import torchvision.transforms as T

# ── Label map (3 classes) ─────────────────────────────────────────────────────
LABEL_MAP = {
    "malignant":      0,
    "benign":         1,
    "non-neoplastic": 2,
}
NUM_CLASSES = 3
CLASS_NAMES = ["Malignant", "Benign", "Non-neoplastic"]

# ── ImageNet stats ────────────────────────────────────────────────────────────
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]


def get_transforms(split: str) -> T.Compose:
    """
    split = 'train' → augmentation + normalize
    split = 'val'/'test' → resize + center-crop + normalize only
    """
    if split == "train":
        return T.Compose([
            T.Resize(256),
            T.RandomResizedCrop(224, scale=(0.8, 1.0)),
            T.RandomHorizontalFlip(),
            T.RandomVerticalFlip(),
            T.ColorJitter(brightness=0.2, contrast=0.2,
                          saturation=0.2, hue=0.05),
            T.RandomRotation(15),
            T.ToTensor(),
            T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ])
    else:
        return T.Compose([
            T.Resize(256),
            T.CenterCrop(224),
            T.ToTensor(),
            T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ])


class FitzpatrickDataset(Dataset):
    """
    Loads Fitzpatrick 17k images + three_partition_label.

    Args:
        csv_path   : path to fitzpatrick17k.csv
        img_dir    : directory containing <md5hash>.jpg files
        split      : 'train' | 'val' | 'test'
        df         : pass a pre-split DataFrame directly (overrides csv_path)
    """

    def __init__(
        self,
        csv_path: str = r"C:\Users\Administrator\Downloads\data\fitzpatrick17k.csv",
        img_dir:  str = r"C:\Users\Administrator\Downloads\data\finalfitz17k",
        split:    str = "train",
        df:       pd.DataFrame = None,
    ):
        self.img_dir   = img_dir
        self.transform = get_transforms(split)

        if df is not None:
            self.df = df.reset_index(drop=True)
        else:
            raw = pd.read_csv(csv_path)
            self.df = self._clean(raw).reset_index(drop=True)

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _clean(df: pd.DataFrame) -> pd.DataFrame:
        """
        1. Drop rows with missing md5hash or three_partition_label.
        2. Normalise label strings to lowercase / strip whitespace.
        3. Keep only rows whose label is in LABEL_MAP.
        4. Drop rows flagged as bad quality (qc column if present).
        """
        df = df.copy()

        # Required columns
        df = df.dropna(subset=["md5hash", "three_partition_label"])

        # Normalise label
        df["three_partition_label"] = (
            df["three_partition_label"]
            .str.strip()
            .str.lower()
            .str.replace(r"\s+", " ", regex=True)
        )

        # Keep only known classes
        df = df[df["three_partition_label"].isin(LABEL_MAP.keys())]

        # Quality filter (column may not exist in all CSV versions)
        if "qc" in df.columns:
            df = df[df["qc"].isna() | (df["qc"].str.strip().str.lower() != "bad")]

        return df

    # ── Public helpers ────────────────────────────────────────────────────────

    def get_class_weights(self):
        """
        Returns per-class weights (inverse frequency) for WeightedRandomSampler
        or CrossEntropyLoss weight argument.
        """
        import torch
        counts = self.df["three_partition_label"].value_counts()
        total  = len(self.df)
        weights = torch.zeros(NUM_CLASSES)
        for label, idx in LABEL_MAP.items():
            n = counts.get(label, 1)
            weights[idx] = total / (NUM_CLASSES * n)
        return weights

    # ── Dataset interface ─────────────────────────────────────────────────────

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row      = self.df.iloc[idx]
        img_path = os.path.join(self.img_dir, f"{row['md5hash']}.jpg")

        # Load image — graceful fallback for corrupt files
        try:
            img = Image.open(img_path).convert("RGB")
        except (FileNotFoundError, OSError):
            # Return a blank image so training doesn't crash;
            # log the bad hash so you can clean it later.
            img = Image.new("RGB", (224, 224), color=(128, 128, 128))

        img   = self.transform(img)
        label = LABEL_MAP[row["three_partition_label"]]
        return img, label
