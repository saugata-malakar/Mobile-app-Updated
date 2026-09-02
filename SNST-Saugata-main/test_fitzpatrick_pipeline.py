"""
tests/test_fitzpatrick_pipeline.py

Automated tests for the Fitzpatrick 17k skin classifier pipeline.
Uses dummy data — no real images required to run.

Run:
    pytest tests/test_fitzpatrick_pipeline.py -v
"""

import sys
import os
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
import torch
from PIL import Image

# Add ml/skin_classifier to path
sys.path.insert(0, str(Path(__file__).parent.parent / "ml" / "skin_classifier"))

from dataset import (
    FitzpatrickDataset, LABEL_MAP, NUM_CLASSES,
    CLASS_NAMES, get_transforms,
)
from model import build_model, unfreeze_backbone, count_trainable


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def dummy_img_dir(tmp_path):
    """Create 12 dummy JPG images named by fake MD5 hashes."""
    for i in range(12):
        fake_hash = f"{'a' * 31}{i}"
        img = Image.new("RGB", (300, 300), color=(i * 20, 100, 150))
        img.save(tmp_path / f"{fake_hash}.jpg")
    return str(tmp_path)


@pytest.fixture
def dummy_csv(tmp_path):
    """Create a minimal CSV with all 3 label classes and a bad-qc row."""
    rows = []
    labels = ["malignant", "benign", "non-neoplastic"]
    for i in range(12):
        rows.append({
            "md5hash": f"{'a' * 31}{i}",
            "three_partition_label": labels[i % 3],
            "qc": "bad" if i == 11 else None,
        })
    df = pd.DataFrame(rows)
    path = tmp_path / "test_fitz.csv"
    df.to_csv(path, index=False)
    return str(path)


@pytest.fixture
def dummy_df(dummy_img_dir):
    """Build a clean DataFrame directly (no CSV needed)."""
    rows = []
    labels = ["malignant", "benign", "non-neoplastic"]
    for i in range(9):
        rows.append({
            "md5hash": f"{'a' * 31}{i}",
            "three_partition_label": labels[i % 3],
        })
    return pd.DataFrame(rows)


# ── Dataset tests ─────────────────────────────────────────────────────────────

class TestFitzpatrickDataset:

    def test_csv_cleaning_removes_bad_qc(self, dummy_csv, dummy_img_dir):
        ds = FitzpatrickDataset(
            csv_path=dummy_csv, img_dir=dummy_img_dir, split="test")
        # Row 11 has qc='bad' and should be dropped
        for _, row in ds.df.iterrows():
            assert row.get("qc", None) != "bad", "Bad QC row not removed"

    def test_label_map_completeness(self):
        assert set(LABEL_MAP.keys()) == {"malignant", "benign", "non-neoplastic"}
        assert set(LABEL_MAP.values()) == {0, 1, 2}
        assert NUM_CLASSES == 3

    def test_dataset_length(self, dummy_df, dummy_img_dir):
        ds = FitzpatrickDataset(img_dir=dummy_img_dir, split="train", df=dummy_df)
        assert len(ds) == 9

    def test_getitem_returns_correct_shapes(self, dummy_df, dummy_img_dir):
        ds = FitzpatrickDataset(img_dir=dummy_img_dir, split="val", df=dummy_df)
        img, label = ds[0]
        assert img.shape == (3, 224, 224), f"Expected (3,224,224), got {img.shape}"
        assert label in {0, 1, 2}

    def test_getitem_label_range(self, dummy_df, dummy_img_dir):
        ds = FitzpatrickDataset(img_dir=dummy_img_dir, split="train", df=dummy_df)
        for i in range(len(ds)):
            _, label = ds[i]
            assert 0 <= label < NUM_CLASSES

    def test_missing_image_returns_blank(self, dummy_img_dir, tmp_path):
        """Dataset should not crash on missing image — returns blank tensor."""
        df = pd.DataFrame([{
            "md5hash": "nonexistent_hash_00000000000000000",
            "three_partition_label": "benign",
        }])
        ds = FitzpatrickDataset(img_dir=dummy_img_dir, split="val", df=df)
        img, label = ds[0]
        assert img.shape == (3, 224, 224)
        assert label == 1   # benign

    def test_class_weights_shape(self, dummy_df, dummy_img_dir):
        ds = FitzpatrickDataset(img_dir=dummy_img_dir, split="train", df=dummy_df)
        w  = ds.get_class_weights()
        assert w.shape == (NUM_CLASSES,)
        assert (w > 0).all()

    def test_train_val_transforms_differ(self):
        t_train = get_transforms("train")
        t_val   = get_transforms("val")
        # Different number of transforms (train has more augmentations)
        assert len(t_train.transforms) > len(t_val.transforms)


