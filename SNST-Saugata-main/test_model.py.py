import onnxruntime as ort
import numpy as np
from PIL import Image
import torchvision.transforms as T
import torch

# 1. Configuration
ONNX_MODEL_PATH = "skin_classifier_b3.onnx"
TEST_IMAGE_PATH = "test_image.jpg"

CLASS_NAMES = {
    0: "Malignant",
    1: "Benign",
    2: "Non-neoplastic"
}

# 2. Exact Preprocessing from dataset.py
# The model will fail if the image isn't resized and normalized correctly
preprocess = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(
        mean=[0.485, 0.456, 0.406], 
        std=[0.229, 0.224, 0.225]
    ),
])

def predict_image():
    print(f"Loading ONNX model from {ONNX_MODEL_PATH}...")
    
    # Start the ONNX session
    session = ort.InferenceSession(ONNX_MODEL_PATH)
    input_name = session.get_inputs()[0].name
    
    print(f"Loading and preprocessing {TEST_IMAGE_PATH}...")
    try:
        img = Image.open(TEST_IMAGE_PATH).convert("RGB")
    except FileNotFoundError:
        print(f"❌ Error: Could not find {TEST_IMAGE_PATH}. Please put an image in the folder.")
        return

    # Apply transforms and add batch dimension: [1, 3, 224, 224]
    input_tensor = preprocess(img).unsqueeze(0).numpy()

    # Run inference
    print("Running inference...")
    logits = session.run(None, {input_name: input_tensor})[0]

    # Convert raw logits to percentages using Softmax
    probabilities = torch.nn.functional.softmax(torch.tensor(logits), dim=1).numpy()[0]
    
    # Get the winning prediction
    predicted_class_idx = np.argmax(probabilities)
    confidence = probabilities[predicted_class_idx] * 100
    
    print("\n" + "="*40)
    print("🎯 RESULTS")
    print("="*40)
    print(f"Prediction: {CLASS_NAMES[predicted_class_idx]}")
    print(f"Confidence: {confidence:.2f}%\n")
    
    print("Full Breakdown:")
    for i, prob in enumerate(probabilities):
        print(f" - {CLASS_NAMES[i]}: {prob * 100:.2f}%")

if __name__ == "__main__":
    predict_image()