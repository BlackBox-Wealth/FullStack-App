"""Notification management routes."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from bson import ObjectId
from app.core.database import get_database
from app.core.security import get_current_user
from app.helper.utils import decrypt_user_data, encrypt_update_fields
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
router = APIRouter(prefix="/notifications", tags=["Notifications"])


class FCMTokenRequest(BaseModel):
    fcm_token: str


@router.post("/fcm-token")
async def register_fcm_token(data: FCMTokenRequest, current_user: dict = Depends(get_current_user)):
    """
    Store the user's Flutter app FCM token so the backend can send push notifications
    for large payment approvals. Called by the Flutter app on login.
    """
    user_id = str(current_user["_id"])
    if not data.fcm_token.strip():
        raise HTTPException(status_code=400, detail="FCM token is required")
    db = get_database()
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"fcm_token": data.fcm_token, "fcm_token_updated_at": datetime.utcnow()}},
    )
    log.info(f"Flutter FCM token registered: user={user_id}")
    return {"message": "FCM token registered"}


@router.get("/")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Fetching notifications: user={user_id}")
    db = get_database()
    cursor = db.notifications.find({"user_id": user_id}).sort("created_at", -1).limit(50)
    notifs = await cursor.to_list(50)
    for n in notifs:
        decrypted_notif = decrypt_user_data(n)
        n.clear()
        n.update(decrypted_notif)
    unread = sum(1 for n in notifs if not n.get("read", False))
    for n in notifs:
        n["id"] = str(n["_id"])
        del n["_id"]
    log.info(f"Returned {len(notifs)} notifications ({unread} unread) for user={user_id}")
    return notifs


@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    log.debug(f"Marking notification as read: id={notification_id}")
    db = get_database()
    update_fields = encrypt_update_fields({"read": True, "read_at": datetime.utcnow()})
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": str(current_user["_id"])},
        {"$set": update_fields}
    )
    if result.modified_count == 0:
        log.warning(f"Notification not found or access denied: id={notification_id}")
        raise HTTPException(status_code=404, detail="Notification not found")
    log.debug(f"Notification marked as read: id={notification_id}")
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Marking all notifications as read: user={user_id}")
    db = get_database()
    update_fields = encrypt_update_fields({"read": True, "read_at": datetime.utcnow()})
    result = await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": update_fields}
    )
    log.info(f"Marked {result.modified_count} notifications as read for user={user_id}")
    return {"message": f"Marked {result.modified_count} notifications as read"}


@router.get("/unread-count")
async def unread_count(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_database()
    count = await db.notifications.count_documents({"user_id": user_id, "read": False})
    log.debug(f"Unread notifications: user={user_id}, count={count}")
    return {"unread_count": count}


@router.get("/alerts")
async def get_alerts(
    current_user: dict = Depends(get_current_user),
    is_read: Optional[bool] = Query(None)
):
    """Get user's fraud/security alerts."""
    user_id = str(current_user["_id"])
    log.info(f"Fetching alerts: user={user_id}, is_read={is_read}")
    db = get_database()
    
    query = {"user_id": user_id}
    if is_read is not None:
        query["is_read"] = is_read
    
    cursor = db.alerts.find(query).sort("created_at", -1).limit(50)
    alerts = await cursor.to_list(50)
    
    for a in alerts:
        decrypted_alert = decrypt_user_data(a)
        a.clear()
        a.update(decrypted_alert)
    
    unread = sum(1 for a in alerts if not a.get("is_read", False))
    log.info(f"Returned {len(alerts)} alerts ({unread} unread) for user={user_id}")
    
    return [
        {
            "id": str(a["_id"]),
            "alert_type": a["alert_type"],
            "risk_score": a["risk_score"],
            "reason": a["reason"],
            "payment_id": a.get("payment_id"),
            "amount": a.get("amount"),
            "is_read": a.get("is_read", False),
            "created_at": str(a.get("created_at", "")),
            "read_at": str(a.get("read_at", "")) if a.get("read_at") else None,
        }
        for a in alerts
    ]


