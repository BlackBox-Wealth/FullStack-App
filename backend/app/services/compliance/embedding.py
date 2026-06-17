"""
embedding.py
Chunks documents → embeds with sentence-transformers → stores in FAISS.
Each chunk retains source metadata for citation.
"""

import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

from .config import EMBEDDING_MODEL, FAISS_INDEX_PATH, CHUNK_SIZE, CHUNK_OVERLAP

from logifyx import Logifyx

# Configure logging for the microservice
logger = Logifyx(
    name="compliance_ai_service",
    color=True,  # Ensure colored output for console logs
)
CHUNKS_STORE_PATH = FAISS_INDEX_PATH + "_chunks.pkl"


def _chunk_text(text: str, source_name: str, url: str) -> list[dict]:
    """Split text into overlapping chunks, preserving paragraph boundaries where possible."""
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = min(start + CHUNK_SIZE, len(words))
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words)

        # Try to detect a section heading in the chunk for citation
        section = _extract_section_hint(chunk_text)

        chunks.append({
            "text": chunk_text,
            "source_name": source_name,
            "url": url,
            "section": section,
            "chunk_index": len(chunks),
        })

        if end == len(words):
            break
        start += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks


def _extract_section_hint(text: str) -> str:
    """Extract a likely section heading from the first 120 chars of a chunk."""
    import re
    # Match patterns like "Section 3", "3.1 KYC Requirements", "CHAPTER IV"
    patterns = [
        r"(Section\s+\d+[\.\d]*[^\n]{0,60})",
        r"(Chapter\s+[IVXLC\d]+[^\n]{0,60})",
        r"(\d+\.\d+[\.\d]*\s+[A-Z][^\n]{0,50})",
        r"([A-Z][A-Z\s]{5,40}(?=\n))",
    ]
    for pat in patterns:
        m = re.search(pat, text[:300], re.IGNORECASE)
        if m:
            return m.group(1).strip()[:80]
    return "General"


class EmbeddingStore:
    def __init__(self):
        self.model = SentenceTransformer(EMBEDDING_MODEL)
        self.index: Optional[faiss.IndexFlatIP] = None
        self.chunks: list[dict] = []

    def build(self, documents: list[dict]) -> None:
        """Chunk all documents, embed, and build FAISS index."""
        all_chunks = []
        for doc in documents:
            chunks = _chunk_text(doc["text"], doc["source_name"], doc["url"])
            all_chunks.extend(chunks)
            logger.info(f"  {doc['source_name']}: {len(chunks)} chunks")

        logger.info(f"Total chunks: {len(all_chunks)} — embedding...")
        texts = [c["text"] for c in all_chunks]
        embeddings = self.model.encode(texts, batch_size=32, show_progress_bar=True, normalize_embeddings=True)
        embeddings = np.array(embeddings, dtype=np.float32)

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)  # Inner product = cosine sim (normalized)
        self.index.add(embeddings)
        self.chunks = all_chunks

        self._save()
        logger.info(f"FAISS index built: {self.index.ntotal} vectors, dim={dim}")

    def _save(self) -> None:
        Path(FAISS_INDEX_PATH).parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, FAISS_INDEX_PATH)
        with open(CHUNKS_STORE_PATH, "wb") as f:
            pickle.dump(self.chunks, f)
        logger.info(f"Index saved to {FAISS_INDEX_PATH}")

    def load(self) -> bool:
        if not Path(FAISS_INDEX_PATH).exists() or not Path(CHUNKS_STORE_PATH).exists():
            return False
        self.index = faiss.read_index(FAISS_INDEX_PATH)
        with open(CHUNKS_STORE_PATH, "rb") as f:
            self.chunks = pickle.load(f)
        logger.info(f"Index loaded: {self.index.ntotal} vectors")
        return True

    def embed_query(self, query: str) -> np.ndarray:
        vec = self.model.encode([query], normalize_embeddings=True)
        return np.array(vec, dtype=np.float32)


if __name__ == "__main__":
    from .ingestion import ingest_all
    docs = ingest_all()
    store = EmbeddingStore()
    store.build(docs)
    print(f"Index ready: {store.index.ntotal} chunks")
