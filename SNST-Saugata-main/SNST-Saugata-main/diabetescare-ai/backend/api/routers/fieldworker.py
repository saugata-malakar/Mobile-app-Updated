"""
ASHA Fieldworker RAG API Router
Week 5 - Saugata Malakar

Exposes the POST /api/v1/fieldworker/ask endpoint to query the training manual RAG system.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging

from ml.fieldworker_rag import FieldworkerRAG

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/fieldworker", tags=["fieldworker-rag"])

# Request/Response schemas
class RAGQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500, description="Question about the fieldworker training manual")
    k: Optional[int] = Field(3, ge=1, le=10, description="Number of source documents to retrieve")

    class Config:
        json_schema_extra = {
            "example": {
                "question": "What are the red flags for urgent referral?",
                "k": 3
            }
        }


class RAGQueryResponse(BaseModel):
    question: str
    answer: str
    sources: List[str]


# Dependency: Get RAG assistant instance (singleton)
_rag_assistant = None

def get_rag_assistant() -> FieldworkerRAG:
    global _rag_assistant
    if _rag_assistant is None:
        logger.info("Initializing Fieldworker RAG Assistant...")
        _rag_assistant = FieldworkerRAG()
        _rag_assistant.initialize_index()
        logger.info("✓ Fieldworker RAG Assistant ready")
    return _rag_assistant


@router.post("/ask", response_model=RAGQueryResponse)
async def ask_fieldworker_manual(
    request: RAGQueryRequest,
    rag: FieldworkerRAG = Depends(get_rag_assistant)
) -> RAGQueryResponse:
    """
    Ask a question about the ASHA Fieldworker Training Manual.
    
    The RAG system retrieves the most relevant chunks from the PDF training manual 
    and answers using the configured LLM or local keyword matcher fallback.
    """
    try:
        logger.info(f"Processing RAG request for query: '{request.question}'")
        res = rag.ask(request.question, k=request.k)
        
        return RAGQueryResponse(
            question=res["question"],
            answer=res["answer"],
            sources=res["sources"]
        )
    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query RAG assistant: {str(e)}")
