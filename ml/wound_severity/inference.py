"""
Wound Severity Inference Module

Production inference pipeline for wound severity classification.
Handles image preprocessing, model loading, prediction, and result formatting.

Owner: Saugata Malakar (covering Sharif's role)
Integration: FastAPI endpoints, mobile app, doctor dashboard
"""

import os
import sys
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
import numpy as np
from typing import Dict, List, Optional, Tuple, Union
import logging
import json
from datetime import datetime
import hashlib

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from ml.wound_severity.model import WoundSeverityModel, ModelConfig, load_pretrained_model

logger = logging.getLogger(__name__)


class WoundSeverityInference:
    """
    Production inference pipeline for wound severity classification.
    
    Features:
    - Optimized image preprocessing
    - Batch inference support
    - Confidence thresholding
    - Result caching
    - Error handling and logging
    """
    
    def __init__(
        self,
        model_path: str,
        device: str = "auto",
        confidence_threshold: float = 0.7
    ):
        """
        Initialize inference pipeline.
        
        Args:
            model_path: Path to trained model checkpoint
            device: Inference device ("auto", "cpu", "cuda")
            confidence_threshold: Minimum confidence for predictions
        """
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        
        # Check if TFLite model is used
        self.is_tflite = model_path.endswith('.tflite')
        
        # Set device
        if self.is_tflite:
            self.device = "cpu"
        elif device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
        
        logger.info(f"Inference device: {self.device}")
        
        # Load model
        self.model = self._load_model()
        self.config = ModelConfig()
        
        # Setup preprocessing
        self.transform = self._create_transform()
        
        # Wagner grade descriptions
        self.grade_descriptions = {
            0: {
                "label": "Normal/Intact",
                "description": "Intact skin with no ulceration",
                "severity": "None",
                "recommendation": "Continue regular monitoring"
            },
            1: {
                "label": "Superficial",
                "description": "Superficial ulcer without penetration to deeper layers",
                "severity": "Mild",
                "recommendation": "Basic wound care and monitoring"
            },
            2: {
                "label": "Deep",
                "description": "Deep ulcer penetrating to tendon or bone",
                "severity": "Moderate",
                "recommendation": "Professional wound care required"
            },
            3: {
                "label": "Deep with infection",
                "description": "Deep ulcer with abscess or osteomyelitis",
                "severity": "Severe",
                "recommendation": "Immediate medical attention required"
            },
            4: {
                "label": "Localized gangrene",
                "description": "Localized gangrene of forefoot or heel",
                "severity": "Very Severe",
                "recommendation": "Urgent surgical consultation required"
            },
            5: {
                "label": "Extensive gangrene",
                "description": "Extensive gangrene involving entire foot",
                "severity": "Critical",
                "recommendation": "Emergency surgical intervention required"
            }
        }
        
        logger.info("Wound severity inference pipeline initialized")
    
    def _load_model(self):
        """Load trained model from checkpoint."""
        if self.is_tflite:
            try:
                import ai_edge_litert.interpreter as litert
                logger.info(f"Loading TFLite model from {self.model_path}")
                interpreter = litert.Interpreter(model_path=self.model_path)
                interpreter.allocate_tensors()
                logger.info(f"TFLite Model loaded successfully from {self.model_path}")
                return interpreter
            except Exception as e:
                logger.error(f"Failed to load TFLite model from {self.model_path}: {str(e)}")
                raise
        else:
            try:
                model = load_pretrained_model(self.model_path, device=str(self.device))
                logger.info(f"Model loaded successfully from {self.model_path}")
                return model
            except Exception as e:
                logger.error(f"Failed to load model from {self.model_path}: {str(e)}")
                raise
    
    def _create_transform(self) -> transforms.Compose:
        """Create image preprocessing transform."""
        return transforms.Compose([
            transforms.Resize((self.config.IMAGE_SIZE, self.config.IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=self.config.MEAN, std=self.config.STD)
        ])
    
    def preprocess_image(self, image: Union[str, Image.Image, np.ndarray]) -> torch.Tensor:
        """
        Preprocess image for inference.
        
        Args:
            image: Input image (file path, PIL Image, or numpy array)
            
        Returns:
            Preprocessed tensor [1, 3, 224, 224]
        """
        try:
            # Convert to PIL Image
            if isinstance(image, str):
                # File path
                pil_image = Image.open(image).convert('RGB')
            elif isinstance(image, np.ndarray):
                # Numpy array
                pil_image = Image.fromarray(image).convert('RGB')
            elif isinstance(image, Image.Image):
                # PIL Image
                pil_image = image.convert('RGB')
            else:
                raise ValueError(f"Unsupported image type: {type(image)}")
            
            # Apply transforms
            tensor = self.transform(pil_image)
            
            # Add batch dimension
            tensor = tensor.unsqueeze(0)
            
            return tensor.to(self.device)
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {str(e)}")
            raise
    
    def predict_single(self, image: Union[str, Image.Image, np.ndarray]) -> Dict:
        """
        Predict wound severity for a single image.
        
        Args:
            image: Input image
            
        Returns:
            Prediction results dictionary
        """
        try:
            # Preprocess image
            input_tensor = self.preprocess_image(image)
            
            # Generate image hash for caching/tracking
            if isinstance(image, str):
                with open(image, 'rb') as f:
                    image_hash = hashlib.sha256(f.read()).hexdigest()[:16]
            else:
                # For PIL/numpy images, use tensor hash
                image_hash = hashlib.sha256(input_tensor.cpu().numpy().tobytes()).hexdigest()[:16]
            
            # Inference
            start_time = datetime.now()
            
            if self.is_tflite:
                input_details = self.model.get_input_details()
                output_details = self.model.get_output_details()
                input_index = input_details[0]['index']
                output_index = output_details[0]['index']
                
                # Preprocessed input is PyTorch NCHW format, TFLite expects NHWC format
                input_np = input_tensor.cpu().numpy()
                input_nhwc = np.transpose(input_np, (0, 2, 3, 1))
                
                self.model.set_tensor(input_index, input_nhwc)
                self.model.invoke()
                output_logits = self.model.get_tensor(output_index)
                
                # Custom softmax
                e_x = np.exp(output_logits - np.max(output_logits, axis=-1, keepdims=True))
                probabilities_np = (e_x / e_x.sum(axis=-1, keepdims=True))[0]
                
                confidence = float(np.max(probabilities_np))
                predicted_class = int(np.argmax(probabilities_np))
                probs_list = probabilities_np.tolist()
            else:
                with torch.no_grad():
                    self.model.eval()
                    logits = self.model(input_tensor)
                    probabilities = F.softmax(logits, dim=1)
                    
                    # Get prediction
                    confidence, predicted_class = torch.max(probabilities, dim=1)
                    predicted_class = predicted_class.item()
                    confidence = confidence.item()
                    probs_list = probabilities[0].cpu().numpy().tolist()
            
            inference_time = (datetime.now() - start_time).total_seconds() * 1000  # ms
            
            # Format results
            grade_info = self.grade_descriptions[predicted_class]
            
            result = {
                "wagner_grade": predicted_class,
                "grade_label": grade_info["label"],
                "description": grade_info["description"],
                "severity": grade_info["severity"],
                "recommendation": grade_info["recommendation"],
                "confidence": round(confidence, 4),
                "high_confidence": confidence >= self.confidence_threshold,
                "class_probabilities": {
                    f"grade_{i}": round(prob, 4) 
                    for i, prob in enumerate(probs_list)
                },
                "metadata": {
                    "model_version": "wound_severity_v1.0",
                    "inference_time_ms": round(inference_time, 2),
                    "image_hash": image_hash,
                    "timestamp": datetime.now().isoformat(),
                    "device": "tflite_cpu" if self.is_tflite else str(self.device)
                }
            }
            
            logger.info(
                f"Prediction: Grade {predicted_class} ({grade_info['label']}) "
                f"with confidence {confidence:.3f}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def predict_batch(self, images: List[Union[str, Image.Image, np.ndarray]]) -> List[Dict]:
        """
        Predict wound severity for multiple images.
        
        Args:
            images: List of input images
            
        Returns:
            List of prediction results
        """
        if self.is_tflite:
            return [self.predict_single(image) for image in images]
            
        results = []
        
        try:
            # Preprocess all images
            input_tensors = []
            image_hashes = []
            
            for image in images:
                tensor = self.preprocess_image(image)
                input_tensors.append(tensor)
                
                # Generate hash
                if isinstance(image, str):
                    with open(image, 'rb') as f:
                        image_hash = hashlib.sha256(f.read()).hexdigest()[:16]
                else:
                    image_hash = hashlib.sha256(tensor.cpu().numpy().tobytes()).hexdigest()[:16]
                image_hashes.append(image_hash)
            
            # Batch inference
            batch_tensor = torch.cat(input_tensors, dim=0)
            
            start_time = datetime.now()
            
            with torch.no_grad():
                self.model.eval()
                logits = self.model(batch_tensor)
                probabilities = F.softmax(logits, dim=1)
                
                confidences, predicted_classes = torch.max(probabilities, dim=1)
            
            inference_time = (datetime.now() - start_time).total_seconds() * 1000  # ms
            
            # Format results for each image
            for i, (pred_class, confidence, probs, img_hash) in enumerate(
                zip(predicted_classes, confidences, probabilities, image_hashes)
            ):
                pred_class = pred_class.item()
                confidence = confidence.item()
                grade_info = self.grade_descriptions[pred_class]
                
                result = {
                    "wagner_grade": pred_class,
                    "grade_label": grade_info["label"],
                    "description": grade_info["description"],
                    "severity": grade_info["severity"],
                    "recommendation": grade_info["recommendation"],
                    "confidence": round(confidence, 4),
                    "high_confidence": confidence >= self.confidence_threshold,
                    "class_probabilities": {
                        f"grade_{j}": round(prob, 4) 
                        for j, prob in enumerate(probs.cpu().numpy())
                    },
                    "metadata": {
                        "model_version": "wound_severity_v1.0",
                        "inference_time_ms": round(inference_time / len(images), 2),
                        "image_hash": img_hash,
                        "batch_index": i,
                        "timestamp": datetime.now().isoformat(),
                        "device": str(self.device)
                    }
                }
                
                results.append(result)
            
            logger.info(f"Batch prediction completed: {len(images)} images processed")
            
        except Exception as e:
            logger.error(f"Batch prediction failed: {str(e)}")
            # Return error for all images
            error_result = {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            results = [error_result] * len(images)
        
        return results
    
    def get_model_info(self) -> Dict:
        """
        Get model information and statistics.
        
        Returns:
            Model information dictionary
        """
        return {
            "model_path": self.model_path,
            "model_version": "wound_severity_v1.0",
            "architecture": "EfficientNet-B0",
            "num_classes": self.config.NUM_CLASSES,
            "input_size": [3, self.config.IMAGE_SIZE, self.config.IMAGE_SIZE],
            "wagner_grades": self.grade_descriptions,
            "confidence_threshold": self.confidence_threshold,
            "device": str(self.device),
            "preprocessing": {
                "resize": [self.config.IMAGE_SIZE, self.config.IMAGE_SIZE],
                "normalize_mean": self.config.MEAN,
                "normalize_std": self.config.STD
            }
        }


class WoundSeverityAPI:
    """
    API wrapper for wound severity inference.
    Designed for integration with FastAPI endpoints.
    """
    
    def __init__(self, model_path: str, device: str = "auto"):
        """
        Initialize API wrapper.
        
        Args:
            model_path: Path to trained model
            device: Inference device
        """
        self.inference_engine = WoundSeverityInference(
            model_path=model_path,
            device=device,
            confidence_threshold=0.7
        )
    
    def classify_wound(
        self, 
        image_data: Union[str, bytes, Image.Image],
        patient_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict:
        """
        API endpoint for wound classification.
        
        Args:
            image_data: Image data (file path, bytes, or PIL Image)
            patient_id: Optional patient identifier
            session_id: Optional session identifier
            
        Returns:
            API response with prediction results
        """
        try:
            # Convert bytes to PIL Image if needed
            if isinstance(image_data, bytes):
                from io import BytesIO
                image_data = Image.open(BytesIO(image_data))
            
            # Get prediction
            result = self.inference_engine.predict_single(image_data)
            
            # Add API metadata
            if "error" not in result:
                result["api_metadata"] = {
                    "patient_id": patient_id,
                    "session_id": session_id,
                    "api_version": "v1.0",
                    "status": "success"
                }
            
            return result
            
        except Exception as e:
            logger.error(f"API classification failed: {str(e)}")
            return {
                "error": str(e),
                "api_metadata": {
                    "patient_id": patient_id,
                    "session_id": session_id,
                    "api_version": "v1.0",
                    "status": "error"
                },
                "timestamp": datetime.now().isoformat()
            }
    
    def health_check(self) -> Dict:
        """
        API health check endpoint.
        
        Returns:
            Health status
        """
        try:
            # Test with dummy input
            dummy_image = Image.new('RGB', (224, 224), color='white')
            result = self.inference_engine.predict_single(dummy_image)
            
            return {
                "status": "healthy",
                "model_loaded": "error" not in result,
                "device": str(self.inference_engine.device),
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }


# Example usage and testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Test wound severity inference")
    parser.add_argument("--model_path", type=str, required=True, help="Path to trained model")
    parser.add_argument("--image_path", type=str, required=True, help="Path to test image")
    parser.add_argument("--device", type=str, default="auto", help="Inference device")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Create inference engine
    inference = WoundSeverityInference(
        model_path=args.model_path,
        device=args.device
    )
    
    # Test single prediction
    result = inference.predict_single(args.image_path)
    
    print("Wound Severity Prediction Results:")
    print(json.dumps(result, indent=2))
    
    # Test API wrapper
    api = WoundSeverityAPI(model_path=args.model_path, device=args.device)
    
    # Health check
    health = api.health_check()
    print("\nAPI Health Check:")
    print(json.dumps(health, indent=2))
    
    # API classification
    api_result = api.classify_wound(
        image_data=args.image_path,
        patient_id="test_patient_123",
        session_id="test_session_456"
    )
    print("\nAPI Classification Result:")
    print(json.dumps(api_result, indent=2))