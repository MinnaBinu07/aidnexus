import io
import uuid
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app

client = TestClient(app)

def create_user(role: str = "member"):
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

    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {
        "id": resp.json()["id"],
        "email": email,
        "password": password,
        "name": name,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }

def create_dummy_image_bytes(color: str = "blue") -> io.BytesIO:
    img = Image.new("RGB", (100, 100), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

def test_community_fields_and_single_use_code():
    # 1. Register Admin A
    admin_a = create_user("admin")

    # 2. Admin A creates a community
    comm_title = f"Flood Relief {uuid.uuid4().hex[:6]}"
    comm_resp = client.post(
        "/communities",
        json={"title": comm_title, "description": "Emergency flood relief support initiative"},
        headers=admin_a["headers"]
    )
    assert comm_resp.status_code == 201
    comm_id = comm_resp.json()["id"]

    # 3. Admin A defines dynamic required fields
    fields_payload = {
        "fields": [
            {"label": "Applicant Name", "field_type": "name", "is_required": True, "order": 1},
            {"label": "Contact Number", "field_type": "phone", "is_required": True, "order": 2},
            {"label": "Residential Address", "field_type": "address", "is_required": True, "order": 3},
            {"label": "Aadhaar / ID Card", "field_type": "id_number", "is_required": True, "order": 4},
            {"label": "Damage Photo", "field_type": "photo", "is_required": True, "order": 5}
        ]
    }
    fields_resp = client.put(
        f"/communities/{comm_id}/fields",
        json=fields_payload,
        headers=admin_a["headers"]
    )
    assert fields_resp.status_code == 200
    fields = fields_resp.json()
    assert len(fields) == 5

    # 4. Admin A uploads QR image
    qr_buf = create_dummy_image_bytes("green")
    qr_resp = client.post(
        f"/communities/{comm_id}/qr",
        files={"file": ("relief_qr.jpg", qr_buf, "image/jpeg")},
        headers=admin_a["headers"]
    )
    assert qr_resp.status_code == 200
    assert qr_resp.json()["qr_image_path"].startswith("/public-qr/")

    # 5. Admin A generates access codes
    codes_resp = client.post(
        f"/communities/{comm_id}/codes",
        json={"codes": [{"label": "Household 101", "phone": "9876543210"}, {"label": "Household 102"}]},
        headers=admin_a["headers"]
    )
    assert codes_resp.status_code == 200
    codes = codes_resp.json()
    assert len(codes) == 2
    code_1 = codes[0]["code"]
    code_2 = codes[1]["code"]

    # 6. Validate join code
    validate_resp = client.post("/join", json={"code": code_1})
    assert validate_resp.status_code == 200
    val_data = validate_resp.json()
    assert val_data["community_id"] == comm_id
    assert val_data["consent_notice"] is not None
    assert len(val_data["required_fields"]) == 5

    # Map field IDs
    field_ids = {f["label"]: f["id"] for f in val_data["required_fields"]}

    # 7. Attempt submit WITHOUT consent -> should fail (400)
    photo_buf_1 = create_dummy_image_bytes("red")
    no_consent_data = {
        "code": code_1,
        "consent": "false",
        "member_email": f"applicant_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "securepassword123",
        "member_name": "Test Applicant",
        f"field_{field_ids['Applicant Name']}": "Ramesh Kumar",
        f"field_{field_ids['Contact Number']}": "9876543210",
        f"field_{field_ids['Residential Address']}": "Flat 12, MG Road, Ward 4",
        f"field_{field_ids['Aadhaar / ID Card']}": "ID98765432"
    }
    no_consent_files = {
        f"field_{field_ids['Damage Photo']}": ("damage.jpg", photo_buf_1, "image/jpeg")
    }
    resp_no_consent = client.post("/join/submit", data=no_consent_data, files=no_consent_files)
    assert resp_no_consent.status_code == 400
    assert "Consent is required" in resp_no_consent.json()["detail"]

    # 8. Submit WITH consent -> should SUCCEED
    photo_buf_2 = create_dummy_image_bytes("red")
    member_email = f"applicant_{uuid.uuid4().hex[:6]}@example.com"
    valid_data = {
        "code": code_1,
        "consent": "true",
        "member_email": member_email,
        "member_password": "securepassword123",
        "member_name": "Ramesh Kumar",
        f"field_{field_ids['Applicant Name']}": "Ramesh Kumar",
        f"field_{field_ids['Contact Number']}": "9876543210",
        f"field_{field_ids['Residential Address']}": "Flat 12, MG Road, Ward 4",
        f"field_{field_ids['Aadhaar / ID Card']}": "ID98765432"
    }
    valid_files = {
        f"field_{field_ids['Damage Photo']}": ("damage.jpg", photo_buf_2, "image/jpeg")
    }
    submit_resp = client.post("/join/submit", data=valid_data, files=valid_files)
    assert submit_resp.status_code == 200
    res_data = submit_resp.json()
    assert "access_token" in res_data
    assert res_data["submission_id"] > 0
    member_token = res_data["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 9. HARD RULE TEST: A code works EXACTLY ONCE
    # Attempting to use the same code_1 a second time MUST FAIL!
    photo_buf_3 = create_dummy_image_bytes("orange")
    dup_data = {
        "code": code_1,
        "consent": "true",
        "member_email": f"other_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "securepassword123",
        "member_name": "Other Applicant",
        f"field_{field_ids['Applicant Name']}": "Other Person",
        f"field_{field_ids['Contact Number']}": "9876543211",
        f"field_{field_ids['Residential Address']}": "Flat 14, MG Road",
        f"field_{field_ids['Aadhaar / ID Card']}": "ID98765433"
    }
    dup_files = {
        f"field_{field_ids['Damage Photo']}": ("damage2.jpg", photo_buf_3, "image/jpeg")
    }
    dup_resp = client.post("/join/submit", data=dup_data, files=dup_files)
    assert dup_resp.status_code == 400
    assert "already been used" in dup_resp.json()["detail"] or "invalid" in dup_resp.json()["detail"]

    # Also check /join with redeemed code
    join_dup_check = client.post("/join", json={"code": code_1})
    assert join_dup_check.status_code == 400
    assert "already been redeemed" in join_dup_check.json()["detail"]

    # 10. Check Member can view their submission
    my_sub_resp = client.get("/me/submission", headers=member_headers)
    assert my_sub_resp.status_code == 200
    my_sub_data = my_sub_resp.json()
    assert my_sub_data["community_id"] == comm_id
    assert len(my_sub_data["values"]) == 4
    assert len(my_sub_data["evidence"]) == 1
    evidence_id = my_sub_data["evidence"][0]["evidence_id"]

    # 11. Check evidence file download (Authorized member -> 200)
    ev_file_resp = client.get(f"/evidence/{evidence_id}/file", headers=member_headers)
    assert ev_file_resp.status_code == 200

    # 11b. Unauthorized access to evidence file (Anonymous -> 401, Unrelated member -> 403)
    unauthorized_member = create_user("member")
    ev_unauth_resp = client.get(f"/evidence/{evidence_id}/file", headers=unauthorized_member["headers"])
    assert ev_unauth_resp.status_code == 403

    # 12. Test Admin Isolation: Admin B cannot access Admin A's community
    admin_b = create_user("admin")
    isolation_resp = client.get(f"/communities/{comm_id}", headers=admin_b["headers"])
    assert isolation_resp.status_code == 403

    # 13. Test Code Revocation: Admin A revokes code_2
    code_2_obj = next(c for c in client.get(f"/communities/{comm_id}/codes", headers=admin_a["headers"]).json()["items"] if c["code"] == code_2)
    revoke_resp = client.post(f"/codes/{code_2_obj['id']}/revoke", headers=admin_a["headers"])
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "revoked"

    # Joining with revoked code fails
    revoked_join = client.post("/join", json={"code": code_2})
    assert revoked_join.status_code == 400
    assert "revoked" in revoked_join.json()["detail"]

    # 14. Test GET /communities/{id}/fields
    get_fields_resp = client.get(f"/communities/{comm_id}/fields", headers=admin_a["headers"])
    assert get_fields_resp.status_code == 200
    assert len(get_fields_resp.json()) == 5

    # 15. Test Admin creates document request and Member fulfills it
    sub_id = res_data["submission_id"]
    doc_req_resp = client.post(
        f"/communities/{comm_id}/document-requests",
        json={
            "submission_id": sub_id,
            "message": "Please provide proof of electricity bill or land record",
            "requested_labels": ["Electricity Bill"]
        },
        headers=admin_a["headers"]
    )
    assert doc_req_resp.status_code == 200
    dr_id = doc_req_resp.json()["id"]

    # Check member sees the request & notification
    member_sub_updated = client.get("/me/submission", headers=member_headers).json()
    assert member_sub_updated["status"] == "info_requested"
    assert len(member_sub_updated["document_requests"]) >= 1
    assert len(member_sub_updated["notifications"]) >= 1

    notif_id = member_sub_updated["notifications"][0]["id"]
    read_notif_resp = client.post(f"/me/notifications/{notif_id}/read", headers=member_headers)
    assert read_notif_resp.status_code == 200

    # Member fulfills the document request
    supp_buf = create_dummy_image_bytes("yellow")
    fulfill_resp = client.post(
        f"/me/document-requests/{dr_id}/fulfill",
        files={"file": ("electricity_bill.jpg", supp_buf, "image/jpeg")},
        headers=member_headers
    )
    assert fulfill_resp.status_code == 200
    assert fulfill_resp.json()["document_request_id"] == dr_id

    # Check status moved back to pending
    after_fulfill = client.get("/me/submission", headers=member_headers).json()
    assert after_fulfill["status"] == "pending"
    assert any(dr["id"] == dr_id and dr["status"] == "fulfilled" for dr in after_fulfill["document_requests"])
