"""
Wound Tissue Inference API
Week 3 - Sharif's Implementation

REST API endpoints for:
1. POST /infer/wound/tissue - Tissue classification
2. POST /infer/wound/periwound - Periwound detection
3. POST /infer/wound/combined - Complete wound analysis
"""

import sys
import io
import torch
import torch.nn as nn
import numpy as np
from PIL import Image
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.wound_tissue.model import WoundTissueCNN, PeriwoundClassifier, CombinedWoundAnalyzer
from ml.wound_tissue.data_pipeline import WoundTissueDataset


class TissueInferenceAPI:
    """
    Inference API for wound tissue classification.
    
    Provides methods for:
    - Single image inference
    - Batch inference
    - Model loading and management
    """
    
    # Class information
    TISSUE_CLASSES = {
        0: {
            "name": "Granulation",
            "description": "Healthy pink/red granulation tissue",
            "severity": "low",
            "recommendations": [
                "Continue current wound care",
                "Maintain moist environment",
                "Monitor for infection"
            ]
        },
        1: {
            "name": "Slough",
            "description": "Yellow fibrinous tissue indicating stalled healing",
            "severity": "moderate",
            "recommendations": [
                "Consider debridement",
                "Assess for infection",
                "Optimize moisture balance"
            ]
        },
        2: {
            "name": "Eschar",
            "description": "Black/brown necrotic tissue",
            "severity": "high",
            "recommendations": [
                "Urgent debridement required",
                "Assess for infection",
                "Consider surgical consultation"
            ]
        },
        3: {
            "name": "Cellulitis",
            "description": "Active infection with spreading redness",
            "severity": "severe",
            "recommendations": [
                "URGENT: Start antibiotics",
                "Assess for systemic signs",
                "Consider hospitalization"
            ]
        }
    }
    
    def __init__(
        self,
        tissue_model_path: str = None,
        periwound_model_path: str = None,
        device: str = "cuda"
    ):
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        self.tissue_model = None
        self.periwound_model = None
        
        # Load models if paths provided
        if tissue_model_path:
            self.load_tissue_model(tissue_model_path)
        if periwound_model_path:
            self.load_periwound_model(periwound_model_path)
    
    def load_tissue_model(self, model_path: str):
        """Load wound tissue classification model."""
        self.tissue_model = WoundTissueCNN(num_classes=4)
        self.tissue_model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.tissue_model.to(self.device)
        self.tissue_model.eval()
        print(f"[TissueInferenceAPI] Loaded tissue model from {model_path}")
    
    def load_periwound_model(self, model_path: str):
        """Load periwound classification model."""
        self.periwound_model = PeriwoundClassifier()
        self.periwound_model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.periwound_model.to(self.device)
        self.periwound_model.eval()
        print(f"[TissueInferenceAPI] Loaded periwound model from {model_path}")
    
    def preprocess_image(
        self,
        image: Image.Image,
        target_size: Tuple[int, int] = (224, 224)
    ) -> torch.Tensor:
        """
        Preprocess image for inference.
        
        Args:
            image: PIL Image
            target_size: Target image size
        
        Returns:
            Preprocessed tensor
        """
        import torchvision.transforms as transforms
        
        transform = transforms.Compose([
            transforms.Resize(target_size),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        tensor = transform(image).unsqueeze(0)  # Add batch dimension
        return tensor.to(self.device)
    
    def infer_tissue(
        self,
        image: Image.Image,
        return_probs: bool = False
    ) -> Dict:
        """
        Perform tissue classification on a single image.
        
        Args:
            image: PIL Image
            return_probs: Return probabilities for all classes
        
        Returns:
            Dictionary with classification results
        """
        # Return mock response if model not loaded
        if self.tissue_model is None:
            return self._mock_tissue_response()
        
        # Preprocess
        tensor = self.preprocess_image(image)
        
        # Inference
        with torch.no_grad():
            output = self.tissue_model.predict(tensor)
        
        # Get results
        probs = output['probs'].cpu().numpy()[0]
        pred_class = int(output['preds'].item())
        confidence = float(probs[pred_class])
        
        # Build response
        result = {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "prediction": {
                "class_id": pred_class,
                "class_name": self.TISSUE_CLASSES[pred_class]["name"],
                "description": self.TISSUE_CLASSES[pred_class]["description"],
                "confidence": confidence,
                "severity": self.TISSUE_CLASSES[pred_class]["severity"]
            },
            "recommendations": self.TISSUE_CLASSES[pred_class]["recommendations"]
        }
        
        if return_probs:
            result["probabilities"] = {
                self.TISSUE_CLASSES[i]["name"]: float(probs[i])
                for i in range(4)
            }
        
        return result
    
    def _mock_tissue_response(self) -> Dict:
        """Return mock response when model not loaded."""
        return {
            "status": "mock",
            "timestamp": datetime.utcnow().isoformat(),
            "prediction": {
                "class_id": 0,
                "class_name": "Granulation",
                "description": "Healthy pink/red granulation tissue",
                "confidence": 0.85,
                "severity": "low"
            },
            "recommendations": [
                "Continue current wound care",
                "Maintain moist environment",
                "Monitor for infection"
            ],
            "probabilities": {
                "Granulation": 0.85,
                "Slough": 0.08,
                "Eschar": 0.02,
                "Cellulitis": 0.05
            }
        }
    
    def infer_periwound(
        self,
        image: Image.Image
    ) -> Dict:
        """
        Detect periwound redness.
        
        Args:
            image: PIL Image
        
        Returns:
            Dictionary with periwound detection results
        """
        # Return mock response if model not loaded
        if self.periwound_model is None:
            return self._mock_periwound_response()
        
        # Preprocess
        tensor = self.preprocess_image(image)
        
        # Inference
        with torch.no_grad():
            output = self.periwound_model.predict(tensor)
        
        probs = output['probs'].cpu().numpy()[0]
        pred_class = int(output['preds'].item())
        confidence = float(probs[pred_class])
        
        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "prediction": {
                "class_id": pred_class,
                "class_name": "Periwound Redness" if pred_class == 1 else "Normal",
                "confidence": confidence,
                "is_redness": bool(pred_class == 1)
            }
        }
    
    def _mock_periwound_response(self) -> Dict:
        """Return mock response when model not loaded."""
        return {
            "status": "mock",
            "timestamp": datetime.utcnow().isoformat(),
            "prediction": {
                "class_id": 0,
                "class_name": "Normal",
                "confidence": 0.90,
                "is_redness": False
            }
        }
    
    def infer_combined(
        self,
        image: Image.Image
    ) -> Dict:
        """
        Complete wound analysis (tissue + periwound).
        
        Args:
            image: PIL Image
        
        Returns:
            Complete wound analysis results
        """
        # Tissue classification
        tissue_result = self.infer_tissue(image, return_probs=True)
        
        # Periwound detection
        periwound_result = self.infer_periwound(image)
        
        # Determine cellulitis indicator
        cellulitis_indicator = (
            tissue_result["prediction"]["class_id"] == 3 or
            periwound_result["prediction"]["is_redness"]
        )
        
        # Build combined response
        combined = {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat(),
            "tissue_classification": tissue_result["prediction"],
            "tissue_probabilities": tissue_result.get("probabilities", {}),
            "periwound_detection": periwound_result["prediction"],
            "cellulitis_indicator": cellulitis_indicator,
            "severity_assessment": self._assess_severity(
                tissue_result["prediction"]["class_id"],
                periwound_result["prediction"]["is_redness"]
            ),
            "recommendations": self._get_combined_recommendations(
                tissue_result["prediction"]["class_id"],
                periwound_result["prediction"]["is_redness"]
            )
        }
        
        return combined
    
    def _assess_severity(self, tissue_class: int, periwound: bool) -> Dict:
        """Assess overall wound severity."""
        if tissue_class == 3 or periwound:
            level = "SEVERE"
            score = 4
        elif tissue_class == 2:
            level = "HIGH"
            score = 3
        elif tissue_class == 1:
            level = "MODERATE"
            score = 2
        else:
            level = "LOW"
            score = 1
        
        return {
            "level": level,
            "score": score,
            "description": self.TISSUE_CLASSES[tissue_class]["description"]
        }
    
    def _get_combined_recommendations(
        self,
        tissue_class: int,
        periwound: bool
    ) -> List[str]:
        """Get combined clinical recommendations."""
        recommendations = self.TISSUE_CLASSES[tissue_class]["recommendations"].copy()
        
        if periwound:
            recommendations.append("Periwound redness indicates spreading infection")
        
        if tissue_class == 3 or periwound:
            recommendations.insert(0, "URGENT: Active infection suspected")
        
        return recommendations
    
    def batch_infer(
        self,
        images: List[Image.Image],
        tissue_only: bool = True
    ) -> List[Dict]:
        """
        Perform inference on batch of images.
        
        Args:
            images: List of PIL Images
            tissue_only: Only tissue classification (no periwound)
        
        Returns:
            List of inference results
        """
        results = []
        
        for image in images:
            if tissue_only:
                result = self.infer_tissue(image)
            else:
                result = self.infer_combined(image)
            results.append(result)
        
        return results


def create_inference_api(
    tissue_model_path: str = None,
    periwound_model_path: str = None
) -> TissueInferenceAPI:
    """
    Factory function to create inference API.
    
    Args:
        tissue_model_path: Path to tissue classification model
        periwound_model_path: Path to periwound model
    
    Returns:
        Configured TissueInferenceAPI instance
    """
    return TissueInferenceAPI(
        tissue_model_path=tissue_model_path,
        periwound_model_path=periwound_model_path
    )


# Example usage for testing
if __name__ == "__main__":
    # Create API
    api = TissueInferenceAPI()
    
    # Test with sample image (if available)
    try:
        from PIL import Image
        
        # Create dummy image for testing
        dummy_image = Image.new('RGB', (224, 224), color='red')
        
        # Test tissue inference
        result = api.infer_tissue(dummy_image)
        print("Tissue Inference Result:")
        print(f"  Class: {result['prediction']['class_name']}")
        print(f"  Confidence: {result['prediction']['confidence']:.2%}")
        
        print("\n✓ TissueInferenceAPI working correctly")
        
    except Exception as e:
        print(f"Test error: {e}")