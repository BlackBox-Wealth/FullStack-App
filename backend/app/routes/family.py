"""Family management routes."""
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, status
from bson import ObjectId
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.family import FamilyInvite, FamilyInviteResponse
from app.services.deterministic_hash import generate_deterministic_hash
from app.helper.utils import decrypt_user_data
from logifyx import Logifyx
from typing import Literal
from pydantic import BaseModel

log = Logifyx(name="wealthvault", color=True)
router = APIRouter(prefix="/family", tags=["Family"])


class FamilyInviteAction(BaseModel):
    invitation_id: str
    action: Literal["accept", "reject"]


class SetSpendingLimit(BaseModel):
    member_user_id: str
    spending_limit: float


@router.post("/invite", response_model=FamilyInviteResponse)
async def invite_member(
    invite_data: FamilyInvite,
    current_user: dict = Depends(get_current_user)
):
    """Send family invitation to another user by email."""
    db = get_database()
    inviter_id = current_user["id"]
    invitee_email = invite_data.invitee_email.lower()
    
    log.info(f"Family invite: inviter={inviter_id}, invitee_email={invitee_email}")
    
    # Validation 1: Cannot invite self
    if current_user["email"].lower() == invitee_email:
        log.warning(f"User {inviter_id} attempted to invite themselves")
        raise HTTPException(status_code=400, detail="Cannot invite yourself")
    
    # Validation 2: Check if invitee exists
    hashed_email = generate_deterministic_hash(invitee_email)
    invitee_user = await db.users.find_one({"hashed_email": hashed_email})
    
    if not invitee_user:
        log.warning(f"Invite failed: user not found - {invitee_email}")
        raise HTTPException(status_code=404, detail="User not found")
    
    invitee_user = decrypt_user_data(invitee_user)
    invitee_id = str(invitee_user["_id"])
    
    # Get or create family for inviter
    family = await db.families.find_one({"head_user_id": inviter_id})
    
    if not family:
        # Create new family
        family_doc = {
            "head_user_id": inviter_id,
            "family_name": f"{current_user['full_name']}'s Family",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_active": True
        }
        result = await db.families.insert_one(family_doc)
        family_id = str(result.inserted_id)
        
        # Add head as first member
        await db.family_members.insert_one({
            "family_id": family_id,
            "user_id": inviter_id,
            "role": "head",
            "status": "active",
            "invited_by": inviter_id,
            "invited_at": datetime.utcnow(),
            "accepted_at": datetime.utcnow()
        })
        log.info(f"Created new family: family_id={family_id}, head={inviter_id}")
    else:
        family_id = str(family["_id"])
    
    # Validation 3: Check if already a member
    existing_member = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": invitee_id
    })
    
    if existing_member:
        if existing_member["status"] == "active":
            raise HTTPException(status_code=400, detail="User is already a family member")
        elif existing_member["status"] == "pending":
            raise HTTPException(status_code=400, detail="Invitation already pending")
    
    # Validation 4: Check for duplicate pending invitation
    existing_invite = await db.family_invitations.find_one({
        "family_id": family_id,
        "invitee_email": invitee_email,
        "status": "pending"
    })
    
    if existing_invite:
        log.warning(f"Duplicate invite attempt: family={family_id}, invitee={invitee_email}")
        raise HTTPException(status_code=400, detail="Pending invitation already exists")
    
    # Create invitation
    invitation_code = secrets.token_urlsafe(32)
    invitation_doc = {
        "family_id": family_id,
        "inviter_user_id": inviter_id,
        "invitee_email": invitee_email,
        "invitee_user_id": invitee_id,
        "status": "pending",
        "invitation_code": invitation_code,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=7),
        "responded_at": None
    }
    
    result = await db.family_invitations.insert_one(invitation_doc)
    invitation_id = str(result.inserted_id)
    
    # Add member with pending status
    await db.family_members.insert_one({
        "family_id": family_id,
        "user_id": invitee_id,
        "role": "member",
        "status": "pending",
        "invited_by": inviter_id,
        "invited_at": datetime.utcnow(),
        "accepted_at": None,
        "rejected_at": None
    })
    
    log.info(f"Family invitation created: invitation_id={invitation_id}, family={family_id}")
    
    # TODO: Send email notification to invitee
    
    return FamilyInviteResponse(
        status="pending",
        invitation_id=invitation_id
    )


