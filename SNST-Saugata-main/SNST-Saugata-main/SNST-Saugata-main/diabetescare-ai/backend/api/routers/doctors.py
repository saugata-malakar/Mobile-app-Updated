from fastapi import APIRouter, Depends
from backend.database.models import User
from backend.api.dependencies import get_current_user

router = APIRouter()


@router.get("/")
def list_doctors(current_user: User = Depends(get_current_user)):
    return {"doctors": []}
