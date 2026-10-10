import pytest
from backend.app.engine.normalizer import (
    normalize_phone,
    normalize_address,
    normalize_bank_account,
    normalize_upi_id,
    normalize_id_number,
    normalize_name,
    normalize_field
)

def test_normalize_phone():
    # Leading +91
    assert normalize_phone("+91 98765 43210") == "9876543210"
    # Leading 0
    assert normalize_phone("09876543210") == "9876543210"
    # With hyphens, dots, parentheses
    assert normalize_phone("(987) 654-3210") == "9876543210"
    assert normalize_phone("987.654.3210") == "9876543210"
    # Raw 10 digits
    assert normalize_phone("9876543210") == "9876543210"
    # Empty / None
    assert normalize_phone("") == ""
    assert normalize_phone(None) == ""

def test_normalize_address():
    # Lowercase, punctuation stripped, abbreviations expanded
    raw = "Plot No. 42, 2nd Main Rd., Near P.P.O., Indiranagar St."
    normalized = normalize_address(raw)
    assert "road" in normalized
    assert "post office" in normalized
    assert "street" in normalized
    assert "number" in normalized
    assert "." not in normalized
    assert "," not in normalized
    # Collapsed whitespace
    assert "  " not in normalized

    # Another address
    raw2 = "Flat 302, Green Apt, Opp Police Station, 4th Fl"
    norm2 = normalize_address(raw2)
    assert "apartment" in norm2
    assert "opposite" in norm2
    assert "floor" in norm2

def test_normalize_bank_account():
    assert normalize_bank_account("  1234 - 5678 - 9012 ") == "123456789012"
    assert normalize_bank_account("sbi-0012345-a") == "SBI0012345A"
    assert normalize_bank_account(None) == ""

def test_normalize_upi_id():
    assert normalize_upi_id("  ramesh.kumar@okhdfcbank ") == "RAMESH.KUMAR@OKHDFCBANK"
    assert normalize_upi_id("john-doe @ ybl") == "JOHNDOE@YBL"
    assert normalize_upi_id(None) == ""

def test_normalize_id_number():
    assert normalize_id_number(" 1234 - 5678 - 9012 ") == "123456789012"
    assert normalize_id_number("abc-xy-1234") == "ABCXY1234"
    assert normalize_id_number(None) == ""

def test_normalize_name():
    # Titles stripped
    assert normalize_name("Mr. Ramesh Kumar") == "ramesh kumar"
    assert normalize_name("Dr. Priya Sharma, Ph.D.") == "priya sharma phd"
    assert normalize_name("  Smt. Sunita Devi  ") == "sunita devi"
    assert normalize_name("Late Rajesh Patel") == "rajesh patel"
    assert normalize_name("Prof. Amit Verma") == "amit verma"
    assert normalize_name(None) == ""

def test_normalize_field_dispatch():
    assert normalize_field("phone", "+91 9123456780") == "9123456780"
    assert normalize_field("address", "MG Rd.") == "mg road"
    assert normalize_field("id_number", "id-1234") == "ID1234"
    assert normalize_field("name", "Mr. John Doe") == "john doe"
    assert normalize_field("text", "  Hello   World  ") == "Hello World"
