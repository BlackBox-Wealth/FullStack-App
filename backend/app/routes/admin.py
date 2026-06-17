"""Admin routes - User mgmt, KYC, Loans, Fraud, Analytics, Audit."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from bson import ObjectId
from app.core.database import get_database
from app.core.security import require_role
from app.core.kafka_service import kafka_service
from app.helper.utils import decrypt_user_data, encrypt_update_fields
from app.services.grpc_client import ml_client
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
    # Find users whose documents are in 'pending_review' status
    cursor = db.kyc_documents.find({"status": "pending_review"})
    pending_docs = await cursor.to_list(100)
    
    for doc in pending_docs:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    
    return pending_docs

@router.get("/kyc/escalated")
async def get_escalated_kyc(current_user: dict = Depends(require_role("super_admin", "relationship_manager"))):
    log.info(f"KYC escalated list requested: by={current_user['email']}")
    db = get_database()
    cursor = db.kyc_documents.find({"status": "escalated"})
    escalated_docs = await cursor.to_list(100)
    
    for doc in escalated_docs:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    
    return escalated_docs

@router.put("/kyc/{user_id}/action")
async def kyc_action(
    user_id: str, 
    action: str = Body(..., embed=True),
    comments: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(require_role("super_admin", "relationship_manager", "employee"))
):
    """
    Handle KYC actions: accept, reject, request_reupload, escalate.
    """
    log.info(f"KYC action: user={user_id}, action={action}, by={current_user['email']}")
    db = get_database()
    
    valid_actions = ["accept", "reject", "request_reupload", "escalate"]
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be {valid_actions}")

    # Role checks
    if action == "escalate" and current_user["role"] not in ["employee", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only employees can escalate to manager")
    
    if action in ["accept", "reject", "request_reupload"] and \
       current_user["role"] == "employee" and \
       await db.kyc_documents.find_one({"user_id": user_id, "status": "escalated"}):
        raise HTTPException(status_code=403, detail="Document is escalated. Only managers can perform this action.")

    # Map action to status
    status_map = {
        "accept": "verified",
        "reject": "rejected",
        "request_reupload": "reupload_requested",
        "escalate": "escalated"
    }
    
    new_status = status_map[action]
    
    update_data = {
        "status": new_status,
        "comments": comments,
        "reviewed_by": current_user["email"],
        "updated_at": datetime.utcnow()
    }
    
    # Update kyc_documents
    await db.kyc_documents.update_one({"user_id": user_id}, {"$set": update_data})
    
    # Update user status for all major status changes
    await db.users.update_one(
        {"_id": ObjectId(user_id)}, 
        {"$set": {"kyc_status": new_status, "updated_at": datetime.utcnow()}}
    )

    # Audit log
    await db.audit_logs.insert_one({
        "performed_by": current_user["email"],
        "action": f"kyc_{action}",
        "target_user": user_id,
        "status": new_status,
        "comments": comments,
        "created_at": datetime.utcnow(),
    })

    # Notify user via Kafka
    message_map = {
        "verified": "Your KYC has been verified successfully.",
        "rejected": "Your KYC has been rejected.",
        "reupload_requested": f"Please re-upload your KYC documents. Reason: {comments}",
        "escalated": "Your KYC is being reviewed by a senior manager."
    }
    
    await kafka_service.publish("notifications.send", {
        "user_id": user_id,
        "type": "kyc_update",
        "message": message_map.get(new_status, "KYC status updated"),
    })

    return {"message": f"KYC {action} successful", "new_status": new_status}


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


@router.get("/insider-threat-check")
async def insider_threat_check(current_user: dict = Depends(require_role("super_admin"))):
    """Scan for potential collusion/insider fraud using GraphSAGE model."""
    log.warning(f"Insider threat scan initiated by {current_user['email']}")
    db = get_database()
    
    # In a real scenario, we'd build a graph from employees and customers
    # For now, we'll pull some high-risk interactions to simulate
    # e.g., transactions where employee_id and customer_id are related or have unusual ratios
    
    # Placeholder: Process some records through the model
    # Features as per doc: txn_amount, is_off_hours, override_count_this_month, 
    # personal_relationship_flag, employee_txn_amount_ratio
    
    # Scan known employee-account node pairs via GraphSAGE gRPC
    scan_pairs = [
        ("ACC001", "EMP001", 500000, 5),
        ("ACC002", "EMP002", 250000, 3),
        ("ACC003", "EMP003", 150000, 2),
    ]
    alerts = []
    for user_id, emp_id, amount, txn_count in scan_pairs:
        result = ml_client.detect_insider_threat(user_id, emp_id, float(amount), txn_count)
        log.info(f"Insider threat [{user_id} ↔ {emp_id}]: {result}")
        if result.get("is_insider_threat"):
            alerts.append({
                "user_id": user_id,
                "employee_id": emp_id,
                "threat_score": result["threat_score"],
                "message": f"Collusion risk detected between {user_id} and {emp_id} (score={result['threat_score']:.3f})"
            })

    return {
        "scan_timestamp": datetime.utcnow(),
        "status": "completed",
        "threats_detected": len(alerts),
        "alerts": alerts,
        "message": "GraphSAGE relationship analysis complete."
    }
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


# ─── System Performance ─────────────────────────
@router.get("/performance")
async def get_performance_metrics(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_role("super_admin"))
):
    """Retrieve system performance metrics with pagination support."""
    from app.core.redis_client import get_redis
    import json
    
    redis = get_redis()
    if not redis:
        return {"metrics": [], "total": 0}
        
    key = "system_performance_zset"
    
    # Get total count for pagination info
    total = await redis.zcard(key)
    
    # Get the specific range [offset, offset + limit - 1]
    metrics_raw = await redis.zrevrange(key, offset, offset + limit - 1)
    metrics = [json.loads(m) for m in metrics_raw]
    
    for i, m in enumerate(metrics):
        if "id" not in m:
            m["id"] = f"perf_{offset + i}"
            
    return {
        "metrics": metrics,
        "total": total,
        "page_size": limit,
        "offset": offset
    }
