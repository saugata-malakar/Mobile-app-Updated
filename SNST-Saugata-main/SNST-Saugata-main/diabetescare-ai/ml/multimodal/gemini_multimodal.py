"""
Multimodal Gemini 1.5 Pro Integration
Part 10 Deliverable — Saugata Malakar

Combines base64-encoded wound photograph + clinical patient metadata
using Gemini 1.5 Pro to return structured clinical assessments.
"""

import os
import json
import base64
import asyncio
import logging
from typing import Dict, Any, List, Literal, Optional
from pydantic import BaseModel, Field

# Google Gemini imports
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logging.warning("google-generativeai not installed.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiWoundAssessment(BaseModel):
    """Structured response from multimodal wound clinical analysis."""
    wound_severity_assessment: str = Field(..., description="Clinical Wagner grade assessment and classification details")
    confidence_level: Literal["low", "medium", "high"] = Field(..., description="Confidence level of the clinical assessment")
    recommended_action: str = Field(..., description="Recommended actions for the fieldworker")
    clinical_flags: List[str] = Field(..., description="Clinical flags/observations (e.g. infection, necrosis)")


class GeminiMultimodalAPI:
    """
    Multimodal AI assistant using Gemini 1.5 Pro.
    Accepts base64-encoded wound photograph and clinical metadata dict.
    Returns: Pydantic-validated GeminiWoundAssessment JSON.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = None
        
        if not GEMINI_AVAILABLE:
            logger.error("Gemini SDK not available.")
            return
            
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not set. Running in mock mode.")
            return
            
        try:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-pro')
            logger.info("✓ Gemini 1.5 Pro model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini model: {e}")
            self.model = None

    def _build_prompt(self, metadata: Dict[str, Any]) -> str:
        """Build structured system prompt instructing model to act as a clinician."""
        return f"""You are an expert wound assessment clinician. Analyze this wound photograph alongside the patient's clinical metadata.

PATIENT METADATA:
- HbA1c: {metadata.get('hba1c')}%
- Years with Diabetes: {metadata.get('diabetes_duration_years')} years
- Blood Pressure: {metadata.get('systolic_bp')}/{metadata.get('diastolic_bp')} mmHg

You must evaluate:
1. Wound severity classification (Wagner grade assessment).
2. Tissue conditions (granulation, slough, eschar, cellulitis, necrotic tissue).
3. Recommended clinical actions (referral SLA, wound irrigation, debridement).
4. Clinical flags/risks.

You MUST return a valid JSON object ONLY. Do NOT include markdown code fences (like ```json), styling, or any extra conversational text. The JSON object must strictly conform to this schema:
{{
  "wound_severity_assessment": "detailed string describing classification and tissue",
  "confidence_level": "low" | "medium" | "high",
  "recommended_action": "detailed action recommendations",
  "clinical_flags": ["list", "of", "flags"]
}}
"""

    async def analyze_base64_and_metadata(
        self,
        base64_image: str,
        metadata: Dict[str, Any]
    ) -> GeminiWoundAssessment:
        """
        Analyze base64 image + metadata.
        Retries up to 2 times (3 attempts total) if validation or parsing fails.
        """
        if self.model is None:
            logger.info("Operating in mock mode (GEMINI_API_KEY not set).")
            return self._mock_assessment(metadata)
            
        prompt = self._build_prompt(metadata)
        max_attempts = 3
        last_error = None
        
        for attempt in range(max_attempts):
            try:
                # Decode base64 image string to raw bytes for inline data
                image_bytes = base64.b64decode(base64_image)
                image_part = {
                    "mime_type": "image/jpeg",
                    "data": image_bytes
                }
                
                # Request JSON mode to guarantee parseable output
                generation_config = {"response_mime_type": "application/json"}
                
                # Call live model asynchronously (blocking thread pool wrapper)
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.model.generate_content(
                        [prompt, image_part],
                        generation_config=generation_config
                    )
                )
                
                response_text = response.text.strip()
                data = json.loads(response_text)
                
                # Pydantic validation
                assessment = GeminiWoundAssessment(**data)
                return assessment
                
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed for multimodal Gemini API: {e}")
                last_error = e
                # Wait 1 second before retrying
                await asyncio.sleep(1)
                
        logger.error(f"All {max_attempts} attempts failed. Last error: {last_error}")
        raise last_error

    def _mock_assessment(self, metadata: Dict[str, Any]) -> GeminiWoundAssessment:
        """Mock response for offline testing or when API key is missing."""
        hba1c = metadata.get("hba1c", 6.0)
        duration = metadata.get("diabetes_duration_years", 0)
        sys_bp = metadata.get("systolic_bp", 120)
        
        # Rule-based generation
        if hba1c > 9.0 or duration > 15 or sys_bp > 150:
            severity = "Wagner Grade 3 deep ulcer with signs of peripheral vascular disease and cellulitis. High risk."
            confidence = "high"
            action = "Urgent specialist podiatry referral within 24 hours. Start empirical antibiotics."
            flags = ["poor_glycemic_control", "infection_risk", "gangrene_vulnerability"]
        else:
            severity = "Wagner Grade 1 superficial ulcer. Pink granulation base, no signs of cellulitis or active infection."
            confidence = "medium"
            action = "Saline irrigation, hydrogel dressing, and weekly offloading checks."
            flags = ["peripheral_neuropathy"]
            
        return GeminiWoundAssessment(
            wound_severity_assessment=severity,
            confidence_level=confidence,
            recommended_action=action,
            clinical_flags=flags
        )


def create_gemini_api(api_key: Optional[str] = None) -> GeminiMultimodalAPI:
    """Helper factory function to create a GeminiMultimodalAPI instance."""
    return GeminiMultimodalAPI(api_key=api_key)

