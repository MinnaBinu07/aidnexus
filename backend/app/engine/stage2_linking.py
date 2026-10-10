import math
from typing import Optional, List, Dict, Set, Tuple
from sqlalchemy.orm import Session
import rapidfuzz

from backend.app.core import config
from backend.app.models.models import (
    Submission, SubmissionValue, Evidence, Link, RequiredField
)
from backend.app.engine.stage1_analysis import hamming_distance

def mask_hint(val: Optional[str], field_type: str = "") -> str:
    """Masks value showing only last 4 characters for sensitive clues."""
    if not val:
        return ""
    val_str = str(val).strip()
    if len(val_str) <= 4:
        return "*" * len(val_str)
    if field_type == "address":
        # First 6 chars + ... + last 4 chars
        if len(val_str) > 12:
            return f"{val_str[:6]}...{val_str[-4:]}"
        return f"...{val_str[-4:]}"
    return f"{'*' * (len(val_str) - 4)}{val_str[-4:]}"

def calculate_rarity_strength(count: int, base_weight: float = 1.0) -> float:
    """
    Decreasing function of how many submissions share the value:
    A value shared by 2 is strong (1.0), shared by 5 is weaker (~0.53).
    Values shared by > HUB_LIMIT are treated as common hubs.
    """
    if count <= 2:
        return round(base_weight, 2)
    # Monotonic bounded decay: 1 / (1 + 0.3 * (count - 2))
    factor = 1.0 / (1.0 + 0.3 * (count - 2))
    return round(base_weight * factor, 2)

