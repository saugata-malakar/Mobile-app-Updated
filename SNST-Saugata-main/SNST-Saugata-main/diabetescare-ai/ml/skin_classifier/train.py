"""
ml/skin_classifier/train.py

Full training pipeline for Fitzpatrick 17k  →  EfficientNet-B3
Target label : three_partition_label  (Malignant / Benign / Non-neoplastic)

Usage:
    # Dry-run on 100 images first
    python train.py --dry_run

    # Full training
    python train.py

    # Full training + ONNX export
    python train.py --export_onnx
"""

import os
import sys
import time
import argparse
import json
from pathlib import Path

import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, WeightedRandomSampler
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, confusion_matrix, cohen_kappa_score
)

# ── Local imports ─────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from dataset import FitzpatrickDataset, LABEL_MAP, CLASS_NAMES, NUM_CLASSES
from model   import build_model, unfreeze_backbone, count_trainable

# ═════════════════════════════════════════════════════════════════════════════
#  CONFIG
# ═════════════════════════════════════════════════════════════════════════════
CSV_PATH = r"C:\Users\Administrator\Downloads\data\fitzpatrick17k.csv"
IMG_DIR  = r"C:\Users\Administrator\Downloads\data\finalfitz17k"

# Output paths (relative to repo root)
CKPT_DIR  = Path("models/skin_classifier")
LOG_FILE  = CKPT_DIR / "training_log.json"
ONNX_PATH = CKPT_DIR / "skin_classifier_b3.onnx"

# Hyperparameters
SEED          = 42
BATCH_SIZE    = 32          # lower to 16 if OOM on GPU
NUM_WORKERS   = 4
IMG_SIZE      = 224

# Two-phase training
WARMUP_EPOCHS  = 5          # Phase 1 : only head, backbone frozen
FINETUNE_EPOCHS= 15         # Phase 2 : unfreeze top blocks
WARMUP_LR      = 1e-3
FINETUNE_LR    = 2e-5

DROPOUT        = 0.4
WEIGHT_DECAY   = 1e-4
UNFREEZE_FROM  = 5          # unfreeze EfficientNet-B3 blocks ≥ this index

# Split ratios
TRAIN_RATIO = 0.80
VAL_RATIO   = 0.10
# TEST_RATIO = 0.10  (remainder)


# ═════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def set_seed(seed: int):
    import random
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def load_and_split(csv_path: str, dry_run: bool = False):
    """
    Reads CSV, cleans, stratified-splits into train / val / test DataFrames.
    dry_run: use only 100 rows for a quick smoke test.
    """
    raw = pd.read_csv(csv_path)
    ds  = FitzpatrickDataset(csv_path=csv_path, img_dir=IMG_DIR)
    df  = ds.df   # already cleaned

    if dry_run:
        # sample ~100 rows, keep class balance as best we can
        df = df.groupby("three_partition_label").head(34).reset_index(drop=True)
        print(f"[DRY RUN] Using {len(df)} rows")

    print(f"\n── Dataset stats ──────────────────────────────")
    print(df["three_partition_label"].value_counts().to_string())
    print(f"Total valid rows: {len(df)}\n")

    # Stratified train / val+test split
    train_df, temp_df = train_test_split(
        df,
        test_size=1 - TRAIN_RATIO,
        stratify=df["three_partition_label"],
        random_state=SEED,
    )
    val_size_relative = VAL_RATIO / (1 - TRAIN_RATIO)
    val_df, test_df = train_test_split(
        temp_df,
        test_size=1 - val_size_relative,
        stratify=temp_df["three_partition_label"],
        random_state=SEED,
    )

    print(f"Train: {len(train_df)}  Val: {len(val_df)}  Test: {len(test_df)}")
    return train_df, val_df, test_df


