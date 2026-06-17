from app.core.config import settings

GROQ_API_KEY = settings.GROQ_API_KEY
GROQ_MODEL = settings.GROQ_MODEL
EMBEDDING_MODEL = settings.EMBEDDING_MODEL
FAISS_INDEX_PATH = settings.FAISS_INDEX_PATH
CHUNK_SIZE = settings.CHUNK_SIZE
CHUNK_OVERLAP = settings.CHUNK_OVERLAP
TOP_K = settings.TOP_K

# Data sources — Punjab & Sind Bank + RBI
SCRAPE_SOURCES = [
    {
        "name": "PSB_KYC_Policy",
        "url": "https://www.psbindia.com/kyc-aml-policy",
        "type": "html",
    },
    {
        "name": "PSB_Compliance",
        "url": "https://www.psbindia.com/compliance",
        "type": "html",
    },
    {
        "name": "PSB_Home",
        "url": "https://www.psbindia.com",
        "type": "html",
    },
    {
        "name": "RBI_KYC_Master_Direction",
        "url": "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=11566",
        "type": "html",
    },
    {
        "name": "RBI_AML_Guidelines",
        "url": "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12153",
        "type": "html",
    },
    {
        "name": "RBI_PMLA_Guidelines",
        "url": "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11244",
        "type": "html",
    },
]

PDF_SOURCES = [
    # Place downloaded PDFs here; ingestion.py will auto-detect files in data/raw/
]

RAW_DATA_DIR = "./data/raw"
PROCESSED_DATA_DIR = "./data/processed"
METADATA_FILE = "./data/processed/metadata.json"
