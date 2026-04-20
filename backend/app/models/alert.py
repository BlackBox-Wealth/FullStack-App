from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class AlertType(str, Enum):
    HIGH_RISK_PAYMENT = "high_risk_payment"
    FRAUD_DETECTED = "fraud_detected"
    UNUSUAL_ACTIVITY = "unusual_activity"


class AlertCreate(BaseModel):
    user_id: str
    alert_type: AlertType
    risk_score: float = Field(..., ge=0.0, le=1.0)  # 0.0 to 1.0
    reason: str  # Why was this flagged
    payment_id: Optional[str] = None
    amount: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AlertResponse(BaseModel):
    id: str
    user_id: str
    alert_type: str
    risk_score: float
    reason: str
    payment_id: Optional[str] = None
    amount: Optional[float] = None
    is_read: bool = False
    created_at: str
    read_at: Optional[str] = None