def run_stage2_linking(submission_id: int, db: Session) -> List[Link]:
    """
    Incremental cross-submission linking for a newly analyzed submission:
    - Uses inverted indexes by (field_type, normalized_value)
    - Applies HUB_LIMIT cutoff: if > HUB_LIMIT submissions share a value, skips N^2 links
    - Applies rarity weighting on link strength
    - Name matches only link if another field also matches
    - Pairwise ordering: always (a < b)
    - Records community_id if same community, None if cross-community
    """
    new_sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not new_sub:
        return []

    created_links: List[Link] = []

    # Map new submission values by field_type
    new_vals_by_type: Dict[str, List[SubmissionValue]] = {}
    for sv in new_sub.values:
        ft = sv.required_field.field_type if sv.required_field else "text"
        new_vals_by_type.setdefault(ft, []).append(sv)

    # Track pairs linked by non-name fields to allow name linking
    pairs_with_prior_links: Set[Tuple[int, int]] = set()

    # Load existing links for this submission
    existing_links = db.query(Link).filter(
        (Link.submission_a == new_sub.id) | (Link.submission_b == new_sub.id)
    ).all()
    existing_pairs: Set[Tuple[int, int, str]] = {
        (l.submission_a, l.submission_b, l.link_type) for l in existing_links
    }
    for l in existing_links:
        if l.link_type != "name":
            pairs_with_prior_links.add((l.submission_a, l.submission_b))

    def add_link(sub_a_id: int, sub_b_id: int, comm_id_or_none: Optional[int],
                 l_type: str, hint: str, strength: float, explanation: str):
        a_id, b_id = min(sub_a_id, sub_b_id), max(sub_a_id, sub_b_id)
        if a_id == b_id:
            return
        if (a_id, b_id, l_type) in existing_pairs:
            return

        link = Link(
            community_id=comm_id_or_none,
            submission_a=a_id,
            submission_b=b_id,
            link_type=l_type,
            matched_value_hint=hint,
            strength=strength,
            explanation=explanation
        )
        db.add(link)
        created_links.append(link)
        existing_pairs.add((a_id, b_id, l_type))
        if l_type != "name":
            pairs_with_prior_links.add((a_id, b_id))

    # 1. Exact file match (SHA-256)
    for ev in new_sub.evidence:
        matches = db.query(Evidence).filter(
            Evidence.sha256 == ev.sha256,
            Evidence.submission_id != new_sub.id
        ).all()
        total_count = len(matches) + 1
        if total_count > config.HUB_LIMIT:
            # Hub location note: skip O(N^2) explosion
            continue

        strength = calculate_rarity_strength(total_count, base_weight=1.0)
        for other_ev in matches:
            other_sub = other_ev.submission
            comm_id = new_sub.community_id if (other_sub and other_sub.community_id == new_sub.community_id) else None
            add_link(
                new_sub.id, other_ev.submission_id, comm_id,
                "exact_file", mask_hint(ev.sha256), strength,
                f"Identical file upload detected (rarity strength {strength}), needs review"
            )

    # 2. Similar photos (pHash Hamming distance <= cutoff)
    for ev in new_sub.evidence:
        if ev.phash is not None:
            candidate_photos = db.query(Evidence).filter(
                Evidence.phash.isnot(None),
                Evidence.submission_id != new_sub.id,
                Evidence.sha256 != ev.sha256  # Skip already exact matches
            ).all()

            matched_photos = []
            for cp in candidate_photos:
                dist = hamming_distance(ev.phash, cp.phash)
                if dist <= config.PHASH_HAMMING_CUTOFF:
                    matched_photos.append((cp, dist))

            total_count = len(matched_photos) + 1
            if total_count > config.HUB_LIMIT:
                continue

            strength = calculate_rarity_strength(total_count, base_weight=0.9)
            for cp, dist in matched_photos:
                other_sub = cp.submission
                comm_id = new_sub.community_id if (other_sub and other_sub.community_id == new_sub.community_id) else None
                add_link(
                    new_sub.id, cp.submission_id, comm_id,
                    "similar_image", f"dist:{dist}", strength,
                    f"Perceptually similar photo detected (distance {dist}, strength {strength}), needs review"
                )

    # 3. Scalar fields with Inverted Indexes
    scalar_fields = ["phone", "bank_account", "upi_id", "id_number", "address"]
    for ft in scalar_fields:
        for sv in new_vals_by_type.get(ft, []):
            norm_val = sv.normalized_value
            if not norm_val:
                continue

            if ft == "address":
                # Find candidate addresses
                all_addresses = db.query(SubmissionValue).join(RequiredField).filter(
                    RequiredField.field_type == "address",
                    SubmissionValue.submission_id != new_sub.id,
                    SubmissionValue.normalized_value.isnot(None)
                ).all()

                matched_subs = []
                for other_av in all_addresses:
                    if not other_av.normalized_value:
                        continue
                    if norm_val == other_av.normalized_value:
                        matched_subs.append((other_av, 100.0))
                    else:
                        ratio = rapidfuzz.fuzz.token_sort_ratio(norm_val, other_av.normalized_value)
                        if ratio >= config.ADDRESS_FUZZY_RATIO_CUTOFF:
                            matched_subs.append((other_av, ratio))

                total_count = len(matched_subs) + 1
                if total_count > config.HUB_LIMIT:
                    # Value shared by > HUB_LIMIT: Treat as common location hub note!
                    continue

                strength = calculate_rarity_strength(total_count, base_weight=0.85)
                for other_av, ratio in matched_subs:
                    other_sub = other_av.submission
                    comm_id = new_sub.community_id if (other_sub and other_sub.community_id == new_sub.community_id) else None
                    add_link(
                        new_sub.id, other_av.submission_id, comm_id,
                        "address", mask_hint(norm_val, "address"), strength,
                        f"Shared residential address ({int(ratio)}% match, strength {strength}), needs review"
                    )
            else:
                # Direct index lookup on (field_type, normalized_value)
                matches = db.query(SubmissionValue).join(RequiredField).filter(
                    RequiredField.field_type == ft,
                    SubmissionValue.normalized_value == norm_val,
                    SubmissionValue.submission_id != new_sub.id
                ).all()

                total_count = len(matches) + 1
                if total_count > config.HUB_LIMIT:
                    continue

                strength = calculate_rarity_strength(total_count, base_weight=1.0)
                hint = mask_hint(norm_val, ft)
                for other_sv in matches:
                    other_sub = other_sv.submission
                    comm_id = new_sub.community_id if (other_sub and other_sub.community_id == new_sub.community_id) else None
                    add_link(
                        new_sub.id, other_sv.submission_id, comm_id,
                        ft, hint, strength,
                        f"Shared {ft.replace('_', ' ')} detected (strength {strength}), needs review"
                    )

    # 4. Name matches: LOW strength, only created if another field also linked the pair
    for name_v in new_vals_by_type.get("name", []):
        norm_name = name_v.normalized_value
        if not norm_name:
            continue

        name_matches = db.query(SubmissionValue).join(RequiredField).filter(
            RequiredField.field_type == "name",
            SubmissionValue.normalized_value == norm_name,
            SubmissionValue.submission_id != new_sub.id
        ).all()

        for other_nv in name_matches:
            a_id, b_id = min(new_sub.id, other_nv.submission_id), max(new_sub.id, other_nv.submission_id)
            # HARD RULE: Only link name if at least one other field also matches!
            if (a_id, b_id) in pairs_with_prior_links:
                other_sub = other_nv.submission
                comm_id = new_sub.community_id if (other_sub and other_sub.community_id == new_sub.community_id) else None
                add_link(
                    new_sub.id, other_nv.submission_id, comm_id,
                    "name", norm_name, 0.2,
                    "Applicant name matches connected household, needs review"
                )

    db.commit()
    return created_links