@router.post("/respond")
async def respond_to_invitation(
    action_data: FamilyInviteAction,
    current_user: dict = Depends(get_current_user)
):
    """Accept or reject a family invitation."""
    db = get_database()
    user_id = current_user["id"]
    invitation_id = action_data.invitation_id
    action = action_data.action
    
    log.info(f"Family invite response: user={user_id}, invitation={invitation_id}, action={action}")
    
    # Validation 1: Invitation must exist
    try:
        invitation = await db.family_invitations.find_one({"_id": ObjectId(invitation_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invitation ID")
    
    if not invitation:
        log.warning(f"Invitation not found: {invitation_id}")
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    # Validation 2: Only the invited user can respond
    if invitation["invitee_user_id"] != user_id:
        log.warning(f"Unauthorized response attempt: user={user_id}, invitation={invitation_id}")
        raise HTTPException(status_code=403, detail="You are not authorized to respond to this invitation")
    
    # Validation 3: Invitation must be pending
    if invitation["status"] != "pending":
        log.warning(f"Invitation already responded: {invitation_id}, status={invitation['status']}")
        raise HTTPException(
            status_code=400, 
            detail=f"Invitation already {invitation['status']}"
        )
    
    # Validation 4: Check if invitation expired
    if invitation["expires_at"] < datetime.utcnow():
        log.warning(f"Expired invitation: {invitation_id}")
        raise HTTPException(status_code=400, detail="Invitation has expired")
    
    family_id = invitation["family_id"]
    
    # Update invitation status
    new_status = "accepted" if action == "accept" else "rejected"
    await db.family_invitations.update_one(
        {"_id": ObjectId(invitation_id)},
        {
            "$set": {
                "status": new_status,
                "responded_at": datetime.utcnow()
            }
        }
    )
    
    # Update family member status
    if action == "accept":
        await db.family_members.update_one(
            {"family_id": family_id, "user_id": user_id},
            {
                "$set": {
                    "status": "active",
                    "accepted_at": datetime.utcnow()
                }
            }
        )
        log.info(f"User {user_id} accepted invitation to family {family_id}")
        message = "Invitation accepted successfully"
    else:
        await db.family_members.update_one(
            {"family_id": family_id, "user_id": user_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": datetime.utcnow()
                }
            }
        )
        log.info(f"User {user_id} rejected invitation to family {family_id}")
        message = "Invitation rejected"
    
    # TODO: Send notification to inviter
    
    return {
        "message": message,
        "status": new_status,
        "invitation_id": invitation_id
    }


@router.post("/set-limit")
async def set_spending_limit(
    limit_data: SetSpendingLimit,
    current_user: dict = Depends(get_current_user)
):
    """Set spending limit for a family member (head only)."""
    db = get_database()
    head_user_id = current_user["id"]
    member_user_id = limit_data.member_user_id
    spending_limit = limit_data.spending_limit
    
    log.info(f"Set spending limit: head={head_user_id}, member={member_user_id}, limit={spending_limit}")
    
    # Validation 1: Spending limit must be positive
    if spending_limit <= 0:
        raise HTTPException(status_code=400, detail="Spending limit must be greater than 0")
    
    # Validation 2: Cannot set limit for self
    if head_user_id == member_user_id:
        raise HTTPException(status_code=400, detail="Cannot set spending limit for yourself")
    
    # Validation 3: User must be head of a family
    family = await db.families.find_one({"head_user_id": head_user_id})
    
    if not family:
        log.warning(f"User {head_user_id} is not a family head")
        raise HTTPException(status_code=403, detail="Only family head can set spending limits")
    
    family_id = str(family["_id"])
    
    # Validation 4: Check if member exists in family
    member = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": member_user_id
    })
    
    if not member:
        log.warning(f"Member {member_user_id} not found in family {family_id}")
        raise HTTPException(status_code=404, detail="Member not found in your family")
    
    # Validation 5: Member must have accepted invitation
    if member["status"] != "active":
        log.warning(f"Member {member_user_id} status is {member['status']}, not active")
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot set limit for member with status: {member['status']}"
        )
    
    # Validation 6: Cannot set limit for head
    if member["role"] == "head":
        raise HTTPException(status_code=400, detail="Cannot set limit for family head")
    
    # Update spending limit
    await db.family_members.update_one(
        {"family_id": family_id, "user_id": member_user_id},
        {
            "$set": {
                "spending_limit": spending_limit,
                "limit_set_at": datetime.utcnow(),
                "limit_set_by": head_user_id
            }
        }
    )
    
    log.info(f"Spending limit set: family={family_id}, member={member_user_id}, limit={spending_limit}")
    
    # TODO: Send notification to member
    
    return {
        "message": "Spending limit set successfully",
        "member_user_id": member_user_id,
        "spending_limit": spending_limit
    }