@router.put("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Mark alert as read."""
    log.debug(f"Marking alert as read: id={alert_id}")
    db = get_database()
    update_fields = encrypt_update_fields({"is_read": True, "read_at": datetime.utcnow()})
    result = await db.alerts.update_one(
        {"_id": ObjectId(alert_id), "user_id": str(current_user["_id"])},
        {"$set": update_fields}
    )
    if result.modified_count == 0:
        log.warning(f"Alert not found or access denied: id={alert_id}")
        raise HTTPException(status_code=404, detail="Alert not found")
    log.debug(f"Alert marked as read: id={alert_id}")
    return {"message": "Alert marked as read"}


@router.get("/alerts/unread-count")
async def unread_alerts_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread alerts."""
    user_id = str(current_user["_id"])
    db = get_database()
    count = await db.alerts.count_documents({"user_id": user_id, "is_read": False})
    log.debug(f"Unread alerts: user={user_id}, count={count}")
    return {"unread_count": count}


@router.get("/unified")
async def get_unified_notifications(current_user: dict = Depends(get_current_user)):
    """Get unified notifications from transactions, fraud logs, and family events."""
    user_id = str(current_user["_id"])
    log.info(f"Fetching unified notifications: user={user_id}")
    db = get_database()
    notifications = []

    # 1. High-risk transactions (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    txn_cursor = db.transactions.find({
        "user_id": user_id,
        "risk_score": {"$gte": 0.7},
        "created_at": {"$gte": thirty_days_ago}
    }).sort("created_at", -1).limit(20)
    
    txns = await txn_cursor.to_list(20)
    for txn in txns:
        txn = decrypt_user_data(txn)
        notifications.append({
            "type": "transaction",
            "message": f"High-risk transaction detected: ₹{txn['amount']:,.0f} - {txn.get('description', 'Transaction')}",
            "timestamp": str(txn.get("created_at", "")),
            "status": "critical" if txn.get("risk_score", 0) >= 0.85 else "warning"
        })

    # 2. Fraud logs
    fraud_cursor = db.fraud_logs.find({
        "user_id": user_id,
        "status": "pending_review"
    }).sort("created_at", -1).limit(10)
    
    fraud_logs = await fraud_cursor.to_list(10)
    for fraud in fraud_logs:
        notifications.append({
            "type": "fraud",
            "message": f"Suspicious activity flagged: ₹{fraud.get('amount', 0):,.0f} - Under review",
            "timestamp": str(fraud.get("created_at", "")),
            "status": "critical"
        })

    # 3. Family alerts (spending limit exceeded)
    alert_cursor = db.alerts.find({
        "user_id": user_id,
        "alert_type": "spending_limit_exceeded",
        "created_at": {"$gte": thirty_days_ago}
    }).sort("created_at", -1).limit(10)
    
    alerts = await alert_cursor.to_list(10)
    for alert in alerts:
        alert = decrypt_user_data(alert)
        notifications.append({
            "type": "family",
            "message": alert.get("reason", "Family spending limit exceeded"),
            "timestamp": str(alert.get("created_at", "")),
            "status": "warning"
        })

    # 4. Family invitations
    user_email = current_user["email"]
    invite_cursor = db.family_invitations.find({
        "invitee_email": user_email,
        "status": "pending"
    }).sort("created_at", -1).limit(5)
    
    invites = await invite_cursor.to_list(5)
    for invite in invites:
        inviter = await db.users.find_one({"_id": ObjectId(invite["inviter_user_id"])})
        if inviter:
            inviter = decrypt_user_data(inviter)
            notifications.append({
                "type": "family",
                "message": f"Family invitation from {inviter['full_name']}",
                "timestamp": str(invite.get("created_at", "")),
                "status": "info"
            })

    # Sort by timestamp (latest first)
    notifications.sort(key=lambda x: x["timestamp"], reverse=True)
    
    log.info(f"Returned {len(notifications)} unified notifications for user={user_id}")
    return notifications
