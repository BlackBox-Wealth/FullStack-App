from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from app.core.config import settings
from app.core.database import get_database
from app.helper.utils import decrypt_user_data
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   

security = HTTPBearer()


# Argon2 configuration (safe defaults)
_ph = PasswordHasher(
    time_cost=3,        # iterations
    memory_cost=65536,  # 64 MB
    parallelism=2,
    hash_len=32,
    salt_len=16
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False

def get_password_hash(password: str) -> str:
    try:
        if not password or not password.strip():
            raise ValueError("Password cannot be empty")
        return _ph.hash(password)
    
    except Exception:
        raise ValueError("Password hashing failed")


def get_password_hash(password: str) -> str:
    try:
        if not password or not password.strip():
            raise ValueError("Password cannot be empty")
        return _ph.hash(password)
    
    except Exception:
        raise ValueError("Password hashing failed")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    token = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    log.debug(f"Access token created for sub={data.get('sub')}, expires in {settings.ACCESS_TOKEN_EXPIRE_MINUTES}m")
    return token


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    token = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    log.debug(f"Refresh token created for sub={data.get('sub')}, expires in {settings.REFRESH_TOKEN_EXPIRE_DAYS}d")
    return token


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        log.debug(f"Token decoded successfully, type={payload.get('type')}, sub={payload.get('sub')}")
        return payload
    except JWTError as e:
        log.warning(f"JWT decode failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(request: Request):
    """Extract user from httpOnly cookie or Authorization header."""
    token = None

    # 1. Try httpOnly cookie first (secure)
    token = request.cookies.get("access_token")
    if token:
        log.debug("Token found in httpOnly cookie")

    # 2. Fallback to Authorization header (for API clients / testing)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            log.debug("Token found in Authorization header")

    if not token:
        log.warning("No auth token found in cookie or header")
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)

    if payload.get("type") != "access":
        log.warning(f"Invalid token type: {payload.get('type')} (expected 'access')")
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    if user_id is None:
        log.warning("Token missing 'sub' claim")
        raise HTTPException(status_code=401, detail="Invalid token")

    db = get_database()
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        log.warning(f"User not found for token sub={user_id}")
        raise HTTPException(status_code=401, detail="User not found")
    user = decrypt_user_data(user) if user else None  # Decrypt fields if user exists

    user["id"] = str(user["_id"])
    log.debug(f"Authenticated user: {user['email']} (role={user['role']})")
    return user


def require_role(*roles):
    """Decorator to require specific roles for an endpoint."""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            log.warning(
                f"Access denied: user={current_user.get('email')} "
                f"role={current_user.get('role')} required={roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(roles)}"
            )
        return current_user
    return role_checker
