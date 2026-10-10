import io
import os
import re
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from PIL import Image
import imagehash
import rapidfuzz
from sqlalchemy.orm import Session

from backend.app.core import config
from backend.app.core.database import SessionLocal
from backend.app.models.models import (
    Submission, SubmissionValue, Evidence, RequiredField, Community
)
from backend.app.engine.normalizer import normalize_field
from backend.app.engine.gemini_hook import extract_entities_if_enabled

# Configure pytesseract path if available
try:
    import pytesseract
    if config.TESSERACT_CMD and os.path.exists(config.TESSERACT_CMD):
        pytesseract.pytesseract.tesseract_cmd = config.TESSERACT_CMD
except Exception:
    pytesseract = None

def compute_phash(file_path: str) -> Optional[int]:
    """Computes perceptual hash (pHash) of an image and returns as signed 64-bit integer for SQLite."""
    try:
        p = Path(file_path)
        if not p.exists():
            return None
        with Image.open(p) as img:
            h = imagehash.phash(img)
            unsigned_val = int(str(h), 16)
            signed_val = unsigned_val if unsigned_val < (1 << 63) else unsigned_val - (1 << 64)
            return signed_val
    except Exception:
        return None

def compute_phash_from_bytes(file_bytes: bytes) -> Optional[int]:
    """Computes perceptual hash (pHash) from in-memory byte stream without saving to disk."""
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            h = imagehash.phash(img)
            unsigned_val = int(str(h), 16)
            signed_val = unsigned_val if unsigned_val < (1 << 63) else unsigned_val - (1 << 64)
            return signed_val
    except Exception:
        return None

def hamming_distance(h1: Optional[int], h2: Optional[int]) -> int:
    """Computes bitwise Hamming distance between two 64-bit pHash integers."""
    if h1 is None or h2 is None:
        return 64
    u1 = h1 & 0xFFFFFFFFFFFFFFFF
    u2 = h2 & 0xFFFFFFFFFFFFFFFF
    return bin(u1 ^ u2).count("1")

def run_ocr(file_path: str) -> str:
    """Preprocesses document (grayscale + downscale) and extracts OCR text."""
    if not pytesseract:
        return ""
    try:
        p = Path(file_path)
        if not p.exists():
            return ""
        with Image.open(p) as img:
            rgb_img = img.convert("RGB")
            # Grayscale
            gray = rgb_img.convert("L")
            # Downscale if excessively large
            w, h = gray.size
            max_dim = max(w, h)
            if max_dim > 1800:
                scale = 1800.0 / max_dim
                gray = gray.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
            
            text = pytesseract.image_to_string(gray)
            return text.strip() if text else ""
    except Exception:
        return ""

