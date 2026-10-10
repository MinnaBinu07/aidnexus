import hashlib
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session

from backend.app.core import config
from backend.app.core.database import get_db
from backend.app.core.security import require_investigator
from backend.app.core.masking import mask_sensitive_value
from backend.app.models.models import (
    User, Community, Submission, SubmissionValue, Evidence,
    Link, InvestigationLog, AuditLog
)
from backend.app.schemas.schemas import InvestigationLogOut
from backend.app.engine.normalizer import normalize_field
from backend.app.engine.stage1_analysis import compute_phash_from_bytes, hamming_distance
from backend.app.engine.graph import get_graph_export

router = APIRouter(prefix="/investigate", tags=["Investigator"])

@router.post("/photo")
async def investigate_photo(
    file: UploadFile = File(...),
    investigator: User = Depends(require_investigator),
    db: Session = Depends(get_db)
):
    """
    Search across all evidence in all communities for matching damage photos.
    CRITICAL: The uploaded query photo is processed in-memory and NEVER saved to disk.
    """
    if file.content_type not in config.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image type. Allowed: {config.ALLOWED_IMAGE_TYPES}"
        )

    # Read image into memory
    content = await file.read()
    max_bytes = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Query file exceeds {config.MAX_UPLOAD_SIZE_MB}MB limit"
        )

    # Compute SHA-256 for audit logging
    query_sha256 = hashlib.sha256(content).hexdigest()

    # Compute pHash directly from byte buffer without saving to disk
    query_phash = compute_phash_from_bytes(content)
    if query_phash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not compute perceptual hash for provided image"
        )

    # Query all evidence records with non-null pHash across all communities
    all_evidence = db.query(Evidence).filter(Evidence.phash.isnot(None)).all()

    matches = []
    seen_submissions = set()

    for ev in all_evidence:
        dist = hamming_distance(query_phash, ev.phash)
        if dist <= config.PHASH_HAMMING_THRESHOLD:
            sub = db.query(Submission).filter(Submission.id == ev.submission_id).first()
            if not sub or sub.id in seen_submissions:
                continue

            seen_submissions.add(sub.id)
            community = db.query(Community).filter(Community.id == sub.community_id).first()
            applicant_user = sub.membership.user if sub.membership else None
            applicant_name = applicant_user.name if applicant_user else "Applicant"

            matches.append({
                "submission_id": sub.id,
                "evidence_id": ev.id,
                "community_id": sub.community_id,
                "community_title": community.title if community else "Unknown Program",
                "applicant_name": mask_sensitive_value(applicant_name, "name"),
                "status": sub.status,
                "risk_score": sub.risk_score,
                "hamming_distance": dist,
                "threshold": config.PHASH_HAMMING_THRESHOLD,
                "is_exact_match": dist == 0,
                "explanation": (
                    f"Identical perceptual photo match (Hamming distance {dist})"
                    if dist == 0
                    else f"Perceptually similar damage photo (Hamming distance {dist} <= {config.PHASH_HAMMING_THRESHOLD})"
                ),
                "created_at": sub.created_at
            })

    # Sort matches by closest distance, then newest
    matches.sort(key=lambda m: (m["hamming_distance"], -m["submission_id"]))

    # Record in InvestigationLog
    inv_log = InvestigationLog(
        investigator_id=investigator.id,
        query_type="photo",
        query_hash=query_sha256,
        result_count=len(matches)
    )
    db.add(inv_log)

    audit = AuditLog(
        actor_id=investigator.id,
        action="investigate_photo",
        target_type="investigation",
        target_id=inv_log.id,
        detail=f"Investigator queried damage photo hash {query_sha256[:12]}... (found {len(matches)} matches)"
    )
    db.add(audit)
    db.commit()

    return {
        "query_type": "photo",
        "query_hash": query_sha256,
        "matches_count": len(matches),
        "matches": matches
    }

