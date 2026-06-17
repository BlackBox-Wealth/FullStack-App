from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ModuleEnum(str, Enum):
    phishing = "phishing"
    social_eng = "social_eng"
    incident_drill = "incident_drill"


class DifficultyEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class RoleEnum(str, Enum):
    teller = "teller"
    loan_officer = "loan_officer"
    it_admin = "IT_admin"
    all = "all"


class CertificationEnum(str, Enum):
    needs_training = "needs_training"
    aware = "aware"
    trained = "trained"
    certified = "certified"


class CampaignTriggerEnum(str, Enum):
    manual_single = "manual_single"
    manual_bulk = "manual_bulk"
    automatic_random = "automatic_random"


class CampaignStatusEnum(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"


class DeliveryStatusEnum(str, Enum):
    pending = "pending"
    delivered = "delivered"
    failed = "failed"


class AssignmentStatusEnum(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    expired = "expired"


class ThreatReviewEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ---- Request / Response models ----

class TriggerSingleRequest(BaseModel):
    employee_id_hash: str
    module: ModuleEnum
    template_id: Optional[str] = None
    due_in_hours: int = 168


class TriggerBulkRequest(BaseModel):
    name: str
    target: str  # "all" | "department:<name>" | "random:<pct>"
    module: ModuleEnum
    template_id: Optional[str] = None
    due_in_hours: int = 168
    scheduled_at: Optional[datetime] = None


class ScenarioResponseRequest(BaseModel):
    option_index: int


class IncidentSubmitRequest(BaseModel):
    incident_type: str
    affected_system: str
    time_detected: str
    description: str
    immediate_action_taken: str
    escalation_path: str


class ThreatApprovalRequest(BaseModel):
    reviewed_by: str


class StandardResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