# ── Model tests ───────────────────────────────────────────────────────────────

class TestModel:

    def test_model_output_shape(self):
        model = build_model(num_classes=3)
        model.eval()
        dummy = torch.randn(2, 3, 224, 224)
        with torch.no_grad():
            out = model(dummy)
        assert out.shape == (2, 3), f"Expected (2,3), got {out.shape}"

    def test_head_only_trainable_initially(self):
        model = build_model(num_classes=3)
        trainable = {n for n, p in model.named_parameters() if p.requires_grad}
        # Only classifier params should be trainable
        non_clf_trainable = {n for n in trainable if "classifier" not in n}
        assert len(non_clf_trainable) == 0, \
            f"Backbone params trainable before unfreeze: {non_clf_trainable}"

    def test_unfreeze_increases_trainable_count(self):
        model      = build_model(num_classes=3)
        before     = count_trainable(model)
        unfreeze_backbone(model, unfreeze_from_block=5)
        after      = count_trainable(model)
        assert after > before, "Unfreezing should increase trainable param count"

    def test_full_unfreeze(self):
        model = build_model(num_classes=3)
        unfreeze_backbone(model, unfreeze_from_block=0)
        assert count_trainable(model) > 0


# ── Forward + backward pass (integration) ────────────────────────────────────

class TestForwardBackward:

    def test_single_forward_backward_pass(self, dummy_df, dummy_img_dir):
        """
        End-to-end smoke test:
            dummy image batch → forward → loss → backward → optimizer step
        All on CPU, no GPU required.
        """
        device    = torch.device("cpu")
        model     = build_model(num_classes=3).to(device)
        criterion = torch.nn.CrossEntropyLoss()
        optimizer = torch.optim.AdamW(
            filter(lambda p: p.requires_grad, model.parameters()), lr=1e-3)

        ds      = FitzpatrickDataset(img_dir=dummy_img_dir, split="train", df=dummy_df)
        loader  = torch.utils.data.DataLoader(ds, batch_size=3, shuffle=False)

        imgs, labels = next(iter(loader))
        imgs, labels = imgs.to(device), labels.to(device)

        optimizer.zero_grad()
        logits = model(imgs)
        assert logits.shape == (imgs.size(0), 3)

        loss = criterion(logits, labels)
        assert not torch.isnan(loss), "Loss is NaN — something is wrong"
        assert loss.item() > 0

        loss.backward()
        optimizer.step()   # should not raise

    def test_checkpoint_save_load(self, tmp_path, dummy_df, dummy_img_dir):
        model    = build_model(num_classes=3)
        ckpt_path = tmp_path / "test_ckpt.pth"
        torch.save(model.state_dict(), ckpt_path)

        # Load into a fresh model
        model2 = build_model(num_classes=3)
        model2.load_state_dict(torch.load(ckpt_path, map_location="cpu"))

        # Both should produce identical outputs
        model.eval(); model2.eval()
        dummy = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            out1 = model(dummy)
            out2 = model2(dummy)
        assert torch.allclose(out1, out2), "Loaded checkpoint produces different output"
