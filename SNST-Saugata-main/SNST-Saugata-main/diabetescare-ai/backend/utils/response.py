"""
Consistent response formatting for FastAPI endpoints.

Provides standard response schemas for success and error cases.

Owner: Sahil Kumar Gupta
"""

from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, Any, List
from datetime import datetime

T = TypeVar("T")


class SuccessResponse(BaseModel, Generic[T]):
    """
    Standard success response format.
    
    Example:
        {
            "status": "success",
            "data": {...},
            "message": "Patient retrieved successfully",
            "timestamp": "2024-11-15T14:32:00Z"
        }
    """
    status: str = "success"
    data: T
    message: Optional[str] = None
    timestamp: datetime = datetime.utcnow()


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standard paginated response format.
    
    Example:
        {
            "status": "success",
            "data": [...],
            "total": 150,
            "page": 1,
            "page_size": 10,
            "total_pages": 15
        }
    """
    status: str = "success"
    data: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    timestamp: datetime = datetime.utcnow()


class ErrorResponse(BaseModel):
    """
    Standard error response format.
    
    Example:
        {
            "status": "error",
            "error_code": "PATIENT_NOT_FOUND",
            "detail": "Patient with ID pat-123 not found",
            "timestamp": "2024-11-15T14:32:00Z"
        }
    """
    status: str = "error"
    error_code: str
    detail: str
    timestamp: datetime = datetime.utcnow()


# Response helper functions

def success_response(data: Any, message: Optional[str] = None) -> dict:
    """Create standardized success response."""
    return {
        "status": "success",
        "data": data,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
    }


def paginated_response(
    data: List[Any],
    total: int,
    page: int,
    page_size: int,
) -> dict:
    """Create standardized paginated response."""
    total_pages = (total + page_size - 1) // page_size
    return {
        "status": "success",
        "data": data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "timestamp": datetime.utcnow().isoformat(),
    }


def error_response(error_code: str, detail: str) -> dict:
    """Create standardized error response."""
    return {
        "status": "error",
        "error_code": error_code,
        "detail": detail,
        "timestamp": datetime.utcnow().isoformat(),
    }
