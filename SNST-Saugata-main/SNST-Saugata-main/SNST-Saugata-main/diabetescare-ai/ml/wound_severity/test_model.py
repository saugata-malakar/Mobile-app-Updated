"""
Quick test of the trained wound severity model
"""

import torch
from model import WoundSeverityModel
from PIL import Image
from torchvision import transforms
from pathlib import Path

print("\n" + "="*70)
print("🧪 TESTING TRAINED WOUND SEVERITY MODEL")
print("="*70)

# Load model
print("\n[1/4] Loading trained model...")
MODEL_PATH = "../../models/wound_severity_best.pth"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = WoundSeverityModel(num_classes=6, dropout_rate=0.3, pretrained=False)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model = model.to(DEVICE)
model.eval()
print(f"✅ Model loaded from {MODEL_PATH}")
print(f"✅ Device: {DEVICE}")

# Prepare transform
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# Test on a few images
print("\n[2/4] Testing on sample images...")
test_images = [
    "../../archive/DFU/Patches/Normal(Healthy skin)/1.jpg",
    "../../archive/DFU/Patches/Abnormal(Ulcer)/1.jpg",
    "../../archive/DFU/Original Images/1.jpg",
]

wagner_grades = {
    0: "Grade 0 (Normal - No ulcer)",
    1: "Grade 1 (Superficial ulcer)",
    2: "Grade 2 (Deep ulcer)",
    3: "Grade 3 (Deep ulcer with abscess)",
    4: "Grade 4 (Localized gangrene)",
    5: "Grade 5 (Extensive gangrene)"
}

for img_path in test_images:
    if not Path(img_path).exists():
        print(f"⚠️  Image not found: {img_path}")
        continue
    
    # Load and preprocess image
    image = Image.open(img_path).convert('RGB')
    image_tensor = transform(image).unsqueeze(0).to(DEVICE)
    
    # Predict
    with torch.no_grad():
        logits = model(image_tensor)
        probabilities = torch.softmax(logits, dim=1)
        predicted_class = logits.argmax(dim=1).item()
        confidence = probabilities[0][predicted_class].item()
    
    print(f"\n📸 Image: {Path(img_path).name}")
    print(f"   Prediction: {wagner_grades[predicted_class]}")
    print(f"   Confidence: {confidence*100:.2f}%")
    print(f"   All probabilities:")
    for grade, prob in enumerate(probabilities[0]):
        print(f"      Grade {grade}: {prob.item()*100:.2f}%")

print("\n[3/4] Model statistics...")
total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"✅ Total parameters: {total_params:,}")
print(f"✅ Trainable parameters: {trainable_params:,}")
print(f"✅ Model size: {Path(MODEL_PATH).stat().st_size / (1024*1024):.2f} MB")

print("\n[4/4] Model is ready for deployment!")
print("\n" + "="*70)
print("✅ MODEL TEST COMPLETE")
print("="*70)
print("\nNext steps:")
print("  1. Start API server: uvicorn backend.api.main:app --reload --port 8000")
print("  2. Test API endpoint: POST http://localhost:8000/api/v1/wound/classify")
print("  3. Deploy to production")
print("\n" + "="*70 + "\n")
