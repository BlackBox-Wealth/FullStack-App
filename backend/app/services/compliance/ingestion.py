"""
ingestion.py
Scrapes HTML + extracts PDF text from PSB and RBI sources.
Cleans, normalizes, and saves raw documents with source metadata.
"""

import re
import json
import time
from pathlib import Path
from typing import Optional

import requests
import pdfplumber
from bs4 import BeautifulSoup

from .config import SCRAPE_SOURCES, RAW_DATA_DIR, PROCESSED_DATA_DIR, METADATA_FILE

from logifyx import Logifyx

# Configure logging for the microservice
logger = Logifyx(
    name="compliance_ai_service",
    color=True,  # Ensure colored output for console logs
)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}


def _clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\x20-\x7E\u0900-\u097F\u0A00-\u0A7F\u20B9\n]", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def scrape_html(url: str, source_name: str) -> Optional[dict]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove nav/footer/script noise
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        # Try to get main content area first
        main = soup.find("main") or soup.find("article") or soup.find("div", {"id": "content"}) or soup.body
        text = main.get_text(separator="\n") if main else soup.get_text(separator="\n")
        text = _clean_text(text)

        if len(text) < 100:
            logger.warning(f"Very short content from {url} — may be blocked or empty")
            return None

        return {"source_name": source_name, "url": url, "type": "html", "text": text}

    except Exception as e:
        logger.error(f"Failed to scrape {url}: {e}")
        return None


def extract_pdf(filepath: str, source_name: str) -> Optional[dict]:
    try:
        pages_text = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    pages_text.append(page_text)

        text = _clean_text("\n\n".join(pages_text))
        if len(text) < 100:
            logger.warning(f"Very short PDF content: {filepath}")
            return None

        return {
            "source_name": source_name,
            "url": filepath,
            "type": "pdf",
            "text": text,
        }
    except Exception as e:
        logger.error(f"Failed to extract PDF {filepath}: {e}")
        return None


def ingest_all() -> list[dict]:
    Path(RAW_DATA_DIR).mkdir(parents=True, exist_ok=True)
    Path(PROCESSED_DATA_DIR).mkdir(parents=True, exist_ok=True)

    documents = []

    # Scrape HTML sources
    for source in SCRAPE_SOURCES:
        logger.info(f"Scraping: {source['name']} — {source['url']}")
        doc = scrape_html(source["url"], source["name"])
        if doc:
            documents.append(doc)
            logger.info(f"  ✓ {source['name']}: {len(doc['text'])} chars")
        time.sleep(1)  # polite crawl delay

    # Extract PDFs from data/raw/
    for pdf_path in Path(RAW_DATA_DIR).glob("*.pdf"):
        source_name = pdf_path.stem.replace("_", " ").title()
        logger.info(f"Extracting PDF: {pdf_path.name}")
        doc = extract_pdf(str(pdf_path), source_name)
        if doc:
            documents.append(doc)
            logger.info(f"  ✓ {source_name}: {len(doc['text'])} chars")

    # Save metadata
    metadata = [
        {"source_name": d["source_name"], "url": d["url"], "type": d["type"], "length": len(d["text"])}
        for d in documents
    ]
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    # Fallback: always include seed data to guarantee baseline coverage
    from .seed_data import SEED_DOCUMENTS
    seed_names = {d["source_name"] for d in documents}
    for seed_doc in SEED_DOCUMENTS:
        if seed_doc["source_name"] not in seed_names:
            documents.append(seed_doc)
            logger.info(f"  [SEED] {seed_doc['source_name']}: {len(seed_doc['text'])} chars")

    logger.info(f"\nIngestion complete: {len(documents)} documents loaded")
    return documents


if __name__ == "__main__":
    docs = ingest_all()
    for d in docs:
        print(f"  [{d['type'].upper()}] {d['source_name']}: {len(d['text'])} chars")
