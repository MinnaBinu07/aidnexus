from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import (
    hash_password, verify_password, create_access_token, get_current_user
)
from backend.app.models.models import User, AuditLog
from backend.app.schemas.schemas import UserRegister, UserLogin, Token, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )

    # For prototype: admin and member can register; investigator can register, but needs is_verified set
    user = User(
        name=user_in.name,
        email=user_in.email,
        phone=user_in.phone,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
        is_verified=False  # Must be verified by admin/seed script for investigator
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        actor_id=user.id,
        action="user_registered",
        target_type="user",
        target_id=user.id,
        detail=f"User registered with role: {user.role}"
    )
    db.add(audit)
    db.commit()

    return user

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role, "is_verified": user.is_verified}
    )

    audit = AuditLog(
        actor_id=user.id,
        action="login",
        target_type="user",
        target_id=user.id,
        detail=f"User logged in from role: {user.role}"
    )
    db.add(audit)
    db.commit()

    return Token(
        access_token=token,
        token_type="bearer",
        user=user
    )

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
