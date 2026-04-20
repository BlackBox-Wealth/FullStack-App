"""ML/AI routes - Recommendations, Fraud Detection, Spending Insights, Groq Chatbot."""
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.database import get_database
from app.core.security import get_current_user
from app.core.config import settings
from app.helper.utils import decrypt_user_data
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
router = APIRouter(prefix="/ml", tags=["ML / AI"])


class FraudCheckRequest(BaseModel):
    amount: float
    transaction_type: str = "debit"
    category: str = "other"
    account_age_days: int = 30


class ChatbotRequest(BaseModel):
    message: str


@router.get("/recommendations")
async def get_recommendations(current_user: dict = Depends(get_current_user)):
    """AI-powered investment recommendations based on user profile."""
    user_id = str(current_user["_id"])
    log.info(f"Generating recommendations: user={user_id}")
    db = get_database()

    # Analyze user's portfolio
    investments = await db.investments.find({"user_id": user_id}).to_list(100)
    for inv in investments:
        decrypyed_inv = decrypt_user_data(inv)  # Decrypt fields if needed
        inv.clear()  # Clear original dict
        inv.update(decrypyed_inv)  # Update original dict with decrypted values
    total_invested = sum(inv["amount"] for inv in investments)
    log.debug(f"User portfolio: {len(investments)} investments, total=₹{total_invested}")

    # Determine risk profile
    if total_invested > 500000:
        risk_profile = "aggressive"
    elif total_invested > 100000:
        risk_profile = "moderate"
    else:
        risk_profile = "conservative"
    log.info(f"Risk profile determined: user={user_id}, risk={risk_profile}, invested=₹{total_invested:.0f}")

    existing_symbols = {inv["symbol"] for inv in investments}

    # Generate mock recommendations
    all_suggestions = [
        {"symbol": "RELIANCE", "type": "stocks", "reason": "Strong Q3 results with 15% revenue growth. Diversified portfolio across retail, telecom, and energy.", "confidence": 0.87},
        {"symbol": "TCS", "type": "stocks", "reason": "IT sector leader with consistent dividend history and strong order pipeline.", "confidence": 0.82},
        {"symbol": "SBI_MF_BLUE", "type": "mutual_funds", "reason": "Large-cap fund with 18% CAGR over 5 years. Low expense ratio.", "confidence": 0.79},
        {"symbol": "ICICI_BOND_A", "type": "bonds", "reason": "AAA-rated corporate bond yielding 8.5%. Low risk with steady income.", "confidence": 0.91},
        {"symbol": "INFY", "type": "stocks", "reason": "Digital transformation leader. AI/ML capabilities driving new contracts.", "confidence": 0.76},
        {"symbol": "GOLD_ETF", "type": "mutual_funds", "reason": "Safe haven during market volatility. 12% YoY appreciation.", "confidence": 0.85},
        {"symbol": "HDFCBANK", "type": "stocks", "reason": "Consistent loan growth and strong NPA management.", "confidence": 0.83},
        {"symbol": "GOVT_BOND_10Y", "type": "bonds", "reason": "Government-backed 10-year bond with 7.2% yield. Zero default risk.", "confidence": 0.94},
    ]

    recommendations = []
    for s in all_suggestions:
        action = "HOLD" if s["symbol"] in existing_symbols else "BUY"
        amount = round(random.uniform(10000, 100000), 2) if action == "BUY" else 0
        recommendations.append({**s, "action": action, "amount": amount})

    random.shuffle(recommendations)
    recommendations = recommendations[:5]
    log.info(f"Generated {len(recommendations)} recommendations for user={user_id}")

    return {"risk_profile": risk_profile, "recommendations": recommendations}


@router.post("/fraud-check")
async def fraud_check(data: FraudCheckRequest, current_user: dict = Depends(get_current_user)):
    """Real-time fraud risk assessment."""
    user_id = str(current_user["_id"])
    log.info(f"Fraud check: user={user_id}, amount=₹{data.amount}, type={data.transaction_type}, category={data.category}")

    # Mock ML model scoring
    risk_score = 0.0

    # Amount-based risk
    if data.amount > 500000:
        risk_score += 0.35
        log.debug("High amount penalty: +0.35")
    elif data.amount > 100000:
        risk_score += 0.15
        log.debug("Medium amount penalty: +0.15")

    # Category risk
    if data.category in ["gambling", "crypto", "unknown"]:
        risk_score += 0.25
        log.debug(f"High-risk category '{data.category}': +0.25")

    # Account age risk
    if data.account_age_days < 7:
        risk_score += 0.3
        log.debug("New account penalty: +0.3")
    elif data.account_age_days < 30:
        risk_score += 0.1
        log.debug("Young account penalty: +0.1")
        
    # SIM BINDING RISK
    if current_user.get("verified_phone"):
        user_phone = current_user.get("phone")
        verified_phone = current_user.get("verified_phone")
        if user_phone != verified_phone:
            risk_score += 0.25
            log.debug(f"SIM binding mismatch (different phone): +0.25")
    else:
        risk_score += 0.1
        log.debug("Phone not verified (SIM binding): +0.1")      
    # Random noise (simulates ML uncertainty)
    noise = random.uniform(-0.05, 0.1)
    risk_score = min(max(risk_score + noise, 0.0), 1.0)

    is_fraudulent = risk_score > 0.7
    risk_level = "high" if risk_score > 0.7 else "medium" if risk_score > 0.4 else "low"

    log.info(f"Fraud assessment result: user={user_id}, risk_score={risk_score:.3f}, level={risk_level}, flagged={is_fraudulent}")

    return {
        "risk_score": round(risk_score, 3),
        "is_fraudulent": is_fraudulent,
        "risk_level": risk_level,
        "factors": [
            f"Transaction amount: ₹{data.amount}",
            f"Category: {data.category}",
            f"Account age: {data.account_age_days} days",
        ],
    }


