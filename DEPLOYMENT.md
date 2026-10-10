# AidNexus Cloud Deployment Guide

This guide walks you through deploying **AidNexus**:
- **Backend (FastAPI)** on [Render](https://render.com) or [Railway](https://railway.app)
- **Frontend (React + Vite)** on [Vercel](https://vercel.com)

---

## Part 1: Deploy Backend (Render or Railway)

### Option A: Deploy on Render (Recommended)

1. Push your code to your GitHub / GitLab repository.
2. Log in to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Select your AidNexus repository. Render will automatically detect [`render.yaml`](./render.yaml).
5. Click **Apply**. Render will:
   - Create the `aidnexus-api` web service.
   - Attach a 1 GB persistent disk for your SQLite database and evidence uploads.
   - Install dependencies and start Uvicorn.
6. Once deployed, copy your backend URL (e.g. `https://aidnexus-api.onrender.com`).

*Manual Render Web Service Settings (if not using Blueprint):*
- **Environment**: Python
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**:
  - `JWT_SECRET`: *(Generate a secure random string)*
  - `UPLOAD_DIR`: `/var/data/uploads`
  - `DATABASE_URL`: `sqlite:////var/data/aidnexus.db`
- **Disks**: Add 1 GB disk mounted to `/var/data`.

---

### Option B: Deploy on Railway

1. Log in to [railway.app](https://railway.app) and create a **New Project**.
2. Select **Deploy from GitHub repo** and choose your repository.
3. Railway automatically detects [`railway.json`](./railway.json) or [`Dockerfile`](./Dockerfile).
4. Under **Variables**, add:
   - `JWT_SECRET`: *(A random secret string)*
   - `PORT`: `8000`
5. In **Settings** → **Networking**, click **Generate Domain** to get your public API URL (e.g. `https://aidnexus-production.up.railway.app`).

---

## Part 2: Deploy Frontend on Vercel

1. Log in to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Import your GitHub repository.
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: Select `frontend` (or leave as `./` with our root `vercel.json`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: Your live backend URL from Part 1 (e.g. `https://aidnexus-api.onrender.com`)
   *(Note: Do not include a trailing slash)*
5. Click **Deploy**.

Vercel will build and deploy the React frontend in ~30 seconds and provide a global CDN URL (e.g. `https://aidnexus.vercel.app`).

---

## Part 3: Verification & Health Check

1. **Verify Backend Health**:
   Visit `https://YOUR-BACKEND-URL/health` in your browser. You should receive:
   ```json
   {"status":"healthy","service":"AidNexus","database":"sqlite_wal"}
   ```
2. **Interactive API Documentation**:
   Visit `https://YOUR-BACKEND-URL/docs` to test Swagger API endpoints directly.
3. **Frontend Connection**:
   Open your Vercel URL. Browse communities, register a community, or submit a claim to verify end-to-end cloud communication.
