"""Payment routes with OTP verification."""
import asyncio
import random
import string
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.core.database import get_database
from app.core.redis_client import get_redis
from app.core.security import get_current_user, require_kyc
from app.core.kafka_service import kafka_service
from app.core.config import settings
from app.services.email_service import email_service
from app.services.sms_service import sms_service
from app.helper.utils import encrypt_user_data, decrypt_user_data, encrypt_update_fields
from app.services.deterministic_hash import generate_deterministic_hash
from app.services.budget_service import budget_service
from app.services.credit_score_service import update_user_credit_score
from app.services.firebase_service import send_payment_approval_notification
from pydantic import BaseModel
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
from app.models.account import PaymentInitiate, OTPVerify
from app.models.alert import AlertType
router = APIRouter(prefix="/payments", tags=["Payments"])


class PaymentApprovalRequest(BaseModel):
    approved: bool


async def _complete_payment(db, payment: dict, payment_id: str, user_id: str, current_user: dict) -> dict:
    """Debit/credit balances, create transaction records, publish events. Returns {budget_alert}."""
    amount = payment["amount"]

    from_account_doc = await db.accounts.find_one({"_id": ObjectId(payment["from_account_id"])})
    to_account_doc = await db.accounts.find_one({"_id": ObjectId(payment["to_account_id"])})
    from_account = decrypt_user_data(from_account_doc) if from_account_doc else None
    to_account = decrypt_user_data(to_account_doc) if to_account_doc else None

    if not from_account or not to_account:
        raise HTTPException(status_code=404, detail="Payment account not found")

    from_balance = float(from_account.get("balance", 0))
    to_balance = float(to_account.get("balance", 0))

    if from_balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    from_update = encrypt_update_fields({"balance": from_balance - amount, "updated_at": datetime.utcnow()})
    to_update = encrypt_update_fields({"balance": to_balance + amount, "updated_at": datetime.utcnow()})
    await db.accounts.update_one({"_id": ObjectId(payment["from_account_id"])}, {"$set": from_update})
    await db.accounts.update_one({"_id": ObjectId(payment["to_account_id"])}, {"$set": to_update})
    log.debug(f"Balance debit/credit done: payment={payment_id}, amount=₹{amount}")

    budget_alert = await budget_service.check_budget_breach(user_id, "transfer", amount)

    debit_txn = {
        "account_id": payment["from_account_id"], "user_id": user_id,
        "amount": amount, "transaction_type": "debit", "category": "transfer",
        "description": f"Payment: {payment.get('description', '')}", "status": "completed",
        "risk_score": 0.0, "budget_alert": budget_alert, "payment_id": payment_id,
        "created_at": datetime.utcnow(),
    }
    credit_txn = {
        "account_id": payment["to_account_id"], "user_id": payment.get("to_user_id", ""),
        "amount": amount, "transaction_type": "credit", "category": "transfer",
        "description": f"Received payment: {payment.get('description', '')}", "status": "completed",
        "risk_score": 0.0, "payment_id": payment_id, "created_at": datetime.utcnow(),
    }
    await db.transactions.insert_many([encrypt_user_data(debit_txn), encrypt_user_data(credit_txn)])
    log.info(f"Transaction records created for payment={payment_id}")

    payment_update = encrypt_update_fields({"status": "completed", "completed_at": datetime.utcnow()})
    await db.payments.update_one({"_id": ObjectId(payment_id)}, {"$set": payment_update})

    # Risk assessment
    account_age_days = (datetime.utcnow() - current_user.get("created_at", datetime.utcnow())).days
    sim_risk = payment.get("sim_binding_risk", 0.0)
    risk_score = 0.0
    if amount > 500000:
        risk_score += 0.35
    elif amount > 100000:
        risk_score += 0.15
    if account_age_days < 7:
        risk_score += 0.3
    elif account_age_days < 30:
        risk_score += 0.1
    risk_score = min(risk_score + sim_risk, 1.0)

    if risk_score > 0.6:
        log.warning(f"HIGH RISK PAYMENT: payment={payment_id}, risk={risk_score:.3f}, amount=₹{amount}")
        alert_doc = {
            "user_id": user_id,
            "alert_type": AlertType.HIGH_RISK_PAYMENT.value,
            "risk_score": round(risk_score, 3),
            "reason": f"High-risk payment: ₹{amount:,.0f}, account age {account_age_days}d, SIM risk {sim_risk:.1%}",
            "payment_id": payment_id, "amount": amount, "is_read": False,
            "created_at": datetime.utcnow(),
        }
        await db.alerts.insert_one(encrypt_user_data(alert_doc))
        try:
            asyncio.create_task(email_service.send_fraud_alert(
                to_email=current_user["email"], amount=amount,
                recipient=payment.get("to_account_number", "Unknown")[-4:],
                risk_score=risk_score,
                risk_factors=[f"Amount: ₹{amount:,.0f}", f"Account age: {account_age_days}d", f"SIM risk: {sim_risk:.1%}"]
            ))
        except Exception as e:
            log.error(f"Failed to send fraud alert email: {e}")

    await kafka_service.publish("transactions.created", {"payment_id": payment_id, "amount": amount, "status": "completed"})
    await kafka_service.publish("notifications.send", {"user_id": user_id, "type": "payment_completed", "message": f"Payment of ₹{amount} completed successfully"})

    asyncio.create_task(update_user_credit_score(db, user_id))
    if payment.get("to_user_id") and payment.get("to_user_id") != user_id:
        asyncio.create_task(update_user_credit_score(db, payment["to_user_id"]))

    try:
        from_acc = decrypt_user_data(from_account_doc) if from_account_doc else None
        if from_acc:
            await sms_service.send_transaction_sms(
                current_user["phone"], current_user["full_name"],
                f"••{from_acc['account_number'][-4:]}", amount, "debit",
                current_user["full_name"], payment.get("to_account_number", "Recipient")
            )
    except Exception as e:
        log.error(f"Failed to send payment completion SMS: {e}")

    log.info(f"Payment completed: payment={payment_id}, amount=₹{amount}")
    return {"budget_alert": budget_alert}


