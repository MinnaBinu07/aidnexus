# AidNexus System Changes Log

This document provides a detailed breakdown of all fixes, security enhancements, architectural refactorings, and accessibility improvements applied across the AidNexus codebase, organized per file according to Phases 1 through 8.

---

## 1. Phase 1: API Connectivity & Error Standardization

### `frontend/src/api/client.js`
- **HTML Response Interceptor Guard:** Added an axios response interceptor that checks if the `content-type` header includes `text/html`. When an API endpoint responds with HTML (such as when SPA catch-alls or CDN fallbacks return `index.html`), the interceptor rejects with an explicit, actionable error message: `"API unreachable: received HTML instead of JSON. Check VITE_API_BASE_URL."`. This prevents silent 200 OK HTML responses from crashing React JSON consumers.
- **Global Unauthorized Event Dispatch:** Updated the 401 response interceptor to clear `localStorage` and dispatch `window.dispatchEvent(new Event('auth:unauthorized'))`.
- **Credential Endpoint Exclusion:** Fixed exclusion logic so that all `/auth/*` endpoints (including `/auth/login`, `/auth/register`, `/auth/token`) do not trigger the global unauthorized event on failed login attempts, preserving normal inline error displays.

### `frontend/src/utils/formatError.js`
- **Standardized Error Formatter (`formatApiError`):** Created a universal helper function to safely process diverse error shapes from Axios and FastAPI:
  - Interceptor HTML guard errors.
  - Axios network connection failures (`ERR_NETWORK`, `Network Error` -> `"Cannot reach server. Please check your internet connection."`).
  - FastAPI 422 validation error arrays: joins field-level `msg` strings into readable sentences.
  - Plain string `detail` objects.
  - Safe fallback default message when no server message exists.
  - Guarantees a string is returned, preventing objects from being passed as React children (which causes React runtime crashes).

### `frontend/vite.config.js`
- **Proxy Route Collision Fix:** Created a shared proxy configuration with a `bypass` function. Any browser page navigation requesting `Accept: text/html` (e.g. `/join`, `/investigate`, `/public`, `/auth`) returns `/index.html` to allow React Router client-side routing, while XHR and `fetch` requests are proxied to the backend API (`http://localhost:8000`).

### `.env.example` & `frontend/.env.example` & `frontend/README.md`
- **Environment Variable Documentation:** Documented `VITE_API_BASE_URL`, `VITE_CONTACT_EMAIL`, and `VITE_HOTLINE_PHONE`. Added explicit notices explaining that Vite bakes `VITE_*` environment variables at build time, requiring a rebuild and redeployment after updating configuration values in production (e.g., on Vercel).

---

## 2. Phase 2: Authentication & Route Protection

### `frontend/src/context/AuthContext.jsx`
- **Strict Login Validation:** Validated authentication payloads on login/register. If `access_token` or `user` is missing or invalid, an error is thrown; prevented saving the literal string `"undefined"` into `localStorage`.
- **Safe Profile Fetching (`initAuth`):** Prevented clearing sessions on transient network errors (status 0 or 5xx). `logout()` is only triggered on HTTP 401 or when the user object is structurally invalid.
- **Role Verification:** Exported `isAdmin`, `isMember`, and `isInvestigator` (which verifies both `user.role === 'investigator'` and `user.is_verified === true`).
- **Manual Session Setting:** Exported `setManualAuth(token, user)` allowing guest claimant submissions to seamlessly establish sessions without full-page reloads.
- **Unauthorized Event Listener:** Attached a listener for `auth:unauthorized` to invoke `logout()` and clear state cleanly.

### `frontend/src/App.jsx`
- **`ProtectedRoute` Implementation:** Created a robust `ProtectedRoute({ roles, children })` component that renders a loading spinner while authentication initializes, redirects unauthenticated users to `/login` preserving `location.state.from`, and redirects unauthorized roles to home `/`.
- **Granular Route Guarding:**
  - Protected `/admin`, `/admin/communities`, `/admin/fields`, `/admin/codes`, `/admin/network`, and `/admin/audit` with `['admin']`.
  - Protected `/status` with `['member']`.
  - Protected `/investigate` with `['investigator']`.
