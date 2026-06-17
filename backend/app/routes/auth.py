"""Authentication routes - JWT via secure httpOnly cookies."""
import random
import string
import asyncio
import uuid
import json
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from bson import ObjectId
from app.core.database import get_database
from app.core.redis_client import get_redis
from app.core.security import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token,
    decode_token, get_current_user
)
from app.core.kafka_service import kafka_service
from app.core.config import settings
from app.services.email_service import email_service
from app.helper.utils import encrypt_user_data, decrypt_user_data, encrypt_update_fields
from app.services.deterministic_hash import generate_deterministic_hash
from app.services.sms_service import sms_service
from app.core.bloom_filter import CountingBloomFilter
from app.services.device_service import check_and_save_device
from app.services.turnstile_service import turnstile_service
from logifyx import Logifyx
from app.models.user import (
    UserCreate, UserLogin, UserResponse,
    PhoneOTPRequest, VerifyPhoneRequest, CompleteRegistrationRequest,
    UserUpdate, PasswordResetRequest, PasswordResetConfirm
)

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Cookie settings
COOKIE_DOMAIN = None  # None = current domain (localhost)
COOKIE_SECURE = not settings.DEBUG  # True in prod (HTTPS only)
COOKIE_SAMESITE = "lax"  # "lax" for same-site nav, "none" for cross-origin

# Initialize bloom filters
user_email_bloom_filter = CountingBloomFilter(capacity=100000, error_rate=0.01)
user_phone_bloom_filter = CountingBloomFilter(capacity=100000, error_rate=0.01)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set httpOnly secure cookies for both tokens."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/", # Set to root path to allow refresh endpoint to access it, adjust if you want to restrict it 
    )
    # for mobile applications, we also return tokens in response body
    log.debug("Auth cookies set successfully")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer"
    }


