"""Authentication routes - JWT via secure httpOnly cookies."""
import random
import string
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status, Response, Request
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
from app.services.device_service import check_and_save_device
from logifyx import Logifyx
from app.models.user import (
    UserCreate, UserLogin, UserResponse,
    TokenResponse, RefreshTokenRequest, UserRole,
    PhoneOTPRequest, VerifyPhoneRequest, CompleteRegistrationRequest
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
        path="/api/v1/auth",  # Only sent to auth endpoints
    )
    log.debug("Auth cookies set successfully")


def clear_auth_cookies(response: Response):
    """Clear auth cookies on logout."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    log.debug("Auth cookies cleared")


def user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user["full_name"],
        phone=user["phone"],
        role=user["role"],
        kyc_status=user.get("kyc_status", "pending"),
        is_active=user.get("is_active", True),
        created_at=str(user.get("created_at", "")),
        avatar_url=user.get("avatar_url"),
    )


@router.post("/register", status_code=201)
async def register(user_data: UserCreate, response: Response):
    """Legacy registration endpoint (without OTP verification). Use /register/complete for secure signup."""
    log.info(f"Legacy registration attempt: email={user_data.email}, role={user_data.role}")
    db = get_database()

    hashed_email = generate_deterministic_hash(user_data.email)
    hashed_phone = generate_deterministic_hash(user_data.phone)

    # Check if user exists
    existing = await db.users.find_one({"hashed_email": hashed_email})
    if existing:
        log.warning(f"Registration failed: email already exists - {user_data.email}")
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_phone = await db.users.find_one({"hashed_phone": hashed_phone})
    if existing_phone:
        log.warning(f"Registration failed: phone already exists - {user_data.phone}")
        raise HTTPException(status_code=400, detail="Phone number already registered")

    # Create user
    log.info(f"Creating new user: {user_data.email}")
    user_doc = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "role": user_data.role.value,
        "kyc_status": "pending",
        "is_active": True,
        "verified_phone": None,
        "phone_verified_at": None,
        "sim_binding_enabled": False,
        "email_verified": False,
        "phone_verified": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "avatar_url": None,
        "assigned_rm": None,
        "assigned_employee": None,
    }
    
    # encrypt user data before storing
    encrypted_user_doc = encrypt_user_data(user_doc)

    # deterministic hashes for indexed lookups
    encrypted_user_doc["hashed_email"] = hashed_email
    encrypted_user_doc["hashed_phone"] = hashed_phone

    result = await db.users.insert_one(encrypted_user_doc)
    user_doc["_id"] = result.inserted_id
    user_id = str(result.inserted_id)
    log.info(f"User created successfully: id={user_id}, email={user_data.email}")

    # Publish event
    await kafka_service.publish("user.activity", {
        "action": "user_registered",
        "user_id": user_id,
        "email": user_data.email,
    })
    
    # Send Welcome Email
    try:
        await email_service.send_welcome_email(user_data.email, user_data.full_name)
    except Exception as e:
        log.error(f"Failed to send welcome email: {e}")

    # Generate tokens and set cookies
    access_token = create_access_token({"sub": user_id, "role": user_doc["role"]})
    refresh_token = create_refresh_token({"sub": user_id})
    set_auth_cookies(response, access_token, refresh_token)
    log.info(f"Tokens set via cookies for new user: {user_id}")

    return {
        "user": user_to_response(user_doc).dict(),
        "message": "Registration successful",
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
        await email_service.send_verification_email(email, otp)
        log.info(f"Email OTP sent: email={email}")
    except Exception as e:
        log.error(f"Failed to send email OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP")
    
    return {
        "message": f"OTP sent to {email}",
        "otp_debug": otp if settings.DEBUG else None
    }


@router.post("/register/send-phone-otp")
async def send_phone_otp_for_registration(phone: str):
    """Send OTP to phone during registration."""
    log.info(f"Phone OTP requested for registration: phone={phone}")
    
    # Normalize phone
    if not phone.startswith("+"):
        phone = f"+91{phone}"
    
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
async def complete_registration(data: CompleteRegistrationRequest, response: Response):
    """Complete registration after verifying both email and phone OTPs."""
    log.info(f"Registration completion: email={data.email}, phone={data.phone}")
    
    db = get_database()
    redis = get_redis()
    
    # Normalize phone
    phone = data.phone if data.phone.startswith("+") else f"+91{data.phone}"
    
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
        "kyc_status": "pending",
        "is_active": True,
        "email_verified": True,
        "phone_verified": True,
        "verified_phone": phone,
        "phone_verified_at": datetime.utcnow(),
        "sim_binding_enabled": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "avatar_url": None,
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
        await email_service.send_welcome_email(data.email, data.full_name)
    except Exception as e:
        log.error(f"Failed to send welcome email: {e}")
    
    # Auto-login: Generate tokens
    access_token = create_access_token({"sub": user_id, "role": user_doc["role"]})
    refresh_token = create_refresh_token({"sub": user_id})
    set_auth_cookies(response, access_token, refresh_token)
    
    log.info(f"User auto-logged in: id={user_id}")
    
    return {
        "user": user_to_response(user_doc).dict(),
        "message": "Registration successful. Email and phone verified.",
    }

@router.post("/login")
async def login(credentials: UserLogin, response: Response, request: Request):
    log.info(f"Login attempt: email={credentials.email}")
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

    # Generate tokens and set cookies
    access_token = create_access_token({"sub": user_id, "role": user["role"]})
    refresh_token = create_refresh_token({"sub": user_id})
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "user": user_to_response(user).dict(),
        "message": "Login successful",
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

    # Read refresh token from cookie
    token = request.cookies.get("refresh_token")
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
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        log.warning(f"Token refresh failed: user not found for sub={user_id}")
        raise HTTPException(status_code=401, detail="User not found")
    
    user = decrypt_user_data(user) if user else None  # Decrypt fields if user exists

    new_access = create_access_token({"sub": user_id, "role": user["role"]})
    new_refresh = create_refresh_token({"sub": user_id})
    set_auth_cookies(response, new_access, new_refresh)
    log.info(f"Token refreshed successfully for user={user_id}")

    return {
        "user": user_to_response(user).dict(),
        "message": "Token refreshed",
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
    
    # Send Verification Email
    try:
        await email_service.send_verification_email(current_user["email"], otp)
    except Exception as e:
        log.error(f"Failed to send verification email: {e}")

    # Send Verification SMS (Twilio)
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