@router.get("/my-family")
async def get_my_family(
    current_user: dict = Depends(get_current_user)
):
    """Get family information for current user."""
    db = get_database()
    user_id = current_user["id"]
    
    log.info(f"Fetching family info: user={user_id}")
    
    # Find user's family membership
    member_record = await db.family_members.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    if not member_record:
        log.info(f"User {user_id} is not part of any family")
        return {
            "is_member": False,
            "message": "You are not part of any family"
        }
    
    family_id = member_record["family_id"]
    
    # Get family details
    family = await db.families.find_one({"_id": ObjectId(family_id)})
    
    if not family:
        log.warning(f"Family not found: family_id={family_id}")
        raise HTTPException(status_code=404, detail="Family not found")
    
    # Get all family members
    members_cursor = db.family_members.find({"family_id": family_id})
    members = await members_cursor.to_list(100)
    
    # Fetch user details for each member
    member_list = []
    for member in members:
        user = await db.users.find_one({"_id": ObjectId(member["user_id"])})
        if user:
            user = decrypt_user_data(user)
            member_list.append({
                "user_id": member["user_id"],
                "email": user["email"],
                "full_name": user["full_name"],
                "role": member["role"],
                "status": member["status"],
                "spending_limit": member.get("spending_limit"),
                "joined_at": str(member.get("accepted_at", member.get("invited_at", ""))),
                "is_current_user": member["user_id"] == user_id
            })
    
    log.info(f"Family info retrieved: family={family_id}, members={len(member_list)}")
    
    return {
        "is_member": True,
        "family_id": str(family["_id"]),
        "family_name": family["family_name"],
        "head_user_id": family["head_user_id"],
        "created_at": str(family["created_at"]),
        "is_head": user_id == family["head_user_id"],
        "my_role": member_record["role"],
        "my_spending_limit": member_record.get("spending_limit"),
        "members": member_list,
        "total_members": len(member_list)
    }


@router.get("/invitations")
async def get_pending_invitations(
    current_user: dict = Depends(get_current_user)
):
    """Get pending family invitations for current user."""
    db = get_database()
    user_id = current_user["id"]
    user_email = current_user["email"]
    
    log.info(f"Fetching pending invitations: user={user_id}")
    
    # Find pending invitations for this user
    invitations_cursor = db.family_invitations.find({
        "invitee_email": user_email,
        "status": "pending"
    })
    invitations = await invitations_cursor.to_list(100)
    
    result = []
    for invite in invitations:
        # Get inviter details
        inviter = await db.users.find_one({"_id": ObjectId(invite["inviter_user_id"])})
        if inviter:
            inviter = decrypt_user_data(inviter)
            
            # Get family details
            family = await db.families.find_one({"_id": ObjectId(invite["family_id"])})
            
            result.append({
                "invitation_id": str(invite["_id"]),
                "inviter_name": inviter["full_name"],
                "inviter_email": inviter["email"],
                "family_name": family["family_name"] if family else "Unknown Family",
                "created_at": str(invite["created_at"])
            })
    
    log.info(f"Found {len(result)} pending invitations for user={user_id}")
    return result


@router.delete("/member/{member_user_id}")
async def remove_member(
    member_user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from family (head only)."""
    db = get_database()
    head_user_id = current_user["id"]
    
    log.info(f"Remove member request: head={head_user_id}, member={member_user_id}")
    
    # Cannot remove self
    if head_user_id == member_user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    
    # Check if user is head
    family = await db.families.find_one({"head_user_id": head_user_id})
    if not family:
        raise HTTPException(status_code=403, detail="Only family head can remove members")
    
    family_id = str(family["_id"])
    
    # Check if member exists
    member = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": member_user_id
    })
    
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in your family")
    
    if member["role"] == "head":
        raise HTTPException(status_code=400, detail="Cannot remove family head")
    
    # Delete member
    await db.family_members.delete_one({
        "family_id": family_id,
        "user_id": member_user_id
    })
    
    log.info(f"Member removed: family={family_id}, member={member_user_id}")
    
    return {"message": "Member removed successfully", "member_user_id": member_user_id}
