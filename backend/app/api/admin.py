import os
import secrets
from pathlib import Path
from math import ceil
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session

from backend.app.core import config
from backend.app.core.database import get_db
from backend.app.core.security import require_admin
from backend.app.models.models import (
    User, Community, RequiredField, AccessCode, AuditLog,
    Submission, SubmissionValue, Evidence, Link, DocumentRequest, Notification
)
from backend.app.schemas.schemas import (
    CommunityCreate, CommunityUpdate, CommunityOut,
    RequiredFieldsUpdate, RequiredFieldSchema,
    BulkCodesCreate, AccessCodeOut,
    ReviewAction, DocumentRequestCreate, DocumentRequestOut, CommunityStatsOut
)

router = APIRouter(tags=["Admin"])

def get_admin_community(community_id: int, admin: User, db: Session) -> Community:
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )
    if community.admin_id != admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not manage this community"
        )
    return community

@router.post("/communities", response_model=CommunityOut, status_code=status.HTTP_201_CREATED)
def create_community(
    community_in: CommunityCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = Community(
        admin_id=admin.id,
        title=community_in.title,
        description=community_in.description,
        is_verified_admin=admin.is_verified,
        status="open"
    )
    db.add(community)
    db.commit()
    db.refresh(community)

    audit = AuditLog(
        actor_id=admin.id,
        action="create_community",
        target_type="community",
        target_id=community.id,
        detail=f"Admin created community: {community.title}"
    )
    db.add(audit)
    db.commit()

    return community

@router.get("/communities/mine")
def get_my_communities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Community).filter(Community.admin_id == admin.id).order_by(Community.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": [CommunityOut.model_validate(c) for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/communities/{id}", response_model=CommunityOut)
def get_community_detail(
    id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    return community

@router.put("/communities/{id}", response_model=CommunityOut)
def update_community(
    id: int,
    community_update: CommunityUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    if community_update.title is not None:
        community.title = community_update.title
    if community_update.description is not None:
        community.description = community_update.description
    if community_update.status is not None:
        community.status = community_update.status

    db.commit()
    db.refresh(community)

    audit = AuditLog(
        actor_id=admin.id,
        action="update_community",
        target_type="community",
        target_id=community.id,
        detail="Admin updated community settings"
    )
    db.add(audit)
    db.commit()

    return community

@router.post("/communities/{id}/qr", response_model=CommunityOut)
def upload_community_qr(
    id: int,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)

    # Validate mime type
    if file.content_type not in config.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {config.ALLOWED_IMAGE_TYPES}"
        )

    # Read and validate size
    content = file.file.read()
    max_bytes = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {config.MAX_UPLOAD_SIZE_MB}MB"
        )

    # Save to uploads/qr with secure random name
    ext = Path(file.filename or "qr.png").suffix.lower()
    if not ext or ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".png"
    random_filename = f"qr_{community.id}_{secrets.token_hex(8)}{ext}"
    qr_dir = Path(config.UPLOAD_DIR) / "qr"
    qr_dir.mkdir(parents=True, exist_ok=True)
    file_path = qr_dir / random_filename

    with open(file_path, "wb") as f:
        f.write(content)

    public_url = f"/public-qr/{random_filename}"
    community.qr_image_path = public_url
    db.commit()
    db.refresh(community)

    audit = AuditLog(
        actor_id=admin.id,
        action="upload_qr",
        target_type="community",
        target_id=community.id,
        detail=f"Admin uploaded donation QR image: {random_filename}"
    )
    db.add(audit)
    db.commit()

    return community

@router.put("/communities/{id}/fields", response_model=List[RequiredFieldSchema])
def define_required_fields(
    id: int,
    fields_in: RequiredFieldsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)

    # Clear existing fields for this community and rebuild
    db.query(RequiredField).filter(RequiredField.community_id == community.id).delete()

    created_fields = []
    for idx, f in enumerate(fields_in.fields):
        rf = RequiredField(
            community_id=community.id,
            label=f.label.strip(),
            field_type=f.field_type.lower(),
            is_required=f.is_required,
            order=f.order if f.order is not None else idx
        )
        db.add(rf)
        created_fields.append(rf)

    db.commit()
    for rf in created_fields:
        db.refresh(rf)

    audit = AuditLog(
        actor_id=admin.id,
        action="define_fields",
        target_type="community",
        target_id=community.id,
        detail=f"Defined {len(created_fields)} required fields for community"
    )
    db.add(audit)
    db.commit()

    return created_fields

