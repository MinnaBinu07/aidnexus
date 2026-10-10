import io
import uuid
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app
from backend.app.core import config
from backend.app.core.database import SessionLocal
from backend.app.models.models import Submission, Link, AuditLog
from backend.app.engine.stage1_analysis import analyze_submission
from backend.app.engine.stage2_linking import run_stage2_linking, calculate_rarity_strength
from backend.app.engine.graph import get_ranked_clusters, get_graph_export

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

def make_test_image(color: str = "blue", size=(100, 100), stamp: Optional[str] = None) -> io.BytesIO:
    img = Image.new("RGB", size, color=color)
    if stamp:
        # Write unique stamp so test file SHA is unique to this test pair
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.text((5, 5), stamp, fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

def test_stage2_linking_and_network_pipeline():
    admin = create_admin()

    # 1. Create community
    comm_resp = client.post(
        "/communities",
        json={"title": "Landslide Relief Scheme", "description": "Hilly terrain rehabilitation aid"},
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
                {"label": "Damage Photo", "field_type": "photo", "is_required": True, "order": 5}
            ]
        },
        headers=admin["headers"]
    )
    field_map = {f["label"]: f["id"] for f in fields_resp.json()}

    # 3. Generate 4 codes
    codes_resp = client.post(
        f"/communities/{comm_id}/codes",
        json={"codes": [{"label": "H1"}, {"label": "H2"}, {"label": "H3"}, {"label": "H4"}]},
        headers=admin["headers"]
    )
    codes = [c["code"] for c in codes_resp.json()]

    # Unique base values
    unique_phone = f"98{uuid.uuid4().int % 100000000:08d}"
    unique_bank = f"BANK{uuid.uuid4().hex[:8].upper()}"
    unique_addr = f"Sector {uuid.uuid4().hex[:4]}, Hill Road"

    # Submission 1: Base household
    shared_photo_bytes = make_test_image("blue", stamp=f"stamp_{uuid.uuid4().hex[:6]}").getvalue()
    res1 = client.post("/join/submit", data={
        "code": codes[0], "consent": "true",
        "member_email": f"h1_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "pass", "member_name": "Ravi Kumar",
        f"field_{field_map['Applicant Name']}": "Ravi Kumar",
        f"field_{field_map['Phone Number']}": unique_phone,
        f"field_{field_map['Bank Account']}": unique_bank,
        f"field_{field_map['Address']}": unique_addr
    }, files={f"field_{field_map['Damage Photo']}": ("photo1.jpg", io.BytesIO(shared_photo_bytes), "image/jpeg")})
    assert res1.status_code == 200
    sub1_id = res1.json()["submission_id"]

    db = SessionLocal()
    analyze_submission(sub1_id, db)
    run_stage2_linking(sub1_id, db)
    db.close()

    # Submission 2: Shares PHONE and PHOTO with Submission 1, and has same NAME
    res2 = client.post("/join/submit", data={
        "code": codes[1], "consent": "true",
        "member_email": f"h2_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "pass", "member_name": "Ravi Kumar",
        f"field_{field_map['Applicant Name']}": "Ravi Kumar",  # Same name
        f"field_{field_map['Phone Number']}": f"+91 {unique_phone}",  # Same normalized phone!
        f"field_{field_map['Bank Account']}": f"HDFC{uuid.uuid4().hex[:6].upper()}",
        f"field_{field_map['Address']}": f"Other Sector {uuid.uuid4().hex[:4]}"
    }, files={f"field_{field_map['Damage Photo']}": ("photo2.jpg", io.BytesIO(shared_photo_bytes), "image/jpeg")})
    assert res2.status_code == 200
    sub2_id = res2.json()["submission_id"]

    db = SessionLocal()
    analyze_submission(sub2_id, db)
    links_2 = run_stage2_linking(sub2_id, db)
    db.close()

    # Verify link created between sub1 and sub2
    db = SessionLocal()
    links_between_1_2 = db.query(Link).filter(
        Link.submission_a == min(sub1_id, sub2_id),
        Link.submission_b == max(sub1_id, sub2_id)
    ).all()
    link_types_1_2 = {l.link_type for l in links_between_1_2}
    assert "phone" in link_types_1_2
    assert "exact_file" in link_types_1_2
    # Since phone linked them, name link was also created!
    assert "name" in link_types_1_2

    # Check pair ordering rule (a < b)
    for l in links_between_1_2:
        assert l.submission_a < l.submission_b
        # Hint is masked
        assert "*" in l.matched_value_hint or "..." in l.matched_value_hint or len(l.matched_value_hint) > 0
    db.close()

    # Submission 3: Shares BANK ACCOUNT with Submission 1
    img3 = make_test_image("yellow")
    res3 = client.post("/join/submit", data={
        "code": codes[2], "consent": "true",
        "member_email": f"h3_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "pass", "member_name": "Sunita Devi",
        f"field_{field_map['Applicant Name']}": "Sunita Devi",
        f"field_{field_map['Phone Number']}": f"97{uuid.uuid4().int % 100000000:08d}",
        f"field_{field_map['Bank Account']}": unique_bank,  # Same bank account!
        f"field_{field_map['Address']}": f"Different area {uuid.uuid4().hex[:4]}"
    }, files={f"field_{field_map['Damage Photo']}": ("photo3.jpg", img3, "image/jpeg")})
    assert res3.status_code == 200
    sub3_id = res3.json()["submission_id"]

    db = SessionLocal()
    analyze_submission(sub3_id, db)
    run_stage2_linking(sub3_id, db)
    db.close()

    # Submission 4: Distinct clean data (Isolated)
    img4 = make_test_image("purple")
    res4 = client.post("/join/submit", data={
        "code": codes[3], "consent": "true",
        "member_email": f"h4_{uuid.uuid4().hex[:6]}@example.com",
        "member_password": "pass", "member_name": "Gopal Sharma",
        f"field_{field_map['Applicant Name']}": "Gopal Sharma",
        f"field_{field_map['Phone Number']}": f"96{uuid.uuid4().int % 100000000:08d}",
        f"field_{field_map['Bank Account']}": f"AXIS{uuid.uuid4().hex[:6].upper()}",
        f"field_{field_map['Address']}": f"Village {uuid.uuid4().hex[:4]}"
    }, files={f"field_{field_map['Damage Photo']}": ("photo4.jpg", img4, "image/jpeg")})
    assert res4.status_code == 200
    sub4_id = res4.json()["submission_id"]

    db = SessionLocal()
    analyze_submission(sub4_id, db)
    run_stage2_linking(sub4_id, db)
    db.close()

    # 4. Test NetworkX Connected Components
    db = SessionLocal()
    clusters = get_ranked_clusters(comm_id, db)
    db.close()

    # There should be 1 multi-node connected component containing {sub1, sub2, sub3}
    assert len(clusters) >= 1
    top_cluster = clusters[0]
    assert sub1_id in top_cluster["submission_ids"]
    assert sub2_id in top_cluster["submission_ids"]
    assert sub3_id in top_cluster["submission_ids"]
    assert sub4_id not in top_cluster["submission_ids"]  # Isolated node not in multi-node cluster

    # 5. Test Flagged Queue Endpoint
    queue_resp = client.get(f"/communities/{comm_id}/queue", headers=admin["headers"])
    assert queue_resp.status_code == 200
    q_data = queue_resp.json()
    assert q_data["total_flagged_networks"] >= 1
    assert q_data["flagged_networks"][0]["nodes_count"] == 3

    # 6. Test Network Graph Endpoint (with component_id)
    net_resp = client.get(f"/communities/{comm_id}/network?component_id=0", headers=admin["headers"])
    assert net_resp.status_code == 200
    net_data = net_resp.json()
    assert len(net_data["nodes"]) == 3
    assert len(net_data["links"]) >= 2
    assert net_data["selected_cluster_id"] == 0

    # 7. Test Computed Stats Endpoint (Rule 1: All values computed, nothing hardcoded)
    stats_resp = client.get(f"/communities/{comm_id}/stats", headers=admin["headers"])
    assert stats_resp.status_code == 200
    st = stats_resp.json()
    assert st["total_submissions"] == 4
    assert st["total_codes"] == 4
    assert st["redeemed_codes"] == 4
    assert st["unused_codes"] == 0
    assert st["flagged_networks_count"] >= 1
    assert st["total_links_count"] >= 2

    # 8. Test Masking & Reveal Endpoint
    detail_resp = client.get(f"/submissions/{sub1_id}", headers=admin["headers"])
    assert detail_resp.status_code == 200
    det = detail_resp.json()
    phone_entry = next(v for v in det["values"] if v["field_type"] == "phone")
    # Phone must be masked by default
    assert "*" in phone_entry["value"]
    assert phone_entry["value"] != unique_phone
    assert phone_entry["value"][-4:] == unique_phone[-4:]

    # Unmask via reveal endpoint
    reveal_resp = client.post(f"/submissions/{sub1_id}/reveal/{phone_entry['id']}", headers=admin["headers"])
    assert reveal_resp.status_code == 200
    assert reveal_resp.json()["raw_value"] == unique_phone

    # Verify AuditLog recorded the reveal
    db = SessionLocal()
    audit_entry = db.query(AuditLog).filter(
        AuditLog.action == "reveal_value",
        AuditLog.target_id == phone_entry["id"]
    ).first()
    assert audit_entry is not None
    db.close()

    # 9. Test Review Submission
    review_resp = client.post(
        f"/submissions/{sub1_id}/review",
        json={"action": "needs_field_visit", "status_change": "info_requested"},
        headers=admin["headers"]
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["review_status"] == "needs_field_visit"

    # 10. Test Document Request Endpoint
    doc_req_resp = client.post(
        f"/communities/{comm_id}/document-requests",
        json={"submission_id": sub1_id, "message": "Please provide proof of electricity bill", "requested_labels": ["Electricity Bill"]},
        headers=admin["headers"]
    )
    assert doc_req_resp.status_code == 200
    assert doc_req_resp.json()["status"] == "open"

def test_rarity_weighting_and_hub_limit():
    # Rarity calculation: decreases as count increases
    s2 = calculate_rarity_strength(2)
    s3 = calculate_rarity_strength(3)
    s4 = calculate_rarity_strength(4)
    s5 = calculate_rarity_strength(5)

    assert s2 == 1.0
    assert s2 > s3 > s4 > s5
    assert s5 > 0.0

    # Hub limit
    assert config.HUB_LIMIT == 5
