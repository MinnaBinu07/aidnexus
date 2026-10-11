# AidNexus Backend Required Changes & Security Recommendations

This document outlines backend enhancements, security improvements, and infrastructure adjustments needed to complement the frontend updates.

---

## 1. Production CORS & Authorization Headers

### Current State
`backend/app/main.py` has been updated with explicit origins:
```python
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://aidnexus-nu.vercel.app",
]
frontend_env = os.getenv("FRONTEND_URL")
if frontend_env and frontend_env not in origins:
    origins.append(frontend_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
```

### Action Required
1. Ensure the production deployment environment (e.g. Render, Railway, or AWS) specifies `FRONTEND_URL=https://aidnexus-nu.vercel.app` in its production environment variables.
2. In production API gateways or reverse proxies (Nginx, Traefik, Cloudflare), verify that preflight `OPTIONS` requests are passed through with `Access-Control-Allow-Headers: Authorization, Content-Type, Accept` and that credentials mode is supported.

---

## 2. Removal / Hardening of `/public/demo-code` Endpoint

### Current State
`backend/app/api/public.py` currently gates the endpoint with:
```python
is_dev = os.getenv("ENVIRONMENT", "development").lower() in ("development", "dev", "test")
if not is_dev:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Demo code endpoint is disabled in production."
    )
```

### Action Required
1. **Complete Removal in Production:** For security compliance, consider completely removing the endpoint in production builds or ensuring that `ENVIRONMENT=production` is strictly enforced.
2. The endpoint should never be mounted in production routers to eliminate attack surface.

---

## 3. Server-Side Role Enforcement Audit

### Current Status
All administrative and investigator endpoints require server-side token validation and role checks via FastAPI dependencies in `backend/app/core/security.py`:
- `require_admin`: Verifies `current_user.role == "admin"`.
- `require_member`: Verifies `current_user.role == "member"`.
- `require_investigator`: Verifies `current_user.role == "investigator"` AND `current_user.is_verified is True`.
- Community endpoints verify tenant ownership (`community.admin_id == admin.id`).

### Action Required
1. **Periodic Route Audit:** Ensure all newly added routes explicitly declare dependency guards (`Depends(require_admin)` or `Depends(require_investigator)`).
2. **Rate Limiting:** Implement route-level rate limiting (`slowapi` or Redis token bucket) on sensitive endpoints:
   - `/auth/login` (prevent brute-force password guessing).
   - `/auth/register` (prevent automated account spam).
   - `/join` (prevent brute-forcing of single-use access codes).
   - `/investigate/*` (prevent bulk scraping of hashed entity clusters).

---

## 4. Persistent File Storage for Uploads (S3 / Cloudflare R2)

### Current Problem
Currently, `backend/app/core/config.py` saves files to local disk under `UPLOAD_DIR` (`./uploads/`):
- Serverless hosts (e.g., Render, Railway free tiers, Heroku, AWS ECS without EBS) use ephemeral filesystems.
- Whenever the container restarts or redeploys, all uploaded evidence documents, disaster photos, and community QR codes are permanently lost.

### Action Required
1. Migrate file storage from local filesystem to an S3-compatible object store (e.g., AWS S3, Cloudflare R2, or Google Cloud Storage).
2. Store documents and photos as private buckets with short-lived presigned URLs for authorized viewing:
   - Evidence photos and documents must only be accessible to community coordinators and verified investigators.
   - Public community QR codes can remain in a public bucket or CDN endpoint.
3. Replace disk file paths in `models.Evidence.file_path` and `models.Community.qr_image_path` with canonical object storage keys (e.g. `evidence/{submission_id}/{uuid}.jpg`).

---

## 5. `/join` Claim Submission & Account Linking

### Current Architecture
- `POST /join` validates the access code, returns dynamic community requirements, and checks expiration.
- `POST /join/submit` handles multipart form data containing dynamic fields, password, and files, creates a member account, marks the access code redeemed, and returns an access token.

### Recommendations
1. **Atomic Transaction Scope:** Ensure the transaction wrapping user creation, membership creation, submission value insertion, and access code status update (`status="redeemed"`) is strictly transactional (`db.begin() ... db.commit()`) with immediate rollback on validation failure.
2. **Duplicate Detection:** Ensure phone numbers or emails provided during guest claims do not cause unhandled integrity errors if an inactive account already exists; provide account recovery links.
3. **Async File Processing:** Verify background analysis tasks (`run_stage1_analysis_task`) run via a dedicated task queue (Celery, ARQ, or Redis Queue) rather than FastAPI in-process `BackgroundTasks` so heavy hashing does not block the web server event loop.

---

## 6. Authentication Token Storage: `localStorage` vs. `httpOnly` Cookies

### Evaluation & Security Tradeoffs

| Factor | Current: `localStorage` | Recommended: `httpOnly` Cookies |
| :--- | :--- | :--- |
| **XSS Vulnerability** | High: Any Cross-Site Scripting (XSS) vulnerability allows malicious scripts to extract the JWT token directly. | Low: Scripts cannot access `httpOnly` cookies via `document.cookie`. |
| **CSRF Vulnerability** | Low: Browsers do not automatically attach `Authorization: Bearer <token>` to cross-origin requests. | Requires Mitigation: Browsers automatically attach cookies to cross-site requests unless `SameSite=Lax` or `SameSite=Strict` and anti-CSRF tokens are enforced. |
| **Cross-Domain Setup** | Easy: Frontend on `https://aidnexus-nu.vercel.app` and API on a separate domain (e.g., `https://api.aidnexus.org`) communicate freely via request headers. | Requires Shared Domain: Sharing cookies between Vercel and third-party backend requires common apex domain (e.g. `app.aidnexus.org` and `api.aidnexus.org`) with `Domain=.aidnexus.org; Secure; SameSite=None`. |
| **Mobile & Native Clients** | Seamless: Standard Bearer tokens work across mobile web, Android/iOS wrappers, and desktop clients. | Requires cookie jar management in non-browser clients. |

### Conclusion & Recommendation
- **Current Approach:** For the decoupled deployment (`frontend` on Vercel domain, backend on separate domain), Bearer token in `localStorage` is standard and avoids cross-site cookie restrictions in Safari/Brave.
- **Future Hardening:** Once a custom unified domain (e.g., `aidnexus.org`) is provisioned:
  1. Transition the JWT to a secure `httpOnly`, `SameSite=Lax`, `Secure` cookie issued by `/auth/login`.
  2. Implement a Double-Submit Cookie or CSRF-Token header (`X-CSRF-Token`) on all state-mutating requests (`POST`, `PUT`, `DELETE`).
  3. Implement refresh token rotation with a short JWT expiry (15 minutes for access tokens, 7 days for httpOnly refresh tokens).
