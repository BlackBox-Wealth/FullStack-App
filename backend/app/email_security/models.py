from enum import Enum
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class EmailRiskFlag(str, Enum):
    urgency = "urgency"
    impersonation = "impersonation"
    credential_request = "credential_request"
    transfer_request = "transfer_request"
    secrecy_request = "secrecy_request"
    suspicious_link = "suspicious_link"
    authority_claim = "authority_claim"


class EmailRiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class InboundEmailRequest(BaseModel):
    email_id: str
    employee_id_hash: str
    sender_email: str
    sender_name: str
    subject: str
    body: str
    received_at: Optional[datetime] = None


class EmailInteractionEvent(BaseModel):
    email_id: str
    employee_id_hash: str
    action: str
    risk_score: float
    risk_level: str


class EmailRiskResult(BaseModel):
    email_id: str
    risk_score: float
    risk_level: EmailRiskLevel
    flags: List[EmailRiskFlag]
    explanation: str
    anonymized: bool = True
    language_detected: str = "en"