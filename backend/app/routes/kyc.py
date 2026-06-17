from fastapi import APIRouter, Depends, HTTPException, Body
from app.core.database import get_database
from app.core.security import get_current_user
from app.services.kyc_service import kyc_service
from datetime import datetime
from bson import ObjectId
from logifyx import Logifyx

log = Logifyx(name="wealthvault-kyc")
router = APIRouter(prefix="/kyc", tags=["KYC"])

@router.post("/upload")
async def upload_kyc_documents(
    aadhaar_front: str = Body(..., description="Base64 Aadhaar Front"),
    aadhaar_back: str = Body(..., description="Base64 Aadhaar Back"),
    pan: str = Body(..., description="Base64 PAN Card"),
    aadhaar_number: str = Body(None, description="12-digit Aadhaar Number"),
    pan_number: str = Body(None, description="10-character PAN Number"),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    log.info(f"KYC upload initiated by user: {user_id}")
    
    # Process with Gemini
    extracted_data = await kyc_service.process_kyc_documents(aadhaar_front, aadhaar_back, pan)
    
    if "error" in extracted_data:
        log.error(f"KYC processing error for user {user_id}: {extracted_data['error']}")
        raise HTTPException(status_code=500, detail=extracted_data["error"])

    db = get_database()
    
    # Prepare document for DB
    kyc_doc = {
        "user_id": user_id,
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "aadhaar_front": aadhaar_front,
        "aadhaar_back": aadhaar_back,
        "pan": pan,
        "aadhaar_number": aadhaar_number,
        "pan_number": pan_number,
        "extracted_data": extracted_data,
        "status": "pending_review",  # Status for employee review
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Upsert KYC document
    await db.kyc_documents.update_one(
        {"user_id": user_id},
        {"$set": kyc_doc},
        upsert=True
    )
    
    # Update user's KYC status to pending
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"kyc_status": "pending", "updated_at": datetime.utcnow()}}
    )
    
    log.info(f"KYC documents saved and pending review for user: {user_id}")
    return {"message": "KYC documents uploaded successfully and pending review", "extracted_data": extracted_data}

@router.get("/status")
async def get_kyc_status(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_database()

    doc = await db.kyc_documents.find_one({"user_id": user_id})
    if not doc:
        # Fall back to authoritative status on the user record
        user_kyc_status = current_user.get("kyc_status", "not_initiated")
        return {"status": user_kyc_status, "message": "KYC not initiated" if user_kyc_status == "not_initiated" else "KYC status from user profile"}
    
    return {
        "status": doc.get("status"),
        "comments": doc.get("comments", ""),
        "updated_at": doc.get("updated_at"),
        "extracted_summary": {
            "name_aadhaar": doc["extracted_data"].get("Aadhaar", {}).get("Full Name"),
            "name_pan": doc["extracted_data"].get("PAN", {}).get("Full Name"),
            "match_score": doc["extracted_data"].get("match_score")
        }
    }