@router.post("/initiate")
async def initiate_payment(data: PaymentInitiate, current_user: dict = Depends(require_kyc)):
    user_id = str(current_user["_id"])
    
    # Determine payment mode
    payment_mode = "upi" if data.to_vpa else "account"
    destination = data.to_vpa if data.to_vpa else data.to_account_number
    
    log.info(f"Payment initiation: user={user_id}, from={data.from_account_id}, to={destination}, mode={payment_mode}, amount=₹{data.amount}")
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

    # Check family spending limit (if applicable)
    family_member = await db.family_members.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    if family_member and family_member.get("spending_limit"):
        spending_limit = family_member["spending_limit"]
        
        if data.amount > spending_limit:
            log.warning(f"⚠️ Spending limit exceeded in payment: user={user_id}, amount=₹{data.amount}, limit=₹{spending_limit}")
            
            # Create alert for family head
            family_id = family_member["family_id"]
            family = await db.families.find_one({"_id": ObjectId(family_id)})
            
            if family:
                head_user_id = family["head_user_id"]
                alert_doc = {
                    "user_id": head_user_id,
                    "alert_type": "spending_limit_exceeded",
                    "reason": f"Family member exceeded spending limit in payment: ₹{data.amount:,.0f} (limit: ₹{spending_limit:,.0f})",
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
                    "message": f"Family member exceeded spending limit in payment: ₹{data.amount:,.0f}"
                })

    # Resolve destination account based on payment mode
    to_account = None
    to_account_number = None
    
    if payment_mode == "upi":
        # UPI VPA lookup - Simple mapping: vpa format is username@wealthvault
        vpa_username = data.to_vpa.split('@')[0] if '@' in data.to_vpa else data.to_vpa
        
        # Try to find user by email matching VPA pattern
        vpa_email_pattern = f"{vpa_username}@"
        to_user = await db.users.find_one({"email": {"$regex": f"^{vpa_username}@", "$options": "i"}})
        
        if to_user:
            to_user = decrypt_user_data(to_user)
            to_user_id = str(to_user["_id"])
            
            # Find primary account for this user
            to_account = await db.accounts.find_one({
                "user_id": to_user_id,
                "is_external": False,
                "status": "active"
            })
            to_account = decrypt_user_data(to_account) if to_account else None
            
            if to_account:
                to_account_number = to_account["account_number"]
                log.info(f"UPI VPA resolved: {data.to_vpa} → user={to_user_id}, account={to_account_number}")
        
        if not to_account:
            log.warning(f"Payment failed: UPI VPA={data.to_vpa} could not be resolved")
            raise HTTPException(status_code=404, detail="UPI VPA not found or no active account linked")
    else:
        # Traditional account number lookup
        to_account_number = data.to_account_number
        to_account_hash = generate_deterministic_hash(to_account_number)
        to_account = await db.accounts.find_one({"hashed_account_number": to_account_hash})
        to_account = decrypt_user_data(to_account) if to_account else None
        
        if not to_account:
            log.warning(f"Payment failed: destination account={to_account_number} not found")
            raise HTTPException(status_code=404, detail="Destination account not found")

    log.info(f"Payment validation passed: from={data.from_account_id} → to={to_account_number} (mode={payment_mode})")

    # Create pending payment
    payment_doc = {
        "user_id": user_id,
        "from_account_id": data.from_account_id,
        "to_account_id": str(to_account["_id"]),
        "to_account_number": to_account_number,
        "payment_mode": payment_mode,
        "to_vpa": data.to_vpa if payment_mode == "upi" else None,
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
            await kafka_service.publish("email.otpVerification", {
                "user_email": current_user["email"],
                "otp_code": otp,
            })
        except Exception as e:
            log.error(f"Failed to send payment verification email: {e}")

    return {
        "payment_id": payment_id,
        "message": "OTP sent for payment verification",
        "otp_debug": otp if settings.DEBUG else None,
    }


@router.post("/verify")
async def verify_payment(data: OTPVerify, current_user: dict = Depends(require_kyc)):
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
        if otp_doc:
            otp_doc = decrypt_user_data(otp_doc)
        stored_otp = otp_doc.get("otp") if otp_doc else None
   
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

    # Clean up OTP
    if redis:
        await redis.delete(f"payment_otp:{data.payment_id}")
        log.debug(f"Payment OTP cleaned from Redis: payment={data.payment_id}")

    # --- Large payment: hold for Flutter app approval ---
    if amount >= settings.LARGE_PAYMENT_THRESHOLD:
        log.info(f"Large payment (₹{amount} >= ₹{settings.LARGE_PAYMENT_THRESHOLD}): routing to Flutter approval, payment={data.payment_id}")
        status_update = encrypt_update_fields({"status": "pending_app_approval", "updated_at": datetime.utcnow()})
        await db.payments.update_one({"_id": ObjectId(data.payment_id)}, {"$set": status_update})

        # Fetch Flutter FCM token and push notification
        user_doc = await db.users.find_one({"_id": current_user["_id"]})
        if user_doc:
            user_doc = decrypt_user_data(user_doc)
            fcm_token = user_doc.get("fcm_token")
            if fcm_token:
                asyncio.create_task(send_payment_approval_notification(fcm_token, data.payment_id, amount))
            else:
                log.warning(f"No Flutter FCM token for user={user_id} — push skipped")

        return {
            "payment_id": data.payment_id,
            "status": "pending_app_approval",
            "requires_app_approval": True,
            "message": f"Payment of ₹{amount:,.0f} requires approval from your mobile app. A notification has been sent.",
        }

    # --- Normal payment (< ₹1L): complete immediately ---
    result = await _complete_payment(db, payment, data.payment_id, user_id, current_user)
    return {
        "message": "Payment completed successfully",
        "payment_id": data.payment_id,
        "budget_alert": result["budget_alert"],
    }


@router.post("/{payment_id}/respond")
async def respond_to_payment(
    payment_id: str,
    data: PaymentApprovalRequest,
    current_user: dict = Depends(require_kyc),
):
    """
    Called by the Flutter app when the user taps YES or NO on the approval notification.
    YES  → debit/credit balances, status = completed
    NO   → status = blocked, no money moved
    """
    user_id = str(current_user["_id"])
    log.info(f"Flutter approval response: payment={payment_id}, user={user_id}, approved={data.approved}")
    db = get_database()

    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    payment = decrypt_user_data(payment) if payment else None
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if payment["status"] != "pending_app_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Payment is not awaiting approval (status: {payment['status']})"
        )

    if not data.approved:
        status_update = encrypt_update_fields({"status": "blocked", "blocked_at": datetime.utcnow()})
        await db.payments.update_one({"_id": ObjectId(payment_id)}, {"$set": status_update})
        await kafka_service.publish("notifications.send", {
            "user_id": user_id, "type": "payment_rejected",
            "message": f"Payment of ₹{payment['amount']:,.0f} was rejected.",
        })
        log.info(f"Payment rejected via Flutter: payment={payment_id}, amount=₹{payment['amount']}")
        return {"message": "Payment rejected", "payment_id": payment_id, "status": "blocked"}

    result = await _complete_payment(db, payment, payment_id, user_id, current_user)
    log.info(f"Payment approved via Flutter: payment={payment_id}, amount=₹{payment['amount']}")
    return {
        "message": "Payment approved and completed",
        "payment_id": payment_id,
        "budget_alert": result["budget_alert"],
    }