- **Route Merging:** Merged `/member/status` into `/status` using `<Navigate to="/status" replace />`.
- **404 Catch-All Page:** Replaced raw redirects with an accessible, branded 404 page featuring a link back to home.
- **Contact Modal State Lifting:** Lifted `contactOpen` state to `App` so the footer's "Contact" button properly opens the contact modal without broken DOM element lookups.
- **Institutional Pages:** Created routes and linked `/about`, `/help`, `/privacy`, and `/terms` using `<Link>`.
- **Footer Updates:** Restored the missing `©` symbol before "2026 AidNexus" and ensured mobile visibility of policy links.

### `frontend/src/pages/InstitutionalPages.jsx`
- Created dedicated placeholder pages (`AboutPage`, `HelpPage`, `PrivacyPage`, `TermsPage`) with semantic markup, back navigation, and consistent branding.

---

## 3. Phase 3: Navigation & Accessibility

### `frontend/src/components/Navbar.jsx`
- **Role-Aware Links:**
  - "My Communities" (`/admin/communities`) is now visible only to administrators (`isAdmin`).
  - "Investigator Mode" (`/investigate`) is now visible only to verified investigators (`isInvestigator`).
  - Added the missing "Field Builder" link (`/admin/fields`) to the administrator menu.
  - Removed duplicate "Donor Portal & Schemes" link that pointed to `/public/communities`.
- **Search Keyboard Shortcut:** Implemented a global `Ctrl+K` / `Cmd+K` keyboard listener that focuses the search input. Rendered OS-appropriate shortcut badges (`Cmd K` on Mac, `Ctrl K` on Windows/Linux).
- **Mobile Search:** Added a mobile search icon button that expands the search input bar on smaller screen viewports.
- **Semantic Profile Button:** Replaced the unsemantic clickable `div` with a real accessible `<button>` element.
- **Dialog Accessibility:**
  - Drawer and Contact Modal include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  - Implemented Escape key listeners to close open dialogs.
  - Implemented focus trapping and restoration of focus to the triggering element upon close.
  - Inactive drawer element marked with `aria-hidden="true"`.
- **Clipboard Feedback:** Replaced browser `alert()` with a smooth inline toast notification, wrapped in `try/catch` with fallback handling.
- **Prefix Route Matching:** Updated `isActive` to use prefix matching (e.g., `/public/communities/12` activates `/public/communities`).
- **Accurate Claims in Contact Modal:** Removed false claims such as "Encrypted Privacy Shield Guarantee" and replaced with truthful disclosures regarding email and phone communication channels. Added TODO comments to verify official production support addresses.
- **Removed Decorative Toggle:** Removed the disconnected language switch toggle (EN/മലയാളം).

---

## 4. Phase 4: Public Communities & Donor Portal

### `frontend/src/pages/PublicCommunities.jsx`
- **URL Synchronization:** Used `useSearchParams` to read `?q=` and synchronized the search bar input bidirectionally with URL query parameters.
- **Pagination Controls:** Implemented Previous and Next page controls with page index indicators, wiring requests to `getPublicCommunities(page, query)`.
- **Response Validation:** Validated `Array.isArray(data.items)` to prevent runtime crashes.
- **Clean Error & Empty States:** Hidden the "No communities found" empty state when an error is active; added a "Retry" button.
- **Removed Debug & Dead Code:** Removed the "Preview Empty State" debug toggle, dead `currentNavScope` state, and unused imports.
- **Corrected Badges:**
  - Replaced incorrect "Enrolled Member" badge on verified admins with "Verified Coordinator".
  - Replaced misleading checkmark on unverified communities with a neutral "Unverified" indicator.
  - Made drawer verification status conditional on actual community metadata.
