"""
AidNexus All-in-One Runner Script
Starts both the FastAPI backend (port 8000) and the Vite frontend (port 5173).
"""

import sys
import subprocess
import time
import os
import signal
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"

def main():
    print("=" * 60)
    print("  Starting AidNexus (Backend + Frontend)")
    print("=" * 60)

    # 1. Start FastAPI backend
    print("\n[*] Starting FastAPI backend on http://127.0.0.1:8000 ...")
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.app.main:app",
        "--port",
        "8000",
        "--reload"
    ]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT_DIR),
        env=os.environ.copy()
    )

    # Brief delay for backend to initialize
    time.sleep(1.5)

    # 2. Start Vite frontend
    print("\n[*] Starting Vite frontend on http://localhost:5173 ...")
    # Use npm.cmd on Windows, npm on Unix
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        env=os.environ.copy()
    )

    print("\n" + "=" * 60)
    print("  AidNexus is running!")
    print("  - Frontend UI : http://localhost:5173")
    print("  - Backend API : http://127.0.0.1:8000")
    print("  - API Docs    : http://127.0.0.1:8000/docs")
    print("=" * 60)
    print("Press Ctrl+C to stop both servers.\n")

    def shutdown(signum, frame):
        print("\n[*] Shutting down AidNexus servers...")
        try:
            frontend_proc.terminate()
        except Exception:
            pass
        try:
            backend_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            # Check if either process terminated unexpectedly
            b_ret = backend_proc.poll()
            f_ret = frontend_proc.poll()
            if b_ret is not None:
                print(f"[!] Backend process exited with code {b_ret}")
                frontend_proc.terminate()
                break
            if f_ret is not None:
                print(f"[!] Frontend process exited with code {f_ret}")
                backend_proc.terminate()
                break
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown(None, None)

if __name__ == "__main__":
    main()
