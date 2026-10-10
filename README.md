# AidNexus

> **Disaster Relief Clue Discovery & Household Verification Platform**  
> *A 24-hour hackathon prototype built for transparent, dignity-first disaster relief distribution.*

---

## 1. What AidNexus Is

AidNexus empowers government workers and disaster relief coordinators to collect household claims digitally for a disaster scheme, discovering reused contact numbers, duplicate damage photographs, shared residential addresses, bank accounts, and identification numbers.

### Core Ethical & Security Principles
1. **Zero Auto-Rejection**: The engine **never** rejects a claim automatically or accuses an applicant. Overlaps are surfaced as clues requiring compassionate human inquiry.
2. **Non-Accusatory Wording**: All UI badges, labels, and API messages state `"shared address, needs review"` or `"photo similarity clue"`. Words like *"fraud"* or *"guilty"* are strictly forbidden.
3. **Zero Hardcoded Data**: No sample claims, mock counts, synthetic graphs, or hardcoded scores exist in source code. Every number, edge, node, and badge is computed live from the SQLite database via SQLAlchemy.
4. **Beneficiary Privacy & Audit Trail**: Sensitive values (Aadhaar, bank account numbers, phones) are masked by default (`XXXX-XXXX-3210`). Any unmasking triggers an immutable `AuditLog` entry.
5. **In-Memory Investigator Photo Matching**: Query images uploaded by investigators are hashed directly in-memory and **never written to disk**.

---

## 2. Architecture & Tech Stack

```
                   ┌────────────────────────────────────────┐
                   │          AidNexus Frontend             │
                   │   React 19 + Vite + Tailwind CSS v4    │
                   │  react-force-graph-2d + Lucide React   │
                   └──────────────────┬─────────────────────┘
                                      │ HTTP / REST
                                      ▼
                   ┌────────────────────────────────────────┐
                   │           FastAPI Backend              │
                   │   Direct Bcrypt + Python-JOSE JWT      │
                   └─────────┬────────────────────┬─────────┘
                             │                    │
              ┌──────────────▼─────┐       ┌──────▼──────────────┐
              │ Linking & Clue     │       │ SQLite Database     │
              │ Engine             │       │ (WAL Journaling     │
              │ - Normalizer       │       │  + Foreign Keys)    │
              │ - pHash (64-bit)   │       └─────────────────────┘
              │ - RapidFuzz Sim    │
              │ - NetworkX Graph   │
              └────────────────────┘
```

- **Backend**: Python 3.10+ / 3.14, FastAPI, SQLAlchemy 2.0, SQLite (WAL mode), `bcrypt`, `Pillow`, `imagehash` (perceptual hashing), `rapidfuzz` (Levenshtein & token sort ratio), `networkx` (connected components).
- **Frontend**: React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), `axios`, `react-router-dom` v7, `react-force-graph-2d`.
- **Security & Storage**: Local encrypted storage for evidence files, zero external paid dependencies required, optional Gemini entity extraction behind `GEMINI_ENABLED=false`.

---

## 3. User Personas & Features

### 1. Relief Coordinator (Admin)
- **Relief Communities**: Create and manage disaster initiatives with title, description, and status toggles.
- **Dynamic Schema Builder**: Custom household forms (`name`, `phone`, `address`, `id_number`, `bank_account`, `upi_id`, `photo`, `document`, `text`) with 1-click standard Indian disaster template.
- **Single-Use Access Codes**: Bulk generate cryptographically unguessable codes (`AID-XXXX-XXXX`), 1-click copy join links, and live code revocation.
- **Priority Queue**: Live ranking of linked household clusters sorted by cluster size and highest clue score.
- **Interactive Network Graph**: Visual graph of claims color-coded by clue score and links color-coded by match type (Phone: Emerald, Address: Amber, Photo: Purple, Bank: Blue, ID: Rose, Name: Cyan).
- **Claim Inspector**: Masked side-by-side claim comparison, unmasking with audit trail, and human review actions (*Confirm Clue*, *False Alarm*, *Needs Field Visit*, *Approve*).
- **Supplementary Requests**: Send document requests directly to applicants for additional proof.

### 2. Household Applicant (Beneficiary)
- **Redeem Single-Use Token**: Enter token code (`/join?code=AID-...`) to load the verified organizer's title and dynamic schema.
- **Mandatory Consent Authorization**: Explicit consent notice required before claim submission.
- **Dynamic Submission**: Direct multipart upload of damaged property photos and household data.
- **Status Tracking Portal**: Authenticated view showing verification status, read-only submitted details, and coordinator alerts.
- **Document Request Fulfillment**: Upload requested proof directly to resume review.

### 3. Verified Relief Investigator
- **Restricted Access**: Enforces `role == "investigator"` AND `is_verified == True`.
- **Zero-Disk Photo Search**: Query images are hashed in-memory to find matching damage photos across all disaster schemes (Hamming distance $\le 10$).
- **Cross-Scheme Search**: Query phone numbers, accounts, or addresses across all relief camps.
- **Investigation Ledger**: Every query is logged with a `SHA-256` hash and timestamp for legal accountability.

### 4. Public Donor
- **Public Directory**: Browse open relief initiatives with verified coordinator badges.
- **Verified Counts Only**: View computed approved household counts.
- **Direct Donation Channels**: Scan official coordinator donation QR codes.
- **Privacy Assurance**: Beneficiary personal identities are never exposed to donors.

