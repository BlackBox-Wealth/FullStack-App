"""
retriever.py
Hybrid retrieval: FAISS semantic search + BM25 keyword reranking.
Returns top-k chunks with source metadata for citation.
"""

from logifyx import Logifyx
from typing import Optional

from rank_bm25 import BM25Okapi

from .config import TOP_K
from .embedding import EmbeddingStore

# Configure logging for the microservice
logger = Logifyx(
    name="compliance_ai_service",
    color=True,  # Ensure colored output for console logs
)


class HybridRetriever:
    def __init__(self, store: EmbeddingStore):
        self.store = store
        self._bm25: Optional[BM25Okapi] = None
        # Pre-built map: (source_name, chunk_index) → position in self.store.chunks
        self._chunk_pos: dict[tuple, int] = {
            (c["source_name"], c["chunk_index"]): i
            for i, c in enumerate(store.chunks)
        }

    def _get_bm25(self) -> BM25Okapi:
        if self._bm25 is None:
            tokenized = [c["text"].lower().split() for c in self.store.chunks]
            self._bm25 = BM25Okapi(tokenized)
        return self._bm25

    def retrieve(self, query: str, top_k: int = TOP_K) -> list[dict]:
        """
        1. FAISS semantic search → top_k * 3 candidates
        2. BM25 rerank → return top_k
        """
        if self.store.index is None or self.store.index.ntotal == 0:
            logger.error("FAISS index is empty. Run embedding.py first.")
            return []

        # Step 1: Semantic retrieval (wider net)
        query_vec = self.store.embed_query(query)
        candidate_k = min(top_k * 3, self.store.index.ntotal)
        scores, indices = self.store.index.search(query_vec, candidate_k)

        candidates = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            chunk = dict(self.store.chunks[idx])
            chunk["_faiss_idx"] = int(idx)
            chunk["semantic_score"] = float(score)
            candidates.append(chunk)

        if not candidates:
            return []

        # Step 2: BM25 rerank over candidates — O(1) lookup via pre-built map
        bm25 = self._get_bm25()
        query_tokens = query.lower().split()
        bm25_scores = bm25.get_scores(query_tokens)

        for chunk in candidates:
            pos = chunk["_faiss_idx"]  # FAISS idx == position in self.store.chunks
            chunk["bm25_score"] = float(bm25_scores[pos])

        # Normalize and combine scores
        sem_max = max(c["semantic_score"] for c in candidates) or 1.0
        bm25_max = max(c["bm25_score"] for c in candidates) or 1.0

        for chunk in candidates:
            chunk["hybrid_score"] = (
                0.6 * (chunk["semantic_score"] / sem_max) +
                0.4 * (chunk["bm25_score"] / bm25_max)
            )

        candidates.sort(key=lambda x: x["hybrid_score"], reverse=True)

        # Deduplicate by source+chunk_index
        seen = set()
        results = []
        for c in candidates:
            key = (c["source_name"], c["chunk_index"])
            if key not in seen:
                seen.add(key)
                results.append(c)
            if len(results) == top_k:
                break

        return results


def format_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a numbered context block for the LLM prompt."""
    parts = []
    for i, chunk in enumerate(chunks, 1):
        parts.append(
            f"[{i}] Source: {chunk['source_name']} | Section: {chunk['section']}\n"
            f"{chunk['text']}"
        )
    return "\n\n---\n\n".join(parts)
