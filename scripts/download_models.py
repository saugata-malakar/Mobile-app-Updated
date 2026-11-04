#!/usr/bin/env python3
"""
DiabetesCare AI — Automated Model Weights Downloader
Downloads fine-tuned YOLO11 and SAM2 model weights from GitHub Releases into models/sam2/.
"""

import os
import sys
import urllib.request
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT_DIR / "models" / "sam2"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Release URL configuration
# Default fallback links; update TAG if specific release tag is used
REPO = "saugata-malakar/Mobile-app-Updated"
RELEASE_TAG = "v1.0-wound-models"

MODEL_FILES = {
    "sam2_hiera_small.pt": [
        f"https://github.com/{REPO}/releases/download/{RELEASE_TAG}/sam2_hiera_small.pt",
        "https://dl.fbaipublicfiles.com/segment_anything_2/072824/sam2_hiera_small.pt",
    ],
    "yolo11s_wound_best.pt": [
        f"https://github.com/{REPO}/releases/download/{RELEASE_TAG}/yolo11s_wound_best.pt",
        f"https://github.com/{REPO}/releases/latest/download/yolo11s_wound_best.pt",
    ],
    "sam2_wound_combined_finetuned.pth": [
        f"https://github.com/{REPO}/releases/download/{RELEASE_TAG}/sam2_wound_combined_finetuned.pth",
        f"https://github.com/{REPO}/releases/latest/download/sam2_wound_combined_finetuned.pth",
    ],
}


def download_file_with_progress(url: str, dest_path: Path):
    """Downloads a file from url to dest_path with download progress percentage."""
    print(f"[*] Downloading: {dest_path.name}")
    print(f"    Source URL: {url}")

    def report_progress(block_num, block_size, total_size):
        if total_size > 0:
            percent = min(100, int(block_num * block_size * 100 / total_size))
            mb_downloaded = (block_num * block_size) / (1024 * 1024)
            mb_total = total_size / (1024 * 1024)
            sys.stdout.write(f"\r    Progress: {percent}% ({mb_downloaded:.1f}/{mb_total:.1f} MB)")
            sys.stdout.flush()

    urllib.request.urlretrieve(url, str(dest_path), reporthook=report_progress)
    print("\n    [OK] Finished!")


def ensure_models(github_token: str = None):
    print("=" * 72)
    print("       DIABETESCARE AI — MODEL WEIGHTS DOWNLOADER")
    print("=" * 72)
    print(f"Target Directory: {MODELS_DIR}\n")

    for filename, urls in MODEL_FILES.items():
        dest = MODELS_DIR / filename
        if dest.exists() and dest.stat().st_size > 1024 * 1024:
            size_mb = dest.stat().st_size / (1024 * 1024)
            print(f"[FOUND] {filename} is already present ({size_mb:.1f} MB). Skipping.")
            continue

        print(f"[MISSING] {filename} not found on disk.")
        downloaded = False
        for url in urls:
            try:
                download_file_with_progress(url, dest)
                downloaded = True
                break
            except Exception as e:
                print(f"    [!] Failed from: {url} ({e})")
                if dest.exists():
                    dest.unlink(missing_ok=True)

        if not downloaded:
            print(f"\n[!] Could not automatically download {filename}.")
            print(f"    Please manually download it from your GitHub Release page:")
            print(f"    https://github.com/{REPO}/releases")
            print(f"    and place it into: {MODELS_DIR}\n")

    print("\n" + "=" * 72)
    print("[SUCCESS] Model verification completed.")
    print("=" * 72)


if __name__ == "__main__":
    token = sys.argv[1] if len(sys.argv) > 1 else os.getenv("GITHUB_TOKEN")
    ensure_models(token)