---

## 4. Quickstart Guide

### Prerequisites
- Python 3.10+ (tested up to Python 3.14)
- Node.js 18+ and npm

### 1. Clone & Setup Backend
```bash
# Navigate to repository root
cd AidNexus

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
uvicorn backend.app.main:app --reload --port 8000
```
Backend API will be running at `http://127.0.0.1:8000` with interactive docs at `http://127.0.0.1:8000/docs`.

### 2. Setup & Run Frontend
```bash
# In a new terminal window
cd AidNexus/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend web application will be accessible at `http://localhost:5173`.

---

## 5. Seed Synthetic Demo Data

AidNexus includes a synthetic Indian demo data generator (`backend/scripts/generate_demo_data.py`) that plants multi-hop duplicate clusters through real API endpoints:

```bash
# Run standalone (auto-handles running dev server or in-process TestClient):
python backend/scripts/generate_demo_data.py --count 12
```

**Console Output Summary:**
```
============================================================
 AIDNEXUS SYNTHETIC DEMO DATA GENERATOR
============================================================
[*] Target Households: 12
[+] Generated 12 single-use access codes.
[+] All households submitted successfully through the API!

============================================================
 PLANTED DUPLICATES SUMMARY (CONSOLE ONLY)
 Compare this summary against the engine-discovered flags!
============================================================
 Total Households Created   : 12
 Planted Shared Phones      : 2
 Planted Shared Accounts    : 2
 Planted Shared Addresses   : 3
 Planted Shared ID Numbers  : 5
 Planted Exact File Photos  : 1
 Planted Edited Near Photos : 2
------------------------------------------------------------
 Admin Credentials For Demo :
   Email    : admin.disaster_XXX@relief.gov.in
   Password : AdminRelief2026!
   Community: #1 (Disaster Relief Initiative)
============================================================
```

Sign in with the generated admin credentials at `http://localhost:5173/login` to inspect the live network graph and review queue!

---

## 6. Running Automated Tests

Run the complete backend pytest suite (22 automated test cases):
```bash
python -m pytest backend/tests/ -v
```

**Test Coverage Summary:**
- `test_auth.py`: Direct bcrypt hashing, JWT validation, role dependencies, investigator verification check.
- `test_codes_and_join.py`: Dynamic schema building, single-use access code burning, consent enforcement, isolation, document request fulfillment, notification reading.
- `test_normalizer.py`: Phone numbers, address abbreviations (`st` $\to$ `street`, `ppo` $\to$ `post office`), Indian bank accounts, UPI VPAs, ID numbers, name dispatch.
- `test_stage1_analysis.py`: Perceptual hashing (Hamming XOR), OCR preprocessing, non-accusatory rule engine, capped score ($\le 100$).
- `test_linking_engine.py`: Inverted indexes, rarity weighting, hub skipping ($> 5$ occurrences), name gating.
- `test_investigator.py`: Unverified investigator rejection (403), in-memory photo matching, zero disk leakage verification, cross-community entity search, SHA-256 query ledger.
- `test_public.py`: Public donor endpoint privacy audit (zero claimant data leak), computed approved count verification.
- `test_generator.py`: Demo data generator end-to-end execution.

Validate frontend production bundle:
```bash
cd frontend
npm run build
```

---

## 7. Key API Endpoints

| Method | Endpoint | Access Role | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new user account |
| `POST` | `/auth/login` | Public | Authenticate and obtain JWT |
| `POST` | `/join` | Public | Validate single-use access code and fetch schema |
| `POST` | `/join/submit` | Public / Member | Submit household details and burn access code |
| `GET` | `/me/submission` | Member | View claim status, notifications, and document requests |
| `POST` | `/me/document-requests/{id}/fulfill` | Member | Upload requested supplementary evidence |
| `GET` | `/communities/mine` | Admin | List relief communities managed by coordinator |
| `POST` | `/communities` | Admin | Create new relief initiative |
| `PUT` | `/communities/{id}/fields` | Admin | Define dynamic household schema |
| `POST` | `/communities/{id}/codes` | Admin | Bulk generate single-use access codes |
| `POST` | `/codes/{id}/revoke` | Admin | Revoke an unused access code |
| `GET` | `/communities/{id}/stats` | Admin | Computed live statistics (claims, clues, codes) |
| `GET` | `/communities/{id}/queue` | Admin | Ranked connected clusters requiring review |
| `GET` | `/communities/{id}/network` | Admin | Force-directed NetworkX graph export |
| `POST` | `/submissions/{id}/review` | Admin | Human review action (confirm, false alarm, visit, approve) |
| `POST` | `/submissions/{id}/reveal/{value_id}` | Admin | Unmask sensitive value (logged in AuditLog) |
| `POST` | `/investigate/photo` | Verified Investigator | In-memory perceptual photo search across schemes |
| `GET` | `/investigate/search` | Verified Investigator | Cross-disaster search by phone/account/ID/address |
| `GET` | `/investigate/logs` | Verified Investigator | View cryptographic inquiry ledger |
| `GET` | `/public/communities` | Public | Browse open relief schemes (zero claimant data leak) |
| `GET` | `/public/communities/{id}` | Public | Public scheme detail and donation QR code |

---

## 8. License

Developed for the 2026 Hackathon under the MIT License.
AidNexus is designed strictly for fair, dignified, and human-centered disaster relief coordination.
