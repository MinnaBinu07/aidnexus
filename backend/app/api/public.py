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
    db: Session = Depends(get_db)
):
    """
    Public donor endpoint to browse open relief programs.
    NO leak of individual claimant names, phones, addresses, or risk scores.
    """
    query = (
        db.query(Community)
        .filter(Community.status == "open")
        .order_by(Community.created_at.desc())
    )

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
