"""
WealthVault - Banking & Wealth Management Platform
Main FastAPI application entry point.
"""
import uuid
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from logifyx import flush, shutdown
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.core.redis_client import connect_to_redis, close_redis_connection
from app.core.kafka_service import kafka_service
from app.services.event_consumers import register_all_consumers
from app.services.firebase_service import _init_firebase
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)

from app.routes import auth, accounts, transactions, payments, investments, ml, admin, loans, notifications, kyc, sessions, family, aa, assets, budgets, credit, tax, employee_notifications, risk, agents, ml_http
from app.simulation.routes import portal as sim_portal, sim_tracking, admin as sim_admin
from app.email_security import router as email_security_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    log.info("=" * 60)
    log.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    log.info(f"   Debug mode: {settings.DEBUG}")
    log.info(f"   CORS origins: {settings.CORS_ORIGINS}")
    log.info("=" * 60)

    log.info("Connecting to MongoDB...")
    await connect_to_mongo()
    log.info("MongoDB connection established")

    log.info("Connecting to Redis...")
    await connect_to_redis()
    log.info("Redis connection established")

    log.info("Connecting to Kafka...")
    register_all_consumers()
    await kafka_service.connect()
    log.info("Kafka connection established and consumers registered")

    log.info("Initializing Firebase for push notifications...")
    _init_firebase()
    log.info("Firebase initialization complete")

    log.info(f"✅ {settings.APP_NAME} is ready and accepting requests")
    yield

    # Shutdown
    log.info("🛑 Shutdown initiated...")
    log.info("Closing MongoDB connection...")
    await close_mongo_connection()
    log.info("Closing Redis connection...")
    await close_redis_connection()
    log.info("Disconnecting Kafka...")
    await kafka_service.disconnect()
    log.info("Flushing log buffers...")
    flush(timeout=5.0)
    log.info(f"🛑 {settings.APP_NAME} stopped gracefully")
    shutdown()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-grade Banking & Wealth Management Platform with AI-powered features",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware with request ID injection
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id

    start_time = time.time()
    method = request.method
    path = request.url.path
    client = request.client.host if request.client else "unknown"

    log.info(f"[{request_id}] ➜ {method} {path} from {client}")

    try:
        response = await call_next(request)
        duration = time.time() - start_time
        status = response.status_code

        if status >= 500:
            log.error(f"[{request_id}] ✗ {method} {path} → {status} ({duration:.3f}s)")
        elif status >= 400:
            log.warning(f"[{request_id}] ⚠ {method} {path} → {status} ({duration:.3f}s)")
        else:
            log.info(f"[{request_id}] ✓ {method} {path} → {status} ({duration:.3f}s)")

        # Try to get user_id from cookie for more accurate performance tracking
        user_id = "anonymous"
        access_token = request.cookies.get("access_token")
        if access_token:
            try:
                from app.core.security import decode_token
                payload = decode_token(access_token)
                user_id = payload.get("sub", "anonymous")
            except:
                pass

        # Publish performance metric to Kafka
        await kafka_service.publish("system.performance", {
            "metric": "api_request",
            "method": method,
            "path": path,
            "status": status,
            "latency_ms": round(duration * 1000, 2),
            "request_id": request_id,
            "user_id": user_id
        })

        return response
    except Exception as e:
        duration = time.time() - start_time
        log.error(f"[{request_id}] ✗ {method} {path} → EXCEPTION ({duration:.3f}s): {e}", exc_info=True)
        raise


# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(investments.router, prefix="/api/v1")
app.include_router(loans.router, prefix="/api/v1")
if settings.USING_GRPC:
    app.include_router(ml.router, prefix="/api/v1") # grpc router will handle /api/v1/ml internally
else:
    app.include_router(ml_http.router, prefix="/api/v1") # fallback to HTTP ML router if gRPC is not enabled
app.include_router(admin.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(kyc.router, prefix="/api/v1")
app.include_router(aa.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(budgets.router, prefix="/api/v1")
app.include_router(family.router, prefix="/api/v1")
app.include_router(credit.router, prefix="/api/v1")
app.include_router(tax.router, prefix="/api/v1")
app.include_router(employee_notifications.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")

# WealthVault Simulation Lab
app.include_router(sim_portal.router, prefix="/api/v1")
app.include_router(sim_tracking.router, prefix="/api")
app.include_router(sim_admin.router, prefix="/api/v1")

# Email Security
app.include_router(email_security_router.router, prefix="/api/v1")

log.info(f"Registered {21} API routers under /api/v1 (incl. simulation lab)")


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    log.debug("Health check requested")
    return {"status": "healthy", "service": settings.APP_NAME}
