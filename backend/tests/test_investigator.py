import io
import os
import uuid
import hashlib
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app
from backend.app.core import config
from backend.app.core.database import SessionLocal
from backend.app.models.models import User, Community, RequiredField, AccessCode, Submission, SubmissionValue, Evidence, InvestigationLog, AuditLog
from backend.app.engine.stage1_analysis import run_stage1_analysis_task

client = TestClient(app)

def create_user_helper(role: str = "member", is_verified: bool = False):
    uid = uuid.uuid4().hex[:8]
    email = f"{role}_{uid}@example.com"
    password = f"Pass_{uid}"
    name = f"User {uid}"
    resp = client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
        "role": role
    })
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    if is_verified:
        db = SessionLocal()
        u = db.query(User).filter(User.id == user_id).first()
        u.is_verified = True
        db.commit()
        db.close()

    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {
        "id": user_id,
        "email": email,
        "name": name,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }

def create_dummy_image_bytes(color: str = "purple") -> io.BytesIO:
    img = Image.new("RGB", (120, 120), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

def test_unverified_investigator_rejected():
    # 1. Unverified investigator should get 403
    unverified = create_user_helper("investigator", is_verified=False)
    resp = client.get("/investigate/search?q=9876543210", headers=unverified["headers"])
    assert resp.status_code == 403
    assert "Investigator must be verified" in resp.json()["detail"]

    # Also photo search fails
    img_buf = create_dummy_image_bytes("blue")
    photo_resp = client.post(
        "/investigate/photo",
        files={"file": ("query.jpg", img_buf, "image/jpeg")},
        headers=unverified["headers"]
    )
    assert photo_resp.status_code == 403
    assert "Investigator must be verified" in photo_resp.json()["detail"]

def test_investigator_photo_search_in_memory_and_no_disk_leak():
    # 1. Setup Admin & Community with photo field
    admin = create_user_helper("admin", is_verified=True)
    comm_resp = client.post(
        "/communities",
        json={"title": f"Disaster Comm {uuid.uuid4().hex[:6]}", "description": "Emergency relief support initiative"},
        headers=admin["headers"]
    )
    assert comm_resp.status_code == 201
    comm_id = comm_resp.json()["id"]

    fields_resp = client.put(
        f"/communities/{comm_id}/fields",
        json={"fields": [
            {"label": "Name", "field_type": "name", "is_required": True, "order": 1},
            {"label": "Damage Photo", "field_type": "photo", "is_required": True, "order": 2}
        ]},
        headers=admin["headers"]
    )
    fields = fields_resp.json()
    field_ids = {f["label"]: f["id"] for f in fields}

    # Generate single-use code
    code_resp = client.post(
        f"/communities/{comm_id}/codes",
        json={"codes": [{"label": "Household 1"}]},
        headers=admin["headers"]
    )
    code_str = code_resp.json()[0]["code"]

    # Member submits with an image of solid green
    green_img_buf = create_dummy_image_bytes("green")
    member_email = f"mem_{uuid.uuid4().hex[:6]}@example.com"
    sub_resp = client.post(
        "/join/submit",
        data={
            "code": code_str,
            "consent": "true",
            "member_email": member_email,
            "member_password": "password123",
            "member_name": "Test Claimant",
            f"field_{field_ids['Name']}": "Claimant One"
        },
        files={
            f"field_{field_ids['Damage Photo']}": ("damage.jpg", green_img_buf, "image/jpeg")
        }
    )
    assert sub_resp.status_code == 200
    sub_id = sub_resp.json()["submission_id"]

    # Run stage 1 analysis synchronously to ensure pHash is computed
    run_stage1_analysis_task(sub_id)

    db = SessionLocal()
    ev = db.query(Evidence).filter(Evidence.submission_id == sub_id).first()
    assert ev is not None
    assert ev.phash is not None
    db.close()

    # 2. Count existing files in upload dir
    upload_path = Path(config.UPLOAD_DIR)
    before_files = set(upload_path.rglob("*"))

    # 3. Verified investigator searches with the exact same green image
    investigator = create_user_helper("investigator", is_verified=True)
    query_green = create_dummy_image_bytes("green")
    query_bytes = query_green.getvalue()
    expected_query_hash = hashlib.sha256(query_bytes).hexdigest()

    query_green.seek(0)
    search_resp = client.post(
        "/investigate/photo",
        files={"file": ("investigation_query.jpg", query_green, "image/jpeg")},
        headers=investigator["headers"]
    )
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert data["query_type"] == "photo"
    assert data["query_hash"] == expected_query_hash
    assert data["matches_count"] >= 1
    assert any(m["submission_id"] == sub_id for m in data["matches"])

    match_obj = next(m for m in data["matches"] if m["submission_id"] == sub_id)
    assert match_obj["hamming_distance"] == 0
    assert match_obj["is_exact_match"] is True

    # 4. HARD RULE TEST: Ensure query file was NEVER written to disk
    after_files = set(upload_path.rglob("*"))
    assert before_files == after_files, "Query file must NOT be written to storage disk!"

    # 5. Verify InvestigationLog was created with the correct query hash
    db = SessionLocal()
    inv_log = (
        db.query(InvestigationLog)
        .filter(
            InvestigationLog.investigator_id == investigator["id"],
            InvestigationLog.query_type == "photo"
        )
        .order_by(InvestigationLog.created_at.desc())
        .first()
    )
    assert inv_log is not None
    assert inv_log.query_hash == expected_query_hash
    assert inv_log.result_count >= 1
    db.close()

def test_investigator_cross_community_search():
    admin = create_user_helper("admin", is_verified=True)
    shared_phone = "919988776655"

    # Community 1
    comm1 = client.post(
        "/communities",
        json={"title": f"Camp Alpha {uuid.uuid4().hex[:4]}", "description": "Disaster relief camp initiative Alpha"},
        headers=admin["headers"]
    ).json()
    f1 = client.put(f"/communities/{comm1['id']}/fields", json={"fields": [
        {"label": "Phone", "field_type": "phone", "is_required": True, "order": 1}
    ]}, headers=admin["headers"]).json()
    code1 = client.post(f"/communities/{comm1['id']}/codes", json={"codes": [{"label": "H1"}]}, headers=admin["headers"]).json()[0]["code"]

    sub1 = client.post("/join/submit", data={
        "code": code1,
        "consent": "true",
        "member_email": f"m1_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "pass",
        "member_name": "Applicant Alpha",
        f"field_{f1[0]['id']}": shared_phone
    }).json()

    # Community 2
    comm2 = client.post(
        "/communities",
        json={"title": f"Camp Beta {uuid.uuid4().hex[:4]}", "description": "Disaster relief camp initiative Beta"},
        headers=admin["headers"]
    ).json()
    f2 = client.put(f"/communities/{comm2['id']}/fields", json={"fields": [
        {"label": "Phone", "field_type": "phone", "is_required": True, "order": 1}
    ]}, headers=admin["headers"]).json()
    code2 = client.post(f"/communities/{comm2['id']}/codes", json={"codes": [{"label": "H2"}]}, headers=admin["headers"]).json()[0]["code"]

    sub2 = client.post("/join/submit", data={
        "code": code2,
        "consent": "true",
        "member_email": f"m2_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "pass",
        "member_name": "Applicant Beta",
        f"field_{f2[0]['id']}": shared_phone
    }).json()

    # Verified Investigator searches across all communities
    investigator = create_user_helper("investigator", is_verified=True)
    search_resp = client.get(
        f"/investigate/search?q={shared_phone}&query_type=phone",
        headers=investigator["headers"]
    )
    assert search_resp.status_code == 200
    res = search_resp.json()
    sub_ids = [m["submission_id"] for m in res["matches"]]
    assert sub1["submission_id"] in sub_ids
    assert sub2["submission_id"] in sub_ids

    # Query hash checked in InvestigationLog
    expected_hash = hashlib.sha256(shared_phone.encode("utf-8")).hexdigest()
    assert res["query_hash"] == expected_hash

    # Check unmasking value
    db = SessionLocal()
    val = db.query(SubmissionValue).filter(SubmissionValue.submission_id == sub1["submission_id"]).first()
    val_id = val.id
    db.close()

    reveal_resp = client.post(f"/investigate/reveal/{val_id}", headers=investigator["headers"])
    assert reveal_resp.status_code == 200
    assert reveal_resp.json()["raw_value"] == shared_phone

    # Check AuditLog for unmasking
    db = SessionLocal()
    audit = db.query(AuditLog).filter(
        AuditLog.actor_id == investigator["id"],
        AuditLog.action == "reveal_value"
    ).first()
    assert audit is not None
    assert f"#{sub1['submission_id']}" in audit.detail
    db.close()