@router.get("/communities/{id}/fields", response_model=List[RequiredFieldSchema])
def get_community_fields(
    id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    fields = (
        db.query(RequiredField)
        .filter(RequiredField.community_id == community.id)
        .order_by(RequiredField.order.asc())
        .all()
    )
    return fields

@router.post("/communities/{id}/codes", response_model=List[AccessCodeOut])
def bulk_generate_codes(
    id: int,
    payload: BulkCodesCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)

    created_codes = []
    for item in payload.codes:
        # Unguessable random token
        raw_code = f"AID-{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}"
        code = AccessCode(
            community_id=community.id,
            code=raw_code,
            issued_to_label=item.label.strip(),
            issued_to_phone=item.phone.strip() if item.phone else None,
            status="unused"
        )
        db.add(code)
        created_codes.append(code)

    db.commit()
    for c in created_codes:
        db.refresh(c)

    audit = AuditLog(
        actor_id=admin.id,
        action="code_generated",
        target_type="community",
        target_id=community.id,
        detail=f"Generated {len(created_codes)} access codes"
    )
    db.add(audit)
    db.commit()

    return created_codes

@router.get("/communities/{id}/codes")
def list_community_codes(
    id: int,
    status_filter: Optional[str] = Query(None, pattern="^(unused|redeemed|revoked|expired)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    query = db.query(AccessCode).filter(AccessCode.community_id == community.id)

    if status_filter:
        query = query.filter(AccessCode.status == status_filter)

    total = query.count()
    items = query.order_by(AccessCode.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": [AccessCodeOut.model_validate(c) for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.post("/codes/{id}/revoke", response_model=AccessCodeOut)
def revoke_code(
    id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    code = db.query(AccessCode).filter(AccessCode.id == id).first()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access code not found"
        )
    # Check admin ownership of the community
    get_admin_community(code.community_id, admin, db)

    if code.status != "unused":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke code with status '{code.status}'"
        )

    code.status = "revoked"
    db.commit()
    db.refresh(code)

    audit = AuditLog(
        actor_id=admin.id,
        action="revoke_code",
        target_type="access_code",
        target_id=code.id,
        detail=f"Revoked code: {code.code}"
    )
    db.add(audit)
    db.commit()

    return code

# --- Submissions & Detail Endpoints ---

@router.get("/communities/{id}/submissions")
def list_community_submissions(
    id: int,
    status_filter: Optional[str] = Query(None, pattern="^(pending|approved|info_requested|rejected_by_admin)$"),
    risk_filter: Optional[str] = Query(None, pattern="^(flagged|low_risk|all)$"),
    sort_by: Optional[str] = Query("risk_desc", pattern="^(risk_desc|risk_asc|newest|oldest)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    query = db.query(Submission).filter(Submission.community_id == community.id)

    if status_filter:
        query = query.filter(Submission.status == status_filter)

    if risk_filter == "flagged":
        query = query.filter(Submission.risk_score >= config.FLAG_THRESHOLD)
    elif risk_filter == "low_risk":
        query = query.filter(Submission.risk_score < config.FLAG_THRESHOLD)

    if sort_by == "risk_desc":
        query = query.order_by(Submission.risk_score.desc(), Submission.id.desc())
    elif sort_by == "risk_asc":
        query = query.order_by(Submission.risk_score.asc())
    elif sort_by == "newest":
        query = query.order_by(Submission.created_at.desc())
    elif sort_by == "oldest":
        query = query.order_by(Submission.created_at.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    from backend.app.core.masking import mask_sensitive_value

    serialized_items = []
    for sub in items:
        applicant_name = "Household Applicant"
        if sub.membership and sub.membership.user:
            applicant_name = sub.membership.user.name

        serialized_items.append({
            "id": sub.id,
            "membership_id": sub.membership_id,
            "applicant_name": mask_sensitive_value(applicant_name, "name"),
            "status": sub.status,
            "risk_score": sub.risk_score,
            "risk_reasons": sub.risk_reasons,
            "analysis_status": sub.analysis_status,
            "review_status": sub.review_status,
            "is_flagged": sub.risk_score >= config.FLAG_THRESHOLD,
            "created_at": sub.created_at
        })

    return {
        "items": serialized_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/submissions/{id}")
def get_submission_detail(
    id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    # Verify admin ownership of this community
    get_admin_community(sub.community_id, admin, db)

    from backend.app.core.masking import mask_sensitive_value

    # Audit log submission view
    audit = AuditLog(
        actor_id=admin.id,
        action="view_submission",
        target_type="submission",
        target_id=sub.id,
        detail=f"Admin viewed submission details for claim #{sub.id}"
    )
    db.add(audit)
    db.commit()

    applicant_user = sub.membership.user if sub.membership else None

    # Masked values
    values_data = []
    for v in sub.values:
        ft = v.required_field.field_type if v.required_field else ""
        masked_val = mask_sensitive_value(v.raw_value, ft)
        values_data.append({
            "id": v.id,
            "field_id": v.required_field_id,
            "label": v.required_field.label if v.required_field else "",
            "field_type": ft,
            "value": masked_val,
            "is_masked": True
        })

    # Evidence files list
    evidence_data = [
        {
            "id": e.id,
            "field_id": e.required_field_id,
            "label": e.required_field.label if e.required_field else "",
            "sha256": e.sha256,
            "has_phash": e.phash is not None,
            "ocr_text": e.ocr_text,
            "created_at": e.created_at
        }
        for e in sub.evidence
    ]

    # Connected submissions from Links table
    links = db.query(Link).filter(
        (Link.submission_a == sub.id) | (Link.submission_b == sub.id)
    ).all()

    connected = []
    for l in links:
        other_id = l.submission_b if l.submission_a == sub.id else l.submission_a
        other_sub = db.query(Submission).filter(Submission.id == other_id).first()
        connected.append({
            "link_id": l.id,
            "connected_submission_id": other_id,
            "link_type": l.link_type,
            "strength": l.strength,
            "explanation": l.explanation,
            "matched_value_hint": l.matched_value_hint,
            "other_risk_score": other_sub.risk_score if other_sub else 0.0,
            "other_status": other_sub.status if other_sub else ""
        })

    return {
        "id": sub.id,
        "community_id": sub.community_id,
        "membership_id": sub.membership_id,
        "applicant_name": mask_sensitive_value(applicant_user.name if applicant_user else "Applicant", "name"),
        "status": sub.status,
        "risk_score": sub.risk_score,
        "risk_reasons": sub.risk_reasons,
        "analysis_status": sub.analysis_status,
        "review_status": sub.review_status,
        "is_flagged": sub.risk_score >= config.FLAG_THRESHOLD,
        "created_at": sub.created_at,
        "values": values_data,
        "evidence": evidence_data,
        "connected_submissions": connected
    }

@router.post("/submissions/{id}/reveal/{value_id}")
def reveal_submission_value(
    id: int,
    value_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    get_admin_community(sub.community_id, admin, db)

    sv = db.query(SubmissionValue).filter(
        SubmissionValue.id == value_id,
        SubmissionValue.submission_id == sub.id
    ).first()
    if not sv:
        raise HTTPException(status_code=404, detail="Submission value not found")

    # Mandatory AuditLog on unmasking
    audit = AuditLog(
        actor_id=admin.id,
        action="reveal_value",
        target_type="submission_value",
        target_id=sv.id,
        detail=f"Admin unmasked value for field '{sv.required_field.label if sv.required_field else sv.required_field_id}' on submission #{sub.id}"
    )
    db.add(audit)
    db.commit()

    return {
        "value_id": sv.id,
        "raw_value": sv.raw_value
    }

@router.post("/submissions/{id}/review")
def review_submission(
    id: int,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    action = payload.get("action")
    if action not in ["confirmed", "false_alarm", "needs_field_visit"]:
        raise HTTPException(
            status_code=400,
            detail="Action must be one of: 'confirmed', 'false_alarm', 'needs_field_visit'"
        )

    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    get_admin_community(sub.community_id, admin, db)

    sub.review_status = action
    status_change = payload.get("status_change")
    if status_change in ["pending", "approved", "info_requested", "rejected_by_admin"]:
        sub.status = status_change
        if sub.membership:
            sub.membership.status = status_change

    audit = AuditLog(
        actor_id=admin.id,
        action="review_submission",
        target_type="submission",
        target_id=sub.id,
        detail=f"Admin marked review as '{action}', submission status '{sub.status}'"
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Review recorded: {action}",
        "submission_id": sub.id,
        "review_status": sub.review_status,
        "status": sub.status
    }

# --- Network & Queue Endpoints ---

@router.get("/communities/{id}/network")
def get_community_network(
    id: int,
    component_id: Optional[int] = Query(None, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    from backend.app.engine.graph import get_graph_export

    graph_data = get_graph_export(community.id, db, component_id)

    audit = AuditLog(
        actor_id=admin.id,
        action="view_network",
        target_type="community",
        target_id=community.id,
        detail=f"Admin viewed network graph (cluster: {component_id})"
    )
    db.add(audit)
    db.commit()

    return graph_data

@router.get("/communities/{id}/queue")
def get_flagged_queue(
    id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    from backend.app.engine.graph import get_ranked_clusters

    clusters = get_ranked_clusters(community.id, db)
    return {
        "community_id": community.id,
        "flagged_networks": clusters,
        "total_flagged_networks": len(clusters)
    }

# --- Computed Stats & Document Requests ---

@router.get("/communities/{id}/stats", response_model=CommunityStatsOut)
def get_community_stats(
    id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    from backend.app.models.models import Submission, AccessCode, Link
    from backend.app.engine.graph import get_ranked_clusters

    total_submissions = db.query(Submission).filter(Submission.community_id == community.id).count()
    pending_submissions = db.query(Submission).filter(
        Submission.community_id == community.id,
        Submission.status == "pending"
    ).count()
    approved_submissions = db.query(Submission).filter(
        Submission.community_id == community.id,
        Submission.status == "approved"
    ).count()
    flagged_submissions = db.query(Submission).filter(
        Submission.community_id == community.id,
        Submission.risk_score >= config.FLAG_THRESHOLD
    ).count()

    total_codes = db.query(AccessCode).filter(AccessCode.community_id == community.id).count()
    redeemed_codes = db.query(AccessCode).filter(
        AccessCode.community_id == community.id,
        AccessCode.status == "redeemed"
    ).count()
    unused_codes = db.query(AccessCode).filter(
        AccessCode.community_id == community.id,
        AccessCode.status == "unused"
    ).count()

    clusters = get_ranked_clusters(community.id, db)
    total_links = db.query(Link).filter(Link.community_id == community.id).count()

    return CommunityStatsOut(
        total_submissions=total_submissions,
        pending_submissions=pending_submissions,
        approved_submissions=approved_submissions,
        flagged_submissions=flagged_submissions,
        total_codes=total_codes,
        redeemed_codes=redeemed_codes,
        unused_codes=unused_codes,
        flagged_networks_count=len(clusters),
        total_links_count=total_links
    )

@router.post("/communities/{id}/document-requests", response_model=DocumentRequestOut)
def create_document_request(
    id: int,
    payload: DocumentRequestCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)
    sub = db.query(Submission).filter(
        Submission.id == payload.submission_id,
        Submission.community_id == community.id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found in this community")

    from backend.app.models.models import DocumentRequest, Notification

    doc_req = DocumentRequest(
        community_id=community.id,
        submission_id=sub.id,
        message=payload.message,
        requested_labels=payload.requested_labels,
        status="open"
    )
    db.add(doc_req)

    # Update submission and membership status
    sub.status = "info_requested"
    if sub.membership:
        sub.membership.status = "info_requested"

        # Create notification for member
        notif = Notification(
            user_id=sub.membership.user_id,
            message=f"Additional document requested for relief verification: '{payload.message}'",
            is_read=False
        )
        db.add(notif)

    audit = AuditLog(
        actor_id=admin.id,
        action="create_document_request",
        target_type="document_request",
        target_id=sub.id,
        detail=f"Requested additional documents for submission #{sub.id}: {payload.message}"
    )
    db.add(audit)
    db.commit()
    db.refresh(doc_req)

    return doc_req

@router.get("/communities/{id}/audit")
def get_community_audit_logs(
    id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    community = get_admin_community(id, admin, db)

    # Get submission IDs for this community to include submission audit logs
    sub_ids = [s.id for s in db.query(Submission.id).filter(Submission.community_id == community.id).all()]

    query = db.query(AuditLog).filter(
        ((AuditLog.target_type == "community") & (AuditLog.target_id == community.id)) |
        ((AuditLog.target_type == "submission") & (AuditLog.target_id.in_(sub_ids))) |
        (AuditLog.actor_id == admin.id)
    ).order_by(AuditLog.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": [
            {
                "id": a.id,
                "actor_id": a.actor_id,
                "action": a.action,
                "target_type": a.target_type,
                "target_id": a.target_id,
                "detail": a.detail,
                "created_at": a.created_at
            }
            for a in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

