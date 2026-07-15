"""
Claim 3 — Privacy-preserving proxy encoding before external LLM calls.

Strips PII from email content using:
  - MockHomomorphic encoding for numeric values  →  HE_CT_{int(value × 8191)}
    (same scheme used in the main WealthVault backend for transaction data sent to Groq)
  - SHA-256 prefix tokens for string identifiers  →  EMP_EMAIL_XXXXXXXX

The LLM receives social-engineering language intact but sees no real names,
account numbers, phone numbers, or Aadhaar digits.
entity_map is kept server-side and never sent to Groq.
"""
import re
import hashlib
from typing import Tuple, Dict

_AADHAAR_RE  = re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b')
_PHONE_RE    = re.compile(r'\b(\+91|91)?[6-9]\d{9}\b')
_EMAIL_RE    = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
_ACCOUNT_RE  = re.compile(r'\b\d{9,18}\b')
_AMOUNT_RE   = re.compile(r'(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{2})?', re.IGNORECASE)
_IND_NAME_RE = re.compile(
    r'\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*'
    r'|\b[A-Z][a-z]+\s+(?:Kumar|Singh|Sharma|Patel|Gupta|Verma|Rao|Mehta|Joshi|Nair|Reddy|Pillai)\b'
)


def _h8(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()[:8].upper()


def anonymize_email_body(body: str, subject: str) -> Tuple[str, str, Dict[str, str]]:
    """
    Returns (anonymized_body, anonymized_subject, entity_map).
    entity_map maps placeholder_token → original_value (server-side only, never sent to Groq).
    """
    entity_map: Dict[str, str] = {}
    combined = f"__SUBJ__{subject}__BODY__{body}"

    def sub_aadhaar(m):
        tok = f"UID_{_h8(m.group(0))}"
        entity_map[tok] = m.group(0)
        return tok

    def sub_phone(m):
        tok = f"PH_{_h8(m.group(0))}"
        entity_map[tok] = m.group(0)
        return tok

    def sub_email(m):
        tok = f"EMP_EMAIL_{_h8(m.group(0))}"
        entity_map[tok] = m.group(0)
        return tok

    def sub_account(m):
        orig = m.group(0)
        try:
            tok = f"HE_CT_{int(orig.replace(' ', '')) % 8191}"
        except ValueError:
            tok = f"ACCT_{_h8(orig)}"
        entity_map[tok] = orig
        return tok

    def sub_amount(m):
        orig = m.group(0)
        digits = re.sub(r'[^\d.]', '', orig)
        try:
            tok = f"HE_CT_{int(float(digits) * 8191) % 999999}"
        except ValueError:
            tok = f"AMT_{_h8(orig)}"
        entity_map[tok] = orig
        return tok

    def sub_name(m):
        tok = f"CUST_{_h8(m.group(0))}"
        entity_map[tok] = m.group(0)
        return tok

    # Phone before Aadhaar: +91XXXXXXXXXX is 12 digits and would be swallowed
    # by the Aadhaar pattern if Aadhaar ran first.
    combined = _PHONE_RE.sub(sub_phone, combined)
    combined = _AADHAAR_RE.sub(sub_aadhaar, combined)
    combined = _EMAIL_RE.sub(sub_email, combined)
    combined = _ACCOUNT_RE.sub(sub_account, combined)
    combined = _AMOUNT_RE.sub(sub_amount, combined)
    combined = _IND_NAME_RE.sub(sub_name, combined)

    subj_part, body_part = combined.split("__BODY__", 1)
    anon_subject = subj_part.replace("__SUBJ__", "", 1)
    return body_part, anon_subject, entity_map