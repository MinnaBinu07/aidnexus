import os
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.core import config
from backend.app.core.database import Base, engine
from backend.app.core.security import (
    require_admin, require_member, require_investigator, get_current_user
)
from backend.app.models.models import User
from backend.app.api import auth, admin, member, investigator, public

# Ensure upload directories exist
uploads_path = Path(config.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
(uploads_path / "qr").mkdir(parents=True, exist_ok=True)
(uploads_path / "evidence").mkdir(parents=True, exist_ok=True)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AidNexus API",
    description="Digital Relief Verification & Clue Discovery Engine",
    version="1.0.0"
)

# CORS configuration: explicit origins required when allow_credentials=True
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://aidnexus-nu.vercel.app",
]
frontend_env = os.getenv("FRONTEND_URL")
if frontend_env and frontend_env not in origins:
    origins.append(frontend_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Exception: Public QR images only
app.mount("/public-qr", StaticFiles(directory=str(uploads_path / "qr")), name="public_qr")

# Mount Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(member.router)
app.include_router(investigator.router)
app.include_router(public.router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AidNexus",
        "database": "sqlite_wal"
    }

# Role check test routes for validation
@app.get("/test/admin-only")
def test_admin_only(admin: User = Depends(require_admin)):
    return {"message": f"Welcome Admin {admin.name}", "role": admin.role}

@app.get("/test/member-only")
def test_member_only(member: User = Depends(require_member)):
    return {"message": f"Welcome Member {member.name}", "role": member.role}

@app.get("/test/investigator-only")
def test_investigator_only(investigator: User = Depends(require_investigator)):
    return {"message": f"Welcome Investigator {investigator.name}", "role": investigator.role}
