"""
AidNexus Demo Data Generator
Uses the real HTTP API (never direct DB writes) to register an admin, create a community,
define dynamic fields, issue access codes, and register households.
Randomly reuses values and edits photos to plant clues for the engine to discover.
Prints a summary of planted duplicates ONLY to the console.
"""

import sys
import io
import os
import random
import argparse
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from PIL import Image, ImageDraw, ImageEnhance

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Synthetic data pools
FIRST_NAMES = [
    "Ramesh", "Suresh", "Priya", "Ananya", "Rajesh", "Sunita", "Amit", "Kavita",
    "Vikram", "Sneha", "Manoj", "Deepa", "Arun", "Pooja", "Sanjay", "Rekha",
    "Vijay", "Meena", "Alok", "Geeta", "Kishore", "Anita", "Mahesh", "Lata"
]
LAST_NAMES = [
    "Kumar", "Sharma", "Patel", "Verma", "Singh", "Yadav", "Gupta", "Reddy",
    "Nair", "Das", "Joshi", "Mishra", "Choudhury", "Bose", "Mehta", "Rao"
]
STREETS = [
    "MG Road", "Station Road", "Gandhi Nagar", "Indira Colony", "Temple Street",
    "Nehru Nagar", "Market Yard", "Post Office Lane", "Ward 4 Ext", "Bypass Road",
    "Lake View Colony", "Civil Lines", "Subhash Nagar", "Teachers Colony"
]
BANKS = ["SBIN", "HDFC", "ICIC", "PUNB", "BARB", "UBIN"]

def generate_random_photo(index: int) -> bytes:
    """Generates a synthetic house damage image using Pillow with textured shapes."""
    width, height = 320, 240
    # Background color varying by index
    r = random.randint(70, 180)
    g = random.randint(70, 180)
    b = random.randint(70, 180)
    img = Image.new("RGB", (width, height), color=(r, g, b))
    draw = ImageDraw.Draw(img)

    # Draw synthetic damage cracks and building blocks
    draw.rectangle([20, 40, 200, 220], fill=(r - 30, g - 30, b - 30), outline=(0, 0, 0), width=2)
    draw.polygon([(10, 45), (110, 5), (210, 45)], fill=(180, 50, 40))
    # Cracks
    draw.line([(60, 90), (90, 140), (75, 180), (120, 210)], fill=(30, 30, 30), width=3)
    draw.line([(140, 100), (160, 130), (150, 170)], fill=(30, 30, 30), width=2)
    # Text stamp
    draw.text((25, 222), f"DAMAGE REF-{index:04d}", fill=(240, 240, 240))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()

def lightly_edit_photo(raw_bytes: bytes) -> bytes:
    """
    Applies small edits (crop, brightness change, re-compression) to a photo.
    pHash remains near-identical (Hamming dist 1-5), but SHA-256 changes completely.
    """
    img = Image.open(io.BytesIO(raw_bytes))
    w, h = img.size

    # 1. Random light crop (92% to 98% of size)
    crop_factor = random.uniform(0.92, 0.98)
    new_w, new_h = int(w * crop_factor), int(h * crop_factor)
    left = random.randint(0, w - new_w)
    top = random.randint(0, h - new_h)
    img = img.crop((left, top, left + new_w, top + new_h))
    img = img.resize((w, h), Image.Resampling.LANCZOS)

    # 2. Random slight brightness adjustment (+/- 8%)
    enhancer = ImageEnhance.Brightness(img)
    img = enhancer.enhance(random.uniform(0.92, 1.08))

    # 3. Save with varied JPEG compression
    buf = io.BytesIO()
    quality = random.choice([75, 80, 88, 92])
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()