@router.get("/search")
def investigate_search(
    q: str = Query(..., min_length=1),
    query_type: str = Query("all", pattern="^(all|phone|bank_account|upi_id|id_number|address|name)$"),
    investigator: User = Depends(require_investigator),
    db: Session = Depends(get_db)
):
    """
    Search cross-community by phone, account, ID, address, or name.
    Every search query is hashed and logged in InvestigationLog.
    """
    clean_q = q.strip()
    query_sha256 = hashlib.sha256(clean_q.lower().encode("utf-8")).hexdigest()

    matches = []
    seen_subs = set()

    # 1. Search in SubmissionValues
    values_query = db.query(SubmissionValue)
    if query_type != "all":
        norm_val = normalize_field(query_type, clean_q)
        values_query = values_query.filter(
            (SubmissionValue.normalized_value == norm_val) |
            (SubmissionValue.raw_value.ilike(f"%{clean_q}%"))
        )
    else:
        values_query = values_query.filter(
            SubmissionValue.raw_value.ilike(f"%{clean_q}%")
        )

    matched_values = values_query.all()

    for sv in matched_values:
        sub = db.query(Submission).filter(Submission.id == sv.submission_id).first()
        if not sub or sub.id in seen_subs:
            continue

        seen_subs.add(sub.id)
        community = db.query(Community).filter(Community.id == sub.community_id).first()
        applicant_user = sub.membership.user if sub.membership else None
        applicant_name = applicant_user.name if applicant_user else "Applicant"
        field_label = sv.required_field.label if sv.required_field else "Field"
        field_type = sv.required_field.field_type if sv.required_field else "text"

        matches.append({
            "submission_id": sub.id,
            "community_id": sub.community_id,
            "community_title": community.title if community else "Unknown Program",
            "applicant_name": mask_sensitive_value(applicant_name, "name"),
            "status": sub.status,
            "risk_score": sub.risk_score,
            "matched_field": field_label,
            "matched_value_masked": mask_sensitive_value(sv.raw_value, field_type),
            "explanation": f"Matched on '{field_label}' across community '{community.title if community else ''}'",
            "created_at": sub.created_at
        })

    # 2. Search in Users (Applicant names/phones)
    if query_type in ["all", "name", "phone"]:
        users = db.query(User).filter(
            (User.name.ilike(f"%{clean_q}%")) |
            (User.phone.ilike(f"%{clean_q}%"))
        ).all()

        for u in users:
            for m in u.memberships:
                for sub in m.submissions:
                    if sub.id in seen_subs:
                        continue
                    seen_subs.add(sub.id)
                    comm = db.query(Community).filter(Community.id == sub.community_id).first()
                    matches.append({
                        "submission_id": sub.id,
                        "community_id": sub.community_id,
                        "community_title": comm.title if comm else "Unknown Program",
                        "applicant_name": mask_sensitive_value(u.name, "name"),
                        "status": sub.status,
                        "risk_score": sub.risk_score,
                        "matched_field": "User Profile",
                        "matched_value_masked": mask_sensitive_value(u.name, "name"),
                        "explanation": f"Matched applicant account details ({mask_sensitive_value(u.name, 'name')})",
                        "created_at": sub.created_at
                    })

    # Record in InvestigationLog
    inv_log = InvestigationLog(
        investigator_id=investigator.id,
        query_type=query_type,
        query_hash=query_sha256,
        result_count=len(matches)
    )
    db.add(inv_log)

    audit = AuditLog(
        actor_id=investigator.id,
        action="investigate_search",
        target_type="investigation",
        target_id=inv_log.id,
        detail=f"Investigator searched type '{query_type}' (hash {query_sha256[:12]}..., found {len(matches)} matches)"
    )
    db.add(audit)
    db.commit()

    return {
        "query": clean_q,
        "query_type": query_type,
        "query_hash": query_sha256,
        "matches_count": len(matches),
        "matches": matches
    }

@router.get("/network/{submission_id}")
def investigate_network(
    submission_id: int,
    investigator: User = Depends(require_investigator),
    db: Session = Depends(get_db)
):
    """
    Returns graph export data for the cluster containing submission_id.
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    graph_data = get_graph_export(sub.community_id, db)

    # Filter component nodes/links containing submission_id
    target_nodes = set()
    for link in graph_data.get("links", []):
        if link["source"] == submission_id or link["target"] == submission_id:
            target_nodes.add(link["source"])
            target_nodes.add(link["target"])

    target_nodes.add(submission_id)

    component_nodes = [n for n in graph_data.get("nodes", []) if n["id"] in target_nodes]
    component_links = [l for l in graph_data.get("links", []) if l["source"] in target_nodes and l["target"] in target_nodes]

    audit = AuditLog(
        actor_id=investigator.id,
        action="investigate_network",
        target_type="submission",
        target_id=sub.id,
        detail=f"Investigator inspected network cluster for claim #{sub.id}"
    )
    db.add(audit)
    db.commit()

    return {
        "submission_id": sub.id,
        "community_id": sub.community_id,
        "nodes": component_nodes if component_nodes else graph_data.get("nodes", []),
        "links": component_links if component_links else graph_data.get("links", []),
        "metrics": graph_data.get("metrics", {})
    }

@router.get("/logs", response_model=List[InvestigationLogOut])
def get_investigation_logs(
    limit: int = Query(25, ge=1, le=100),
    investigator: User = Depends(require_investigator),
    db: Session = Depends(get_db)
):
    """
    Returns recent investigation logs for the authenticated investigator.
    """
    logs = (
        db.query(InvestigationLog)
        .filter(InvestigationLog.investigator_id == investigator.id)
        .order_by(InvestigationLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return logs

@router.post("/reveal/{value_id}")
def investigator_reveal_value(
    value_id: int,
    investigator: User = Depends(require_investigator),
    db: Session = Depends(get_db)
):
    """
    Reveals a sensitive value for verification with mandatory audit log.
    """
    sv = db.query(SubmissionValue).filter(SubmissionValue.id == value_id).first()
    if not sv:
        raise HTTPException(status_code=404, detail="Submission value not found")

    audit = AuditLog(
        actor_id=investigator.id,
        action="reveal_value",
        target_type="submission_value",
        target_id=sv.id,
        detail=f"Investigator unmasked value for field '{sv.required_field.label if sv.required_field else sv.required_field_id}' on claim #{sv.submission_id}"
    )
    db.add(audit)
    db.commit()

    return {
        "value_id": sv.id,
        "raw_value": sv.raw_value
    }
