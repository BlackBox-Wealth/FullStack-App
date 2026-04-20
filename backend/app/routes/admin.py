"""Admin routes - User mgmt, KYC, Loans, Fraud, Analytics, Audit."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from app.core.database import get_database
from app.core.security import require_role
from app.core.kafka_service import kafka_service
from app.helper.utils import decrypt_user_data, encrypt_update_fields
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── User Management ─────────────────────────
@router.get("/users")
async def get_users(
    role: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_role("super_admin", "relationship_manager", "employee"))
):
    log.info(f"Admin user listing: by={current_user['email']} (role={current_user['role']}), filter_role={role}")
    db = get_database()
    query = {}
    if role:
        query["role"] = role

    cursor = db.users.find(query, {"password_hash": 0}).skip(skip).limit(limit)
    users = await cursor.to_list(limit)
    for u in users:
        decrypted_user = decrypt_user_data(u)  # Decrypt fields if needed
        u.clear()  # Clear original dict
        u.update(decrypted_user)  # Update original dict with decrypted values
        u["id"] = str(u["_id"])
        del u["_id"]
    total = await db.users.count_documents(query)

    log.info(f"Returned {len(users)}/{total} users")
    return {"users": users, "total": total, "skip": skip, "limit": limit}


@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: str, new_role: str,
    current_user: dict = Depends(require_role("super_admin"))
):
    log.warning(f"Role change: target_user={user_id}, new_role={new_role}, by={current_user['email']}")
    db = get_database()
    valid_roles = ["customer", "employee", "relationship_manager", "super_admin"]
    if new_role not in valid_roles:
        log.error(f"Invalid role: {new_role}")
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    update_fields = encrypt_update_fields({"role": new_role, "updated_at": datetime.utcnow()})
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    if result.modified_count == 0:
        log.warning(f"Role change failed: user={user_id} not found")
        raise HTTPException(status_code=404, detail="User not found")

    # Audit log
    await db.audit_logs.insert_one({
        "performed_by": current_user["email"],
        "action": "role_change",
        "target_user": user_id,
        "new_role": new_role,
        "created_at": datetime.utcnow(),
    })
    log.info(f"Role changed successfully: user={user_id} → {new_role}, audit logged")
    return {"message": f"User role updated to {new_role}"}


@router.put("/users/{user_id}/deactivate")
async def deactivate_user(user_id: str, current_user: dict = Depends(require_role("super_admin"))):
    log.warning(f"User deactivation: target={user_id}, by={current_user['email']}")
    db = get_database()
    update_fields = encrypt_update_fields({"is_active": False, "updated_at": datetime.utcnow()})
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    if result.modified_count == 0:
        log.warning(f"Deactivation failed: user={user_id} not found")
        raise HTTPException(status_code=404, detail="User not found")
    await db.audit_logs.insert_one({"performed_by": current_user["email"], "action": "user_deactivated", "target_user": user_id, "created_at": datetime.utcnow()})
    log.info(f"User deactivated: {user_id}, audit logged")
    return {"message": "User deactivated"}


@router.put("/users/{user_id}/activate")
async def activate_user(user_id: str, current_user: dict = Depends(require_role("super_admin"))):
    log.info(f"User activation: target={user_id}, by={current_user['email']}")
    db = get_database()
    update_fields = encrypt_update_fields({"is_active": True, "updated_at": datetime.utcnow()})
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await db.audit_logs.insert_one({"performed_by": current_user["email"], "action": "user_activated", "target_user": user_id, "created_at": datetime.utcnow()})
    log.info(f"User activated: {user_id}")
    return {"message": "User activated"}


# ─── KYC Verification ─────────────────────────
@router.get("/kyc/pending")
async def get_pending_kyc(current_user: dict = Depends(require_role("super_admin", "relationship_manager", "employee"))):
    log.info(f"KYC pending list requested: by={current_user['email']}")
    db = get_database()
    cursor = db.users.find({"kyc_status": "pending"}, {"password_hash": 0})
    users = await cursor.to_list(100)
    for u in users:
        decrypted_user = decrypt_user_data(u)  # Decrypt fields if needed
        u.clear()  # Clear original dict
        u.update(decrypted_user)  # Update original dict with decrypted values
        u["id"] = str(u["_id"])
        del u["_id"]
    log.info(f"Found {len(users)} pending KYC verifications")
    return users


@router.put("/kyc/{user_id}/verify")
async def verify_kyc(
    user_id: str, status: str,
    current_user: dict = Depends(require_role("super_admin", "relationship_manager", "employee"))
):
    log.info(f"KYC verification: user={user_id}, status={status}, by={current_user['email']}")
    db = get_database()
    if status not in ["verified", "rejected"]:
        log.error(f"Invalid KYC status: {status}")
        raise HTTPException(status_code=400, detail="Status must be 'verified' or 'rejected'")

    update_fields = encrypt_update_fields({"kyc_status": status, "updated_at": datetime.utcnow()})
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
    if result.modified_count == 0:
        log.warning(f"KYC update failed: user={user_id} not found")
        raise HTTPException(status_code=404, detail="User not found")

    await db.audit_logs.insert_one({
        "performed_by": current_user["email"],
        "action": "kyc_verification",
        "target_user": user_id,
        "status": status,
        "created_at": datetime.utcnow(),
    })

    await kafka_service.publish("notifications.send", {
        "user_id": user_id,
        "type": "kyc_update",
        "message": f"Your KYC has been {status}",
    })

    log.info(f"KYC updated: user={user_id} → {status}, notification sent")
    return {"message": f"KYC status updated to {status}"}


# ─── Loan Management ─────────────────────────
@router.get("/loans")
async def admin_get_loans(
    status: Optional[str] = None,
    current_user: dict = Depends(require_role("super_admin", "relationship_manager", "employee"))
):
    log.info(f"Admin loan listing: filter_status={status}, by={current_user['email']}")
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    cursor = db.loans.find(query).sort("created_at", -1)
    loans = await cursor.to_list(100)
    for l in loans:
        decrypted_loan = decrypt_user_data(l)  # Decrypt fields if needed
        l.clear()  # Clear original dict
        l.update(decrypted_loan)  # Update original dict with decrypted values
        l["id"] = str(l["_id"])
        del l["_id"]
    log.info(f"Returned {len(loans)} loans")
    return loans


@router.put("/loans/{loan_id}/approve")
async def approve_loan(loan_id: str, current_user: dict = Depends(require_role("super_admin", "relationship_manager"))):
    log.info(f"Loan approval: loan={loan_id}, by={current_user['email']}")
    db = get_database()
    update_fields = encrypt_update_fields({
        "status": "approved",
        "approved_by": current_user["email"],
        "approved_at": datetime.utcnow(),
    })
    result = await db.loans.update_one({"_id": ObjectId(loan_id)}, {"$set": update_fields})
    if result.modified_count == 0:
        log.warning(f"Loan approval failed: loan={loan_id} not found")
        raise HTTPException(status_code=404, detail="Loan not found")

    loan = await db.loans.find_one({"_id": ObjectId(loan_id)})
    loan = decrypt_user_data(loan) if loan else None  # Decrypt fields if loan exists
    await db.audit_logs.insert_one({"performed_by": current_user["email"], "action": "loan_approved", "target_user": loan.get("user_id"), "created_at": datetime.utcnow()})
    log.info(f"Loan approved: loan={loan_id} for user={loan.get('user_id')}")
    return {"message": "Loan approved"}


@router.put("/loans/{loan_id}/reject")
async def reject_loan(loan_id: str, current_user: dict = Depends(require_role("super_admin", "relationship_manager"))):
    log.info(f"Loan rejection: loan={loan_id}, by={current_user['email']}")
    db = get_database()
    update_fields = encrypt_update_fields({"status": "rejected", "rejected_by": current_user["email"]})
    result = await db.loans.update_one({"_id": ObjectId(loan_id)}, {"$set": update_fields})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Loan not found")
    log.info(f"Loan rejected: loan={loan_id}")
    return {"message": "Loan rejected"}


# ─── Fraud Alerts ─────────────────────────
@router.get("/fraud-alerts")
async def get_fraud_alerts(current_user: dict = Depends(require_role("super_admin", "relationship_manager", "employee"))):
    log.info(f"Fraud alerts requested: by={current_user['email']}")
    db = get_database()
    cursor = db.fraud_logs.find().sort("created_at", -1)
    alerts = await cursor.to_list(100)
    pending = sum(1 for a in alerts if a.get("status") == "pending_review")
    for a in alerts:
        a["id"] = str(a["_id"])
        del a["_id"]
    log.info(f"Returned {len(alerts)} fraud alerts ({pending} pending)")
    return alerts


@router.put("/fraud-alerts/{alert_id}/resolve")
async def resolve_fraud_alert(
    alert_id: str, resolution: str,
    current_user: dict = Depends(require_role("super_admin", "relationship_manager"))
):
    log.warning(f"Fraud alert resolution: alert={alert_id}, resolution={resolution}, by={current_user['email']}")
    db = get_database()
    if resolution not in ["confirmed", "false_positive"]:
        raise HTTPException(status_code=400, detail="Resolution must be 'confirmed' or 'false_positive'")
    result = await db.fraud_logs.update_one({"_id": ObjectId(alert_id)}, {"$set": {"status": resolution, "resolved_by": current_user["email"], "resolved_at": datetime.utcnow()}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.audit_logs.insert_one({"performed_by": current_user["email"], "action": "fraud_resolved", "target_user": alert_id, "status": resolution, "created_at": datetime.utcnow()})
    log.info(f"Fraud alert resolved: alert={alert_id} → {resolution}")
    return {"message": f"Fraud alert resolved as {resolution}"}


# ─── Analytics ─────────────────────────
@router.get("/analytics")
async def get_analytics(current_user: dict = Depends(require_role("super_admin", "relationship_manager"))):
    log.info(f"Analytics dashboard requested: by={current_user['email']}")
    db = get_database()

    total_users = await db.users.count_documents({})
    total_accounts = await db.accounts.count_documents({})
    total_transactions = await db.transactions.count_documents({})
    total_loans = await db.loans.count_documents({})
    active_fraud = await db.fraud_logs.count_documents({"status": "pending_review"})
    pending_kyc = await db.users.count_documents({"kyc_status": "pending"})
    log.debug(f"Analytics counts: users={total_users}, accounts={total_accounts}, txns={total_transactions}")

    # Transaction volume
    volume_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    vol_result = await db.transactions.aggregate(volume_pipeline).to_list(1) # db transactions
    total_volume = vol_result[0]["total"] if vol_result else 0

    # Monthly trends
    trend_pipeline = [
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}}, "count": {"$sum": 1}, "volume": {"$sum": "$amount"}}},
        {"$sort": {"_id": 1}},
        {"$limit": 12},
    ]
    trends = await db.transactions.aggregate(trend_pipeline).to_list(12)
    log.info(f"Analytics computed: volume=₹{total_volume:.0f}, trends={len(trends)} months")

    return {
        "overview": {
            "total_users": total_users,
            "total_accounts": total_accounts,
            "total_transactions": total_transactions,
            "total_loans": total_loans,
            "active_fraud_alerts": active_fraud,
            "pending_kyc": pending_kyc,
            "total_transaction_volume": round(total_volume, 2),
        },
        "monthly_trends": trends,
    }


# ─── Audit Logs ─────────────────────────
@router.get("/audit-logs")
async def get_audit_logs(current_user: dict = Depends(require_role("super_admin"))):
    log.info(f"Audit logs requested: by={current_user['email']}")
    db = get_database()
    cursor = db.audit_logs.find().sort("created_at", -1).limit(200)
    logs = await cursor.to_list(200)
    for l in logs:
        l["id"] = str(l["_id"])
        del l["_id"]
    log.info(f"Returned {len(logs)} audit log entries")
    return logs
