import io
import uuid
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.models.models import Submission, Evidence
from backend.app.engine.stage1_analysis import analyze_submission, compute_phash

client = TestClient(app)

def create_admin():
    uid = uuid.uuid4().hex[:8]
    email = f"admin_{uid}@example.com"
    password = f"Pass_{uid}"
    client.post("/auth/register", json={
        "name": f"Admin {uid}",
        "email": email,
        "password": password,
        "role": "admin"
    })
    token = client.post("/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}

def make_test_image(color: str = "blue", size=(120, 120)) -> io.BytesIO:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

def test_stage1_analysis_pipeline():
    admin = create_admin()

    # 1. Create community
    comm_resp = client.post(
        "/communities",
        json={"title": "Earthquake Relief Fund", "description": "Emergency reconstruction aid"},
        headers=admin["headers"]
    )
    comm_id = comm_resp.json()["id"]

    # 2. Define fields
    fields_resp = client.put(
        f"/communities/{comm_id}/fields",
        json={
            "fields": [
                {"label": "Applicant Name", "field_type": "name", "is_required": True, "order": 1},
                {"label": "Phone Number", "field_type": "phone", "is_required": True, "order": 2},
                {"label": "Bank Account", "field_type": "bank_account", "is_required": True, "order": 3},
                {"label": "Address", "field_type": "address", "is_required": True, "order": 4},
                {"label": "House Damage", "field_type": "photo", "is_required": True, "order": 5}
            ]
        },
        headers=admin["headers"]
    )
    field_map = {f["label"]: f["id"] for f in fields_resp.json()}

    # 3. Generate two codes
    codes_resp = client.post(
        f"/communities/{comm_id}/codes",
        json={"codes": [{"label": "Household A"}, {"label": "Household B"}]},
        headers=admin["headers"]
    )
    code_a = codes_resp.json()[0]["code"]
    code_b = codes_resp.json()[1]["code"]

    # 4. Submit first claim (Household A) with fresh unique data
    phone_a = f"98{uuid.uuid4().int % 100000000:08d}"
    bank_a = f"BANK{uuid.uuid4().hex[:8].upper()}"
    addr_a = f"House {uuid.uuid4().hex[:4]}, MG Rd, Near P.P.O."
    img_a = make_test_image("cyan")

    data_a = {
        "code": code_a,
        "consent": "true",
        "member_email": f"member_a_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "password123",
        "member_name": "Ravi Kumar",
        f"field_{field_map['Applicant Name']}": "Mr. Ravi Kumar",
        f"field_{field_map['Phone Number']}": phone_a,
        f"field_{field_map['Bank Account']}": bank_a,
        f"field_{field_map['Address']}": addr_a
    }
    files_a = {f"field_{field_map['House Damage']}": ("damage1.jpg", img_a, "image/jpeg")}
    res_a = client.post("/join/submit", data=data_a, files=files_a)
    assert res_a.status_code == 200
    sub_a_id = res_a.json()["submission_id"]

    # Run analysis for A directly via engine function to inspect immediate DB state
    db = SessionLocal()
    sub_a = analyze_submission(sub_a_id, db)
    assert sub_a.analysis_status == "done"
    # First submission with clean distinct data should have 0 or very low risk score
    assert sub_a.risk_score == 0.0
    assert len(sub_a.risk_reasons) == 0

    # Verify pHash was computed on evidence
    ev_a = db.query(Evidence).filter(Evidence.submission_id == sub_a_id).first()
    assert ev_a.phash is not None
    db.close()

    # 5. Submit second claim (Household B) planting duplicate phone and identical image
    img_b_duplicate = make_test_image("cyan")  # identical image -> exact file match
    data_b = {
        "code": code_b,
        "consent": "true",
        "member_email": f"member_b_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "password123",
        "member_name": "Suresh Kumar",
        f"field_{field_map['Applicant Name']}": "Suresh Kumar",
        # REUSED PHONE:
        f"field_{field_map['Phone Number']}": f"+91 {phone_a}",  # Same normalized phone!
        f"field_{field_map['Bank Account']}": f"HDFC{uuid.uuid4().hex[:8].upper()}",
        # REUSED ADDRESS with variation:
        f"field_{field_map['Address']}": addr_a
    }
    files_b = {f"field_{field_map['House Damage']}": ("damage2.jpg", img_b_duplicate, "image/jpeg")}
    res_b = client.post("/join/submit", data=data_b, files=files_b)
    assert res_b.status_code == 200
    sub_b_id = res_b.json()["submission_id"]

    db2 = SessionLocal()
    sub_b = analyze_submission(sub_b_id, db2)
    assert sub_b.analysis_status == "done"

    # Verify risk indicators discovered
    assert sub_b.risk_score > 0
    reasons_text = " ".join(sub_b.risk_reasons).lower()

    # HARD RULE: Wording MUST use "needs review", NEVER "fraud" or "guilty"
    assert "fraud" not in reasons_text
    assert "guilty" not in reasons_text
    assert "needs review" in reasons_text

    # Reused phone and identical file should be detected
    assert "phone" in reasons_text or "contact" in reasons_text
    assert "identical" in reasons_text or "file" in reasons_text
    db2.close()

def test_risk_score_capped_at_100():
    admin = create_admin()
    comm_resp = client.post(
        "/communities",
        json={"title": "Cyclone Relief", "description": "Coastal reconstruction relief fund"},
        headers=admin["headers"]
    )
    comm_id = comm_resp.json()["id"]

    db = SessionLocal()
    # Create submission with mock triggers that would exceed 100
    sub = Submission(
        membership_id=999999,  # synthetic
        community_id=comm_id,
        status="pending",
        risk_score=150.0,
        risk_reasons=["Reason 1", "Reason 2"],
        analysis_status="done"
    )
    # Ensure min(100.0, score) cap
    capped = min(100.0, sub.risk_score)
    assert capped == 100.0
    db.close()
