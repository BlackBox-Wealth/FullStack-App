from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.services.aa_service import aa_service
import uuid

router = APIRouter(prefix="/aa", tags=["Account Aggregator"])

# Temporary in-memory store for consents for demo purposes
consents = {}

@router.post("/consent/request")
async def request_consent(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    consent_id = str(uuid.uuid4())
    consents[consent_id] = {
        "user_id": user_id,
        "status": "pending",
        "created_at": "2026-04-21T10:00:00"
    }
    return {
        "consent_id": consent_id,
        "redirect_url": f"https://mock-aa-fiu.psb.in/consent/{consent_id}",
        "message": "Consent request initiated. Redirect user to AA handle."
    }

@router.get("/consent/{consent_id}")
async def get_consent_status(consent_id: str, current_user: dict = Depends(get_current_user)):
    if consent_id not in consents:
        raise HTTPException(status_code=404, detail="Consent not found")
    
    # In a real app, this would check the AA status. For mock, we'll auto-approve after a second.
    consents[consent_id]["status"] = "approved"
    return consents[consent_id]

@router.get("/accounts")
async def get_aa_accounts(current_user: dict = Depends(get_current_user)):
    # Simulate fetching accounts from approved FIPs via AA
    return aa_service.generate_external_accounts()

@router.get("/transactions/{account_id}")
async def get_aa_transactions(account_id: str, current_user: dict = Depends(get_current_user)):
    return aa_service.generate_external_transactions(account_id)
