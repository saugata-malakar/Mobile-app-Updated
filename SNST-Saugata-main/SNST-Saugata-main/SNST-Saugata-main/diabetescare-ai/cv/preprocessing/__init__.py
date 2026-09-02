"""Image preprocessing and coin detection for wound photographs."""

from cv.preprocessing.coin_detection import detect_coin_hough

__all__ = ["detect_coin_hough"]

# Step 1: Generate synthetic training data (immediate)
# python -c "
# from ml.utils.synthetic_dataset_generator import SyntheticWoundGenerator
# SyntheticWoundGenerator.generate_dataset(1000)
# "
# 
# # Step 2: Train model on synthetic data
# python ml/wound_severity/train.py --data synthetic
# 
# # Step 3: Later, when you have real data, fine-tune
# python ml/wound_severity/train.py --data real --pretrained synthetic
