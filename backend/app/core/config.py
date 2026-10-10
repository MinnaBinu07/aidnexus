import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'aidnexus.db'}")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-aidnexus-hackathon-key-change-in-production-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

TESSERACT_CMD = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_ENABLED = os.getenv("GEMINI_ENABLED", "false").lower() == "true"

MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

# Engine Thresholds and Weights (Zero hardcoded values in analysis code)
PHASH_HAMMING_CUTOFF = 10  # Hamming distance <= 10 considered near duplicate
PHASH_HAMMING_THRESHOLD = PHASH_HAMMING_CUTOFF
ADDRESS_FUZZY_RATIO_CUTOFF = 85.0
OCR_NAME_FUZZY_RATIO_CUTOFF = 70.0
OCR_ID_FUZZY_RATIO_CUTOFF = 80.0
HUB_LIMIT = 5  # Values shared by > HUB_LIMIT submissions treated as common location note
FLAG_THRESHOLD = 30.0  # Combined score >= 30 flagged for human review

WEIGHT_EXACT_FILE = 40.0
WEIGHT_SIMILAR_PHOTO = 30.0
WEIGHT_SHARED_PHONE = 35.0
WEIGHT_SHARED_BANK = 40.0
WEIGHT_SHARED_UPI = 35.0
WEIGHT_SHARED_ID_NUMBER = 40.0
WEIGHT_SHARED_ADDRESS = 25.0
WEIGHT_SHARED_NAME = 10.0  # Only counts if another field also matches
WEIGHT_OCR_MISMATCH = 25.0
WEIGHT_MISSING_REQUIRED = 15.0

# Dictionary of address abbreviations to expand during normalization
ADDRESS_ABBREVIATIONS = {
    "st": "street",
    "rd": "road",
    "ave": "avenue",
    "blvd": "boulevard",
    "dr": "drive",
    "ln": "lane",
    "ppo": "post office",
    "po": "post office",
    "apt": "apartment",
    "fl": "floor",
    "opp": "opposite",
    "nr": "near",
    "dist": "district",
    "sec": "sector",
    "plot": "plot",
    "no": "number",
    "flat": "flat",
    "col": "colony",
    "hno": "house number",
    "vill": "village"
}
