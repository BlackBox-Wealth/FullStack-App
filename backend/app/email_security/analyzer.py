"""
Claim 2 — Multilingual phishing/social-engineering detection (EN / HI / PA).
Claim 3 — Anonymizes PII before sending content to Groq.

Pipeline:
  anonymize_email_body()  →  script detection  →  Groq LLM  →  EmailRiskResult
  (fallback to keyword heuristics if Groq is unavailable)
"""
import json
import re
from groq import Groq
from app.core.config import settings
from app.email_security.models import EmailRiskFlag, EmailRiskLevel, EmailRiskResult
from app.email_security.anonymizer import anonymize_email_body

_PROMPT = """You are a bank email security system analyzing an incoming employee email for social engineering and phishing.

Detect these threat categories:
- urgency: Artificial time pressure ("act immediately", "expires today", "अभी", "ਤੁਰੰਤ", "block", "suspend")
- impersonation: Claims to be CEO, RBI official, CBI, bank management, IT helpdesk, auditor
- credential_request: Asks for passwords, OTP, PIN, login credentials
- transfer_request: Requests fund transfers, RTGS/NEFT instructions, account changes
- secrecy_request: "Don't tell your manager", "keep confidential", "bypass normal process"
- suspicious_link: URLs with urgency framing or context mismatch
- authority_claim: Invokes RBI, SEBI, Income Tax, CBI, Enforcement Directorate to create fear

Email to analyze:
{email_content}

Respond ONLY in valid JSON (no markdown, no extra text):
{{
  "risk_score": <float 0.0-1.0>,
  "flags": [<zero or more categories from the list above>],
  "language": "<en | hi | pa | mixed>",
  "explanation": "<one sentence: primary risk reason, or why email is safe>"
}}

Scoring guide: 0.0-0.35 = legitimate, 0.36-0.69 = suspicious, 0.70-1.0 = high-risk phishing"""


# ── Script / language detection ───────────────────────────────────────────────

_DEVANAGARI = re.compile(r'[ऀ-ॿ]')
_GURMUKHI   = re.compile(r'[਀-੿]')


def _detect_script(text: str) -> str:
    n = max(len(text), 1)
    hi = len(_DEVANAGARI.findall(text)) / n
    pa = len(_GURMUKHI.findall(text)) / n
    if pa > 0.05:
        return "pa"
    if hi > 0.05:
        return "hi"
    if hi + pa > 0.02:
        return "mixed"
    return "en"


# ── Keyword heuristic fallback ────────────────────────────────────────────────

_CHECKS = [
    (["urgent", "immediately", "expire", "24 hour", "block", "suspend",
      "अभी", "तुरंत", "बंद", "ਤੁਰੰਤ", "ਬੰਦ"],
     "urgency", 0.20),
    (["password", "otp", "pin", "login", "credential",
      "पासवर्ड", "ओटीपी", "ਪਾਸਵਰਡ"],
     "credential_request", 0.35),
    (["transfer", "wire", "send money", "ifsc", "rtgs", "neft",
      "ट्रांसफर", "ਟ੍ਰਾਂਸਫਰ"],
     "transfer_request", 0.30),
    (["rbi", "cbi", "income tax", "sebi", "enforcement directorate",
      "ceo", "md ", "managing director"],
     "authority_claim", 0.15),
    (["confidential", "don't tell", "do not tell", "bypass", "secret",
      "गोपनीय", "ਗੁਪਤ"],
     "secrecy_request", 0.25),
]


def _heuristic(subject: str, body: str) -> tuple[float, list, str]:
    text = (subject + " " + body).lower()
    flags, score = [], 0.0
    for words, flag, weight in _CHECKS:
        if any(w in text for w in words):
            flags.append(flag)
            score += weight
    explanation = (
        f"Heuristic: {len(flags)} risk indicator(s) found — {', '.join(flags)}."
        if flags else "No common social-engineering indicators detected."
    )
    return min(score, 1.0), flags, explanation


# ── Main entry point ──────────────────────────────────────────────────────────

async def analyze_email_risk(
    email_id:     str,
    subject:      str,
    body:         str,
    sender_email: str,
    sender_name:  str,
) -> EmailRiskResult:
    # Claim 3: strip PII before external API call
    anon_body, anon_subject, _ = anonymize_email_body(body, subject)

    # Detect script from original text (anonymization removes non-ASCII names)
    language = _detect_script(body + " " + subject)

    email_content = (
        f"FROM: {sender_name} <{sender_email}>\n"
        f"SUBJECT: {anon_subject}\n\n"
        f"{anon_body}"
    )

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system",
                 "content": "You are a bank email security analyzer. Respond only in valid JSON."},
                {"role": "user",
                 "content": _PROMPT.format(email_content=email_content)},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        raw = resp.choices[0].message.content.strip()
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        parsed = json.loads(m.group(0) if m else raw)

        risk_score  = float(parsed.get("risk_score", 0.0))
        valid       = set(EmailRiskFlag.__members__)
        flags       = [f for f in parsed.get("flags", []) if f in valid]
        explanation = parsed.get("explanation", "")
        language    = parsed.get("language", language)

    except Exception:
        risk_score, flags, explanation = _heuristic(subject, body)

    if risk_score >= 0.70:
        level = EmailRiskLevel.high
    elif risk_score >= 0.36:
        level = EmailRiskLevel.medium
    else:
        level = EmailRiskLevel.low

    return EmailRiskResult(
        email_id=email_id,
        risk_score=round(risk_score, 4),
        risk_level=level,
        flags=flags,
        explanation=explanation,
        anonymized=True,
        language_detected=language,
    )