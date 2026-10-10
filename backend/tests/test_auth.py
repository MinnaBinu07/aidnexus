import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.models.models import User

client = TestClient(app)

def unique_email(prefix: str = "user") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_register_and_login_admin():
    email = unique_email("admin")
    password = f"Pass_{uuid.uuid4().hex[:6]}"
    name = f"Admin {uuid.uuid4().hex[:4]}"

    # 1. Register admin
    reg_resp = client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
        "role": "admin"
    })
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert data["email"] == email
    assert data["role"] == "admin"
    assert "password" not in data

    # 2. Login admin
    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["user"]["role"] == "admin"
    token = token_data["access_token"]

    # 3. Access /auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

    # 4. Access admin-only endpoint
    admin_access = client.get("/test/admin-only", headers=headers)
    assert admin_access.status_code == 200
    assert admin_access.json()["role"] == "admin"

    # 5. Admin trying member-only endpoint should be forbidden (403)
    member_access = client.get("/test/member-only", headers=headers)
    assert member_access.status_code == 403

def test_register_and_login_member():
    email = unique_email("member")
    password = f"Pass_{uuid.uuid4().hex[:6]}"
    name = f"Member {uuid.uuid4().hex[:4]}"

    # 1. Register member
    reg_resp = client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
        "role": "member"
    })
    assert reg_resp.status_code == 201

    # 2. Login member
    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Access member-only route -> OK
    member_access = client.get("/test/member-only", headers=headers)
    assert member_access.status_code == 200

    # 4. Access admin-only route -> 403 Forbidden
    admin_access = client.get("/test/admin-only", headers=headers)
    assert admin_access.status_code == 403

def test_investigator_verification_check():
    email = unique_email("investigator")
    password = f"Pass_{uuid.uuid4().hex[:6]}"
    name = f"Investigator {uuid.uuid4().hex[:4]}"

    # Register investigator (unverified by default)
    reg_resp = client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
        "role": "investigator"
    })
    assert reg_resp.status_code == 201
    user_id = reg_resp.json()["id"]

    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Unverified investigator -> 403 Forbidden
    resp = client.get("/test/investigator-only", headers=headers)
    assert resp.status_code == 403

    # Now verify via admin/seed mechanism
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    user.is_verified = True
    db.commit()
    db.close()

    # Login again to get updated claims
    login_resp2 = client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    token2 = login_resp2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Verified investigator -> 200 OK
    resp2 = client.get("/test/investigator-only", headers=headers2)
    assert resp2.status_code == 200
    assert resp2.json()["role"] == "investigator"

def test_invalid_login_rejected():
    resp = client.post("/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "wrongpassword"
    })
    assert resp.status_code == 401
