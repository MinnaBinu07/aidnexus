from typing import Optional

def mask_sensitive_value(raw: Optional[str], field_type: str = "") -> str:
    """
    Masks sensitive values by default:
    - ID, Account, UPI, Phone: shows only last 4 characters
    - Address: shows first 6 chars + ... + last 4 chars
    - Name: keeps first letter of each word and masks remainder
    """
    if not raw:
        return ""
    text = str(raw).strip()
    ft = (field_type or "").lower()

    if ft in ["phone", "id_number", "bank_account", "upi_id"]:
        if len(text) <= 4:
            return "*" * len(text)
        return f"{'*' * (len(text) - 4)}{text[-4:]}"
    elif ft == "address":
        if len(text) <= 12:
            return f"...{text[-4:]}" if len(text) >= 4 else "****"
        return f"{text[:6]}...{text[-4:]}"
    elif ft == "name":
        words = text.split()
        masked_words = [f"{w[0]}{'*' * (len(w) - 1)}" if len(w) > 1 else w for w in words]
        return " ".join(masked_words)
    else:
        # For general sensitive text, mask middle
        if len(text) <= 4:
            return "****"
        return f"{text[:2]}...{text[-2:]}"
