import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.models.models import Submission, Link
from backend.scripts.generate_demo_data import create_demo_data

def test_demo_data_generator_in_process(capsys):
    client = TestClient(app)

    # Run generator with 8 households and elevated probabilities to guarantee duplicate planting
    summary = create_demo_data(
        client=client,
        num_households=8,
        admin_email="admin.monsoon@aidnexus.org",
        admin_password="AdminMonsoon2026!",
        comm_title="Monsoon Relief 2026 Test",
        dup_phone_prob=0.5,
        dup_account_prob=0.5,
        dup_address_prob=0.5,
        dup_photo_prob=0.5,
        dup_id_prob=0.4
    )

    # 1. Verify summary returned
    assert summary["households_created"] == 8
    assert summary["community_id"] is not None

    # 2. Check console summary output
    captured = capsys.readouterr()
    assert "PLANTed DUPLICATES SUMMARY" in captured.out
    assert "Total Households Created   : 8" in captured.out
    assert "Admin Credentials For Demo" in captured.out

    # 3. Check engine discovered submissions and computed stats in DB
    db = SessionLocal()
    subs = db.query(Submission).filter(Submission.community_id == summary["community_id"]).all()
    assert len(subs) == 8

    # All submissions should have analysis_status done (or pending/done)
    for s in subs:
        assert s.analysis_status in ["done", "pending"]

    # Check that links table has discovered links
    comm_links = db.query(Link).filter(Link.community_id == summary["community_id"]).all()
    # At least some duplicates were planted and discovered
    total_planted = (
        summary["shared_phones"] + summary["shared_accounts"] +
        summary["shared_addresses"] + summary["exact_photos"] +
        summary["edited_photos"]
    )
    if total_planted > 0:
        assert len(comm_links) > 0

    # 4. Check /stats endpoint via API
    login_resp = client.post("/auth/login", json={
        "email": summary["admin_email"],
        "password": summary["admin_password"]
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    stats_resp = client.get(f"/communities/{summary['community_id']}/stats", headers=headers)
    assert stats_resp.status_code == 200
    st = stats_resp.json()
    assert st["total_submissions"] == 8
    assert st["redeemed_codes"] == 8

    # 5. Check /queue endpoint via API
    queue_resp = client.get(f"/communities/{summary['community_id']}/queue", headers=headers)
    assert queue_resp.status_code == 200
    db.close()
