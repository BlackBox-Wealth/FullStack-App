"""
utils/helpers.py
Shared utilities: text normalization, PII masking, structured logging.
"""

import re
import logging
import time
from functools import wraps
from typing import Any

logger = logging.getLogger(__name__)

# PII patterns to mask in logs
_PII_PATTERNS = [
    (re.compile(r"\b\d{12}\b"), "<AADHAAR>"),                          # Aadhaar
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"), "<PAN>"),                 # PAN
    (re.compile(r"\b\d{10}\b"), "<PHONE>"),                            # Phone
    (re.compile(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}"), "<EMAIL>"),        # Email
    (re.compile(r"\b\d{9,18}\b"), "<ACCOUNT_NO>"),                     # Account number
]


def mask_pii(text: str) -> str:
    """Replace PII patterns with safe placeholders for logging."""
    for pattern, replacement in _PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def normalize_query(text: str) -> str:
    """Normalize whitespace and strip control characters from user input."""
    text = re.sub(r"[\x00-\x1F\x7F]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def truncate_for_voice(text: str, max_chars: int = 400) -> str:
    """
    Shorten answer for TTS — keep first complete sentence(s) under max_chars.
    Voice responses must be concise for phone/call use.
    """
    if len(text) <= max_chars:
        return text
    sentences = re.split(r"(?<=[.!?])\s+", text)
    result = ""
    for sentence in sentences:
        if len(result) + len(sentence) + 1 > max_chars:
            break
        result = (result + " " + sentence).strip()
    return result or text[:max_chars].rsplit(" ", 1)[0] + "..."


def timed(fn):
    """Decorator: logs execution time of async/sync functions."""
    @wraps(fn)
    async def async_wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = await fn(*args, **kwargs)
        logger.info(f"{fn.__name__} completed in {(time.perf_counter()-start)*1000:.1f}ms")
        return result

    @wraps(fn)
    def sync_wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = fn(*args, **kwargs)
        logger.info(f"{fn.__name__} completed in {(time.perf_counter()-start)*1000:.1f}ms")
        return result

    import asyncio
    return async_wrapper if asyncio.iscoroutinefunction(fn) else sync_wrapper


def build_safe_log(query: str, language: str, compliance_status: str) -> dict[str, Any]:
    """Build a log-safe dict — no raw audio, no PII."""
    return {
        "query_masked": mask_pii(query)[:200],
        "language": language,
        "compliance_status": compliance_status,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
