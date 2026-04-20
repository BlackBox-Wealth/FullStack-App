import redis.asyncio as redis
from app.core.config import settings
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   

redis_client: redis.Redis = None


async def connect_to_redis():
    global redis_client
    log.info(f"Connecting to Redis at {settings.REDIS_URL}")

    try:
        redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        log.info("✅ Redis connected and responsive (PING OK)")
    except Exception as e:
        log.warning(f"⚠️ Redis connection failed: {e}. Running without cache.")
        log.warning("OTP and session caching will fall back to MongoDB")
        redis_client = None


async def close_redis_connection():
    global redis_client
    if redis_client:
        await redis_client.close()
        log.info("❌ Redis connection closed")


def get_redis():
    return redis_client