- **Filter Renaming:** Renamed "Needs Funding" filter to "Accepts Donations" (reflecting QR availability).
- **Cleaned Data Displays:** Removed duplicate location chip displaying `comm.title`; removed inaccurate "Registry sync: REALTIME" and cryptographic ledger claims.
- **QR Modal Enhancements:** Constructed full QR image URLs using `VITE_API_BASE_URL` for relative paths, added descriptive alt text, and added prominent donor advisory: *"Verify the payee before sending money. AidNexus does not process or guarantee payments."*
- **Modal Accessibility:** Added `role="dialog"`, `aria-modal="true"`, Escape key listeners, and `aria-label` attributes to dialog controls.

---

## 5. Phase 5: Member Claim Submission (`/join`)

### `frontend/src/pages/MemberJoin.jsx`
- **Removed Demo Code Flow:** Deleted `getActiveDemoCode`, `fetchAndSetDemoCode`, test access code autofill buttons, and automatic URL validation bypass.
- **Removed Fake Photo Generation:** Deleted `createSampleImageFile`, `fallbackPhoto`, and test data auto-populators from the production interface.
- **Dynamic Field Criteria:** Replaced hardcoded Aadhaar/UPI lists with dynamic rendering derived directly from the community's `required_fields`.
- **Per-Field File Uploads:** Rendered an independent file input for each `photo` and `document` field, preventing single uploads from being shared across all criteria. Added file size limit and MIME type validation.
- **Form Validation:** Enforced that all `is_required` fields have values or attached files before allowing claim submission. Error alert lists specific missing field labels.
- **Guest Authentication & Session Persistence:** Guest applicants creating credentials now seamlessly transition into authenticated member sessions via `setManualAuth(token, user)` without clobbering existing admin or investigator credentials.
- **Credential Requirements:** Enforced minimum password length of 6 characters, preserved untrimmed password characters, and required contact identifiers (email or phone) for guest claim recovery.
- **Semantic Forms & StrictMode Guard:** Wrapped claim steps in semantic `<form>` elements with Enter key submission support. Added a ref guard to prevent React StrictMode double-executions from prematurely redeeming single-use access codes.
- **Accurate Confirmation Screen:** Rendered claim IDs and status only when returned by the API; removed deceptive "ENCRYPTED & AUDITED" stamps.

---

## 6. Phase 6: Member Status Claim Tracking (`/status`)

### `frontend/src/pages/MemberStatus.jsx`
- **Response Validation:** Validated that API payload is a valid object containing a string `status` before rendering, preventing crashes on invalid responses.
- **Error Precedence:** Rendered error alerts before the empty state. Network errors and 5xx responses now show an error banner with a Retry button rather than claiming "No Active Relief Claim".
- **Client-Side Navigation:** Replaced raw `window.location.href = '/join'` with React Router `navigate('/join')`.
- **Comprehensive Status Handling:** Added explicit status banners for `approved`, `pending`, `info_requested`, and `rejected`, providing clear coordinator contact and appeal guidance.
- **Silent Background Refreshes:** Marking notifications as read and fulfilling requested documents now execute background refreshes without flashing the entire page loading spinner.
- **Upload Reset & Validation:** Reset file input state using dynamic keys upon completion; added MIME type and size checks with `aria-live` status regions.
- **Data Fallbacks:** Handled invalid date parsing safely, rendered proper labels for `document` uploads, and defaulted `masked_value` nulls to `"—"`.

---

## 7. Phase 7: Global Styles, Metadata & Assets

### `frontend/index.html`
- Added comprehensive Open Graph metadata (`og:title`, `og:description`, `og:image`).
- Added meta description and `theme-color` meta tag.
- Added `<noscript>` accessibility warning for JavaScript-disabled environments.
- Added `&display=block` to Google Material Symbols web font stylesheet.

### `frontend/src/index.css`
- Added fallback rules and `font-display: block` for `.material-symbols-outlined` to prevent icon ligature names from flashing as plain text before font loads.

