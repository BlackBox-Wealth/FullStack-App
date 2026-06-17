"""
services/rag_client.py
Direct in-process bridge to the RAG pipeline.
NO HTTP — imports rag_pipeline directly (single-repo architecture).
Always returns the canonical API response schema.
"""

import logging
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

# Lazy-loaded singleton — pipeline initializes once on first call
_pipeline = None


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        from .compliance.rag_pipeline import get_pipeline
        _pipeline = get_pipeline()
    return _pipeline


def _compute_confidence(rag_response) -> float:
    """
    Derive a 0–1 confidence score from hybrid retrieval scores.
    Returns 0.0 when no context was found.
    """
    if rag_response.no_context_found or not rag_response.sources:
        return 0.0
    top_score = rag_response.sources[0].get("hybrid_score", 0.0)
    # hybrid_score is already 0–1 (normalized in retriever)
    return round(min(max(top_score, 0.0), 1.0), 3)


def _format_sources(sources: list[dict]) -> str:
    if not sources:
        return "N/A"
    return " | ".join(
        f"{c['source_name']} — {c['section']}"
        for c in sources[:3]  # cap at 3 for readability
    )


def query_rag(text: str) -> dict[str, Any]:
    """
    Synchronous RAG call. Returns canonical response dict.
    Called by both /query and /voice routes (voice calls via asyncio.to_thread).
    """
    try:
        pipeline = _get_pipeline()
        result = pipeline.query(text)

        return {
            "answer": result.answer,
            "source": _format_sources(result.sources),
            "compliance_status": result.compliance.status.value,
            "compliance_explanation": result.compliance.explanation,
            "triggered_rules": result.compliance.triggered_rules,
            "confidence": _compute_confidence(result),
            "no_context_found": result.no_context_found,
        }

    except Exception as e:
        logger.error(f"RAG pipeline error: {e}", exc_info=True)
        return {
            "answer": "No relevant regulation found in the available documents.",
            "source": "N/A",
            "compliance_status": "Unknown",
            "compliance_explanation": "Pipeline error — unable to process query.",
            "triggered_rules": [],
            "confidence": 0.0,
            "no_context_found": True,
        }


async def query_rag_async(text: str) -> dict[str, Any]:
    """Non-blocking wrapper — runs sync RAG call in a thread pool."""
    return await asyncio.to_thread(query_rag, text)
