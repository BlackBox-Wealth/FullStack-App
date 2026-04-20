from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class InvestmentType(str, Enum):
    STOCKS = "stocks"
    MUTUAL_FUNDS = "mutual_funds"
    FIXED_DEPOSIT = "fixed_deposit"
    BONDS = "bonds"
    CRYPTO = "crypto"
    GOLD = "gold"


class RiskProfile(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class InvestmentCreate(BaseModel):
    investment_type: InvestmentType
    symbol: str
    amount: float = Field(..., gt=0)
    quantity: float = Field(..., gt=0)


class InvestmentResponse(BaseModel):
    id: str
    user_id: str
    investment_type: str
    symbol: str
    amount: float
    quantity: float
    buy_price: float = 0
    current_price: float = 0
    current_value: float = 0
    profit_loss: float = 0
    profit_loss_pct: float = 0
    created_at: Optional[str] = None


class PortfolioResponse(BaseModel):
    user_id: str
    total_invested: float
    current_value: float
    total_profit_loss: float
    total_profit_loss_pct: float
    risk_profile: str
    investments: List[InvestmentResponse]


class StockData(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: int
    market_cap: Optional[float] = None


class FinancialGoalCreate(BaseModel):
    name: str
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0, ge=0)
    deadline: str


# Alias for backward compatibility
FinancialGoal = FinancialGoalCreate


class FinancialGoalResponse(BaseModel):
    id: str
    user_id: str
    name: str
    target_amount: float
    current_amount: float
    progress_pct: float
    deadline: str
    status: str
    created_at: Optional[str] = None


class RecommendationResponse(BaseModel):
    id: str
    user_id: str
    recommendation_type: str
    title: str
    description: str
    confidence: float
    data: dict
    created_at: Optional[str] = None


class SIPFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class SIPStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class FundCategory(str, Enum):
    EQUITY = "equity"
    DEBT = "debt"
    HYBRID = "hybrid"


class SIPCreate(BaseModel):
    name: str
    fund_name: str
    fund_category: FundCategory
    amount: float = Field(..., gt=0)
    frequency: SIPFrequency = SIPFrequency.MONTHLY
    start_date: str
    account_id: str
    step_up_pct: float = Field(default=0, ge=0)
    goal_id: Optional[str] = None


class SIPUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    frequency: Optional[SIPFrequency] = None
    status: Optional[SIPStatus] = None
    step_up_pct: Optional[float] = Field(None, ge=0)


class SIPResponse(BaseModel):
    id: str
    user_id: str
    account_id: str
    name: str
    fund_name: str
    fund_category: str
    amount: float
    frequency: str
    status: str
    start_date: str
    next_installment: str
    total_invested: float = 0
    current_value: float = 0
    profit_loss: float = 0
    profit_loss_pct: float = 0
    installments_count: int = 0
    step_up_pct: float = 0
    goal_id: Optional[str] = None
    risk_level: str = "moderate"
    created_at: Optional[str] = None