def make_loaders(train_df, val_df, test_df, batch_size, num_workers):
    """Builds DataLoaders with WeightedRandomSampler for train to handle imbalance."""

    train_ds = FitzpatrickDataset(img_dir=IMG_DIR, split="train",  df=train_df)
    val_ds   = FitzpatrickDataset(img_dir=IMG_DIR, split="val",    df=val_df)
    test_ds  = FitzpatrickDataset(img_dir=IMG_DIR, split="test",   df=test_df)

    # Weighted sampler — oversample minority classes
    class_weights = train_ds.get_class_weights()
    sample_weights = [
        class_weights[LABEL_MAP[row["three_partition_label"]]].item()
        for _, row in train_df.iterrows()
    ]
    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True,
    )

    train_loader = DataLoader(
        train_ds, batch_size=batch_size, sampler=sampler,
        num_workers=num_workers, pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds, batch_size=batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=True,
    )
    test_loader = DataLoader(
        test_ds, batch_size=batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=True,
    )
    return train_loader, val_loader, test_loader


# ═════════════════════════════════════════════════════════════════════════════
#  TRAIN / EVAL LOOPS
# ═════════════════════════════════════════════════════════════════════════════

def train_one_epoch(model, loader, criterion, optimizer, device, epoch):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for batch_idx, (imgs, labels) in enumerate(loader):
        imgs, labels = imgs.to(device), labels.to(device)

        optimizer.zero_grad()
        logits = model(imgs)
        loss   = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * imgs.size(0)
        preds       = logits.argmax(dim=1)
        correct    += (preds == labels).sum().item()
        total      += imgs.size(0)

        if batch_idx % 20 == 0:
            print(
                f"  Epoch {epoch} [{batch_idx}/{len(loader)}] "
                f"loss={loss.item():.4f}",
                end="\r",
            )

    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []

    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        logits = model(imgs)
        loss   = criterion(logits, labels)

        total_loss += loss.item() * imgs.size(0)
        preds       = logits.argmax(dim=1)
        correct    += (preds == labels).sum().item()
        total      += imgs.size(0)

        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

    return (
        total_loss / total,
        correct / total,
        np.array(all_preds),
        np.array(all_labels),
    )


# ═════════════════════════════════════════════════════════════════════════════
#  ONNX EXPORT
# ═════════════════════════════════════════════════════════════════════════════

def export_onnx(model, onnx_path: Path, device):
    model.eval()
    dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE, device=device)
    torch.onnx.export(
        model, dummy, str(onnx_path),
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch_size"}, "logits": {0: "batch_size"}},
        opset_version=13,
    )
    print(f"\n✅ ONNX exported → {onnx_path}")


