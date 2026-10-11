# AidNexus Frontend (React 19 + Vite + Tailwind CSS v4)

Civil disaster verification and autonomous relief protocol frontend.

## Environment Variables Note

> **Important**: Vite bakes all variables prefixed with `VITE_` (such as `VITE_API_BASE_URL`, `VITE_CONTACT_EMAIL`, and `VITE_HOTLINE_PHONE`) into the client JavaScript bundle **at build time**. If you update these environment variables in your deployment environment (e.g. Vercel, Netlify, Docker), a **full rebuild and redeploy** is required for the changes to take effect.

Refer to `.env.example` for variable definitions:
- `VITE_API_BASE_URL`: Base URL for the FastAPI backend (e.g. `http://127.0.0.1:8000` or production backend domain). When deploying on Vercel where the backend is hosted elsewhere, this MUST be set to prevent requests hitting the static host and returning HTML.
- `VITE_CONTACT_EMAIL`: Institutional support email displayed in contact modals and mailto links.
- `VITE_HOTLINE_PHONE`: Priority disaster relief phone number displayed in contact modals and tel links.

## Scripts

- `npm run dev`: Start Vite development server with proxying
- `npm run build`: Production build with Vite
- `npm run lint`: Fast code linting with Oxlint
- `npm run preview`: Preview production build
