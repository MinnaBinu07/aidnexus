"""Optional Gemini entity extraction hook (Default: OFF)."""
import json
from typing import Optional, Dict
from backend.app.core import config

_ENTITY_CACHE: Dict[str, dict] = {}

def extract_entities_if_enabled(ocr_text: str, file_sha256: str) -> Optional[dict]:
    """
    If GEMINI_ENABLED=true in config and valid API key provided,
    extracts entities from OCR text of ambiguous documents.
    Results are cached by file SHA-256.
    If GEMINI_ENABLED is False, returns None immediately.
    """
    if not config.GEMINI_ENABLED or not config.GEMINI_API_KEY:
        return None

    if file_sha256 in _ENTITY_CACHE:
        return _ENTITY_CACHE[file_sha256]

    try:
        # Only import if enabled
        import urllib.request
        prompt = (
            f"Extract name, id_number, and address from this OCR text as JSON. "
            f"Text: {ocr_text[:1000]}"
        )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={config.GEMINI_API_KEY}"
        data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            _ENTITY_CACHE[file_sha256] = res_json
            return res_json
    except Exception:
        return None
