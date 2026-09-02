"""
Clinical NLP Module
Week 4 - Saugata Malakar

Extract structured data from free-text clinical notes using spaCy.
"""

from .clinical_nlp_pipeline import ClinicalNLPPipeline, extract_from_notes

__all__ = ["ClinicalNLPPipeline", "extract_from_notes"]
