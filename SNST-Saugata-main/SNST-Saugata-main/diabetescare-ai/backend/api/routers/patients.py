from fastapi import APIRouter, Depends
from backend.database.models import User
from backend.api.dependencies import get_current_user

router = APIRouter()


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"user_id": str(current_user.user_id), "email": current_user.email, "role": current_user.role}


@router.get("/medical-history")
def medical_history(current_user: User = Depends(get_current_user)):
    return {"patient_id": None, "history": []}


@router.post("/wound-sites")
def create_wound_site(current_user: User = Depends(get_current_user)):
    return {"wound_site_id": None, "status": "created"}


@router.get("/screenings")
def list_screenings(current_user: User = Depends(get_current_user)):
    return {"screenings": []}
