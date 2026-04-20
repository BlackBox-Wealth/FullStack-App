from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    CUSTOMER = "customer"
    EMPLOYEE = "employee"
    RELATIONSHIP_MANAGER = "relationship_manager"
    SUPER_ADMIN = "super_admin"


class KYCStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=10)
    role: UserRole = UserRole.CUSTOMER


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str
    role: str
    kyc_status: str = "pending"
    is_active: bool = True
    created_at: Optional[str] = None
    avatar_url: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    
# SIM Binding Models
class VerifyPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10)
    otp: str = Field(..., min_length=6, max_length=6)
class PhoneOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class CompleteRegistrationRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: str
    email_otp: str
    phone_otp: str