def clear_auth_cookies(response: Response):
    """Clear auth cookies on logout."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    if "Authorization" in response.headers:
        del response.headers["Authorization"]
    log.debug("Auth cookies cleared")


def user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user["full_name"],
        phone=user["phone"],
        role=user["role"],
        kyc_status=user.get("kyc_status", "not_initiated"),
        is_active=user.get("is_active", True),
        created_at=str(user.get("created_at", "")),
        avatar_url=user.get("avatar_url"),
        recovery_email=user.get("recovery_email"),
        recovery_phone=user.get("recovery_phone"),
        is_first_time_investor=bool(user.get("is_first_time_investor", True)),
        is_new_user=bool(user.get("is_new_user", True)),
        language=user.get("language", "en"),
        theme_mode=user.get("theme_mode", "linen"),
        accessibility=user.get("accessibility", {
            "reducedMotion": False,
            "highContrast": False,
            "largeText": False,
            "compactDensity": False,
            "voiceNavigation": False,
            "screenReader": False,
        })
    )


def normalize_indian_phone(phone: str) -> str:
    """Normalize phone to +91XXXXXXXXXX and enforce exactly 10 digits user input."""
    raw_phone = (phone or "").strip()

    if raw_phone.startswith("+91"):
        raw_phone = raw_phone[3:]

    if not raw_phone.isdigit() or len(raw_phone) != 10:
        raise HTTPException(status_code=400, detail="Phone number must be exactly 10 digits")

    return f"+91{raw_phone}"


@router.post("/register", status_code=201)
async def register(user_data: UserCreate, request: Request):
    """Initiate registration by validating signup details and sending email OTP."""
    log.info(f"Registration initiated: email={user_data.email}, role={user_data.role}")
    db = get_database()

    normalized_phone = normalize_indian_phone(user_data.phone)
    hashed_email = generate_deterministic_hash(user_data.email)
    hashed_phone = generate_deterministic_hash(normalized_phone)
    
    # Verify captcha
    if user_data.captcha_token:
        client_ip = request.client.host if request.client else None
        captcha_result = await turnstile_service.verify_token(user_data.captcha_token, client_ip)
        if not captcha_result.get("success"):
            log.warning(f"Registration captcha verification failed: {captcha_result.get('error')}")
            raise HTTPException(status_code=400, detail="Captcha verification failed")
    
    # check in bloom filter first to reduce db load
    if not user_email_bloom_filter.contains(user_data.email):
        log.info(f"Email not found in Bloom filter, safe to proceed")
    else: 
        log.warning(f"Email found in Bloom filter, potential duplicate: {user_data.email}")
        log.warning("Checking database to confirm...")
        existing = await db.users.find_one({"hashed_email": hashed_email})
        if existing:
            log.warning(f"Registration failed: email already exists - {user_data.email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        if not user_phone_bloom_filter.contains(normalized_phone):
            log.info(f"Phone not found in Bloom filter, safe to proceed")
        else:
            log.warning(f"Phone found in Bloom filter, potential duplicate: {normalized_phone}")
            log.warning("Checking database to confirm...")
            existing_phone = await db.users.find_one({"hashed_phone": hashed_phone})
            if existing_phone:
                log.warning(f"Registration failed: phone already exists - {user_data.phone}")
                raise HTTPException(status_code=400, detail="Phone number already registered")
            
    # Add to Bloom filter (even if we later find out it's a duplicate, the filter helps reduce future db checks)
    user_email_bloom_filter.add(user_data.email)
    user_phone_bloom_filter.add(normalized_phone)

    otp = "".join(random.choices(string.digits, k=6))
    redis = get_redis()

    if redis:
        await redis.setex(f"registration_email_otp:{user_data.email}", 300, otp)
        log.info(f"Email OTP stored in Redis for initiated registration: email={user_data.email}")
    else:
        await db.registration_otps.update_one(
            {"email": user_data.email, "type": "email"},
            {"$set": {"otp": otp, "created_at": datetime.utcnow()}},
            upsert=True
        )
        log.info(f"Email OTP stored in MongoDB for initiated registration: email={user_data.email}")

    try:
        await kafka_service.publish("email.otpVerification", {
            "user_email": user_data.email,
            "otp_code": otp
        })
        log.info(f"Event published to Kafka for email OTP verification: email={user_data.email}")
    except Exception as e:
        log.error(f"Failed to send registration email OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP")

    return {
        "message": "Signup initiated. Email OTP sent.",
        "otp_debug": otp if settings.DEBUG else None,
    }
@router.post("/send-phone-otp")
async def send_phone_otp(data: PhoneOTPRequest):
    """Send OTP to phone for SIM binding verification."""
    log.info(f"Phone OTP requested: phone={data.phone}")
    
    phone = data.phone
    if not phone.startswith("+"):
        phone = f"+91{phone}"  # Adds India's country code if it is not present
    
    # Generates OTP
    otp = "".join(random.choices(string.digits, k=6))
    redis = get_redis()
    
    if redis:
        await redis.setex(f"phone_otp:{phone}", 300, otp)  # 5 min expiry
        log.info(f"Phone OTP stored in Redis: phone={phone}")
    else:
        db = get_database()
        await db.phone_otps.update_one(
            {"phone": phone},
            {"$set": {"otp": otp, "created_at": datetime.utcnow()}},
            upsert=True
        )
        log.info(f"Phone OTP stored in MongoDB: phone={phone}")
    
    # Send SMS via Twilio
    try:
        await sms_service.send_otp(phone, otp)
        log.info(f"Phone OTP sent via SMS: phone={phone}")
    except Exception as e:
        log.error(f"Failed to send phone OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")
    
    return {
        "message": f"OTP sent to {phone}",
        "otp_debug": otp if settings.DEBUG else None
    }


@router.post("/verify-phone")
async def verify_phone(data: VerifyPhoneRequest):
    """Verify phone with OTP for SIM binding."""
    log.info(f"Phone verification requested: phone={data.phone}")
    
    phone = data.phone
    if not phone.startswith("+"):
        phone = f"+91{phone}"
    
    redis = get_redis()
    
    # Gets stored OTP
    if redis:
        stored_otp = await redis.get(f"phone_otp:{phone}")
    else:
        db = get_database()
        otp_doc = await db.phone_otps.find_one({"phone": phone})
        stored_otp = otp_doc["otp"] if otp_doc else None
    
    if not stored_otp or stored_otp != data.otp:
        log.warning(f"Phone OTP verification failed: phone={phone}")
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    # Cleans up OTP
    if redis:
        await redis.delete(f"phone_otp:{phone}")
    
    log.info(f"Phone verified successfully: phone={phone}")
    return {
        "message": "Phone verified successfully",
        "phone": phone,
        "verified": True
    }


@router.post("/register/send-email-otp")
async def send_email_otp_for_registration(email: str):
    """Send OTP to email during registration."""
    log.info(f"Email OTP requested for registration: email={email}")
    
    # Check if email already exists
    db = get_database()
    hashed_email = generate_deterministic_hash(email)
    existing = await db.users.find_one({"hashed_email": hashed_email})
    if existing:
        log.warning(f"Email OTP request failed: email already exists - {email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate OTP
    otp = "".join(random.choices(string.digits, k=6))
    redis = get_redis()
    
    # Store OTP in Redis (5 min expiry)
    if redis:
        await redis.setex(f"registration_email_otp:{email}", 300, otp)
        log.info(f"Email OTP stored in Redis: email={email}")
    else:
        await db.registration_otps.update_one(
            {"email": email, "type": "email"},
            {"$set": {"otp": otp, "created_at": datetime.utcnow()}},
            upsert=True
        )
        log.info(f"Email OTP stored in MongoDB: email={email}")
    
    # Send OTP via email
    try:
        await kafka_service.publish("email.otpVerification", {
            "user_email": email,
            "otp_code": otp
        })
        log.info(f"Email OTP sent: email={email}")
    except Exception as e:
        log.error(f"Failed to send email OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP")
    
    return {
        "message": f"OTP sent to {email}",
        "otp_debug": otp if settings.DEBUG else None
    }


@router.post("/register/verify-email-otp")
async def verify_email_otp_for_registration(email: str, otp: str):
    """Verify registration email OTP before moving to phone OTP step."""
    log.info(f"Email OTP verification requested for registration: email={email}")

    db = get_database()
    redis = get_redis()

    stored_email_otp = None
    if redis:
        stored_email_otp = await redis.get(f"registration_email_otp:{email}")

    # Fallback to Mongo if Redis key is missing/unavailable
    if not stored_email_otp:
        otp_doc = await db.registration_otps.find_one({"email": email, "type": "email"})
        stored_email_otp = otp_doc["otp"] if otp_doc else None

    if not stored_email_otp or stored_email_otp != otp:
        log.warning(f"Email OTP verification failed: email={email}")
        raise HTTPException(status_code=400, detail="Invalid or expired email OTP")

    log.info(f"Email OTP verified for registration: email={email}")
    return {"message": "Email OTP verified", "verified": True}


@router.post("/register/send-phone-otp")
async def send_phone_otp_for_registration(phone: str):
    """Send OTP to phone during registration."""
    log.info(f"Phone OTP requested for registration: phone={phone}")
    
    # Normalize and validate phone
    phone = normalize_indian_phone(phone)
    
    # Check if phone already exists
    db = get_database()
    hashed_phone = generate_deterministic_hash(phone)
    existing = await db.users.find_one({"hashed_phone": hashed_phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone already registered")
    
    # Generate OTP
    otp = "".join(random.choices(string.digits, k=6))
    redis = get_redis()
    
    # Store OTP in Redis (5 min expiry)
    if redis:
        await redis.setex(f"registration_phone_otp:{phone}", 300, otp)
        log.info(f"Phone OTP stored in Redis: phone={phone}")
    else:
        await db.registration_otps.update_one(
            {"phone": phone, "type": "phone"},
            {"$set": {"otp": otp, "created_at": datetime.utcnow()}},
            upsert=True
        )
        log.info(f"Phone OTP stored in MongoDB: phone={phone}")
    
    # Send OTP via SMS
    try:
        await sms_service.send_otp(phone, otp, context="registration")
        log.info(f"Phone OTP sent: phone={phone}")
    except Exception as e:
        log.error(f"Failed to send phone OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP")
    
    return {
        "message": f"OTP sent to {phone}",
        "otp_debug": otp if settings.DEBUG else None
    }


@router.post("/register/complete", status_code=201)
async def complete_registration(data: CompleteRegistrationRequest, response: Response, request: Request):
    """Complete registration after verifying both email and phone OTPs."""
    log.info(f"Registration completion: email={data.email}, phone={data.phone}")
    
    db = get_database()
    redis = get_redis()
    
    # Normalize and validate phone
    phone = normalize_indian_phone(data.phone)
    
    # Verify Email OTP
    if redis:
        stored_email_otp = await redis.get(f"registration_email_otp:{data.email}")
    else:
        otp_doc = await db.registration_otps.find_one({"email": data.email, "type": "email"})
        stored_email_otp = otp_doc["otp"] if otp_doc else None
    
    if not stored_email_otp or stored_email_otp != data.email_otp:
        log.warning(f"Email OTP verification failed: email={data.email}")
        raise HTTPException(status_code=400, detail="Invalid or expired email OTP")
    
    # Verify Phone OTP
    if redis:
        stored_phone_otp = await redis.get(f"registration_phone_otp:{phone}")
    else:
        otp_doc = await db.registration_otps.find_one({"phone": phone, "type": "phone"})
        stored_phone_otp = otp_doc["otp"] if otp_doc else None
    
    if not stored_phone_otp or stored_phone_otp != data.phone_otp:
        log.warning(f"Phone OTP verification failed: phone={phone}")
        raise HTTPException(status_code=400, detail="Invalid or expired phone OTP")
    
    # Both OTPs verified - Create user
    hashed_email = generate_deterministic_hash(data.email)
    hashed_phone = generate_deterministic_hash(phone)
    
    # Double-check no duplicate
    existing = await db.users.find_one({"$or": [
        {"hashed_email": hashed_email},
        {"hashed_phone": hashed_phone}
    ]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")
    
    user_doc = {
        "email": data.email,
        "password_hash": get_password_hash(data.password),
        "full_name": data.full_name,
        "phone": phone,
        "role": "customer",
        "kyc_status": "not_initiated",
        "is_active": True,
        "email_verified": True,
        "phone_verified": True,
        "verified_phone": phone,
        "phone_verified_at": datetime.utcnow(),
        "sim_binding_enabled": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "avatar_url": None,
        "is_first_time_investor": True,
        "is_new_user": True,
        "credit_score": 650,
        "credit_score_previous": 650,
        "credit_score_updated_at": datetime.utcnow(),
    }
    
    encrypted_user_doc = encrypt_user_data(user_doc)
    encrypted_user_doc["hashed_email"] = hashed_email
    encrypted_user_doc["hashed_phone"] = hashed_phone
    
    result = await db.users.insert_one(encrypted_user_doc)
    user_doc["_id"] = result.inserted_id
    user_id = str(result.inserted_id)
    
    log.info(f"User created with verified email & phone: id={user_id}")
    
    # Clean up OTPs
    if redis:
        await redis.delete(f"registration_email_otp:{data.email}")
        await redis.delete(f"registration_phone_otp:{phone}")
    
    # Publish event
    await kafka_service.publish("user.activity", {
        "action": "user_registered",
        "user_id": user_id,
        "email": data.email,
        "phone_verified": True,
        "email_verified": True,
    })
    
    # Send welcome email
    try:
        # Fire-and-forget welcome email (don't block registration)
        asyncio.create_task(
            email_service.send_welcome_email(data.email, data.full_name))
    except Exception as e:
        log.error(f"Failed to send welcome email: {e}")
    
    # Auto-login: Create session and generate tokens
    session_id = str(uuid.uuid4())
    forwarded_for = request.headers.get("X-Forwarded-For")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")
    ua_string = request.headers.get("User-Agent", "")
    
    # Simple device info for registration
    device_info = {"browser": "Direct", "os": "Direct", "device_type": "Desktop"}
    try:
        from app.services.device_service import check_and_save_device
        device_res = await check_and_save_device(db, user_id, client_ip, ua_string)
        device_info = device_res["device_info"]
    except:
        pass

    session_doc = {
        "session_id": session_id,
        "user_id": user_id,
        "device_info": device_info,
        "ip_address": client_ip,
        "created_at": datetime.utcnow(),
        "last_active": datetime.utcnow(),
        "is_active": True,
        "revoked_at": None
    }
    
    redis = get_redis()
    if redis:
        await redis.setex(f"session:{session_id}", 7 * 86400, json.dumps(session_doc, default=str))
        await redis.sadd(f"user_sessions:{user_id}", session_id)
    else:
        await db.sessions.insert_one(session_doc)

    access_token = create_access_token({"sub": user_id, "role": user_doc["role"]}, session_id=session_id)
    refresh_token = create_refresh_token({"sub": user_id}, session_id=session_id)
    tokens =set_auth_cookies(response, access_token, refresh_token)
    
    log.info(f"User auto-logged in with session_id={session_id}: id={user_id}")
    
    return {
        "user": user_to_response(user_doc).dict(),
        **tokens,
        "message": "Registration successful. Email and phone verified.",
    }

@router.post("/login")
async def login(credentials: UserLogin, response: Response, request: Request):
    log.info(f"Login attempt: email={credentials.email}")
    
    # Verify captcha
    if credentials.captcha_token:
        client_ip = request.client.host if request.client else None
        captcha_result = await turnstile_service.verify_token(credentials.captcha_token, client_ip)
        if not captcha_result.get("success"):
            log.warning(f"Login captcha verification failed: {captcha_result.get('error')}")
            raise HTTPException(status_code=400, detail="Captcha verification failed")
    
    db = get_database()
    hashed_email = generate_deterministic_hash(credentials.email)
    user = await db.users.find_one({"hashed_email": hashed_email})

    user = decrypt_user_data(user) if user else None  # Decrypt fields if user exists

    if not user or not verify_password(credentials.password, user["password_hash"]):
        log.warning(f"Login failed: invalid credentials for {hashed_email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("is_active", True):
        log.warning(f"Login blocked: account deactivated for {hashed_email}")
        raise HTTPException(status_code=403, detail="Account is deactivated")

    user_id = str(user["_id"])
    log.info(f"Login successful: user={user_id}, email={credentials.email}, role={user['role']}")

    # ── Device & Geolocation Detection ────────────────────────
    # Extract IP (respects reverse proxy X-Forwarded-For header)
    forwarded_for = request.headers.get("X-Forwarded-For")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")
    ua_string = request.headers.get("User-Agent", "")
    login_time = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")

    try:
        device_result = await check_and_save_device(db, user_id, client_ip, ua_string)
        is_new_device = device_result["is_new_device"]
        is_new_location = device_result["is_new_location"]
        device_info = device_result["device_info"]
        location = device_result["location"]

        if is_new_device or is_new_location:
            reason = "new device" if is_new_device else "new location"
            log.warning(f"[security] {reason.upper()} detected for user={user_id}: {device_info['browser']} on {device_info['os']} from {location['full_location']}")

            # Fire-and-forget security alert email (don't block login)
            asyncio.create_task(
                email_service.send_new_device_alert(
                    to_email=user["email"],
                    full_name=user["full_name"],
                    browser=device_info["browser"],
                    os_info=device_info["os"],
                    device_type=device_info["device_type"],
                    location=location["full_location"],
                    ip_address=client_ip,
                    login_time=login_time,
                )
            )

            # Publish security event to Kafka
            await kafka_service.publish("user.security", {
                "action": "new_device_login" if is_new_device else "new_location_login",
                "user_id": user_id,
                "ip": client_ip,
                "location": location["full_location"],
                "browser": device_info["browser"],
                "os": device_info["os"],
            })
    except Exception as e:
        log.warning(f"Device detection failed (non-blocking): {e}")
    # ────────────────────────────────────────────────────────────

    # Publish login event
    await kafka_service.publish("user.activity", {
        "action": "user_login",
        "user_id": user_id,
        "email": user["email"],
    })

    # Create session
    session_id = str(uuid.uuid4())
    session_doc = {
        "session_id": session_id,
        "user_id": user_id,
        "device_info": device_info if 'device_info' in locals() else {"browser": "Unknown", "os": "Unknown", "device_type": "Unknown"},
        "ip_address": client_ip,
        "created_at": datetime.utcnow(),
        "last_active": datetime.utcnow(),
        "is_active": True,
        "revoked_at": None
    }
    
    redis = get_redis()
    if redis:
        # Store session in Redis with 7 days expiry and add to user sessions set
        await redis.setex(f"session:{session_id}", 7 * 86400, json.dumps(session_doc, default=str))
        await redis.sadd(f"user_sessions:{user_id}", session_id)
        log.info(f"Session created in Redis: session_id={session_id}")
    else:
        # Store in MongoDB
        await db.sessions.insert_one(session_doc)
        log.info(f"Session created in MongoDB: session_id={session_id}")

    # Generate tokens with session_id
    access_token = create_access_token({"sub": user_id, "role": user["role"]}, session_id=session_id)
    refresh_token = create_refresh_token({"sub": user_id}, session_id=session_id)
    tokens = set_auth_cookies(response, access_token, refresh_token)

    return {
        "user": user_to_response(user).dict(),
        "message": "Login successful",
        **tokens
    }


@router.post("/security/report")
async def report_unauthorized_login(response: Response, current_user: dict = Depends(get_current_user)):
    """Called when user clicks 'This wasn't me' — logs out and flags for review."""
    user_id = current_user["id"]
    db = get_database()
    log.warning(f"[security] Unauthorized login reported by user={user_id}")

    # Mark the user account as flagged for security review
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"security_flagged": True, "security_flagged_at": datetime.utcnow()}}
    )

    # Publish security event
    await kafka_service.publish("user.security", {
        "action": "unauthorized_login_reported",
        "user_id": user_id,
    })

    # Clear all sessions (logout)
    clear_auth_cookies(response)
    log.info(f"[security] User {user_id} logged out and flagged after reporting unauthorized login")

    return {"message": "Your account has been flagged and you have been logged out. Our security team will review this.", "flagged": True}


