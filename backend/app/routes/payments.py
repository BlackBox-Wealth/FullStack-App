"""Payment routes with OTP verification."""
import random
import string
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.core.database import get_database
from app.core.redis_client import get_redis
from app.core.security import get_current_user
from app.core.kafka_service import kafka_service
from app.core.config import settings
from app.services.email_service import email_service
from app.services.sms_service import sms_service
from app.helper.utils import encrypt_user_data, decrypt_user_data, encrypt_update_fields
from app.services.deterministic_hash import generate_deterministic_hash
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
from app.models.account import PaymentInitiate, OTPVerify
from app.models.alert import AlertType
router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/initiate")
async def initiate_payment(data: PaymentInitiate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Payment initiation: user={user_id}, from={data.from_account_id}, to={data.to_account_number}, amount=₹{data.amount}")
    db = get_database()

    # Verify source account
    from_account = await db.accounts.find_one({"_id": ObjectId(data.from_account_id)})
    from_account = decrypt_user_data(from_account) if from_account else None
    if not from_account:
        log.warning(f"Payment failed: source account={data.from_account_id} not found")
        raise HTTPException(status_code=404, detail="Source account not found")
    if from_account["user_id"] != user_id:
        log.warning(f"Payment denied: user={user_id} does not own account={data.from_account_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    if from_account["status"] != "active":
        log.warning(f"Payment blocked: source account status={from_account['status']}")
        raise HTTPException(status_code=400, detail="Source account is not active")
    if from_account["balance"] < data.amount:
        log.warning(f"Payment failed: insufficient balance. Required=₹{data.amount}, available=₹{from_account['balance']}")
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Verify destination account
    to_account_hash = generate_deterministic_hash(data.to_account_number)
    to_account = await db.accounts.find_one({"hashed_account_number": to_account_hash})
    to_account = decrypt_user_data(to_account) if to_account else None
    if not to_account:
        log.warning(f"Payment failed: destination account={data.to_account_number} not found")
        raise HTTPException(status_code=404, detail="Destination account not found")

    log.info(f"Payment validation passed: from={data.from_account_id} → to={data.to_account_number}")

    # Create pending payment
    payment_doc = {
        "user_id": user_id,
        "from_account_id": data.from_account_id,
        "to_account_id": str(to_account["_id"]),
        "to_account_number": data.to_account_number,
        "amount": data.amount,
        "description": data.description,
        "status": "pending_otp",
        "created_at": datetime.utcnow(),
    }

    encrypted_payment_doc = encrypt_user_data(payment_doc)  # Encrypt sensitive fields if needed
    result = await db.payments.insert_one(encrypted_payment_doc)
    payment_id = str(result.inserted_id)
    # Verifies payment initiated from registered phone
    sim_binding_risk = 0.0
    if current_user.get("verified_phone"):
        # User has verified phone via SIM binding
        # For the web app, we are using the phone number as proxy for SIM identity
        # In actual payment, check if OTP sent to verified phone
        user_phone = current_user.get("phone")
        verified_phone = current_user.get("verified_phone")
        
        if user_phone == verified_phone:
            sim_binding_risk = 0.0  # Same phone - trusted
            log.debug(f"SIM binding verified: payment from registered phone")
        else:
            sim_binding_risk = 0.3  # Different phone - suspicious
            log.warning(f"SIM binding mismatch: registered={verified_phone}, current={user_phone}, risk=0.3")
    else:
        sim_binding_risk = 0.2  # Phone not verified yet
        log.info(f"SIM binding not verified for user: phone_verified={current_user.get('phone_verified_at') is not None}")
    
    # Store SIM binding risk in payment
    payment_doc["sim_binding_risk"] = sim_binding_risk
    payment_doc["payment_phone"] = current_user.get("phone")
    log.info(f"Payment created (pending OTP): payment_id={payment_id}")

    # Generate OTP
    otp = "".join(random.choices(string.digits, k=6))
    redis = get_redis()

    if redis:
        await redis.setex(f"payment_otp:{payment_id}", settings.OTP_EXPIRE_SECONDS, otp)
        log.info(f"Payment OTP stored in Redis: payment={payment_id}, expires={settings.OTP_EXPIRE_SECONDS}s")
    else:
        otp_update_fields = encrypt_update_fields({"otp": otp, "created_at": datetime.utcnow()})
        await db.payment_otps.update_one(
            {"payment_id": payment_id},
            {"$set": otp_update_fields},
            upsert=True
        )
        log.info(f"Payment OTP stored in MongoDB (Redis unavailable): payment={payment_id}")

    await kafka_service.publish("payments.initiated", {
        "payment_id": payment_id,
        "user_id": user_id,
        "amount": data.amount,
    })
    
    # Send Verification Code
    if data.otp_channel == "sms":
        try:
            await sms_service.send_otp(current_user["phone"], otp)
        except Exception as e:
            log.error(f"Failed to send payment verification SMS: {e}")
    else:
        try:
            await email_service.send_verification_email(current_user["email"], otp)
        except Exception as e:
            log.error(f"Failed to send payment verification email: {e}")

    return {
        "payment_id": payment_id,
        "message": "OTP sent for payment verification",
        "otp_debug": otp if settings.DEBUG else None,
    }


@router.post("/verify")
async def verify_payment(data: OTPVerify, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Payment OTP verification: payment={data.payment_id}, user={user_id}")
    db = get_database()
    redis = get_redis()
    # Checks if payment OTP is locked due to too many failed attempts
    if redis:
        locked = await redis.get(f"otp_locked:{data.payment_id}")
        if locked:
            log.warning(f"Payment OTP locked: payment={data.payment_id}, user={user_id} - too many failed attempts")
            raise HTTPException(status_code=429, detail="Too many failed OTP attempts. Payment locked for 1 hour. Please try again later.")
        
    # Verify OTP
    if redis:
        stored_otp = await redis.get(f"payment_otp:{data.payment_id}")
    else:
        otp_doc = await db.payment_otps.find_one({"payment_id": data.payment_id})
        stored_otp = otp_doc["otp"] if otp_doc else None
   
    if not stored_otp or stored_otp != data.otp:
        # Track OTP failure attempts
        failures = 0
        if redis:
            failures = int(await redis.get(f"otp_failures:{data.payment_id}") or 0)
            failures += 1
            
            # Log the failure
            log.warning(f"Payment OTP verification failed: payment={data.payment_id}, user={user_id}, attempt={failures}/5")
            
            # Check if we've hit the limit (5 attempts)
            if failures >= 5:
                # Lock the payment for 1 hour (3600 seconds)
                await redis.setex(f"otp_locked:{data.payment_id}", 3600, "1")
                log.warning(f"Payment OTP locked: payment={data.payment_id}, user={user_id} - reached max 5 attempts")
                raise HTTPException(status_code=429, detail="Too many failed OTP attempts. Payment locked for 1 hour.")
            
            # Store updated failure count (expires after 15 minutes, same as OTP)
            await redis.setex(f"otp_failures:{data.payment_id}", 900, str(failures))
            remaining_attempts = 5 - failures
            raise HTTPException(status_code=400, detail=f"Invalid or expired OTP. {remaining_attempts} attempt(s) remaining.")
        else:
            # Fallback if Redis is down (no rate limiting, but OTP verification still works)
            log.warning(f"Payment OTP verification failed: payment={data.payment_id}, user={user_id} (Redis unavailable)")
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    

    log.info(f"Payment OTP verified: payment={data.payment_id}")
    # Clear OTP failure counter on successful verification
    if redis:
        await redis.delete(f"otp_failures:{data.payment_id}")
        log.debug(f"OTP failure counter cleared: payment={data.payment_id}")
        
    # Get payment
    payment = await db.payments.find_one({"_id": ObjectId(data.payment_id)})
    payment = decrypt_user_data(payment) if payment else None  # Decrypt fields if payment exists
    if not payment:
        log.error(f"Payment record not found after OTP verify: payment={data.payment_id}")
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment["user_id"] != user_id:
        log.warning(f"Payment access denied: user={user_id} not owner of payment={data.payment_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    if payment["status"] != "pending_otp":
        log.warning(f"Payment already processed: payment={data.payment_id}, status={payment['status']}")
        raise HTTPException(status_code=400, detail="Payment already processed")

    # Process payment
    amount = payment["amount"]
    log.info(f"Processing payment: payment={data.payment_id}, amount=₹{amount}")

    # Debit source
    await db.accounts.update_one({"_id": ObjectId(payment["from_account_id"])}, {"$inc": {"balance": -amount}})
    log.debug(f"Debited ₹{amount} from account={payment['from_account_id']}")

    # Credit destination
    await db.accounts.update_one({"_id": ObjectId(payment["to_account_id"])}, {"$inc": {"balance": amount}})
    log.debug(f"Credited ₹{amount} to account={payment['to_account_id']}")

    # Create transactions
    debit_txn = {
        "account_id": payment["from_account_id"], "user_id": payment["user_id"],
        "amount": amount, "transaction_type": "debit", "category": "transfer",
        "description": f"Payment: {payment.get('description', '')}", "status": "completed",
        "risk_score": 0.0, "payment_id": data.payment_id, "created_at": datetime.utcnow(),
    }
    credit_txn = {
        "account_id": payment["to_account_id"], "user_id": payment.get("to_user_id", ""),
        "amount": amount, "transaction_type": "credit", "category": "transfer",
        "description": f"Received payment: {payment.get('description', '')}", "status": "completed",
        "risk_score": 0.0, "payment_id": data.payment_id, "created_at": datetime.utcnow(),
    }
    await db.transactions.insert_many([
        encrypt_user_data(debit_txn),
        encrypt_user_data(credit_txn),
    ])
    log.info(f"Transaction records created for payment={data.payment_id}")

    # Update payment status
    payment_update_fields = encrypt_update_fields({"status": "completed", "completed_at": datetime.utcnow()})
    await db.payments.update_one(
        {"_id": ObjectId(data.payment_id)},
        {"$set": payment_update_fields}
    )

    # Clean up OTP
    if redis:
        await redis.delete(f"payment_otp:{data.payment_id}")
        log.debug(f"Payment OTP cleaned from Redis: payment={data.payment_id}")
    
    #  Create alert if high risk
    account_age_days = (datetime.utcnow() - current_user.get("created_at", datetime.utcnow())).days
    risk_score = 0.0
    
    # Amount-based risk
    if amount > 500000:
        risk_score += 0.35
    elif amount > 100000:
        risk_score += 0.15
    
    # Account age risk
    if account_age_days < 7:
        risk_score += 0.3
    elif account_age_days < 30:
        risk_score += 0.1
    
    # SIM binding risk (already calculated during initiation)
    sim_risk = payment.get("sim_binding_risk", 0.0)
    risk_score += sim_risk
    
    risk_score = min(risk_score, 1.0)
    
    # If HIGH RISK, create alert and send email
    if risk_score > 0.6:
        log.warning(f"🚨 HIGH RISK PAYMENT: payment={data.payment_id}, risk={risk_score:.3f}, amount=₹{amount}")
        
        alert_doc = {
            "user_id": user_id,
            "alert_type": AlertType.HIGH_RISK_PAYMENT.value,
            "risk_score": round(risk_score, 3),
            "reason": f"High-risk payment detected: Amount ₹{amount:,.0f}, Account age {account_age_days} days, SIM risk {sim_risk:.1%}",
            "payment_id": data.payment_id,
            "amount": amount,
            "is_read": False,
            "created_at": datetime.utcnow(),
        }
        await db.alerts.insert_one(encrypt_user_data(alert_doc))
        log.info(f"Alert created for high-risk payment: payment={data.payment_id}")
        
        # Send fraud alert email
        try:
            from_acc = await db.accounts.find_one({"_id": ObjectId(payment["from_account_id"])})
            from_acc = decrypt_user_data(from_acc) if from_acc else None
            
            await email_service.send_fraud_alert(
                to_email=current_user["email"],
                amount=amount,
                recipient=payment.get("to_account_number", "Unknown")[-4:],
                risk_score=risk_score,
                risk_factors=[
                    f"Amount: ₹{amount:,.0f}",
                    f"Account age: {account_age_days} days",
                    f"SIM binding risk: {sim_risk:.1%}"
                ]
            )
            log.info(f"Fraud alert email sent: user={user_id}")
        except Exception as e:
            log.error(f"Failed to send fraud alert email: {e}")

    # Publish events
    await kafka_service.publish("transactions.created", {"payment_id": data.payment_id, "amount": amount, "status": "completed"})
    await kafka_service.publish("notifications.send", {"user_id": payment["user_id"], "type": "payment_completed", "message": f"Payment of ₹{amount} completed successfully"})
    
    # Send Transaction SMS Alert to Sender
    try:
        from_acc = await db.accounts.find_one({"_id": ObjectId(payment["from_account_id"])})
        from_acc = decrypt_user_data(from_acc) if from_acc else None
        if from_acc:
            to_label = payment.get("to_account_number", "Recipient")
            await sms_service.send_transaction_sms(
                current_user["phone"],
                current_user["full_name"],
                f"••{from_acc['account_number'][-4:]}",
                amount,
                "debit",
                current_user["full_name"],
                to_label
            )
    except Exception as e:
        log.error(f"Failed to send payment completion SMS: {e}")

    log.info(f"✅ Payment completed successfully: payment={data.payment_id}, amount=₹{amount}")
    return {"message": "Payment completed successfully", "payment_id": data.payment_id}


@router.get("/")
async def get_payments(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Fetching payment history: user={user_id}")
    db = get_database()
    cursor = db.payments.find({"user_id": user_id}).sort("created_at", -1).limit(50)
    payments = await cursor.to_list(50)
    for p in payments:
        decrypted_payment = decrypt_user_data(p)  # Decrypt fields if needed
        p.clear()  # Clear original dict
        p.update(decrypted_payment)  # Update original dict with decrypted values
        p["id"] = str(p["_id"])
        del p["_id"]
    log.info(f"Returned {len(payments)} payments for user={user_id}")
    return payments


@router.get("/{payment_id}")
async def get_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    log.debug(f"Fetching payment: id={payment_id}")
    db = get_database()
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        log.warning(f"Payment not found: id={payment_id}")
        raise HTTPException(status_code=404, detail="Payment not found")
    payment = decrypt_user_data(payment) if payment else None  # Decrypt fields if payment exists
    if payment and payment["user_id"] != str(current_user["_id"]) and current_user["role"] == "customer":
        raise HTTPException(status_code=403, detail="Access denied")
    if payment:
        payment["id"] = str(payment["_id"])
        del payment["_id"]
    return payment
