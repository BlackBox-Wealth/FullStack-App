from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DeviceInfo(BaseModel):
    browser: str
    os: str
    device_type: str


class SessionResponse(BaseModel):
    session_id: str
    device_info: DeviceInfo
    ip_address: str
    created_at: str
    last_active: str
    is_active: bool
    is_current: Optional[bool] = False  # True if this is the current session