@router.get("/spending-insights")
async def spending_insights(current_user: dict = Depends(get_current_user)):
    """AI-generated spending insights and saving suggestions."""
    user_id = str(current_user["_id"])
    log.info(f"Generating spending insights: user={user_id}")
    db = get_database()

    start_date = datetime.utcnow() - timedelta(days=90)
    pipeline = [
        {"$match": {"user_id": user_id, "transaction_type": "debit", "created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(20)
    total_spending = sum(r["total"] for r in results)
    log.info(f"Spending data aggregated: user={user_id}, total_spending=₹{total_spending:.2f}, categories={len(results)}")

    insights = []
    for r in results:
        category = r["_id"]
        amount = r["total"]
        pct = (amount / total_spending * 100) if total_spending > 0 else 0

        if pct > 30:
            insight_type = "warning"
            msg = f"You're spending {pct:.0f}% of your budget on {category}. Consider reducing by 15-20%."
            savings = round(amount * 0.15, 2)
            log.warning(f"High spending alert: user={user_id}, category={category}, pct={pct:.1f}%")
        elif pct > 15:
            insight_type = "info"
            msg = f"{category.capitalize()} spending is moderate at {pct:.0f}%. Track for optimization."
            savings = round(amount * 0.1, 2)
        else:
            insight_type = "positive"
            msg = f"Great! {category.capitalize()} spending is well-controlled at {pct:.0f}%."
            savings = 0

        insights.append({
            "category": category,
            "type": insight_type,
            "message": msg,
            "total_spent": round(amount, 2),
            "percentage": round(pct, 1),
            "savings_potential": savings,
        })

    log.info(f"Generated {len(insights)} spending insights for user={user_id}")
    return {"total_spending": round(total_spending, 2), "period": "3 months", "insights": insights}


@router.post("/chatbot")
async def chatbot(data: ChatbotRequest, current_user: dict = Depends(get_current_user)):
    """AI Financial Advisor powered by Groq LLM."""
    user_id = str(current_user["_id"])
    log.info(f"Chatbot query: user={user_id}, message_length={len(data.message)}")
    db = get_database()

    # Build user context
    accounts = await db.accounts.find({"user_id": user_id}).to_list(10)
    for acc in accounts:
        decrypted_acc = decrypt_user_data(acc)  # Decrypt fields if needed
        acc.clear()  # Clear original dict
        acc.update(decrypted_acc)  # Update original dict with decrypted values
    total_balance = sum(a.get("balance", 0) for a in accounts)
    investments = await db.investments.find({"user_id": user_id}).to_list(50)
    for inv in investments:
        decrypyed_inv = decrypt_user_data(inv)  # Decrypt fields if needed
        inv.clear()  # Clear original dict
        inv.update(decrypyed_inv)  # Update original dict with decrypted values
    total_invested = sum(i["amount"] for i in investments)
    log.debug(f"Chatbot context: user={user_id}, balance=₹{total_balance:.0f}, invested=₹{total_invested:.0f}")

    context = (
        f"User: {current_user['full_name']}, "
        f"Balance: ₹{total_balance:,.0f}, "
        f"Investments: ₹{total_invested:,.0f} across {len(investments)} positions, "
        f"Accounts: {len(accounts)} active."
    )

    # Try Groq API
    if settings.GROQ_API_KEY:
        log.info(f"Calling Groq LLM API: user={user_id}")
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": f"You are a certified Indian financial advisor at WealthVault Bank. Be helpful, concise, and data-driven. User context: {context}. Answer in 2-3 sentences max."},
                    {"role": "user", "content": data.message},
                ],
                temperature=0.7,
                max_tokens=300,
            )
            response = chat.choices[0].message.content
            log.info(f"Groq API response received: user={user_id}, tokens_used=~{len(response.split())}")
            return {"response": response, "source": "groq_llm"}
        except Exception as e:
            log.error(f"Groq API error: user={user_id}, error={e}", exc_info=True)
            log.warning("Falling back to mock response")

    # Fallback mock responses
    log.info(f"Using mock chatbot response: user={user_id} (no GROQ_API_KEY)")
    mock_responses = {
        "invest": f"Based on your balance of ₹{total_balance:,.0f}, I recommend diversifying into a mix of large-cap stocks and debt mutual funds for stability.",
        "save": "A great savings strategy is the 50-30-20 rule: 50% needs, 30% wants, 20% savings. With your current spending patterns, you could save an extra ₹5,000-10,000 monthly.",
        "budget": f"Based on your transaction history, I notice higher spending on entertainment. Consider allocating a fixed budget of ₹5,000/month for discretionary spending.",
        "loan": "Current home loan rates are 8.5-9.5%. With your credit profile, you could qualify for a competitive rate. I recommend comparing at least 3 lenders.",
        "default": f"I'm your WealthVault AI advisor! With a balance of ₹{total_balance:,.0f} and {len(investments)} investments, you're on a good track. How can I help you with budgeting, investing, or planning?",
    }

    response = mock_responses["default"]
    msg_lower = data.message.lower()
    for keyword, resp in mock_responses.items():
        if keyword in msg_lower:
            response = resp
            break

    log.debug(f"Mock response generated for user={user_id}")
    return {"response": response, "source": "mock"}
