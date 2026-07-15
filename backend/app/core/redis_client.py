import redis.asyncio as aioredis
from app.core.config import settings
from logifyx import Logifyx
import json
from functools import wraps
from typing import Callable

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)

redis_client: aioredis.Redis | None = None

async def connect_to_redis():
    global redis_client
    log.info(f"Connecting to Redis at {settings.REDIS_URL}")
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        log.info("✅ Redis connected and responsive (PING OK)")
    except Exception as e:
        log.warning(f"⚠️ Redis connection failed: {e}. Running without cache.")
        redis_client = None

async def close_redis_connection():
    global redis_client
    if redis_client:
        await redis_client.close()
        log.info("❌ Redis connection closed")

def get_redis():
    return redis_client

def cache_response(key_prefix: str, ttl: int = 300):
    """
    Decorator to cache function results in Redis.
    Args:
        key_prefix: Prefix for the cache key.
        ttl: Time to live in seconds (default 5 mins).
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            client = get_redis()
            if not client:
                return await func(*args, **kwargs)
                
            # Build cache key from prefix and arguments
            # Note: This is a simple implementation, might need refinement for complex args
            cache_key = f"cache:{key_prefix}:" + ":".join(map(str, args))
            if kwargs:
                cache_key += ":" + ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
            
            try:
                cached_data = await client.get(cache_key)
                if cached_data:
                    log.debug(f"Cache HIT for {cache_key}")
                    return json.loads(cached_data)
            except Exception as e:
                log.error(f"Redis cache GET error: {e}")
            
            # Execute original function
            result = await func(*args, **kwargs)
            
            # Store in cache
            try:
                await client.setex(cache_key, ttl, json.dumps(result, default=str))
                log.debug(f"Cache MISS for {cache_key}, data stored")
            except Exception as e:
                log.error(f"Redis cache SET error: {e}")
                
            return result
        return wrapper
    return decorator
