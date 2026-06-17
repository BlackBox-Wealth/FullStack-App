"""Transaction routes with fraud scoring."""
import asyncio
import random
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from app.core.database import get_database
from app.core.security import get_current_user
from app.core.kafka_service import kafka_service
from app.services.email_service import email_service
from app.services.sms_service import sms_service
from app.helper.utils import encrypt_user_data, decrypt_user_data
from app.services.grpc_client import ml_client
from app.services.budget_service import budget_service
from app.services.credit_score_service import update_user_credit_score
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
from app.models.account import TransactionCreate, TransactionResponse
router = APIRouter(prefix="/transactions", tags=["Transactions"])


def txn_to_response(txn: dict) -> TransactionResponse:
    return TransactionResponse(
        id=str(txn["_id"]),
        account_id=txn["account_id"],
        user_id=txn["user_id"],
        amount=txn["amount"],
        transaction_type=txn["transaction_type"],
        category=txn.get("category", "other"),
        description=txn.get("description", ""),
        status=txn["status"],
        risk_score=txn.get("risk_score", 0.0),
        budget_alert=txn.get("budget_alert"),
        created_at=str(txn.get("created_at", "")),
    )


def calculate_risk_score(amount: float, txn_type: str, user_history_count: int) -> float:
    """Mock fraud risk scoring."""
    score = 0.0
    if amount > 100000:
        score += 0.3
    if amount > 500000:
        score += 0.3
    if txn_type == "transfer":
        score += 0.1
    if user_history_count < 5:
        score += 0.15
    score += random.uniform(0, 0.1)
    return min(score, 1.0)


