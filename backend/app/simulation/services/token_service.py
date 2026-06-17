from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.core.config import settings


def create_tracking_token(attempt_id: str, assignment_id: str, employee_id_hash: str, module: str) -> str:
    import os
    ttl_hours = int(os.getenv("SIM_LINK_TTL_HOURS", "168"))  # default 7 days
    payload = {
        "attempt_id": attempt_id,
        "assignment_id": assignment_id,
        "employee_id_hash": employee_id_hash,
        "module": module,
        "type": "sim_tracking",
        "exp": datetime.utcnow() + timedelta(hours=ttl_hours),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_tracking_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "sim_tracking":
            raise ValueError("Invalid token type")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid tracking token: {e}")
