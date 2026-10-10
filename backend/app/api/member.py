import os
import secrets
import hashlib
from pathlib import Path
from typing import Optional, List
from fastapi import (
    APIRouter, Depends, HTTPException, status, Request, UploadFile, BackgroundTasks
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.core import config
from backend.app.core.database import get_db
from backend.app.core.security import (
    get_current_user, hash_password, create_access_token, oauth2_scheme
)
from backend.app.models.models import (
    User, Community, RequiredField, AccessCode, Membership,
    Submission, SubmissionValue, Evidence, Notification, AuditLog, DocumentRequest, utc_now
)
from backend.app.schemas.schemas import (
    JoinValidateRequest, JoinFormResponse, RequiredFieldSchema
)
from backend.app.engine.normalizer import normalize_field
from backend.app.engine.stage1_analysis import run_stage1_analysis_task

router = APIRouter(tags=["Member"])

@router.post("/join", response_model=JoinFormResponse)
def validate_join_code(
    payload: JoinValidateRequest,
    db: Session = Depends(get_db)
):
    clean_code = payload.code.strip()
    code_obj = db.query(AccessCode).filter(AccessCode.code == clean_code).first()
    if not code_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid access code"
        )

    if code_obj.status == "redeemed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This access code has already been redeemed"
        )
    if code_obj.status == "revoked":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This access code has been revoked"
        )
    if code_obj.expires_at and code_obj.expires_at < utc_now():
        code_obj.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This access code has expired"
        )

    community = db.query(Community).filter(Community.id == code_obj.community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Associated community not found")
    if community.status != "open":
        raise HTTPException(status_code=400, detail="This relief program is currently closed to new submissions")

    admin_user = db.query(User).filter(User.id == community.admin_id).first()
    admin_name = admin_user.name if admin_user else "Authorized Relief Worker"

    fields = (
        db.query(RequiredField)
        .filter(RequiredField.community_id == community.id)
        .order_by(RequiredField.order.asc())
        .all()
    )

    consent_text = (
        f"I hereby consent to submit my household information for relief verification "
        f"arranged by {admin_name} for '{community.title}'. "
        f"I understand that the provided details will be reviewed for relief eligibility."
    )

    return JoinFormResponse(
        code=code_obj.code,
        community_id=community.id,
        community_title=community.title,
        community_description=community.description,
        admin_name=admin_name,
        is_verified_admin=community.is_verified_admin,
        consent_notice=consent_text,
        required_fields=[RequiredFieldSchema.model_validate(f) for f in fields]
    )

@router.post("/join/submit")
async def submit_join_claim(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    form = await request.form()

    # 1. Validate Code
    raw_code = form.get("code")
    if not raw_code:
        raise HTTPException(status_code=400, detail="Access code is required")
    code_str = str(raw_code).strip()

    code_obj = db.query(AccessCode).filter(AccessCode.code == code_str).first()
    if not code_obj or code_obj.status != "unused":
        raise HTTPException(
            status_code=400,
            detail="Access code is invalid or has already been used"
        )
    if code_obj.expires_at and code_obj.expires_at < utc_now():
        code_obj.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Access code has expired")

    # 2. Validate Consent
    raw_consent = form.get("consent")
    is_consented = str(raw_consent).lower() in ["true", "1", "yes"]
    if not is_consented:
        raise HTTPException(
            status_code=400,
            detail="Consent is required to submit relief details"
        )

    # 3. Resolve Member User
    current_user: Optional[User] = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token_str = auth_header.split(" ")[1]
        try:
            current_user = get_current_user(token=token_str, db=db)
        except Exception:
            current_user = None

    if not current_user:
        # Require user details from form
        member_email = form.get("member_email")
        member_name = form.get("member_name")
        member_password = form.get("member_password")
        member_phone = form.get("member_phone")

        if not member_email or not member_password:
            raise HTTPException(
                status_code=400,
                detail="User credentials (member_email, member_password) or valid auth token required"
            )

        email_str = str(member_email).strip().lower()
        existing_user = db.query(User).filter(User.email == email_str).first()
        if existing_user:
            current_user = existing_user
        else:
            name_str = str(member_name or "Household Applicant").strip()
            phone_str = str(member_phone or code_obj.issued_to_phone or "").strip()
            current_user = User(
                name=name_str,
                email=email_str,
                phone=phone_str or None,
                password_hash=hash_password(str(member_password)),
                role="member",
                is_verified=False
            )
            db.add(current_user)
            db.flush()

    # Verify user does not already hold a membership in this community
    existing_membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.community_id == code_obj.community_id
    ).first()
    if existing_membership:
        raise HTTPException(
            status_code=400,
            detail="User already has an active submission in this community"
        )

    # 4. Validate dynamic required fields
    required_fields = (
        db.query(RequiredField)
        .filter(RequiredField.community_id == code_obj.community_id)
        .order_by(RequiredField.order.asc())
        .all()
    )

    evidence_records = []
    value_records = []

    evidence_dir = Path(config.UPLOAD_DIR) / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    max_bytes = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    for rf in required_fields:
        field_key = f"field_{rf.id}"
        form_val = form.get(field_key)

        if rf.field_type in ["photo", "document"]:
            has_file = hasattr(form_val, "filename") and bool(getattr(form_val, "filename", None))
            if not has_file:
                if rf.is_required:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Missing required file upload: '{rf.label}'"
                    )
                continue

            content_type = form_val.content_type or ""
            allowed = config.ALLOWED_IMAGE_TYPES if rf.field_type == "photo" else config.ALLOWED_DOC_TYPES
            if content_type not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type for '{rf.label}'. Allowed types: {allowed}"
                )

            file_bytes = await form_val.read()
            if len(file_bytes) > max_bytes:
                raise HTTPException(
                    status_code=400,
                    detail=f"File for '{rf.label}' exceeds {config.MAX_UPLOAD_SIZE_MB}MB limit"
                )

            # Compute SHA-256
            file_sha256 = hashlib.sha256(file_bytes).hexdigest()

            # Save with secure randomized name
            ext = Path(form_val.filename).suffix.lower() or (".jpg" if rf.field_type == "photo" else ".png")
            safe_filename = f"ev_{secrets.token_hex(16)}{ext}"
            file_path = evidence_dir / safe_filename
            with open(file_path, "wb") as f:
                f.write(file_bytes)

            evidence_records.append({
                "required_field_id": rf.id,
                "file_path": str(file_path),
                "sha256": file_sha256
            })
        else:
            # Scalar value
            val_str = str(form_val).strip() if form_val is not None else ""
            if rf.is_required and not val_str:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field: '{rf.label}'"
                )

            norm_val = normalize_field(rf.field_type, val_str)
            value_records.append({
                "required_field_id": rf.id,
                "raw_value": val_str,
                "normalized_value": norm_val
            })

    # 5. Atomically create Membership, Submission, SubmissionValues, Evidence, and burn AccessCode
    try:
        membership = Membership(
            user_id=current_user.id,
            community_id=code_obj.community_id,
            access_code_id=code_obj.id,
            status="pending"
        )
        db.add(membership)
        db.flush()

        submission = Submission(
            membership_id=membership.id,
            community_id=code_obj.community_id,
            status="pending",
            risk_score=0.0,
            risk_reasons=[],
            analysis_status="pending"
        )
        db.add(submission)
        db.flush()

        for val_dict in value_records:
            sv = SubmissionValue(
                submission_id=submission.id,
                required_field_id=val_dict["required_field_id"],
                raw_value=val_dict["raw_value"],
                normalized_value=val_dict["normalized_value"]
            )
            db.add(sv)

        for ev_dict in evidence_records:
            ev = Evidence(
                submission_id=submission.id,
                required_field_id=ev_dict["required_field_id"],
                file_path=ev_dict["file_path"],
                sha256=ev_dict["sha256"],
                phash=None,
                ocr_text=None
            )
            db.add(ev)

        # Mark code as redeemed
        code_obj.status = "redeemed"
        code_obj.redeemed_by_user_id = current_user.id
        code_obj.redeemed_at = utc_now()

        # Audit log
        audit = AuditLog(
            actor_id=current_user.id,
            action="submit_claim",
            target_type="submission",
            target_id=submission.id,
            detail=f"Submitted claim for community {code_obj.community_id} using code {code_obj.code}"
        )
        db.add(audit)

        db.commit()
        db.refresh(submission)

        # Trigger background Stage 1 analysis
        background_tasks.add_task(run_stage1_analysis_task, submission.id)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error saving submission: {str(e)}"
        )

    # Issue token for member so they can access their submission immediately
    token = create_access_token(
        data={"sub": str(current_user.id), "role": current_user.role, "is_verified": current_user.is_verified}
    )

    return {
        "message": "Submission received successfully. Verification pending.",
        "submission_id": submission.id,
        "membership_id": membership.id,
        "community_id": code_obj.community_id,
        "access_token": token,
        "token_type": "bearer"
    }

