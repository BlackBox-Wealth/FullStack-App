"""
utils/audit_logger.py
Writes every query + response to a structured JSONL audit log.
One JSON object per line — easy to parse, grep, and ship to any log aggregator.
Never logs raw audio. PII in query text is masked before writing.
"""

import json
import logging
import time
import uuid
from pathlib import Path

from .helpers import mask_pii

_AUDIT_LOG_PATH = Path("./logs/audit.jsonl")
logger = logging.getLogger(__name__)


def _ensure_log_file():
    _AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _AUDIT_LOG_PATH.exists():
        _AUDIT_LOG_PATH.touch()


def log_query(
    query: str,
    language: str,
    answer: str,
    source: str,
    compliance_status: str,
    triggered_rules: list[str],
    confidence: float,
    endpoint: str,          # "/query" or "/voice"
    latency_ms: float = 0.0,
    transcript: str = "",   # voice only
):
    """Append one audit record to logs/audit.jsonl."""
    record = {
        "audit_id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "endpoint": endpoint,
        "language": language,
        "query_masked": mask_pii(query)[:300],
        "transcript_masked": mask_pii(transcript)[:300] if transcript else None,
        "answer_preview": answer[:200],
        "source": source,
        "compliance_status": compliance_status,
        "triggered_rules": triggered_rules,
        "confidence": confidence,
        "latency_ms": round(latency_ms, 1),
    }
    try:
        _ensure_log_file()
        with open(_AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:
        # Audit log failure must never crash the API
        logger.error(f"Audit log write failed: {e}")