@router.post("/{payment_id}/resend")
async def resend_payment_otp(payment_id: str, otp_channel: str = "email", current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"OTP resend request: payment={payment_id}, user={user_id}, channel={otp_channel}")
    db = get_database()
    redis = get_redis()
    
    # 1. Verify payment exists and belongs to user
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
         log.warning(f"Resend failed: payment={payment_id} not found")
         raise HTTPException(status_code=404, detail="Payment not found")
    
    payment = decrypt_user_data(payment)
    if payment["user_id"] != user_id:
        log.warning(f"Resend denied: user={user_id} does not own payment={payment_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    if payment["status"] != "pending_otp":
        log.warning(f"Resend failed: payment={payment_id} is in status {payment['status']}, not pending_otp")
        raise HTTPException(status_code=400, detail="Payment is not in pending OTP state")

    # 2. Check Resend Count (Max 3)
    resend_count = 0
    if redis:
        resend_key = f"otp_resend_count:{payment_id}"
        resend_count = int(await redis.get(resend_key) or 0)
        
        if resend_count >= 3:
            log.warning(f"Resend limit reached: payment={payment_id}, user={user_id}")
            raise HTTPException(status_code=429, detail="Maximum OTP resend attempts (3) reached.")
    
    # 3. Generate and Store New OTP
    otp = "".join(random.choices(string.digits, k=6))
    if redis:
        await redis.setex(f"payment_otp:{payment_id}", settings.OTP_EXPIRE_SECONDS, otp)
        await redis.incr(f"otp_resend_count:{payment_id}")
        await redis.expire(f"otp_resend_count:{payment_id}", 3600)  # Keep count for 1 hour
        log.info(f"New OTP stored in Redis for resend: payment={payment_id}")
    else:
        # MongoDB fallback
        otp_update_fields = encrypt_update_fields({"otp": otp, "created_at": datetime.utcnow()})
        await db.payment_otps.update_one(
            {"payment_id": payment_id},
            {"$set": otp_update_fields},
            upsert=True
        )
        log.info(f"New OTP stored in MongoDB for resend: payment={payment_id}")

    # 4. Send OTP
    if otp_channel == "sms":
        try:
            await sms_service.send_otp(current_user["phone"], otp)
        except Exception as e:
            log.error(f"Failed to resend payment verification SMS: {e}")
            raise HTTPException(status_code=500, detail="Failed to send SMS")
    else:
        try:
            await kafka_service.publish("email.otpVerification", {
                "user_email": current_user["email"],
                "otp_code": otp
            })
        except Exception as e:
            log.error(f"Failed to resend payment verification email: {e}")
            raise HTTPException(status_code=500, detail="Failed to send email")

    return {
        "message": f"OTP resent successfully to your registered {otp_channel}",
        "resend_count": resend_count + 1,
        "otp_debug": otp if settings.DEBUG else None
    }


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


@router.get("/qr/generate")
async def generate_payment_qr(amount: float, description: str = "", current_user: dict = Depends(get_current_user)):
    """Generate UPI QR code data for receiving payments."""
    user_id = str(current_user["_id"])
    user_email = current_user["email"]
    
    # Generates VPA from user email (username@wealthvault)
    vpa_username = user_email.split('@')[0]
    vpa = f"{vpa_username}@wealthvault"
    
    log.info(f"QR code generation: user={user_id}, vpa={vpa}, amount=₹{amount}")
    
    # Generates UPI payment string
    qr_data = f"upi://pay?pa={vpa}&pn={current_user['full_name']}&am={amount}"
    if description:
        qr_data += f"&tn={description}"
    
    log.info(f"QR code generated: {qr_data}")
    
    return {
        "qr_data": qr_data,
        "vpa": vpa,
        "amount": amount,
        "payee_name": current_user["full_name"],
        "description": description
    }