@router.post("/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    log.info("Token refresh requested")
    token = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        log.debug("Refresh token found in Authorization header")

# check cookie if not found in header (for web clients)
    if not token:
        token = request.cookies.get("refresh_token")
        if token:
            log.debug("Refresh token found in cookie")

    # As a fallback for backward compatibility, also check body (though ideally clients should send in header or cookie)
    if not token:
        # Fallback: accept from body for backward compatibility
        try:
            body = await request.json()
            token = body.get("refresh_token")
        except Exception:
            pass

    if not token:
        log.warning("Token refresh failed: no refresh token found")
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_token(token)
    if payload.get("type") != "refresh":
        log.warning("Token refresh failed: invalid token type")
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    session_id = payload.get("session_id")
    
    # If session_id exists in refresh token, verify it's still alive
    if session_id:
        redis = get_redis()
        db = get_database()
        session_valid = False
        if redis:
            session_data = await redis.get(f"session:{session_id}")
            session_valid = session_data is not None
        else:
            session_doc = await db.sessions.find_one({"session_id": session_id, "is_active": True})
            session_valid = session_doc is not None
            
        if not session_valid:
            log.warning(f"Token refresh blocked: session {session_id} is revoked")
            clear_auth_cookies(response)
            raise HTTPException(status_code=401, detail="Session has been revoked")

    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        log.warning(f"Token refresh failed: user not found for sub={user_id}")
        raise HTTPException(status_code=401, detail="User not found")
    
    user = decrypt_user_data(user) if user else None  # Decrypt fields if user exists

    new_access = create_access_token({"sub": user_id, "role": user["role"]}, session_id=session_id)
    new_refresh = create_refresh_token({"sub": user_id}, session_id=session_id)
    tokens = set_auth_cookies(response, new_access, new_refresh)
    log.info(f"Token refreshed successfully for user={user_id}, session_id={session_id}")

    return {
        "user": user_to_response(user).dict(),
        "message": "Token refreshed",
        **tokens
    }


@router.post("/logout")
async def logout(response: Response):
    log.info("Logout requested")
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    log.debug(f"Profile requested: user={current_user['id']}")
    return user_to_response(current_user)


@router.post("/send-otp")
async def send_otp(current_user: dict = Depends(get_current_user)):
    """Generate and store OTP in Redis."""
    redis = get_redis()
    otp = "".join(random.choices(string.digits, k=6))
    user_id = current_user["id"]

    log.info(f"OTP generation requested: user={user_id}")

    if redis:
        await redis.setex(f"otp:{user_id}", settings.OTP_EXPIRE_SECONDS, otp)
        log.info(f"OTP stored in Redis for user={user_id}, expires in {settings.OTP_EXPIRE_SECONDS}s")
    else:
        db = get_database()
        update_fields = encrypt_update_fields({"otp": otp, "created_at": datetime.utcnow()})
        await db.otps.update_one(
            {"user_id": user_id},
            {"$set": update_fields},
            upsert=True
        )
        log.info(f"OTP stored in MongoDB (Redis unavailable) for user={user_id}")

    log.debug(f"OTP generated for user={user_id}: {otp if settings.DEBUG else '[MASKED]'}")
    
    # Sends Verification Email
    try:
        await kafka_service.publish("email.otpVerification", {
            "user_email": current_user["email"],
            "otp_code": otp
        })
    except Exception as e:
        log.error(f"Failed to send verification email: {e}")

    # Sends Verification SMS (Twilio)
    try:
        await sms_service.send_otp(current_user["phone"], otp, context="login")
    except Exception as e:
        log.error(f"Failed to send verification SMS via Twilio: {e}")

    return {"message": "OTP sent successfully", "otp_debug": otp if settings.DEBUG else None}


@router.post("/verify-otp")
async def verify_otp(otp: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    log.info(f"OTP verification attempt: user={user_id}")

    redis = get_redis()
    if redis:
        stored_otp = await redis.get(f"otp:{user_id}")
    else:
        db = get_database()
        otp_doc = await db.otps.find_one({"user_id": user_id})
        stored_otp = otp_doc["otp"] if otp_doc else None

    if not stored_otp or stored_otp != otp:
        log.warning(f"OTP verification failed: user={user_id} (invalid or expired)")
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if redis:
        await redis.delete(f"otp:{user_id}")

    log.info(f"OTP verified successfully: user={user_id}")
    return {"message": "OTP verified successfully", "verified": True}


@router.put("/recovery-info")
async def update_recovery_info(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update user's recovery email and phone number."""
    user_id = current_user["id"]
    log.info(f"Recovery info update requested: user={user_id}")
    
    update_fields = {}
    
    if data.recovery_email:
        update_fields["recovery_email"] = data.recovery_email
    
    if data.recovery_phone:
        if not data.recovery_phone.isdigit() or len(data.recovery_phone) != 10:
            raise HTTPException(status_code=400, detail="Recovery phone must be exactly 10 digits")
        update_fields["recovery_phone"] = f"+91{data.recovery_phone}"
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No recovery information provided")
    
    update_fields["updated_at"] = datetime.utcnow()
    encrypted_fields = encrypt_update_fields(update_fields)
    
    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": encrypted_fields}
    )
    
    # Fetch updated user data
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    updated_user = decrypt_user_data(updated_user)
    
    log.info(f"Recovery info updated successfully: user={user_id}")
    return {
        "message": "Recovery information updated successfully",
        "user": user_to_response(updated_user).dict()
    }


@router.post("/recovery-info/send-otp")
async def send_recovery_otp(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Send OTP to recovery email and phone for verification."""
    user_id = current_user["id"]
    log.info(f"Recovery OTP requested: user={user_id}")
    
    if not data.recovery_email and not data.recovery_phone:
        raise HTTPException(status_code=400, detail="Provide recovery email or phone")
    
    # Validate phone format
    recovery_phone_normalized = None
    if data.recovery_phone:
        if not data.recovery_phone.isdigit() or len(data.recovery_phone) != 10:
            raise HTTPException(status_code=400, detail="Recovery phone must be exactly 10 digits")
        recovery_phone_normalized = f"+91{data.recovery_phone}"
    
    redis = get_redis()
    db = get_database()
    
    # Generate OTPs
    email_otp = "".join(random.choices(string.digits, k=6))
    phone_otp = "".join(random.choices(string.digits, k=6))
    
    # Debug: Print OTPs in development
    if settings.DEBUG:
        log.info(f"[DEBUG] Recovery Email OTP: {email_otp}")
        log.info(f"[DEBUG] Recovery Phone OTP: {phone_otp}")
    
    # Store OTPs
    if data.recovery_email:
        if redis:
            await redis.setex(f"recovery_email_otp:{user_id}", 300, email_otp)
        else:
            await db.recovery_otps.update_one(
                {"user_id": user_id, "type": "email"},
                {"$set": {"otp": email_otp, "created_at": datetime.utcnow()}},
                upsert=True
            )
        
        # Sends email OTP
        try:
            await kafka_service.publish("email.otpVerification", {
                "user_email": data.recovery_email,
                "otp_code": email_otp
            })
            log.info(f"Recovery email OTP sent: user={user_id}")
        except Exception as e:
            log.error(f"Failed to send recovery email OTP: {e}")
            raise HTTPException(status_code=500, detail="Failed to send email OTP")
    
    if recovery_phone_normalized:
        if redis:
            await redis.setex(f"recovery_phone_otp:{user_id}", 300, phone_otp)
        else:
            await db.recovery_otps.update_one(
                {"user_id": user_id, "type": "phone"},
                {"$set": {"otp": phone_otp, "created_at": datetime.utcnow()}},
                upsert=True
            )
        
        # Send phone OTP
        try:
            await sms_service.send_otp(recovery_phone_normalized, phone_otp, context="recovery")
            log.info(f"Recovery phone OTP sent: user={user_id}")
        except Exception as e:
            log.error(f"Failed to send recovery phone OTP: {e}")
            raise HTTPException(status_code=500, detail="Failed to send phone OTP")
    
    return {
        "message": "OTP sent to recovery email and phone",
        "email_otp_debug": email_otp if settings.DEBUG and data.recovery_email else None,
        "phone_otp_debug": phone_otp if settings.DEBUG and recovery_phone_normalized else None,
    }


@router.post("/recovery-info/verify-and-update")
async def verify_and_update_recovery_info(
    recovery_email: Optional[str] = None,
    recovery_phone: Optional[str] = None,
    email_otp: Optional[str] = None,
    phone_otp: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Verify OTPs and update recovery information."""
    user_id = current_user["id"]
    log.info(f"Recovery info verification: user={user_id}")
    
    if not recovery_email and not recovery_phone:
        raise HTTPException(status_code=400, detail="Provide recovery email or phone")
    
    redis = get_redis()
    db = get_database()
    
    # Verifies email OTP
    if recovery_email:
        if not email_otp:
            raise HTTPException(status_code=400, detail="Email OTP required")
        
        stored_email_otp = None
        if redis:
            stored_email_otp = await redis.get(f"recovery_email_otp:{user_id}")
        else:
            otp_doc = await db.recovery_otps.find_one({"user_id": user_id, "type": "email"})
            stored_email_otp = otp_doc["otp"] if otp_doc else None
        
        if not stored_email_otp or stored_email_otp != email_otp:
            log.warning(f"Recovery email OTP verification failed: user={user_id}")
            raise HTTPException(status_code=400, detail="Invalid or expired email OTP")
    
    # Verifies phone OTP
    if recovery_phone:
        if not phone_otp:
            raise HTTPException(status_code=400, detail="Phone OTP required")
        
        stored_phone_otp = None
        if redis:
            stored_phone_otp = await redis.get(f"recovery_phone_otp:{user_id}")
        else:
            otp_doc = await db.recovery_otps.find_one({"user_id": user_id, "type": "phone"})
            stored_phone_otp = otp_doc["otp"] if otp_doc else None
        
        if not stored_phone_otp or stored_phone_otp != phone_otp:
            log.warning(f"Recovery phone OTP verification failed: user={user_id}")
            raise HTTPException(status_code=400, detail="Invalid or expired phone OTP")
    
    # OTPs verified -Updates recovery info
    update_fields = {}
    if recovery_email:
        update_fields["recovery_email"] = recovery_email
    if recovery_phone:
        if not recovery_phone.isdigit() or len(recovery_phone) != 10:
            raise HTTPException(status_code=400, detail="Recovery phone must be exactly 10 digits")
        update_fields["recovery_phone"] = f"+91{recovery_phone}"
    
    update_fields["updated_at"] = datetime.utcnow()
    encrypted_fields = encrypt_update_fields(update_fields)
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": encrypted_fields}
    )
    
    # Cleans up OTPs
    if redis:
        if recovery_email:
            await redis.delete(f"recovery_email_otp:{user_id}")
        if recovery_phone:
            await redis.delete(f"recovery_phone_otp:{user_id}")
    
    # Fetches updated user
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    updated_user = decrypt_user_data(updated_user)
    
    log.info(f"Recovery info verified and updated: user={user_id}")
    return {
        "message": "Recovery information verified and updated successfully",
        "user": user_to_response(updated_user).dict()
    }


@router.post("/request-password-reset")
async def request_password_reset(data: PasswordResetRequest):
    """Request password reset - sends OTP to recovery email/phone."""
    log.info(f"Password reset requested: email={data.email}")
    
    db = get_database()
    redis = get_redis()
    hashed_email = generate_deterministic_hash(data.email)
    
    # 3 requests per email per hour
    rate_limit_key = f"password_reset_rate:{hashed_email}"
    if redis:
        request_count = await redis.get(rate_limit_key)
        request_count = int(request_count) if request_count else 0
        if request_count >= 3:
            log.warning(f"Password reset rate limit exceeded: email={data.email}")
            raise HTTPException(status_code=429, detail="Too many password reset requests. Please try again in an hour.")
        
        # Increment counter with 1 hour expiry
        await redis.incr(rate_limit_key)
        if request_count == 0:
            await redis.expire(rate_limit_key, 3600)
    
    # Always return same response to prevent user enumeration
    success_message = "If this email exists, you will receive a password reset code."
    
    user = await db.users.find_one({"hashed_email": hashed_email})
    
    if not user:
        log.warning(f"Password reset requested for non-existent email: {data.email}")
        # Return success to prevent enumeration
        return {"message": success_message}
    
    user = decrypt_user_data(user)
    
    # Check if user has recovery email or phone
    if not user.get("recovery_email") and not user.get("recovery_phone"):
        log.warning(f"Password reset failed: no recovery info for {data.email}")
        return {"message": success_message}
    
    # Generate OTP
    otp = "".join(random.choices(string.digits, k=6))
    user_id = str(user["_id"])
    
    # Store OTP
    if redis:
        await redis.setex(f"password_reset_otp:{user_id}", 300, otp)
        log.info(f"Password reset OTP stored in Redis: user={user_id}")
    else:
        await db.password_reset_otps.update_one(
            {"user_id": user_id},
            {"$set": {"otp": otp, "created_at": datetime.utcnow()}},
            upsert=True
        )
        log.info(f"Password reset OTP stored in MongoDB: user={user_id}")
    
    # Prints OTP in development
    if settings.DEBUG:
        log.info(f"[DEBUG] Password Reset OTP: {otp}")
    
    # Sends OTP to recovery email
    if user.get("recovery_email"):
        try:
            await kafka_service.publish("email.otpVerification", {
                "user_email": user["recovery_email"],
                "otp_code": otp
            })
            log.info(f"Password reset OTP sent to recovery email: user={user_id}")
        except Exception as e:
            log.error(f"Failed to send password reset email: {e}")
    
    # Sends OTP to recovery phone
    if user.get("recovery_phone"):
        try:
            await sms_service.send_otp(user["recovery_phone"], otp, context="password_reset")
            log.info(f"Password reset OTP sent to recovery phone: user={user_id}")
        except Exception as e:
            log.error(f"Failed to send password reset SMS: {e}")
    
    # Publishes security event
    await kafka_service.publish("user.security", {
        "action": "password_reset_requested",
        "user_id": user_id,
        "email": data.email,
    })
    
    return {
        "message": success_message,
        "otp_debug": otp if settings.DEBUG else None
    }


@router.post("/reset-password")
async def reset_password(data: PasswordResetConfirm):
    """Reset password with OTP verification."""
    log.info(f"Password reset confirmation: email={data.email}")
    
    db = get_database()
    hashed_email = generate_deterministic_hash(data.email)
    
    user = await db.users.find_one({"hashed_email": hashed_email})
    
    if not user:
        log.warning(f"Password reset failed: user not found - {data.email}")
        raise HTTPException(status_code=400, detail="Invalid email or OTP")
    
    user = decrypt_user_data(user)
    user_id = str(user["_id"])
    redis = get_redis()
    
    # Verifies OTP
    stored_otp = None
    if redis:
        stored_otp = await redis.get(f"password_reset_otp:{user_id}")
    else:
        otp_doc = await db.password_reset_otps.find_one({"user_id": user_id})
        stored_otp = otp_doc["otp"] if otp_doc else None
    
    if not stored_otp or stored_otp != data.otp:
        log.warning(f"Password reset OTP verification failed: user={user_id}")
        if redis:
            # Increment failed attempts
            attempts_key = f"password_reset_attempts:{user_id}"
            attempts = await redis.incr(attempts_key)
            if attempts == 1:
                await redis.expire(attempts_key, 3600)  # 1 hour expiry
            
            if attempts >= 5:
                log.warning(f"Password reset blocked due to too many failed OTP attempts: user={user_id}")
                raise HTTPException(status_code=429, detail="Too many failed OTP attempts. Please request a new password reset.")
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    # Updates password
    new_password_hash = get_password_hash(data.new_password)
    update_fields = {
        "password_hash": new_password_hash,
        "updated_at": datetime.utcnow()
    }
    encrypted_fields = encrypt_update_fields(update_fields)
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": encrypted_fields}
    )
    
    # Cleans up OTP and attempts
    if redis:
        await redis.delete(f"password_reset_otp:{user_id}")
        await redis.delete(f"password_reset_attempts:{user_id}")
    else:
        await db.password_reset_otps.delete_one({"user_id": user_id})
    
    log.info(f"Password reset successful: user={user_id}")
    
    # Publishes security event
    await kafka_service.publish("user.security", {
        "action": "password_reset_completed",
        "user_id": user_id,
        "email": data.email,
    })
    
    # Sends confirmation email
    if user.get("email"):
        try:
            # Creates a dedicated password reset confirmation email
            await kafka_service.publish("email.otpVerification", {
                "user_email": user["email"],
                "otp_code": f"Your password has been reset successfully."
            })
        except Exception as e:
            log.error(f"Failed to send password reset confirmation: {e}")
    
    return {"message": "Password reset successful. You can now login with your new password."}
@router.put("/profile")
async def update_profile(data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update non-sensitive user profile information."""
    user_id = current_user["id"]
    db = get_database()
    
    update_fields = {}
    if data.language:
        update_fields["language"] = data.language
    if data.avatar_url:
        update_fields["avatar_url"] = data.avatar_url
    if data.theme_mode:
        update_fields["theme_mode"] = data.theme_mode
    if data.accessibility:
        # Deep merge or full replace? Full replace for simplicity as frontend sends the whole object
        update_fields["accessibility"] = data.accessibility
    if data.is_new_user is not None:
        update_fields["is_new_user"] = data.is_new_user
    
    if not update_fields:
        return {"message": "No changes requested", "user": user_to_response(current_user).dict()}
        
    update_fields["updated_at"] = datetime.utcnow()
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields}
    )
    
    # Fetch updated user
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    updated_user = decrypt_user_data(updated_user)
    
    log.info(f"User profile updated: user={user_id}, fields={list(update_fields.keys())}")
    return {
        "message": "Profile updated successfully",
        "user": user_to_response(updated_user).dict()
    }


# ── Sentinel Admin Login ─────────────────────────────────────────────────────
# Separate from the main /login — no captcha, no device detection.
# Accepts email + password + 6-digit PIN.  PIN is always 000000 for demo.

class AdminLoginRequest(BaseModel):
    email: str
    password: str
    pin: str

    class Config:
        extra = "ignore"


@router.post("/admin/login")
async def admin_login(body: AdminLoginRequest):
    ADMIN_ROLES = {"superadmin"}
    ADMIN_PIN = "000000"

    if body.pin != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Invalid PIN")

    db = get_database()
    hashed_email = generate_deterministic_hash(body.email)
    user = await db.users.find_one({"hashed_email": hashed_email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Sentinel-seeded users are not encrypted; main-seeded users are.
    try:
        user = decrypt_user_data(user)
    except Exception:
        pass

    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Access restricted to admin roles")

    user_id = str(user["_id"])
    access_token = create_access_token(
        {"sub": user_id, "role": user["role"]},
    )

    return {
        "data": {
            "access_token": access_token,
            "user": {
                "id": user_id,
                "name": user.get("full_name") or user.get("name", "Admin"),
                "email": user.get("email", body.email),
                "role": user.get("role"),
                "department": user.get("department", "Security"),
                "employee_id": user.get("employee_id", ""),
            },
        }
    }
