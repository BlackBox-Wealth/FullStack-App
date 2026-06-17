"""
utils/language_detection.py
Detects language from text: en | hi | pa
Handles Hinglish (mixed Hindi-English) by scoring script presence.
"""

import re

# Devanagari Unicode block: U+0900–U+097F
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
# Gurmukhi (Punjabi) Unicode block: U+0A00–U+0A7F
_GURMUKHI = re.compile(r"[\u0A00-\u0A7F]")

# Common Punjabi romanized markers (Hinglish-style Punjabi)
_PUNJABI_ROMAN_MARKERS = {
    "kive", "kiddan", "tussi", "tenu", "menu", "saanu", "ohna", "assi",
    "nahi", "haan", "kyc karo", "khata", "paisa", "rupaye", "punjab",
}

# Common Hindi romanized markers
_HINDI_ROMAN_MARKERS = {
    "kyc kya", "kya hai", "kaise", "kitne", "batao", "bataiye",
    "niyam", "bank mein", "khata kholna", "paisa", "rupaye",
}


def detect_language(text: str) -> str:
    """
    Returns: 'en' | 'hi' | 'pa'
    Priority: script detection > romanized keyword matching > default English
    """
    if not text or not text.strip():
        return "en"

    # Script-based detection (most reliable)
    gurmukhi_count = len(_GURMUKHI.findall(text))
    devanagari_count = len(_DEVANAGARI.findall(text))
    total_chars = max(len(text.strip()), 1)

    if gurmukhi_count / total_chars > 0.1:
        return "pa"
    if devanagari_count / total_chars > 0.1:
        return "hi"

    # Romanized keyword matching for Hinglish/Punjabi-Roman
    text_lower = text.lower()
    pa_hits = sum(1 for marker in _PUNJABI_ROMAN_MARKERS if marker in text_lower)
    hi_hits = sum(1 for marker in _HINDI_ROMAN_MARKERS if marker in text_lower)

    if pa_hits > hi_hits and pa_hits >= 2:
        return "pa"
    if hi_hits >= 2:
        return "hi"

    return "en"


def is_hinglish(text: str) -> bool:
    """True if text mixes Latin script with Devanagari/Gurmukhi markers."""
    has_latin = bool(re.search(r"[a-zA-Z]{3,}", text))
    has_indic = bool(_DEVANAGARI.search(text) or _GURMUKHI.search(text))
    return has_latin and has_indic