### `frontend/package.json`
- Removed unused `postcss` and `autoprefixer` dependencies (unnecessary under `@tailwindcss/vite`).

### Visual Contrast & Layout Polish
- Upgraded footer copyright text contrast to `#3d2f32` to meet WCAG AA contrast guidelines.
- Verified `<main>` bottom padding (`pb-24`) to ensure the fixed bottom bar does not obscure content on mobile devices.

---

## 8. Phase 8: Comprehensive Audit of Remaining Pages

### `frontend/src/pages/Landing.jsx`
- Removed hardcoded credentials (`admin@aidnexus.org` / `AidNexus2026!`) and mock OTP code `742915`.
- Supported URL parameter `?action=create` to trigger the relief program wizard cleanly.
- Integrated `formatApiError` in all catch blocks.
- Added Escape key listeners, focus trapping, and clipboard copy feedback.

### `frontend/src/pages/PublicCommunityDetail.jsx`
- Replaced raw error strings with `formatApiError`.
- Replaced `window.location.href` with React Router `navigate`.
- Added donor payment advisory on donation QR codes.
- Replaced misleading cryptographic claims with truthful data protection descriptions.

### `frontend/src/pages/AdminDashboard.jsx`
- Added Previous and Next pagination controls for community submissions.
- Replaced raw errors with `formatApiError`.
- Wrapped community data fetching in `useCallback` to prevent cascading render loops.
- Added dialog accessibility to the Quick Access Code modal.

### `frontend/src/pages/AdminCommunities.jsx`
- Added missing imports (`CheckCircle`, `CheckCircle2`) from `lucide-react`.
- Wrapped `loadCommunities` in `useCallback` positioned before `useEffect`.
- Integrated `formatApiError` across all actions.
- Added Escape key handler for the creation dialog.

### `frontend/src/pages/AdminFieldBuilder.jsx`
- Added missing imports (`CheckCircle2`, `Wand2`) from `lucide-react`.
- Wrapped `loadCommunities` and `loadFields` in `useCallback` positioned before `useEffect`.
- Standardized error handling with `formatApiError`.

### `frontend/src/pages/AdminCodeGenerator.jsx`
- Removed unused imports (`Share2`).
- Wrapped `loadCommunities` and `loadCodes` in `useCallback` positioned before `useEffect`.
- Wrapped clipboard copy in `try/catch` with inline feedback.
- Integrated `formatApiError` across all actions.

### `frontend/src/pages/AdminNetworkView.jsx`
- Wrapped `loadCommunities` and `loadNetworkAndClusters` in `useCallback` positioned before `useEffect`.
- Cleaned unused icon imports and standardized error handling with `formatApiError`.

### `frontend/src/pages/AdminAuditLog.jsx`
- Wrapped `loadCommunities` and `loadLogs` in `useCallback` positioned before `useEffect`.
- Displayed `totalLogs` in the event registry count.
- Removed unused `FileText` import and standardized error handling with `formatApiError`.

### `frontend/src/pages/InvestigatorPortal.jsx`
- Removed unused imports (`ErrorAlert`, `LoadingSpinner`).
- Wrapped `loadLogs` in `useCallback` positioned before `useEffect`.
- Enforced verification check (`isInvestigator`) before querying.
- Standardized error handling with `formatApiError`.

### `frontend/src/components/SubmissionDetailModal.jsx`
- Standardized all error displays with `formatApiError`.
- Added Escape key listener and accessible dialog attributes.

### `frontend/src/components/FeedbackComponents.jsx`
- Enhanced `LoadingSpinner` and `EmptyState` prop signatures to support flexible prop names (`message`/`label`, `title`/`heading`, `description`/`message`, `onAction`/`actionText`).

### `backend/app/main.py`
- Updated CORS configuration to explicitly whitelist `https://aidnexus-nu.vercel.app` along with localhost origins and `FRONTEND_URL` environment variables, enabling `allow_credentials=True` without wildcard header rejections.