@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_transaction(data: TransactionCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Transaction initiated: user={user_id}, type={data.transaction_type}, amount=₹{data.amount}, category={data.category}")
    db = get_database()

    # Verify account belongs to user
    account = await db.accounts.find_one({"_id": ObjectId(data.account_id)})
    account = decrypt_user_data(account) if account else None
    if not account:
        log.warning(f"Transaction failed: account={data.account_id} not found")
        raise HTTPException(status_code=404, detail="Account not found")
    if account["user_id"] != user_id:
        log.warning(f"Transaction denied: user={user_id} does not own account={data.account_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    if account["status"] != "active":
        log.warning(f"Transaction blocked: account={data.account_id} status={account['status']}")
        raise HTTPException(status_code=400, detail="Account is not active")

    # Check balance for debit/transfer
    if data.transaction_type in ["debit", "transfer"] and account["balance"] < data.amount:
        log.warning(f"Transaction failed: insufficient balance. Required=₹{data.amount}, available=₹{account['balance']}")
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Check family spending limit (if applicable)
    family_member = await db.family_members.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    if family_member and family_member.get("spending_limit"):
        spending_limit = family_member["spending_limit"]
        
        if data.transaction_type in ["debit", "transfer"] and data.amount > spending_limit:
            log.warning(f"⚠️ Spending limit exceeded: user={user_id}, amount=₹{data.amount}, limit=₹{spending_limit}")
            
            # Create alert for family head
            family_id = family_member["family_id"]
            family = await db.families.find_one({"_id": ObjectId(family_id)})
            
            if family:
                head_user_id = family["head_user_id"]
                alert_doc = {
                    "user_id": head_user_id,
                    "alert_type": "spending_limit_exceeded",
                    "reason": f"Family member exceeded spending limit: ₹{data.amount:,.0f} (limit: ₹{spending_limit:,.0f})",
                    "member_user_id": user_id,
                    "amount": data.amount,
                    "spending_limit": spending_limit,
                    "is_read": False,
                    "created_at": datetime.utcnow(),
                }
                await db.alerts.insert_one(encrypt_user_data(alert_doc))
                log.info(f"Alert created for family head: head={head_user_id}, member={user_id}")
                
                # Publish notification event
                await kafka_service.publish("notifications.send", {
                    "user_id": head_user_id,
                    "type": "spending_limit_exceeded",
                    "message": f"Family member exceeded spending limit: ₹{data.amount:,.0f}"
                })

    # Calculate fraud risk
    history_count = await db.transactions.count_documents({"user_id": user_id})
    base_risk_score = calculate_risk_score(data.amount, data.transaction_type, history_count)
    log.info(f"Base fraud risk assessment: score={base_risk_score:.3f}, history_count={history_count}")

    # --- ML INTEGRATION BEGIN ---
    # 1. M2 (gRPC): NLP category classification
    bert_result = ml_client.classify_transaction(data.description or "")
    predicted_category = bert_result["category"]

    category_mismatch = 0.0
    if data.category.value.lower() != predicted_category.lower() and data.category.value.lower() not in ["other", "transfer"]:
        category_mismatch = 0.2
        log.warning(f"ML Category Mismatch: user={user_id}, provided={data.category.value}, predicted={predicted_category}")

    # 2. LSTM (gRPC): sequence anomaly on last 30 transactions
    last_txns = await db.transactions.find({"user_id": user_id}).sort("created_at", -1).limit(30).to_list(30)
    txn_steps = []
    for t in last_txns:
        d = decrypt_user_data(t)
        created = d.get("created_at", datetime.utcnow())
        ts = int(created.timestamp()) if isinstance(created, datetime) else int(datetime.utcnow().timestamp())
        txn_steps.append({
            "amount": float(d.get("amount", 0)),
            "unix_timestamp": ts,
            "category": str(d.get("category", "Other")),
            "is_debit": d.get("transaction_type", "debit") in ("debit", "transfer"),
        })
    txn_steps.append({
        "amount": float(data.amount),
        "unix_timestamp": int(datetime.utcnow().timestamp()),
        "category": data.category.value,
        "is_debit": data.transaction_type.value in ("debit", "transfer"),
    })
    lstm_result = ml_client.detect_sequence_anomaly(user_id, txn_steps)
    seq_anomaly = float(lstm_result.get("reconstruction_error", 0.0))

    # 3. GraphSAGE (gRPC): insider threat signal
    threat_result = ml_client.detect_insider_threat(user_id, "", float(data.amount), 0)
    insider_threat_score = float(threat_result.get("threat_score", 0.05))

    # 4. M4 (gRPC): final risk score
    now = datetime.utcnow()
    m4_features = [
        float(data.amount),
        float(history_count),
        float(category_mismatch),
        seq_anomaly,
        0.0,                        # biometric_anomaly (needs /behavior-anomaly call)
        insider_threat_score,        # GraphSAGE real signal
        0.0,                        # chat_stress (not available in transaction flow)
        0.0,                        # is_new_beneficiary
        0.0,                        # sim_changed
        0.0,                        # location_risk
        float(now.hour),
        float(now.weekday()),
        0.0,                        # ip_risk
    ]
    m4_result = ml_client.calculate_risk_score(m4_features)
    risk_score = m4_result["risk_score"]
    auto_decision = m4_result["decision"]
    
    log.info(f"M4 Final Assessment: user={user_id}, score={risk_score:.3f}, decision={auto_decision}")
    
    # Override status based on M4 decision
    if auto_decision == "block":
        txn_status = "blocked"
    elif auto_decision == "review" or risk_score > 0.7:
        txn_status = "flagged"
    else:
        txn_status = "completed"
    # --- BUDGET CHECK ---
    budget_alert = None
    if data.transaction_type in ["debit", "transfer"]:
        budget_alert = await budget_service.check_budget_breach(user_id, data.category.value, data.amount)
    
    # --- ML INTEGRATION END ---
    txn_doc = {
        "account_id": data.account_id,
        "user_id": user_id,
        "amount": data.amount,
        "transaction_type": data.transaction_type.value,
        "category": data.category.value,
        "description": data.description,
        "status": txn_status,
        "risk_score": round(risk_score, 3),
        "budget_alert": budget_alert,
        "to_account_id": data.to_account_id,
        "created_at": datetime.utcnow(),
    }

    encrypted_txn_doc = encrypt_user_data(txn_doc)  # Encrypt sensitive fields if needed
    result = await db.transactions.insert_one(encrypted_txn_doc)
    txn_doc["_id"] = result.inserted_id
    log.info(f"Transaction created: id={result.inserted_id}, status={txn_status}")

    # Update balance
    if data.transaction_type == "credit":
        await db.accounts.update_one({"_id": ObjectId(data.account_id)}, {"$inc": {"balance": data.amount}})
        log.debug(f"Balance credited: account={data.account_id}, +₹{data.amount}")
    elif data.transaction_type in ["debit", "transfer"]:
        await db.accounts.update_one({"_id": ObjectId(data.account_id)}, {"$inc": {"balance": -data.amount}})
        log.debug(f"Balance debited: account={data.account_id}, -₹{data.amount}")
        if data.to_account_id:
            await db.accounts.update_one({"_id": ObjectId(data.to_account_id)}, {"$inc": {"balance": data.amount}})
            log.debug(f"Balance credited (transfer dest): account={data.to_account_id}, +₹{data.amount}")

    # Publish event
    await kafka_service.publish("transactions.created", {
        "transaction_id": str(result.inserted_id),
        "user_id": user_id,
        "amount": data.amount,
        "type": data.transaction_type.value,
        "risk_score": risk_score,
    })
    
    # Send Transaction Alert Email
    try:
        # fire-and-forget email (don't block transaction completion)
        asyncio.create_task(
            email_service.send_transaction_alert(
                current_user["email"], 
                data.amount, 
                account["account_number"], 
                data.transaction_type.value,
            txn_status
        ))
    except Exception as e:
        log.error(f"Failed to send transaction alert email: {e}")

    # Send Transaction Alert SMS
    try:
        sender_receiver = data.description or "WealthVault Transfer"
        await sms_service.send_transaction_sms(
            current_user["phone"],
            current_user["full_name"],
            f"••{account['account_number'][-4:]}",
            data.amount,
            data.transaction_type.value,
            sender_receiver
        )
    except Exception as e:
        log.error(f"Failed to send transaction alert SMS: {e}")

    # If high risk, trigger fraud alert
    if risk_score >= 0.7:
        log.error(f"🚨 HIGH RISK TRANSACTION DETECTED: txn={result.inserted_id}, risk={risk_score:.3f}, amount=₹{data.amount}")
        await kafka_service.publish("fraud.alerts", {
            "transaction_id": str(result.inserted_id),
            "user_id": user_id,
            "risk_score": risk_score,
            "amount": data.amount,
            "reason": "High risk transaction detected",
        })
        await db.fraud_logs.insert_one({
            "transaction_id": str(result.inserted_id),
            "user_id": user_id,
            "risk_score": risk_score,
            "amount": data.amount,
            "status": "pending_review",
            "created_at": datetime.utcnow(),
        })
        log.info(f"Fraud log created for transaction={result.inserted_id}")

    # Update credit score in background after every non-blocked transaction
    if txn_status != "blocked":
        asyncio.create_task(update_user_credit_score(db, user_id))

    return txn_to_response(txn_doc)


@router.get("/", response_model=list[TransactionResponse])
async def get_transactions(
    account_id: Optional[str] = None,
    category: Optional[str] = None,
    days: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    log.info(f"Fetching transactions: user={user_id}, account={account_id}, category={category}, limit={limit}")
    db = get_database()
    query = {"user_id": user_id}
    if account_id:
        query["account_id"] = account_id
    if category:
        query["category"] = category
    if days:
        start_date = datetime.utcnow() - timedelta(days=days)
        query["created_at"] = {"$gte": start_date}

    cursor = db.transactions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    txns = await cursor.to_list(limit)
    for txn in txns:
        decrypted_txn = decrypt_user_data(txn)
        txn.clear()
        txn.update(decrypted_txn)
    log.info(f"Returned {len(txns)} transactions for user={user_id}")
    return [txn_to_response(t) for t in txns]


@router.get("/spending-analysis")
async def spending_analysis(
    months: int = Query(3, ge=1, le=12),
    current_user: dict = Depends(get_current_user),
):
    """Analyze spending patterns by category."""
    user_id = str(current_user["_id"])
    log.info(f"Spending analysis: user={user_id}, months={months}")
    db = get_database()
    start_date = datetime.utcnow() - timedelta(days=months * 30)

    # Fetch all debit transactions for the period
    query = {
        "user_id": user_id, 
        "transaction_type": "debit", 
        "created_at": {"$gte": start_date}
    }
    cursor = db.transactions.find(query)
    txns = await cursor.to_list(1000)
    
    # Decrypt and aggregate in memory
    category_totals = {}
    total_spent = 0.0
    
    for txn in txns:
        decrypted = decrypt_user_data(txn)
        cat = decrypted.get("category", "other")
        amt = float(decrypted.get("amount", 0.0))
        
        if cat not in category_totals:
            category_totals[cat] = {"total": 0.0, "count": 0}
        
        category_totals[cat]["total"] += amt
        category_totals[cat]["count"] += 1
        total_spent += amt

    # Format results
    categories = []
    for cat, data in category_totals.items():
        total = data["total"]
        count = data["count"]
        categories.append({
            "category": cat,
            "total": round(total, 2),
            "count": count,
            "average": round(total / count, 2) if count > 0 else 0,
            "percentage": round((total / total_spent * 100) if total_spent > 0 else 0, 1),
        })
    
    # Sort by total spent
    categories.sort(key=lambda x: x["total"], reverse=True)

    log.info(f"Spending analysis complete: user={user_id}, total_spent=₹{total_spent:.2f}, categories={len(categories)}")

    return {"period_months": months, "total_spent": round(total_spent, 2), "categories": categories}


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    log.debug(f"Fetching transaction: id={transaction_id}")
    db = get_database()
    txn = await db.transactions.find_one({"_id": ObjectId(transaction_id)})
    if not txn:
        log.warning(f"Transaction not found: id={transaction_id}")
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn = decrypt_user_data(txn)
    if txn["user_id"] != str(current_user["_id"]) and current_user["role"] == "customer":
        log.warning(f"Access denied: user={current_user['id']} tried to view txn={transaction_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    return txn_to_response(txn)
