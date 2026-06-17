
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
from logifyx import Logifyx
from app.core.config import settings
from app.routes import compliance
from app.services.rag_client import _get_pipeline

# Configure logging for the microservice
logger = Logifyx(
    name="compliance_ai_service",
    color=True,  # Ensure colored output for console logs
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Compliance AI Service...")
    logger.info("Initializing RAG index (this may take a minute)...")
    
    # Pre-load the RAG pipeline synchronously to ensure it's ready
    try:
        _get_pipeline()
        logger.info("✅ RAG Pipeline initialized successfully.")
    except Exception as e:
        logger.error(f"❌ Failed to initialize RAG Pipeline: {e}")
        
    yield
    # Shutdown
    logger.info("🛑 Compliance AI Service stopping...")

app = FastAPI(
    title="WealthVault Compliance AI Service",
    description="Standalone microservice for RAG-based regulatory compliance and voice processing.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration to allow frontend and main backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the compliance router
# Note: In the standalone service, we might want it at root or keep the prefix
app.include_router(compliance.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "service": "Compliance AI",
        "status": "online",
        "docs": "/docs"
    }

if __name__ == "__main__":
    # Run on a different port (8002 by default)
    port = int(os.getenv("COMPLIANCE_SERVICE_PORT", 8002))
    logger.info(f"Compliance service starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
