import re
from typing import Optional
from backend.app.core import config

TITLES_PATTERN = re.compile(
    r"\b(mr|mrs|ms|miss|dr|prof|shri|shrimati|smt|md|late)\b\.?",
    re.IGNORECASE
)

def normalize_phone(raw: Optional[str]) -> str:
    """
    Normalizes phone number:
    - strips all non-digit characters
    - drops leading +91 / 0
    - keeps last 10 digits
    """
    if not raw:
        return ""
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("91") and len(digits) > 10:
        digits = digits[2:]
    while digits.startswith("0") and len(digits) > 10:
        digits = digits[1:]
    return digits[-10:] if len(digits) >= 10 else digits

def normalize_address(raw: Optional[str]) -> str:
    """
    Normalizes residential address:
    - lowercase
    - strip punctuation (preserving internal acronym dots like p.p.o. -> ppo)
    - expand common abbreviations from config dictionary
    - collapse multiple spaces
    """
    if not raw:
        return ""
    text = str(raw).lower()
    # Collapse acronym dots like p.p.o. -> ppo
    text = re.sub(r"(?<=\w)\.(?=\w)", "", text)
    # Replace remaining punctuation with single space
    text = re.sub(r"[^\w\s]", " ", text)
    tokens = text.split()
    expanded_tokens = [config.ADDRESS_ABBREVIATIONS.get(tok, tok) for tok in tokens]
    return " ".join(expanded_tokens)

def normalize_bank_account(raw: Optional[str]) -> str:
    """
    Normalizes bank account number:
    - strips spaces and dashes
    - uppercase
    """
    if not raw:
        return ""
    return re.sub(r"[\s\-]", "", str(raw)).upper()

def normalize_upi_id(raw: Optional[str]) -> str:
    """
    Normalizes UPI ID:
    - strips spaces and dashes
    - uppercase
    """
    if not raw:
        return ""
    return re.sub(r"[\s\-]", "", str(raw)).upper()

def normalize_id_number(raw: Optional[str]) -> str:
    """
    Normalizes ID number (Aadhaar, Voter ID, Ration card, etc.):
    - strips spaces and dashes
    - uppercase
    """
    if not raw:
        return ""
    return re.sub(r"[\s\-]", "", str(raw)).upper()

def normalize_name(raw: Optional[str]) -> str:
    """
    Normalizes applicant name:
    - lowercase
    - strip honorific titles (mr, mrs, dr, etc.)
    - strip punctuation (preserving internal acronym dots like ph.d. -> phd)
    - collapse whitespace
    """
    if not raw:
        return ""
    text = str(raw).lower()
    # Remove honorific titles
    text = TITLES_PATTERN.sub("", text)
    # Collapse acronym dots like ph.d. -> phd
    text = re.sub(r"(?<=\w)\.(?=\w)", "", text)
    # Remove punctuation
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())

def normalize_field(field_type: str, raw_value: Optional[str]) -> str:
    """
    Dispatches to field-specific normalizer based on field_type.
    """
    if raw_value is None:
        return ""
    ft = (field_type or "").lower().strip()
    if ft == "phone":
        return normalize_phone(raw_value)
    elif ft == "address":
        return normalize_address(raw_value)
    elif ft == "bank_account":
        return normalize_bank_account(raw_value)
    elif ft == "upi_id":
        return normalize_upi_id(raw_value)
    elif ft == "id_number":
        return normalize_id_number(raw_value)
    elif ft == "name":
        return normalize_name(raw_value)
    else:
        # Default for text/other scalar fields
        return " ".join(str(raw_value).strip().split())
