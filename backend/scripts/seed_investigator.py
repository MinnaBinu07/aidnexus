"""Script to register or verify an investigator."""
import sys
from backend.app.core.database import SessionLocal
from backend.app.models.models import User
from backend.app.core.security import hash_password

def verify_or_create_investigator(email: str, name: str = "Chief Investigator", password: str = "investigator123"):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.role = "investigator"
            user.is_verified = True
            db.commit()
            print(f"Investigator {email} verified successfully!")
        else:
            user = User(
                name=name,
                email=email,
                phone="9998887770",
                password_hash=hash_password(password),
                role="investigator",
                is_verified=True
            )
            db.add(user)
            db.commit()
            print(f"Investigator {email} created and verified successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    target_email = sys.argv[1] if len(sys.argv) > 1 else "investigator@aidnexus.org"
    verify_or_create_investigator(target_email)
