"""Real credit score computation and persistence."""
from datetime import datetime, timedelta
from bson import ObjectId
from logifyx import Logifyx
from app.helper.utils import decrypt_user_data
from app.helper.utils import decrypt_user_data


log = Logifyx(name="wealthvault-credit", color=True)


async def compute_credit_score(db, user_id: str, user: dict) -> dict:
    """
    Compute a real credit score (300-900) from the user's live financial data.
    The algorithm derives a target score from the user's current financial profile,
    then moves the stored personal score 35% toward that target — giving the score
    memory and inertia so it evolves incrementally rather than resetting each time.
    Returns score, rating, and a list of factor dicts with 'text' and 'impact' keys.
    """

    target = 600  # neutral target baseline; adjusted by factors below
    factors = []

    # ── 1. Account age & longevity (max +30) ─────────────────────────────────
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except ValueError:
            created_at = None

    if created_at:
        age_days = (datetime.utcnow() - created_at).days
        if age_days > 365:
            target += 30
            factors.append({"text": "Established account (1+ year)", "impact": "positive"})
        elif age_days > 180:
            target += 15
            factors.append({"text": "Mature account (6+ months)", "impact": "positive"})
        elif age_days > 30:
            target += 5
            factors.append({"text": "Growing account history", "impact": "positive"})
        else:
            factors.append({"text": "New account (building history)", "impact": "neutral"})

    # ── 2. KYC status (+30 or -10) ────────────────────────────────────────────
    kyc = user.get("kyc_status", "not_initiated")
    if kyc == "verified":
        target += 30
        factors.append({"text": "Identity verified (KYC)", "impact": "positive"})
    elif kyc == "pending":
        factors.append({"text": "KYC verification in progress", "impact": "neutral"})
    else:
        target -= 10
        factors.append({"text": "Identity not verified", "impact": "negative"})

    # ── 3. Account balance & savings (max +50, min -40) ───────────────────────
    accounts = await db.accounts.find({"user_id": user_id, "is_external": False}).to_list(50)
    accounts = [decrypt_user_data(a) for a in accounts]
    total_balance = sum(a.get("balance", 0) for a in accounts)

    if total_balance > 500000:
        target += 50
        factors.append({"text": f"Excellent savings (₹{total_balance:,.0f})", "impact": "positive"})
    elif total_balance > 200000:
        target += 35
        factors.append({"text": f"Strong savings balance (₹{total_balance:,.0f})", "impact": "positive"})
    elif total_balance > 100000:
        target += 20
        factors.append({"text": f"Good savings balance (₹{total_balance:,.0f})", "impact": "positive"})
    elif total_balance > 10000:
        target += 5
        factors.append({"text": f"Moderate balance (₹{total_balance:,.0f})", "impact": "neutral"})
    elif total_balance > 1000:
        target -= 20
        factors.append({"text": "Low account balance", "impact": "negative"})
    elif accounts:
        target -= 40
        factors.append({"text": "Very low account balance", "impact": "negative"})

    # ── 3b. Investment participation (+5 to +30) ────────────────────────────
    investments_raw = await db.investments.find({"user_id": user_id}).to_list(200)
    investments = [decrypt_user_data(inv) for inv in investments_raw]

    if investments:
        total_invested = sum(float(inv.get("amount", 0)) for inv in investments)
        investment_count = len(investments)

        if total_invested > 500000:
            target += 30
            factors.append({"text": f"Strong long-term investing (₹{total_invested:,.0f})", "impact": "positive"})
        elif total_invested > 100000:
            target += 20
            factors.append({"text": f"Healthy investment portfolio (₹{total_invested:,.0f})", "impact": "positive"})
        elif total_invested > 0:
            target += 10
            factors.append({"text": f"Active investment activity (₹{total_invested:,.0f})", "impact": "positive"})

        if investment_count >= 5:
            target += 5
            factors.append({"text": f"Diversified investing across {investment_count} holdings", "impact": "positive"})
    else:
        factors.append({"text": "No investment history yet", "impact": "neutral"})

    # ── 4. Loan & debt analysis (max +30, min -80) ────────────────────────────
    loans_raw = await db.loans.find({"user_id": user_id}).to_list(100)
    loans = [decrypt_user_data(l) for l in loans_raw]
    active_loans = [l for l in loans if l.get("status") in ["approved", "disbursed"]]
    monthly_income = user.get("monthly_income", 50000)

    if active_loans:
        total_loan = sum(l.get("amount", 0) for l in active_loans)
        total_emi = sum(l.get("emi", 0) for l in active_loans)
        dti = (total_emi / monthly_income) if monthly_income > 0 else 1.0

        if dti < 0.3:
            target += 30
            factors.append({"text": "Healthy debt-to-income ratio", "impact": "positive"})
        elif dti < 0.5:
            target += 10
            factors.append({"text": "Manageable loan EMIs", "impact": "positive"})
        elif dti < 0.7:
            target -= 20
            factors.append({"text": "High EMI burden on income", "impact": "negative"})
        else:
            target -= 50
            factors.append({"text": "Critical debt-to-income ratio", "impact": "negative"})

        if total_loan > 2000000:
            target -= 30
            factors.append({"text": "Very high total loan exposure", "impact": "negative"})
        elif total_loan > 1000000:
            target -= 10
            factors.append({"text": "High loan exposure", "impact": "negative"})
        else:
            factors.append({"text": f"Active loan: ₹{total_loan:,.0f}", "impact": "neutral"})
    else:
        factors.append({"text": "No active loans", "impact": "neutral"})

    # ── 5. Transaction behaviour – last 90 days ───────────────────────────────
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    txns_raw = await db.transactions.find({
        "user_id": user_id,
        "created_at": {"$gte": ninety_days_ago},
    }).to_list(2000)
    txns = [decrypt_user_data(t) for t in txns_raw]

    if txns:
        completed = [t for t in txns if t.get("status") == "completed"]
        debits = [t for t in completed if t.get("transaction_type") == "debit"]
        credits = [t for t in completed if t.get("transaction_type") == "credit"]
        blocked = [t for t in txns if t.get("status") == "blocked"]
        high_risk = [t for t in txns if float(t.get("risk_score", 0)) > 0.7]

        total_debit = sum(float(t.get("amount", 0)) for t in debits)
        total_credit = sum(float(t.get("amount", 0)) for t in credits)

        # Income-vs-spending ratio
        if total_credit > 0:
            spend_ratio = total_debit / total_credit
            if spend_ratio < 0.5:
                target += 40
                factors.append({"text": "Excellent savings rate (50%+ of income saved)", "impact": "positive"})
            elif spend_ratio < 0.8:
                target += 25
                factors.append({"text": "Good income-to-spending ratio", "impact": "positive"})
            elif spend_ratio < 1.0:
                target += 10
                factors.append({"text": "Balanced income and spending", "impact": "positive"})
            elif spend_ratio < 1.3:
                target -= 15
                factors.append({"text": "Spending slightly exceeds income", "impact": "negative"})
            else:
                target -= 35
                factors.append({"text": "Spending significantly exceeds income", "impact": "negative"})
        elif total_debit > 0:
            target -= 10
            factors.append({"text": "No income transactions detected", "impact": "negative"})

        # Transaction regularity (per month over 90 days)
        txn_per_month = len(txns) / 3.0
        if txn_per_month > 20:
            target += 20
            factors.append({"text": "High & consistent transaction activity", "impact": "positive"})
        elif txn_per_month > 8:
            target += 10
            factors.append({"text": "Regular transaction activity", "impact": "positive"})

        # Risk & fraud signals
        if blocked:
            penalty = min(len(blocked) * 25, 80)
            target -= penalty
            factors.append({"text": f"{len(blocked)} transaction(s) blocked by fraud detection", "impact": "negative"})

        if high_risk:
            penalty = min(len(high_risk) * 12, 60)
            target -= penalty
            factors.append({"text": f"{len(high_risk)} high-risk transaction(s) flagged", "impact": "negative"})
        elif not blocked:
            target += 15
            factors.append({"text": "Clean transaction history", "impact": "positive"})
    else:
        factors.append({"text": "No transaction history yet", "impact": "neutral"})

    # ── 6. Clamp target and rate ──────────────────────────────────────────────
    # Pure deterministic result — no blending here so page reloads are stable.
    # Blending with the stored personal score happens only in update_user_credit_score,
    # which is triggered by real transactions, not by page views.
    score = max(300, min(900, int(target)))

    if score >= 750:
        rating = "Good"
    elif score >= 600:
        rating = "Average"
    else:
        rating = "Poor"

    log.info(f"Credit score computed: user={user_id}, score={score}, rating={rating}, factors={len(factors)}")
    return {"score": score, "rating": rating, "factors": factors}


async def update_user_credit_score(db, user_id: str) -> int:
    """
    Recompute and persist credit_score on the users document.
    Returns the new score. Safe to call as a fire-and-forget background task.
    """
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return 650
        user = decrypt_user_data(user)

        result = await compute_credit_score(db, user_id, user)
        target_score = result["score"]
        previous = int(user.get("credit_score") or 650)

        # Blend: move 35% toward the target derived from current financial data.
        # This gives the score inertia — triggered only by real transactions,
        # so consistent good behaviour steadily lifts it over time.
        new_score = int(previous + (target_score - previous) * 0.35)
        new_score = max(300, min(900, new_score))

        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "credit_score": new_score,
                "credit_score_previous": previous,
                "credit_score_updated_at": datetime.utcnow(),
            }}
        )
        log.info(f"Credit score persisted: user={user_id}, personal={previous}, target={target_score}, blended={new_score}, delta={new_score - previous}")
        return new_score
    except Exception as e:
        log.error(f"Failed to update credit score for user={user_id}: {e}")
        return 650
