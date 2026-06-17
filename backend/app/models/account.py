from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AccountType(str, Enum):
    SAVINGS = "savings"
    CURRENT = "current"
    FIXED_DEPOSIT = "fixed_deposit"
    RECURRING_DEPOSIT = "recurring_deposit"
    EXTERNAL = "external"


class AccountStatus(str, Enum):
    ACTIVE = "active"
    FROZEN = "frozen"
    CLOSED = "closed"


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_number: str = Field(..., min_length=8, max_length=18, pattern=r"^\d+$")
    account_type: AccountType = AccountType.SAVINGS
    bank_name: str = "WealthVault Bank"
    currency: str = "INR"
    initial_deposit: float = Field(default=0, ge=0)


class LinkExternalAccount(BaseModel):
    bank_name: str
    account_number: str
    ifsc_code: str
    account_holder_name: str
    balance: float = 0.0


class AccountResponse(BaseModel):
    id: str
    user_id: str
    account_number: str
    account_type: str
    bank_name: str
    balance: float
    currency: str
    status: str
    is_external: bool = False
    created_at: Optional[str] = None


class TransactionType(str, Enum):
    CREDIT = "credit"
    DEBIT = "debit"
    TRANSFER = "transfer"


class TransactionCategory(str, Enum):
    SALARY = "salary"
    FOOD = "food"
    SHOPPING = "shopping"
    BILLS = "bills"
    ENTERTAINMENT = "entertainment"
    TRAVEL = "travel"
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    INVESTMENT = "investment"
    TRANSFER = "transfer"
    OTHER = "other"


class TransactionCreate(BaseModel):
    account_id: str
    amount: float = Field(..., gt=0)
    transaction_type: TransactionType
    category: TransactionCategory = TransactionCategory.OTHER
    description: str = ""
    to_account_id: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    account_id: str
    user_id: str
    amount: float
    transaction_type: str
    category: str
    description: str
    status: str
    risk_score: float = 0.0
    budget_alert: Optional[str] = None
    created_at: Optional[str] = None


class PaymentInitiate(BaseModel):
    from_account_id: str
    to_account_number: Optional[str] = None  # Traditional account number
    to_vpa: Optional[str] = None  # UPI VPA (e.g., user@wealthvault)
    amount: float = Field(..., gt=0)
    description: str = ""
    otp_channel: str = "email"  # "email" or "sms"

    @model_validator(mode="after")
    def validate_destination(self):
        # Require at least one destination, independent of field validation order.
        if not self.to_account_number and not self.to_vpa:
            raise ValueError('Either to_account_number or to_vpa must be provided')
        return self


class OTPVerify(BaseModel):
    payment_id: str
    otp: str


class LoanType(str, Enum):
    PERSONAL = "personal"
    HOME = "home"
    VEHICLE = "vehicle"
    EDUCATION = "education"
    BUSINESS = "business"


class LoanStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISBURSED = "disbursed"
    CLOSED = "closed"


class LoanApplication(BaseModel):
    loan_type: LoanType
    amount: float = Field(..., gt=0)
    tenure_months: int = Field(..., gt=0, le=360)
    purpose: str


class LoanResponse(BaseModel):
    id: str
    user_id: str
    loan_type: str
    amount: float
    tenure_months: int
    interest_rate: float
    emi: float
    status: str
    purpose: str
    created_at: Optional[str] = None
