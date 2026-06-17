"""Risk Dashboard - System-wide risk assessment."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from app.core.database import get_database
from app.core.security import require_role
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,
)

router = APIRouter(prefix="/risk", tags=["Risk Management"])


@router.get("/summary")
async def get_risk_summary(
    current_user: dict = Depends(require_role("employee", "relationship_manager", "super_admin"))
):
    """
    Calculate overall system risk score based on multiple factors.
    Returns weighted risk score (0-100) with breakdown.
    """
    log.info(f"Risk summary requested: by={current_user['email']} (role={current_user['role']})")
    db = get_database()

    # Initialize breakdown
    breakdown = {
        "fraud": 0,
        "transactions": 0,
        "otp": 0,
        "new_users": 0
    }

    # 1. Fraud Alerts Risk (max 40 points)
    fraud_pending = await db.fraud_logs.count_documents({"status": "pending_review"})
    # Scale: 0-10 alerts = 0-40 points (linear)
    breakdown["fraud"] = min(fraud_pending * 4, 40)

    # 2. High-Value Transactions Risk (max 20 points)
    # Count transactions > 100,000 in last 24 hours
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
    high_value_txns = await db.transactions.count_documents({
        "amount": {"$gt": 100000},
        "created_at": {"$gte": twenty_four_hours_ago}
    })
    # Scale: 0-20 transactions = 0-20 points (linear)
    breakdown["transactions"] = min(high_value_txns, 20)

    # 3. OTP Failures Risk (max 20 points)
    # Check Redis for OTP failure counts (if available)
    # Fallback: estimate from payment_otps collection
    try:
        from app.core.redis_client import get_redis
        redis = get_redis()
        otp_failures = 0
        
        if redis:
            # Count keys matching otp_failures:* pattern
            # This is a simplified approach - in production, track this more systematically
            keys = await redis.keys("otp_failures:*")
            for key in keys:
                count = await redis.get(key)
                if count:
                    otp_failures += int(count)
        else:
            # Fallback: count recent payment OTPs (last hour)
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            otp_failures = await db.payment_otps.count_documents({
                "created_at": {"$gte": one_hour_ago}
            })
        
        # Scale: 0-10 failures = 0-20 points
        breakdown["otp"] = min(otp_failures * 2, 20)
    except Exception as e:
        log.warning(f"Failed to fetch OTP failures: {e}")
        breakdown["otp"] = 0

    # 4. New Users Risk (max 20 points)
    # Count users created in last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    new_users = await db.users.count_documents({
        "created_at": {"$gte": seven_days_ago}
    })
    # Scale: 0-50 new users = 0-20 points (linear)
    breakdown["new_users"] = min(int(new_users * 0.4), 20)

    # Calculate total risk score (0-100)
    risk_score = sum(breakdown.values())

    # Determine risk level
    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    log.info(
        f"Risk assessment: score={risk_score}, level={risk_level}, "
        f"fraud={breakdown['fraud']}, txns={breakdown['transactions']}, "
        f"otp={breakdown['otp']}, new_users={breakdown['new_users']}"
    )

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "breakdown": breakdown,
        "timestamp": datetime.utcnow().isoformat(),
        "assessed_by": current_user["email"]
    }
