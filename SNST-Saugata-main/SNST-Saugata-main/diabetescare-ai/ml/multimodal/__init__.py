"""
Multimodal AI Module
Week 4 - Saugata Malakar

Combines image + clinical data for richer severity assessment using Gemini 1.5 Pro Vision.
"""

from .gemini_multimodal import GeminiMultimodalAPI, GeminiWoundAssessment, create_gemini_api

__all__ = ["GeminiMultimodalAPI", "GeminiWoundAssessment", "create_gemini_api"]
