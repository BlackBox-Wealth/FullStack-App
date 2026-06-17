"""
rag_pipeline.py
Orchestrates: Retrieval → Compliance Check → LLM Generation → Structured Output.
This is the single entry point for all queries.
"""

from logifyx import Logifyx
from dataclasses import dataclass

from groq import Groq

from .config import GROQ_API_KEY, GROQ_MODEL, TOP_K
from .embedding import EmbeddingStore
from .retriever import HybridRetriever, format_context
from .compliance_checker import (
    check_compliance,
    infer_compliance_from_llm_answer,
    ComplianceResult,
    ComplianceStatus,
    STATUS_EMOJI,
)

# Configure logging for the microservice
logger = Logifyx(
    name="compliance_ai_service",
    color=True,  # Ensure colored output for console logs
)

# ---------------------------------------------------------------------------
# Strict grounded system prompt — no hallucination allowed
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a banking compliance AI assistant for Punjab & Sind Bank.
Your ONLY knowledge source is the regulatory context provided below.

STRICT RULES:
1. Answer ONLY using the provided context. Do NOT use any prior knowledge.
2. If the context does not contain enough information, respond EXACTLY:
   "No relevant regulation found in the available documents."
3. Always cite the source document and section for every claim.
4. Be precise, factual, and concise. No speculation.
5. If a practice described in the query violates a regulation, clearly state the violation.
6. Format your answer as:
   ANSWER: <your answer>
   SOURCE: <Document Name, Section>
   COMPLIANCE_SIGNAL: <compliant / risky / non-compliant / unknown>
"""

USER_PROMPT_TEMPLATE = """REGULATORY CONTEXT:
{context}

---
USER QUERY: {query}

Respond strictly using the context above."""


@dataclass
class RAGResponse:
    query: str
    answer: str
    sources: list[dict]
    compliance: ComplianceResult
    context_used: str
    no_context_found: bool

    def format(self) -> str:
        if self.no_context_found:
            return (
                f"Answer: No relevant regulation found in the available documents.\n\n"
                f"Source: N/A\n\n"
                f"Compliance Status: {STATUS_EMOJI[ComplianceStatus.UNKNOWN]} Unknown"
            )

        source_lines = "\n".join(
            f"  • {c['source_name']} — {c['section']} (score: {c.get('hybrid_score', 0):.2f})"
            for c in self.sources
        )

        return (
            f"Answer:\n{self.answer}\n\n"
            f"Source:\n{source_lines}\n\n"
            f"Compliance Status:\n{self.compliance.badge}\n"
            f"{self.compliance.explanation}"
        )


class RAGPipeline:
    def __init__(self):
        self.store = EmbeddingStore()
        self.retriever: HybridRetriever | None = None
        self.groq_client = Groq(api_key=GROQ_API_KEY)
        self._initialized = False

    def initialize(self, force_rebuild: bool = False) -> None:
        """Load or build the FAISS index."""
        if not force_rebuild and self.store.load():
            logger.info("Loaded existing FAISS index.")
        else:
            logger.info("Building index from scratch...")
            from .ingestion import ingest_all
            docs = ingest_all()
            if not docs:
                raise RuntimeError("No documents ingested. Check data sources.")
            self.store.build(docs)

        self.retriever = HybridRetriever(self.store)
        self._initialized = True
        logger.info("RAG pipeline ready.")

    def query(self, user_query: str, top_k: int = TOP_K) -> RAGResponse:
        if not self._initialized:
            raise RuntimeError("Pipeline not initialized. Call initialize() first.")

        # Step 1: Retrieve relevant chunks
        chunks = self.retriever.retrieve(user_query, top_k=top_k)
        no_context = len(chunks) == 0

        # Step 2: Run compliance rule engine (independent of LLM)
        compliance_result = check_compliance(user_query, chunks)

        if no_context:
            return RAGResponse(
                query=user_query,
                answer="No relevant regulation found in the available documents.",
                sources=[],
                compliance=compliance_result,
                context_used="",
                no_context_found=True,
            )

        # Step 3: Build context and call LLM
        context = format_context(chunks)
        user_prompt = USER_PROMPT_TEMPLATE.format(context=context, query=user_query)

        try:
            response = self.groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.0,  # Zero temperature for deterministic, grounded answers
                max_tokens=1024,
            )
            llm_answer = response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            llm_answer = "LLM unavailable. Please check API key and connectivity."

        # Step 4: Refine compliance status using LLM answer signals
        if compliance_result.status == ComplianceStatus.UNKNOWN:
            inferred = infer_compliance_from_llm_answer(llm_answer)
            if inferred != ComplianceStatus.UNKNOWN:
                compliance_result.status = inferred

        # Step 5: Extract clean answer (strip LLM formatting markers)
        clean_answer = _extract_answer_section(llm_answer)

        return RAGResponse(
            query=user_query,
            answer=clean_answer,
            sources=chunks,
            compliance=compliance_result,
            context_used=context,
            no_context_found=False,
        )


def _extract_answer_section(llm_text: str) -> str:
    """Extract the ANSWER: section from LLM output, or return full text."""
    import re
    match = re.search(r"ANSWER:\s*(.*?)(?=SOURCE:|COMPLIANCE_SIGNAL:|$)", llm_text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return llm_text


# Singleton for reuse across app sessions
_pipeline_instance: RAGPipeline | None = None


def get_pipeline(force_rebuild: bool = False) -> RAGPipeline:
    global _pipeline_instance
    if _pipeline_instance is None or force_rebuild:
        _pipeline_instance = RAGPipeline()
        _pipeline_instance.initialize(force_rebuild=force_rebuild)
    return _pipeline_instance


if __name__ == "__main__":
    pipeline = get_pipeline()

    sample_queries = [
        "What documents are valid for KYC verification?",
        "Our bank updates KYC every 5 years for all customers.",
        "What is the threshold for reporting cash transactions to FIU-IND?",
        "Can we open an account before completing KYC?",
        "How long must transaction records be retained?",
    ]

    for q in sample_queries:
        print(f"\n{'='*70}")
        print(f"QUERY: {q}")
        print("="*70)
        result = pipeline.query(q)
        print(result.format())
