from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from enum import Enum
import re


class UserRole(str, Enum):
    CUSTOMER = "customer"
    EMPLOYEE = "employee"
    RELATIONSHIP_MANAGER = "relationship_manager"
    SUPER_ADMIN = "super_admin"


class KYCStatus(str, Enum):
    NOT_INITIATED = "not_initiated"
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    REUPLOAD_REQUESTED = "reupload_requested"


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=10, max_length=10)
    role: UserRole = UserRole.CUSTOMER
    captcha_token: Optional[str] = None
    
    @field_validator('phone')
    @classmethod
    def validate_indian_phone(cls, v):
        if not re.match(r'^[6-9]\d{9}$', v):
            raise ValueError('Phone must be 10 digits starting with 6-9')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    captcha_token: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str
    role: str
    kyc_status: str = KYCStatus.NOT_INITIATED.value
    is_active: bool = True
    created_at: Optional[str] = None
    avatar_url: Optional[str] = None
    recovery_email: Optional[str] = None
    recovery_phone: Optional[str] = None
    is_first_time_investor: bool = True
    is_new_user: bool = True
    language: str = "en"
    theme_mode: str = "linen"
    accessibility: dict = Field(default_factory=lambda: {
        "reducedMotion": False,
        "highContrast": False,
        "largeText": False,
        "compactDensity": False,
        "voiceNavigation": False,
        "screenReader": False,
    })


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    recovery_email: Optional[EmailStr] = None
    recovery_phone: Optional[str] = Field(None, min_length=10, max_length=10)
    language: Optional[str] = None
    theme_mode: Optional[str] = None
    accessibility: Optional[dict] = None
    is_new_user: Optional[bool] = None
    
    @field_validator('recovery_phone')
    @classmethod
    def validate_recovery_phone(cls, v):
        if v and not re.match(r'^[6-9]\d{9}$', v):
            raise ValueError('Recovery phone must be 10 digits starting with 6-9')
        return v
    
# SIM Binding Models
class VerifyPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=10)
    otp: str = Field(..., min_length=6, max_length=6)
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not re.match(r'^[6-9]\d{9}$', v):
            raise ValueError('Phone must be 10 digits starting with 6-9')
        return v

class PhoneOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=10)
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not re.match(r'^[6-9]\d{9}$', v):
            raise ValueError('Phone must be 10 digits starting with 6-9')
        return v

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
    phone: str = Field(..., min_length=10, max_length=10)
    email_otp: str
    phone_otp: str
    captcha_token: Optional[str] = None
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not re.match(r'^[6-9]\d{9}$', v):
            raise ValueError('Phone must be 10 digits starting with 6-9')
        return v


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)