# ═════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry_run",      action="store_true",
                        help="Run on 100 images only — sanity check")
    parser.add_argument("--export_onnx",  action="store_true",
                        help="Export best checkpoint to ONNX after training")
    parser.add_argument("--batch_size",   type=int, default=BATCH_SIZE)
    parser.add_argument("--num_workers",  type=int, default=NUM_WORKERS)
    args = parser.parse_args()

    set_seed(SEED)
    CKPT_DIR.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n🖥  Device: {device}")
    if device.type == "cuda":
        print(f"   GPU: {torch.cuda.get_device_name(0)}")

    # ── Data ──────────────────────────────────────────────────────────────────
    train_df, val_df, test_df = load_and_split(CSV_PATH, dry_run=args.dry_run)
    train_loader, val_loader, test_loader = make_loaders(
        train_df, val_df, test_df,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
    )

    # ── Model ─────────────────────────────────────────────────────────────────
    model = build_model(num_classes=NUM_CLASSES, dropout=DROPOUT).to(device)
    print(f"\nTrainable params (head only): {count_trainable(model):,}")

    # Class-weighted loss to further handle imbalance
    dummy_ds     = FitzpatrickDataset(img_dir=IMG_DIR, split="train", df=train_df)
    class_weights = dummy_ds.get_class_weights().to(device)
    criterion     = nn.CrossEntropyLoss(weight=class_weights)

    log = {"warmup": [], "finetune": [], "test": {}}
    best_val_acc  = 0.0
    best_ckpt     = CKPT_DIR / "best_model.pth"

    # ══════════════════════════════════════════════════════════════════════════
    #  PHASE 1 — Warm-up (head only)
    # ══════════════════════════════════════════════════════════════════════════
    print("\n" + "═" * 60)
    print(f"PHASE 1 — Warm-up ({WARMUP_EPOCHS} epochs, head only)")
    print("═" * 60)

    optimizer = AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=WARMUP_LR, weight_decay=WEIGHT_DECAY,
    )
    scheduler = CosineAnnealingLR(optimizer, T_max=WARMUP_EPOCHS, eta_min=1e-5)

    for epoch in range(1, WARMUP_EPOCHS + 1):
        t0 = time.time()
        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device, epoch)
        val_loss, val_acc, _, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - t0
        print(
            f"\nEpoch {epoch:02d}/{WARMUP_EPOCHS}  "
            f"train_loss={train_loss:.4f}  train_acc={train_acc:.4f}  "
            f"val_loss={val_loss:.4f}  val_acc={val_acc:.4f}  "
            f"({elapsed:.0f}s)"
        )

        log["warmup"].append({
            "epoch": epoch, "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4), "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
        })

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), best_ckpt)
            print(f"   💾 New best checkpoint (val_acc={val_acc:.4f})")

    # ══════════════════════════════════════════════════════════════════════════
    #  PHASE 2 — Fine-tune (unfreeze top blocks)
    # ══════════════════════════════════════════════════════════════════════════
    print("\n" + "═" * 60)
    print(f"PHASE 2 — Fine-tune ({FINETUNE_EPOCHS} epochs, backbone blocks {UNFREEZE_FROM}+)")
    print("═" * 60)

    unfreeze_backbone(model, unfreeze_from_block=UNFREEZE_FROM)
    print(f"Trainable params (after unfreeze): {count_trainable(model):,}")

    optimizer = AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=FINETUNE_LR, weight_decay=WEIGHT_DECAY,
    )
    scheduler = CosineAnnealingLR(optimizer, T_max=FINETUNE_EPOCHS, eta_min=1e-6)

    for epoch in range(1, FINETUNE_EPOCHS + 1):
        t0 = time.time()
        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device, epoch)
        val_loss, val_acc, _, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - t0
        print(
            f"\nEpoch {epoch:02d}/{FINETUNE_EPOCHS}  "
            f"train_loss={train_loss:.4f}  train_acc={train_acc:.4f}  "
            f"val_loss={val_loss:.4f}  val_acc={val_acc:.4f}  "
            f"({elapsed:.0f}s)"
        )

        log["finetune"].append({
            "epoch": epoch, "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4), "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
        })

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), best_ckpt)
            print(f"   💾 New best checkpoint (val_acc={val_acc:.4f})")

    # ══════════════════════════════════════════════════════════════════════════
    #  TEST SET EVALUATION
    # ══════════════════════════════════════════════════════════════════════════
    print("\n" + "═" * 60)
    print("FINAL TEST SET EVALUATION")
    print("═" * 60)

    model.load_state_dict(torch.load(best_ckpt, map_location=device))
    _, test_acc, preds, labels = evaluate(model, test_loader, criterion, device)

    kappa = cohen_kappa_score(labels, preds)
    report = classification_report(
        labels, preds, target_names=CLASS_NAMES, digits=4)
    cm = confusion_matrix(labels, preds).tolist()

    print(f"\nTest Accuracy : {test_acc:.4f}  ({test_acc*100:.2f}%)")
    print(f"Cohen's Kappa : {kappa:.4f}")
    print(f"\nClassification Report:\n{report}")
    print(f"Confusion Matrix:\n{np.array(cm)}")

    log["test"] = {
        "accuracy": round(test_acc, 4),
        "kappa":    round(kappa, 4),
        "confusion_matrix": cm,
        "report":   report,
    }

    # Save log
    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    print(f"\n📄 Training log → {LOG_FILE}")
    print(f"🏆 Best val accuracy : {best_val_acc:.4f}")
    print(f"💾 Best checkpoint   : {best_ckpt}")

    # ── ONNX export ───────────────────────────────────────────────────────────
    if args.export_onnx:
        export_onnx(model, ONNX_PATH, device)

    print("\n✅ Training complete.\n")


if __name__ == "__main__":
    main()
