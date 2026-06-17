from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime

class FamilyCreate(BaseModel):
    family_name: Optional[str] = "My Family"

class FamilyInvite(BaseModel):
    invitee_email: EmailStr

class FamilyInviteResponse(BaseModel):
    status: Literal["pending", "accepted", "rejected"]
    invitation_id: str

class FamilyMemberResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    status: str
    joined_at: Optional[str]

class FamilyResponse(BaseModel):
    id: str
    family_name: str
    head_user_id: str
    members: list[FamilyMemberResponse]
    created_at: str