@router.get("/evidence/{id}/file")
def get_evidence_file(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    evidence = db.query(Evidence).filter(Evidence.id == id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    submission = db.query(Submission).filter(Submission.id == evidence.submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Access control:
    # 1. Admin of the community
    # 2. Member who submitted it
    # 3. Verified investigator
    authorized = False
    if current_user.role == "investigator" and current_user.is_verified:
        authorized = True
    elif current_user.role == "admin":
        community = db.query(Community).filter(Community.id == submission.community_id).first()
        if community and community.admin_id == current_user.id:
            authorized = True
    elif current_user.role == "member":
        membership = db.query(Membership).filter(Membership.id == submission.membership_id).first()
        if membership and membership.user_id == current_user.id:
            authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="Access denied to this evidence file")

    file_path = Path(evidence.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on storage")

    # Audit log file view
    audit = AuditLog(
        actor_id=current_user.id,
        action="view_file",
        target_type="evidence",
        target_id=evidence.id,
        detail=f"User viewed evidence file {evidence.id}"
    )
    db.add(audit)
    db.commit()

    return FileResponse(path=str(file_path))

@router.get("/me/submission")
def get_my_submission(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == current_user.id)
        .order_by(Membership.created_at.desc())
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="No active submission found for this user")

    submission = db.query(Submission).filter(Submission.membership_id == membership.id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission record not found")

    community = db.query(Community).filter(Community.id == membership.community_id).first()

    values = db.query(SubmissionValue).filter(SubmissionValue.submission_id == submission.id).all()
    evidence = db.query(Evidence).filter(Evidence.submission_id == submission.id).all()
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()
    doc_reqs = db.query(DocumentRequest).filter(DocumentRequest.submission_id == submission.id).order_by(DocumentRequest.created_at.desc()).all()

    return {
        "membership_id": membership.id,
        "submission_id": submission.id,
        "community_id": community.id if community else None,
        "community_title": community.title if community else "Relief Program",
        "status": submission.status,
        "analysis_status": submission.analysis_status,
        "created_at": submission.created_at,
        "values": [
            {
                "field_id": v.required_field_id,
                "label": v.required_field.label if v.required_field else "",
                "field_type": v.required_field.field_type if v.required_field else "",
                "value": v.raw_value
            }
            for v in values
        ],
        "evidence": [
            {
                "evidence_id": e.id,
                "field_id": e.required_field_id,
                "label": e.required_field.label if e.required_field else "",
                "created_at": e.created_at
            }
            for e in evidence
        ],
        "notifications": [
            {
                "id": n.id,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at
            }
            for n in notifs
        ],
        "document_requests": [
            {
                "id": dr.id,
                "message": dr.message,
                "requested_labels": dr.requested_labels,
                "status": dr.status,
                "created_at": dr.created_at
            }
            for dr in doc_reqs
        ]
    }

@router.post("/me/notifications/{id}/read")
def mark_notification_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read", "id": notif.id}

@router.post("/me/document-requests/{id}/fulfill")
async def fulfill_document_request(
    id: int,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_req = db.query(DocumentRequest).filter(DocumentRequest.id == id).first()
    if not doc_req:
        raise HTTPException(status_code=404, detail="Document request not found")

    submission = db.query(Submission).filter(Submission.id == doc_req.submission_id).first()
    if not submission or not submission.membership or submission.membership.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    evidence_dir = Path(config.UPLOAD_DIR) / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    max_bytes = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file exceeds maximum size limit")

    file_sha256 = hashlib.sha256(content).hexdigest()
    ext = Path(file.filename or "doc.png").suffix.lower() or ".png"
    safe_filename = f"ev_supp_{secrets.token_hex(16)}{ext}"
    file_path = evidence_dir / safe_filename
    with open(file_path, "wb") as f:
        f.write(content)

    # Associate with existing file field or community field
    file_rf = (
        db.query(RequiredField)
        .filter(
            RequiredField.community_id == submission.community_id,
            RequiredField.field_type.in_(["photo", "document"])
        )
        .first()
    )
    if not file_rf:
        file_rf = (
            db.query(RequiredField)
            .filter(RequiredField.community_id == submission.community_id)
            .first()
        )
    rf_id = file_rf.id if file_rf else 1

    new_evidence = Evidence(
        submission_id=submission.id,
        required_field_id=rf_id,
        file_path=str(file_path),
        sha256=file_sha256
    )
    db.add(new_evidence)
    doc_req.status = "fulfilled"
    submission.status = "pending"
    submission.review_status = "needs_review"
    if submission.membership:
        submission.membership.status = "pending"

    audit = AuditLog(
        actor_id=current_user.id,
        action="fulfill_document_request",
        target_type="document_request",
        target_id=doc_req.id,
        detail=f"Applicant submitted supplementary document '{file.filename}'"
    )
    db.add(audit)
    db.commit()

    return {
        "message": "Supplemental document uploaded successfully",
        "document_request_id": doc_req.id,
        "evidence_id": new_evidence.id
    }