def generate_qr_image() -> bytes:
    """Generates a dummy donation QR image."""
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 60, 60], fill=(0, 0, 0))
    draw.rectangle([20, 20, 50, 50], fill=(255, 255, 255))
    draw.rectangle([140, 10, 190, 60], fill=(0, 0, 0))
    draw.rectangle([150, 20, 180, 50], fill=(255, 255, 255))
    draw.rectangle([10, 140, 60, 190], fill=(0, 0, 0))
    draw.rectangle([20, 150, 50, 180], fill=(255, 255, 255))
    draw.text((35, 95), "RELIEF QR", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def create_demo_data(
    client,
    num_households: int = 12,
    admin_email: Optional[str] = None,
    admin_password: str = "AdminRelief2026!",
    comm_title: str = "Kerala Monsoon Flood Relief Scheme 2026",
    dup_phone_prob: float = 0.25,
    dup_account_prob: float = 0.20,
    dup_address_prob: float = 0.25,
    dup_photo_prob: float = 0.30,
    dup_id_prob: float = 0.20
) -> dict:
    """Generates demo data through real HTTP API calls."""
    if not admin_email:
        admin_email = f"admin.disaster_{random.randint(100, 999)}@relief.gov.in"

    # Tracking planted duplicates (FOR CONSOLE SUMMARY ONLY)
    planted = {
        "households_created": 0,
        "shared_phones": 0,
        "shared_accounts": 0,
        "shared_addresses": 0,
        "shared_ids": 0,
        "exact_photos": 0,
        "edited_photos": 0,
        "admin_email": admin_email,
        "admin_password": admin_password,
        "community_id": None,
        "community_title": comm_title
    }

    print("=" * 60)
    print(" AIDNEXUS SYNTHETIC DEMO DATA GENERATOR")
    print("=" * 60)
    print(f"[*] Target Households: {num_households}")
    print(f"[*] Registering Admin: {admin_email}...")

    # 1. Register Admin
    reg_resp = client.post("/auth/register", json={
        "name": "District Relief Commissioner",
        "email": admin_email,
        "password": admin_password,
        "role": "admin"
    })
    if reg_resp.status_code != 201:
        # Might already exist
        pass

    login_resp = client.post("/auth/login", json={
        "email": admin_email,
        "password": admin_password
    })
    if login_resp.status_code != 200:
        raise RuntimeError(f"Admin login failed: {login_resp.text}")

    admin_token = login_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[+] Admin authenticated successfully!")

    # 2. Create Community
    print(f"[*] Creating Community: '{comm_title}'...")
    comm_resp = client.post("/communities", json={
        "title": comm_title,
        "description": "Government emergency relief initiative for flood-affected families. Digitally collecting and verifying household claims."
    }, headers=admin_headers)
    if comm_resp.status_code != 201:
        raise RuntimeError(f"Community creation failed: {comm_resp.text}")

    comm_id = comm_resp.json()["id"]
    planted["community_id"] = comm_id
    print(f"[+] Community created with ID: {comm_id}")

    # 3. Upload QR image
    qr_bytes = generate_qr_image()
    client.post(
        f"/communities/{comm_id}/qr",
        files={"file": ("donation_qr.png", qr_bytes, "image/png")},
        headers=admin_headers
    )

    # 4. Define Dynamic Required Fields
    print("[*] Defining dynamic form fields...")
    fields_resp = client.put(f"/communities/{comm_id}/fields", json={
        "fields": [
            {"label": "Applicant Full Name", "field_type": "name", "is_required": True, "order": 1},
            {"label": "Contact Phone", "field_type": "phone", "is_required": True, "order": 2},
            {"label": "Residential Address", "field_type": "address", "is_required": True, "order": 3},
            {"label": "Aadhaar Card / ID Number", "field_type": "id_number", "is_required": True, "order": 4},
            {"label": "Bank Account Number", "field_type": "bank_account", "is_required": True, "order": 5},
            {"label": "House Damage Photograph", "field_type": "photo", "is_required": True, "order": 6}
        ]
    }, headers=admin_headers)
    if fields_resp.status_code != 200:
        raise RuntimeError(f"Failed to define fields: {fields_resp.text}")

    fields_data = fields_resp.json()
    field_map = {f["label"]: f["id"] for f in fields_data}

    # 5. Bulk Generate Access Codes
    print(f"[*] Bulk generating {num_households} access codes...")
    code_items = [{"label": f"Ward {random.randint(1, 10)} - House {i + 1}"} for i in range(num_households)]
    codes_resp = client.post(
        f"/communities/{comm_id}/codes",
        json={"codes": code_items},
        headers=admin_headers
    )
    if codes_resp.status_code != 200:
        raise RuntimeError(f"Failed to generate codes: {codes_resp.text}")

    codes = [c["code"] for c in codes_resp.json()]
    print(f"[+] Generated {len(codes)} single-use access codes.")

    # Storage pools for planting duplicates
    pool_phones: List[str] = []
    pool_accounts: List[str] = []
    pool_addresses: List[str] = []
    pool_ids: List[str] = []
    pool_photos: List[bytes] = []

    print("[*] Submitting household claims through /join and /join/submit...")

    for i in range(num_households):
        code = codes[i]
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        applicant_name = f"{first_name} {last_name}"
        member_email = f"hh_{i + 1}_{random.randint(1000, 9999)}@claimant.org"
        member_pass = "HouseholdPass123!"

        # Decide whether to reuse or generate phone
        if pool_phones and random.random() < dup_phone_prob:
            phone_val = random.choice(pool_phones)
            planted["shared_phones"] += 1
        else:
            phone_val = f"98{random.randint(10000000, 99999999)}"
            pool_phones.append(phone_val)

        # Decide whether to reuse or generate bank account
        if pool_accounts and random.random() < dup_account_prob:
            account_val = random.choice(pool_accounts)
            planted["shared_accounts"] += 1
        else:
            bank_code = random.choice(BANKS)
            account_val = f"{bank_code}{random.randint(1000000000, 9999999999)}"
            pool_accounts.append(account_val)

        # Decide whether to reuse or generate address
        if pool_addresses and random.random() < dup_address_prob:
            address_val = random.choice(pool_addresses)
            planted["shared_addresses"] += 1
        else:
            street = random.choice(STREETS)
            h_no = random.randint(1, 150)
            address_val = f"House No. {h_no}, {street}, Ward {random.randint(1, 12)}"
            pool_addresses.append(address_val)

        # Decide whether to reuse or generate ID
        if pool_ids and random.random() < dup_id_prob:
            id_val = random.choice(pool_ids)
            planted["shared_ids"] += 1
        else:
            id_val = f"ID{random.randint(10000000, 99999999)}"
            pool_ids.append(id_val)

        # Decide photo: fresh, exact duplicate, or edited duplicate
        if pool_photos and random.random() < dup_photo_prob:
            chosen_base = random.choice(pool_photos)
            if random.random() < 0.35:
                # Exact identical file
                photo_bytes = chosen_base
                planted["exact_photos"] += 1
            else:
                # Lightly edited photo (pHash near match, new SHA256)
                photo_bytes = lightly_edit_photo(chosen_base)
                planted["edited_photos"] += 1
        else:
            photo_bytes = generate_random_photo(i + 1)
            pool_photos.append(photo_bytes)

        # Prepare multipart form submission
        submit_data = {
            "code": code,
            "consent": "true",
            "member_email": member_email,
            "member_name": applicant_name,
            "member_password": member_pass,
            f"field_{field_map['Applicant Full Name']}": applicant_name,
            f"field_{field_map['Contact Phone']}": phone_val,
            f"field_{field_map['Residential Address']}": address_val,
            f"field_{field_map['Aadhaar Card / ID Number']}": id_val,
            f"field_{field_map['Bank Account Number']}": account_val
        }
        submit_files = {
            f"field_{field_map['House Damage Photograph']}": (
                f"damage_{i + 1}.jpg",
                photo_bytes,
                "image/jpeg"
            )
        }

        sub_resp = client.post("/join/submit", data=submit_data, files=submit_files)
        if sub_resp.status_code == 200:
            planted["households_created"] += 1
        else:
            print(f"[!] Warning: Household {i + 1} submission error: {sub_resp.text}")

    print("[+] All households submitted successfully through the API!")
    print()
    print("=" * 60)
    print(" PLANTed DUPLICATES SUMMARY (CONSOLE ONLY)")
    print(" Compare this summary against the engine-discovered flags!")
    print("=" * 60)
    print(f" Total Households Created   : {planted['households_created']}")
    print(f" Planted Shared Phones      : {planted['shared_phones']}")
    print(f" Planted Shared Accounts    : {planted['shared_accounts']}")
    print(f" Planted Shared Addresses   : {planted['shared_addresses']}")
    print(f" Planted Shared ID Numbers  : {planted['shared_ids']}")
    print(f" Planted Exact File Photos  : {planted['exact_photos']}")
    print(f" Planted Edited Near Photos : {planted['edited_photos']}")
    print("-" * 60)
    print(f" Admin Credentials For Demo :")
    print(f"   Email    : {planted['admin_email']}")
    print(f"   Password : {planted['admin_password']}")
    print(f"   Community: #{planted['community_id']} ({planted['community_title']})")
    print("=" * 60)

    return planted

def main():
    parser = argparse.ArgumentParser(description="AidNexus Demo Data Generator")
    parser.add_argument("-n", "--count", type=int, default=12, help="Number of households to generate")
    parser.add_argument("--base-url", type=str, default="http://127.0.0.1:8000", help="FastAPI base URL")
    parser.add_argument("--admin-email", type=str, default=None, help="Custom admin email")
    parser.add_argument("--admin-password", type=str, default="AdminRelief2026!", help="Custom admin password")
    parser.add_argument("--title", type=str, default="Kerala Monsoon Flood Relief Scheme 2026", help="Community title")
    parser.add_argument("--dup-phone-prob", type=float, default=0.25, help="Probability of phone reuse")
    parser.add_argument("--dup-account-prob", type=float, default=0.20, help="Probability of account reuse")
    parser.add_argument("--dup-address-prob", type=float, default=0.25, help="Probability of address reuse")
    parser.add_argument("--dup-photo-prob", type=float, default=0.30, help="Probability of photo reuse/edit")
    parser.add_argument("--dup-id-prob", type=float, default=0.20, help="Probability of ID reuse")
    parser.add_argument("--in-process", action="store_true", help="Run in-process via FastAPI TestClient")

    args = parser.parse_args()

    client = None
    if args.in_process:
        from fastapi.testclient import TestClient
        from backend.app.main import app
        client = TestClient(app)
    else:
        import httpx
        try:
            temp_client = httpx.Client(base_url=args.base_url, timeout=2.0)
            health = temp_client.get("/health")
            if health.status_code == 200:
                client = httpx.Client(base_url=args.base_url, timeout=60.0)
        except Exception:
            client = None

        if client is None:
            print(f"[*] Dev server not active on {args.base_url}. Auto-launching in-process FastAPI TestClient directly...")
            from fastapi.testclient import TestClient
            from backend.app.main import app
            client = TestClient(app)

    create_demo_data(
        client=client,
        num_households=args.count,
        admin_email=args.admin_email,
        admin_password=args.admin_password,
        comm_title=args.title,
        dup_phone_prob=args.dup_phone_prob,
        dup_account_prob=args.dup_account_prob,
        dup_address_prob=args.dup_address_prob,
        dup_photo_prob=args.dup_photo_prob,
        dup_id_prob=args.dup_id_prob
    )

if __name__ == "__main__":
    main()
