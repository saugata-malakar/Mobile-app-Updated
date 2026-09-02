from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import User
from backend.api.dependencies import create_access_token

router = APIRouter()
pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "field_worker"   # doctor | admin | field_worker


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=pwd_ctx.hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user_id": str(user.user_id), "email": user.email, "role": user.role}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not pwd_ctx.verify(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(subject=str(user.user_id), role=user.role)
    return {"access_token": token, "token_type": "bearer"}
