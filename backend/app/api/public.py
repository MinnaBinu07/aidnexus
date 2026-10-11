import os
from math import ceil
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.models import Community, Submission, User
from backend.app.schemas.schemas import PublicCommunityOut

router = APIRouter(prefix="/public", tags=["Public"])

@router.get("/communities")
def list_public_communities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Public donor endpoint to browse open relief programs.
    NO leak of individual claimant names, phones, addresses, or risk scores.
    """
    query = (
        db.query(Community)
        .filter(Community.status == "open")
    )

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            (Community.title.ilike(term)) | (Community.description.ilike(term))
        )

    query = query.order_by(Community.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    out_items = []
    for c in items:
        approved_count = (
            db.query(Submission)
            .filter(
                Submission.community_id == c.id,
                Submission.status == "approved"
            )
            .count()
        )
        admin_name = c.admin.name if c.admin else "Authorized Relief Worker"

        out_items.append(
            PublicCommunityOut(
                id=c.id,
                title=c.title,
                description=c.description or "",
                admin_name=admin_name,
                is_verified_admin=c.is_verified_admin,
                status=c.status,
                qr_image_path=c.qr_image_path,
                approved_members_count=approved_count,
                created_at=c.created_at
            )
        )

    return {
        "items": out_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/communities/{id}", response_model=PublicCommunityOut)
def get_public_community(
    id: int,
    db: Session = Depends(get_db)
):
    """
    Public detail view of a single relief community with approved household count and organizer donation QR.
    """
    c = db.query(Community).filter(Community.id == id).first()
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relief community not found"
        )

    approved_count = (
        db.query(Submission)
        .filter(
            Submission.community_id == c.id,
            Submission.status == "approved"
        )
        .count()
    )
    admin_name = c.admin.name if c.admin else "Authorized Relief Worker"

    return PublicCommunityOut(
        id=c.id,
        title=c.title,
        description=c.description or "",
        admin_name=admin_name,
        is_verified_admin=c.is_verified_admin,
        status=c.status,
        qr_image_path=c.qr_image_path,
        approved_members_count=approved_count,
        created_at=c.created_at
    )


@router.get("/demo-code")
def get_demo_access_code(db: Session = Depends(get_db)):
    """
    Dev-gated endpoint. In production, this endpoint is strictly disabled.
    """
    is_dev = os.getenv("ENVIRONMENT", "development").lower() in ("development", "dev", "test")
    if not is_dev:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo code endpoint is disabled in production."
        )

    from backend.app.models.models import AccessCode
    code_obj = (
        db.query(AccessCode)
        .filter(AccessCode.status == "unused")
        .order_by(AccessCode.id.desc())
        .first()
    )
    if not code_obj:
        open_comm = db.query(Community).filter(Community.status == "open").first()
        if open_comm:
            import uuid
            fresh_code = f"AID-{uuid.uuid4().hex[:8].upper()}-{uuid.uuid4().hex[:8].upper()}"
            code_obj = AccessCode(
                community_id=open_comm.id,
                code=fresh_code,
                status="unused",
                issued_to_label="Direct Verification Pass"
            )
            db.add(code_obj)
            db.commit()
            db.refresh(code_obj)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active communities found. Please create a community first."
            )
    return {
        "code": code_obj.code,
        "community_id": code_obj.community_id,
        "community_title": code_obj.community.title if code_obj.community else "Relief Program",
        "issued_to_label": code_obj.issued_to_label
    }