def analyze_submission(submission_id: int, db: Session) -> Submission:
    """
    Executes Stage 1 analysis for a submission:
    - computes pHash on photos
    - runs OCR on documents
    - evaluates clue rules with weights from config
    - sets risk_score and risk_reasons with non-accusatory language
    - updates analysis_status to 'done' (or 'failed' on unhandled error)
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        return None

    try:
        # 1. Process Evidence
        for ev in sub.evidence:
            field_type = ev.required_field.field_type if ev.required_field else ""
            if field_type == "photo":
                if ev.phash is None:
                    ev.phash = compute_phash(ev.file_path)
            elif field_type == "document":
                if ev.ocr_text is None:
                    ev.ocr_text = run_ocr(ev.file_path)
                    # Optional Gemini entity extraction if enabled
                    if config.GEMINI_ENABLED and ev.ocr_text:
                        extract_entities_if_enabled(ev.ocr_text, ev.sha256)
        db.commit()

        # 2. Rule Engine
        risk_reasons: List[str] = []
        triggered_weights: List[float] = []

        # Map current submission values by field_type
        vals_by_type: Dict[str, List[SubmissionValue]] = {}
        for sv in sub.values:
            ft = sv.required_field.field_type if sv.required_field else "text"
            vals_by_type.setdefault(ft, []).append(sv)

        # Rule 1: Check required fields are non-empty
        req_fields = db.query(RequiredField).filter(
            RequiredField.community_id == sub.community_id,
            RequiredField.is_required == True
        ).all()

        missing_fields = []
        for rf in req_fields:
            if rf.field_type in ["photo", "document"]:
                has_ev = any(e.required_field_id == rf.id for e in sub.evidence)
                if not has_ev:
                    missing_fields.append(rf.label)
            else:
                has_val = any(v.required_field_id == rf.id and bool(v.normalized_value) for v in sub.values)
                if not has_val:
                    missing_fields.append(rf.label)

        if missing_fields:
            triggered_weights.append(config.WEIGHT_MISSING_REQUIRED)
            risk_reasons.append(f"Required information missing: {', '.join(missing_fields)}, needs review")

        # Rule 2: OCR text vs entered ID number and Name
        for ev in sub.evidence:
            if ev.required_field and ev.required_field.field_type == "document" and ev.ocr_text:
                ocr_clean = re.sub(r"[^\w\s]", " ", ev.ocr_text.lower())
                # Check ID number
                id_vals = vals_by_type.get("id_number", [])
                for id_v in id_vals:
                    norm_id = (id_v.normalized_value or "").lower()
                    if norm_id:
                        ratio = rapidfuzz.fuzz.partial_ratio(norm_id, ocr_clean)
                        if ratio < config.OCR_ID_FUZZY_RATIO_CUTOFF and norm_id not in ocr_clean:
                            triggered_weights.append(config.WEIGHT_OCR_MISMATCH)
                            risk_reasons.append(
                                "Document text differs from entered ID number, needs review"
                            )
                            break

                # Check Name
                name_vals = vals_by_type.get("name", [])
                for name_v in name_vals:
                    norm_name = (name_v.normalized_value or "").lower()
                    if norm_name:
                        ratio = rapidfuzz.fuzz.partial_ratio(norm_name, ocr_clean)
                        if ratio < config.OCR_NAME_FUZZY_RATIO_CUTOFF and norm_name not in ocr_clean:
                            risk_reasons.append(
                                "Document text differs from entered applicant name, needs review"
                            )
                            break

        # Rule 3: Exact file match (SHA-256) across submissions in this community
        exact_match_found = False
        for ev in sub.evidence:
            other_exact = (
                db.query(Evidence)
                .join(Submission, Evidence.submission_id == Submission.id)
                .filter(
                    Evidence.sha256 == ev.sha256,
                    Submission.community_id == sub.community_id,
                    Evidence.submission_id != sub.id
                )
                .first()
            )
            if other_exact and not exact_match_found:
                exact_match_found = True
                triggered_weights.append(config.WEIGHT_EXACT_FILE)
                risk_reasons.append(
                    "Uploaded file is identical to a file from another submission, needs review"
                )

        # Rule 4: Similar photo (pHash Hamming distance <= cutoff) in this community
        similar_photo_found = False
        for ev in sub.evidence:
            if ev.phash is not None and not exact_match_found:
                # Query other photos with pHash in same community
                other_photos = (
                    db.query(Evidence)
                    .join(Submission, Evidence.submission_id == Submission.id)
                    .filter(
                        Evidence.phash.isnot(None),
                        Submission.community_id == sub.community_id,
                        Evidence.submission_id != sub.id
                    )
                    .all()
                )
                for other_p in other_photos:
                    hamming_dist = hamming_distance(ev.phash, other_p.phash)
                    if hamming_dist <= config.PHASH_HAMMING_CUTOFF and not similar_photo_found:
                        similar_photo_found = True
                        triggered_weights.append(config.WEIGHT_SIMILAR_PHOTO)
                        risk_reasons.append(
                            f"Photo closely resembles photo in another submission (similarity distance {hamming_dist}), needs review"
                        )
                        break

        # Rule 5: Shared scalar attributes with existing submissions in same community
        # (Phone, Bank Account, UPI, ID Number, Address, Name)
        shared_fields_detected = set()
        has_other_match = False

        for ft in ["phone", "bank_account", "upi_id", "id_number", "address"]:
            for sv in vals_by_type.get(ft, []):
                norm_val = sv.normalized_value
                if not norm_val:
                    continue

                if ft == "address":
                    # Check exact or fuzzy in same community
                    other_addresses = (
                        db.query(SubmissionValue)
                        .join(Submission, SubmissionValue.submission_id == Submission.id)
                        .join(RequiredField, SubmissionValue.required_field_id == RequiredField.id)
                        .filter(
                            RequiredField.field_type == "address",
                            Submission.community_id == sub.community_id,
                            SubmissionValue.submission_id != sub.id,
                            SubmissionValue.normalized_value.isnot(None)
                        )
                        .all()
                    )
                    for other_av in other_addresses:
                        if not other_av.normalized_value:
                            continue
                        if norm_val == other_av.normalized_value:
                            shared_fields_detected.add("address")
                            has_other_match = True
                            break
                        ratio = rapidfuzz.fuzz.token_sort_ratio(norm_val, other_av.normalized_value)
                        if ratio >= config.ADDRESS_FUZZY_RATIO_CUTOFF:
                            shared_fields_detected.add("address")
                            has_other_match = True
                            break
                else:
                    # Exact match on normalized value in same community
                    other_match = (
                        db.query(SubmissionValue)
                        .join(Submission, SubmissionValue.submission_id == Submission.id)
                        .join(RequiredField, SubmissionValue.required_field_id == RequiredField.id)
                        .filter(
                            RequiredField.field_type == ft,
                            Submission.community_id == sub.community_id,
                            SubmissionValue.normalized_value == norm_val,
                            SubmissionValue.submission_id != sub.id
                        )
                        .first()
                    )
                    if other_match:
                        shared_fields_detected.add(ft)
                        has_other_match = True

        # Apply weights and non-accusatory reasons for shared fields
        if "phone" in shared_fields_detected:
            triggered_weights.append(config.WEIGHT_SHARED_PHONE)
            risk_reasons.append("Contact phone is shared with another submission, needs review")
        if "bank_account" in shared_fields_detected:
            triggered_weights.append(config.WEIGHT_SHARED_BANK)
            risk_reasons.append("Bank account is shared with another submission, needs review")
        if "upi_id" in shared_fields_detected:
            triggered_weights.append(config.WEIGHT_SHARED_UPI)
            risk_reasons.append("UPI ID is shared with another submission, needs review")
        if "id_number" in shared_fields_detected:
            triggered_weights.append(config.WEIGHT_SHARED_ID_NUMBER)
            risk_reasons.append("ID number is shared with another submission, needs review")
        if "address" in shared_fields_detected:
            triggered_weights.append(config.WEIGHT_SHARED_ADDRESS)
            risk_reasons.append("Residential address is shared with another submission, needs review")

        # Name match: ONLY counts toward score if another field also matched in same community
        for name_v in vals_by_type.get("name", []):
            if not name_v.normalized_value:
                continue
            other_name = (
                db.query(SubmissionValue)
                .join(Submission, SubmissionValue.submission_id == Submission.id)
                .join(RequiredField, SubmissionValue.required_field_id == RequiredField.id)
                .filter(
                    RequiredField.field_type == "name",
                    Submission.community_id == sub.community_id,
                    SubmissionValue.normalized_value == name_v.normalized_value,
                    SubmissionValue.submission_id != sub.id
                )
                .first()
            )
            if other_name:
                if has_other_match:
                    triggered_weights.append(config.WEIGHT_SHARED_NAME)
                    risk_reasons.append(
                        "Applicant name matches another submission with shared attributes, needs review"
                    )
                break

        # Calculate final risk score, capped at 100.0
        total_score = min(100.0, sum(triggered_weights))
        sub.risk_score = round(total_score, 1)
        sub.risk_reasons = risk_reasons
        sub.analysis_status = "done"

        db.commit()
        db.refresh(sub)
        return sub

    except Exception as e:
        db.rollback()
        sub.analysis_status = "failed"
        db.commit()
        return sub

def run_stage1_analysis_task(submission_id: int):
    """FastAPI background task entrypoint: runs Stage 1 analysis and incremental Stage 2 linking."""
    db = SessionLocal()
    try:
        from backend.app.engine.stage2_linking import run_stage2_linking
        analyze_submission(submission_id, db)
        run_stage2_linking(submission_id, db)
    finally:
        db.close()
