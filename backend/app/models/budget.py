from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class BudgetPeriod(str, Enum):
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    DAILY = "daily"


class BudgetCreate(BaseModel):
    category: str  # Category name or "General"
    amount_limit: float = Field(..., gt=0)
    period: BudgetPeriod = BudgetPeriod.MONTHLY


class BudgetResponse(BaseModel):
    id: str
    user_id: str
    category: str
    amount_limit: float
    current_spent: float
    remaining: float
    period: str
    status: str  # "healthy", "warning", "exceeded"
    created_at: Optional[str] = None
