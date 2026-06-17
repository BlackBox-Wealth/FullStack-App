from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings): # BaseSettings ensures that environment variables are loaded and validated
    # App
    APP_NAME: str = "WealthVault"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    #GRPC
    ML_GRPC_HOST: str = os.getenv("ML_GRPC_HOST", "localhost:50051")
    USING_GRPC: bool = os.getenv("USING_GRPC", "true").lower() == "true"
    ML_HTTP_HOST: str = os.getenv("ML_HTTP_HOST", "http://localhost:8009/api/v1")
    ML_API_TOKEN: str = os.getenv("ML_API_TOKEN", "")
    
    # Mock Frontend URLs
    MOCK_PORTAL_BASE_URL: str = os.getenv("MOCK_PORTAL_BASE_URL", "http://localhost:5175")
    SENTINEL_BASE_URL: str = os.getenv("SENTINEL_BASE_URL", "http://localhost:5174")

    # MongoDB
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "wealthvault")

    # encryption
    DATA_ENCRYPTION_KEY: str = os.getenv("DATA_ENCRYPTION_KEY", "")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    # Gmail
    NO_REPLY_EMAIL: str = os.getenv("NO_REPLY_EMAIL", "")
    MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "")
    MAIL_SERVER: str = os.getenv("MAIL_SERVER", "")
    MAIL_PORT: str = os.getenv("MAIL_PORT", "")
    MAIL_STARTTLS: str = os.getenv("MAIL_STARTTLS", "false")
    MAIL_SSL_TLS: str = os.getenv("MAIL_SSL_TLS", "false")
    GMAIL_TOKEN_B64: str = os.getenv("GMAIL_TOKEN_B64", "")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Groq
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # RAG / Compliance AI
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama3-70b-8192")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    FAISS_INDEX_PATH: str = os.getenv("FAISS_INDEX_PATH", "./data/faiss_index")
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "700"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "100"))
    TOP_K: int = int(os.getenv("TOP_K", "5"))

    # Voice Services
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    STT_CONFIDENCE_THRESHOLD: float = float(os.getenv("STT_CONFIDENCE_THRESHOLD", "0.65"))


    # Rate Limiting on voice and text compliance queries
    RATE_LIMIT_QUERY: str = os.getenv("RATE_LIMIT_QUERY", "30/minute")
    RATE_LIMIT_VOICE: str =  os.getenv("RATE_LIMIT_VOICE", "10/minute")

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

    # External APIs
    MARKETSTACK_API_KEY: str = os.getenv("MARKETSTACK_API_KEY", "")
    ALPHA_VANTAGE_API_KEY: str = os.getenv("ALPHA_VANTAGE_API_KEY", "")
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "")
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")
    EXCHANGERATE_API_KEY: str = os.getenv("EXCHANGERATE_API_KEY", "")

    # OTP
    OTP_EXPIRE_SECONDS: int = int(os.getenv("OTP_EXPIRE_SECONDS", "300"))

    # Firebase Cloud Messaging (push notifications to Flutter app)
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    LARGE_PAYMENT_THRESHOLD: float = float(os.getenv("LARGE_PAYMENT_THRESHOLD", "100000"))

    # Twilio (SMS)
    ACCOUNT_SID: str = os.getenv("ACCOUNT_SID", "")
    AUTH_TOKEN: str = os.getenv("AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")

    # Cloudflare Turnstile (CAPTCHA)
    TURNSTILE_SECRET_KEY: str = os.getenv("TURNSTILE_SECRET_KEY", "")
    ENABLE_TURNSTILE: bool = os.getenv("ENABLE_TURNSTILE", "true").lower() == "true"

    # ML Model
    MODEL_DIR : str = os.getenv("MODEL_DIR", "./models")
    DATA_DIR : str = os.getenv("DATA_DIR", "./data")

    # CORS & Frontend
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173,http://localhost:5174,http://localhost:3000")
    CORS_ORIGINS: str = FRONTEND_URL

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
