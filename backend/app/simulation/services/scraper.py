import uuid
import httpx
from datetime import datetime
from typing import List, Dict, Any
from bs4 import BeautifulSoup
import logging

log = logging.getLogger("sim_scraper")

SCRAPE_SOURCES = [
    {
        "name": "RBI Press Releases",
        "url": "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx",
        "source_key": "rbi",
    },
    {
        "name": "CERT-In Advisories",
        "url": "https://www.cert-in.org.in/",
        "source_key": "cert_in",
    },
]

FRAUD_KEYWORDS = [
    "fraud", "phishing", "scam", "cyber", "vishing", "otp", "upi",
    "impersonation", "social engineering",
]

ATTACK_TYPE_KEYWORDS = {
    "phishing": ["phishing", "fake email", "spoofed", "credential", "otp fraud"],
    "vishing": ["vishing", "fake call", "phone fraud", "voice phishing"],
    "social_eng": ["social engineering", "impersonation", "pretexting"],
}


def _classify_attack_type(text: str) -> str:
    lower = text.lower()
    for attack_type, keywords in ATTACK_TYPE_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return attack_type
    return "general_fraud"


def _is_relevant(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in FRAUD_KEYWORDS)


async def scrape_threats() -> List[Dict[str, Any]]:
    results = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for source in SCRAPE_SOURCES:
            try:
                resp = await client.get(source["url"])
                soup = BeautifulSoup(resp.text, "html.parser")
                items = _extract_items(soup, source["source_key"], source["url"])
                results.extend(items)
                log.info(f"Scraped {len(items)} items from {source['name']}")
            except Exception as e:
                log.warning(f"Scraping failed for {source['name']}: {e}")

    return results


def _extract_items(soup: BeautifulSoup, source_key: str, base_url: str) -> List[Dict]:
    items = []
    links = soup.find_all("a", href=True)
    seen_titles = set()

    for link in links:
        title = link.get_text(strip=True)
        href = link["href"]
        if not title or len(title) < 10:
            continue
        if not _is_relevant(title):
            continue
        if title in seen_titles:
            continue
        seen_titles.add(title)

        full_url = href if href.startswith("http") else base_url.rstrip("/") + "/" + href.lstrip("/")
        parent = link.find_parent(["p", "li", "div", "td"])
        content_summary = parent.get_text(strip=True)[:300] if parent else title

        items.append({
            "source": source_key,
            "url": full_url,
            "title": title,
            "content_summary": content_summary,
            "attack_type": _classify_attack_type(title + " " + content_summary),
            "scraped_at": datetime.utcnow().isoformat(),
            "review_status": "pending",
            "reviewed_by": None,
            "reviewed_at": None,
            "generated_template_ids": [],
        })

    return items


async def run_scraper_and_save(db) -> int:
    threats = await scrape_threats()
    saved = 0
    for threat in threats:
        existing = await db.scraped_threats.find_one({"url": threat["url"]})
        if not existing:
            await db.scraped_threats.insert_one(threat)
            saved += 1
    log.info(f"Scraper saved {saved} new threats")
    return saved
