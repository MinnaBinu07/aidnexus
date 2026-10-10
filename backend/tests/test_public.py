import io
import uuid
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app

client = TestClient(app)

def create_user_helper(role: str = "admin", is_verified: bool = False):
    uid = uuid.uuid4().hex[:8]
    email = f"{role}_{uid}@example.com"
    password = f"Pass_{uid}"
    resp = client.post("/auth/register", json={
        "name": f"Coordinator {uid}",
        "email": email,
        "password": password,
        "role": role
    })
    assert resp.status_code == 201

    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {
        "id": resp.json()["id"],
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }

def create_dummy_qr() -> io.BytesIO:
    img = Image.new("RGB", (100, 100), color="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def test_public_communities_and_privacy_integrity():
    # 1. Admin creates community and uploads QR
    admin = create_user_helper("admin", is_verified=True)
    comm_resp = client.post(
        "/communities",
        json={
            "title": f"Kerala Flood Relief {uuid.uuid4().hex[:4]}",
            "description": "Public relief fund for displaced households in Wayanad district"
        },
        headers=admin["headers"]
    )
    assert comm_resp.status_code == 201
    comm = comm_resp.json()
    comm_id = comm["id"]

    # Upload QR
    qr_buf = create_dummy_qr()
    qr_resp = client.post(
        f"/communities/{comm_id}/qr",
        files={"file": ("donate_qr.png", qr_buf, "image/png")},
        headers=admin["headers"]
    )
    assert qr_resp.status_code == 200

    # Define minimal field
    field_put_resp = client.put(
        f"/communities/{comm_id}/fields",
        json={"fields": [{"label": "Name", "field_type": "name", "is_required": True, "order": 1}]},
        headers=admin["headers"]
    )
    f_id = field_put_resp.json()[0]["id"]

    # Issue code & submit a claim
    code_resp = client.post(
        f"/communities/{comm_id}/codes",
        json={"codes": [{"label": "H1"}]},
        headers=admin["headers"]
    )
    code_str = code_resp.json()[0]["code"]

    sub_resp = client.post(
        "/join/submit",
        data={
            "code": code_str,
            "consent": "true",
            "member_email": f"h_{uuid.uuid4().hex[:6]}@example.com",
            "member_password": "password123",
            "member_name": "Private Beneficiary",
            f"field_{f_id}": "Private Beneficiary"
        }
    )
    assert sub_resp.status_code == 200
    sub_id = sub_resp.json()["submission_id"]

    # Admin approves submission
    client.post(
        f"/submissions/{sub_id}/review",
        json={"action": "confirmed", "status_change": "approved"},
        headers=admin["headers"]
    )

    # 2. Public anonymous donor visits /public/communities (NO AUTH HEADER)
    public_list_resp = client.get("/public/communities")
    assert public_list_resp.status_code == 200
    data = public_list_resp.json()
    assert data["total"] >= 1

    pub_comm = next(c for c in data["items"] if c["id"] == comm_id)
    assert pub_comm["title"] == comm["title"]
    assert pub_comm["approved_members_count"] == 1
    assert pub_comm["qr_image_path"].startswith("/public-qr/")

    # 3. Public anonymous donor visits /public/communities/{id}
    detail_resp = client.get(f"/public/communities/{comm_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["approved_members_count"] == 1
    assert detail["status"] == "open"

    # 4. PRIVACY AUDIT: Assert ZERO leakage of applicant data to donors
    forbidden_keys = ["risk_score", "phash", "raw_value", "applicant_name", "phone", "evidence", "values", "links", "submissions"]
    for key in forbidden_keys:
        assert key not in detail, f"Privacy violation: '{key}' must not be present in public donor response!"
        assert key not in pub_comm, f"Privacy violation: '{key}' must not be present in public donor list!"
