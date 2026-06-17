"""ML/AI routes - all model inference is dispatched over gRPC to the ML server."""
import random
from datetime import datetime, timedelta
from typing import Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.database import get_database
import re
from app.services.http_ml_client import ml_client
from app.core.security import get_current_user
from app.core.config import settings
from app.helper.utils import decrypt_user_data
from logifyx import Logifyx

_chat_stress_cache: Dict[str, dict] = {}

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   

class MockHomomorphicEncryption:
    """Simulates Homomorphic Encryption for secure LLM context passing and response interception."""
    @staticmethod
    def encrypt_val(val: float) -> str:
        return f"HE_CT_{int(val * 8191)}"

    @staticmethod
    def decrypt_val(encrypted_str: str) -> float:
        val = int(encrypted_str.replace("HE_CT_", ""))
        return round(val / 8191, 2)
        
    @staticmethod
    def decode_llm_response(text: str) -> str:
        """Finds any HE_CT_ tokens in LLM string and dynamically decrypts them back into readable local currency."""
        def replacer(match):
            try:
                decrypted_val = MockHomomorphicEncryption.decrypt_val(match.group(0))
                return f"₹{decrypted_val:,.0f}"
            except:
                return match.group(0)
                
        return re.sub(r'HE_CT_\d+', replacer, text)

router = APIRouter(prefix="/ml", tags=["ML / AI"])


class FraudCheckRequest(BaseModel):
    amount: float
    transaction_type: str = "debit"
    category: str = "other"
    account_age_days: int = 30
    merchant_id: str | None = None
    merchant_name: str | None = None
    channel: str | None = None


class ChatbotRequest(BaseModel):
    message: str

class ScenarioRequest(BaseModel):
    scenario_type: str
    custom_query: str | None = None


class ClassifyRequest(BaseModel):
    text: str


class BehaviorAnomalyRequest(BaseModel):
    behavior_data: Dict[str, float]
    email: str | None = None


class CashflowForecastRequest(BaseModel):
    days: int = 30


from app.core.redis_client import cache_response

@router.get("/recommendations")
@cache_response("recommendations", ttl=300)
async def get_recommendations(current_user: dict = Depends(get_current_user)):
    """AI-powered investment recommendations based on user profile."""
    user_id = str(current_user["_id"])
    log.info(f"Generating recommendations: user={user_id}")
    db = get_database()

    # Analyze user's portfolio
    investments = await db.investments.find({"user_id": user_id}).to_list(100)
    total_invested = 0.0
    for inv in investments:
        decrypted = decrypt_user_data(inv)
        inv.clear()
        inv.update(decrypted)
        total_invested += float(inv.get("amount", 0.0))
        
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

    # LLM Explainability over Encrypted Context
    llm_explanation = f"Your portfolio is categorized as {risk_profile}. Focus on diversifying across different sectors."
    nudge = "Set up a monthly SIP to average out market volatility."
    
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            enc_total = MockHomomorphicEncryption.encrypt_val(total_invested)
            
            prompt = (
                f"Act as a direct, helpful financial AI. "
                f"Risk: {risk_profile}. Total Invested (Homomorphically Encrypted): {enc_total}. "
                f"Generated recs: {[r['symbol'] for r in recommendations]}. "
                f"Desired Output Language: {current_user.get('language', 'en')}. "
                f"1. Explain the ML model's reasoning for these exact recommendations in 2 natural sentences in the Desired Output Language. "
                f"2. Give a 1 sentence behavioral nudge. Do not mention encryption directly, just explain the strategy."
            )
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": prompt}],
                temperature=0.6,
                max_tokens=200,
            )
            llm_explanation = MockHomomorphicEncryption.decode_llm_response(chat.choices[0].message.content)
        except Exception as e:
            log.warning(f"LLM HE Explainability Failed: {e}")

    return {
        "risk_profile": risk_profile, 
        "recommendations": recommendations,
        "llm_explanation": llm_explanation,
        "nudge": nudge
    }


@router.post("/fraud-check")
async def fraud_check(data: FraudCheckRequest, current_user: dict = Depends(get_current_user)):
    """Real-time fraud assessment — M1 + LSTM + GraphSAGE signals → M4 RiskMLP decision."""
    user_id = str(current_user["_id"])
    log.info(f"Fraud check: user={user_id}, amount=₹{data.amount}")

    # M1 (gRPC): predict transaction category
    classifier_merchant = (data.merchant_id or data.merchant_name or data.category or "").strip()
    classifier_channel = (data.channel or data.transaction_type or "").strip()
    predicted_category = ml_client.predict_category(classifier_merchant, classifier_channel)

    # LSTM (gRPC): fetch last 30 transactions → sequence anomaly
    db = get_database()
    cursor = db.transactions.find({"user_id": user_id}).sort("created_at", -1).limit(30)
    raw_txns = await cursor.to_list(30)
    raw_txns.reverse()   # chronological order for LSTM

    txn_steps = []
    for t in raw_txns:
        d = decrypt_user_data(t)
        _now = datetime.now()
        created = d.get("created_at", _now)
        ts = int(created.timestamp()) if isinstance(created, datetime) else int(_now.timestamp())
        txn_steps.append({
            "amount": float(d.get("amount", 0.0)),
            "unix_timestamp": ts,
            "category": str(d.get("category", "Other")),
            "is_debit": d.get("transaction_type", "debit") == "debit",
        })

    lstm_result = ml_client.detect_sequence_anomaly(user_id, txn_steps)
    seq_anomaly = float(lstm_result["reconstruction_error"])   # MSE as continuous signal

    # GraphSAGE (gRPC): insider threat between user + merchant
    merchant_id = data.merchant_id or ""
    merchant_txn_count = sum(
        1 for t in raw_txns
        if decrypt_user_data(t).get("merchant_id", "") == merchant_id
    ) if merchant_id else 0
    threat_result = ml_client.detect_insider_threat(user_id, merchant_id, data.amount, merchant_txn_count)
    insider_threat_score = float(threat_result["threat_score"])

    # Build M4 feature vector with all real signals
    cat_mismatch = 1.0 if data.category.lower() != predicted_category.lower() else 0.0
    new_account_flag = 1.0 if data.account_age_days < 7 else 0.0
    _entry = _chat_stress_cache.get(user_id)
    chat_stress = float(_entry["val"] if _entry and _entry["expiry"] > datetime.now() else 0)
    now = datetime.now()
    m4_features = [
        float(data.amount),           # amount
        float(data.account_age_days), # account age proxy
        cat_mismatch,                 # M1: category mismatch
        seq_anomaly,                  # LSTM: reconstruction error (real)
        0.0,                          # biometric (from /behavior-anomaly, not in this request)
        insider_threat_score,         # GraphSAGE: insider threat (real)
        chat_stress,                  # M3: stress from local cache
        0.0,                          # is_new_beneficiary
        0.0,                          # sim_changed
        0.0,                          # location_risk
        float(now.hour),              # transaction hour
        float(now.weekday()),         # day of week
        0.0,                          # ip_risk
    ]

    # M4 (gRPC): final risk score + block/review/approve decision
    m4_result = ml_client.calculate_risk_score(m4_features)
    risk_score = float(m4_result["risk_score"])
    m4_decision = m4_result["decision"]

    # New-account penalty
    risk_score = min(risk_score + new_account_flag * 0.15, 1.0)
    risk_score = min(max(risk_score + random.uniform(-0.02, 0.02), 0.0), 1.0)

    is_fraudulent = risk_score > 0.7 or m4_decision == "block"
    risk_level = "high" if risk_score > 0.7 else "medium" if risk_score > 0.4 else "low"

    log.info(f"Fraud result: user={user_id}, score={risk_score:.3f}, decision={m4_decision}, "
             f"lstm_mse={seq_anomaly:.4f}, insider={insider_threat_score:.3f}")
    return {
        "risk_score": round(risk_score, 3),
        "is_fraudulent": is_fraudulent,
        "risk_level": risk_level,
        "m4_decision": m4_decision,
        "predicted_category": predicted_category,
        "lstm_sequence_anomaly": lstm_result["is_anomaly"],
        "insider_threat": threat_result["is_insider_threat"],
        "factors": [
            f"Transaction amount: ₹{data.amount}",
            f"Category validation: {predicted_category}",
            f"Account age: {data.account_age_days} days",
            f"Sequence anomaly (LSTM): {'yes' if lstm_result['is_anomaly'] else 'no'}",
            f"Insider threat (GraphSAGE): {'yes' if threat_result['is_insider_threat'] else 'no'}",
        ],
    }


@router.post("/behavior-anomaly")
async def behavior_anomaly(data: BehaviorAnomalyRequest):
    """Detect unauthorized access — Isolation Forest via gRPC (public, used during login)."""
    account_code = "ACC001" if data.email and "customer1" in data.email else "ACC999"

    result = ml_client.detect_behavior_anomaly(account_code, data.behavior_data)
    log.info(f"Behavior anomaly [{data.email or 'anonymous'}]: {result}")
    return result


@router.post("/forecast-cashflow")
async def forecast_cashflow(data: CashflowForecastRequest, current_user: dict = Depends(get_current_user)):
    """Predict future cash flows — RandomForestRegressor (arima_<account>.pkl) via gRPC."""
    account_code = "ACC001" if "customer1" in current_user.get("email", "") else "ACC999"
    result = ml_client.forecast(account_code, data.days)
    return {
        "account_id": account_code,
        "forecast": result["items"],
        "trend_direction": result["trend_direction"],
    }


@router.get("/spending-insights")
async def spending_insights(current_user: dict = Depends(get_current_user)):
    """AI-generated spending insights and saving suggestions."""
    user_id = str(current_user["_id"])
    log.info(f"Generating spending insights: user={user_id}")
    db = get_database()

    start_date = datetime.utcnow() - timedelta(days=90)
    query = {"user_id": user_id, "transaction_type": "debit", "created_at": {"$gte": start_date}}
    cursor = db.transactions.find(query)
    txns = await cursor.to_list(1000)
    
    # Decrypt and aggregate in memory
    category_totals = {}
    total_spending = 0.0
    
    for txn in txns:
        decrypted = decrypt_user_data(txn)
        cat = decrypted.get("category", "other")
        amt = float(decrypted.get("amount", 0.0))
        category_totals[cat] = category_totals.get(cat, 0.0) + amt
        total_spending += amt

    # Convert to list for processing
    results = [{"_id": k, "total": v} for k, v in category_totals.items()]
    results.sort(key=lambda x: x["total"], reverse=True)
    
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
    
    # LLM Natural Language Translate built over HE
    llm_reasoning = "Monitor your high spending categories to increase available liquidity for investments."
    if settings.GROQ_API_KEY and len(results) > 0:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            enc_spending = MockHomomorphicEncryption.encrypt_val(total_spending)
            highest_cat = results[0]["_id"]
            
            prompt = (
                f"You are evaluating ML classification outputs. Analysis reveals the highest expenditure is in {highest_cat}. "
                f"Total period spending string HE_CT (encrypted): {enc_spending}. "
                f"Desired Output Language: {current_user.get('language', 'en')}. "
                f"Write exactly 1 short sentence giving a direct behavioral financial nudge to the user to reduce their {highest_cat} spending in the Desired Output Language."
            )
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": prompt}],
                temperature=0.7,
                max_tokens=150,
            )
            llm_reasoning = MockHomomorphicEncryption.decode_llm_response(chat.choices[0].message.content)
        except Exception as e:
            log.warning(f"LLM Insights HE Failed: {e}")

    return {
        "total_spending": round(total_spending, 2), 
        "period": "3 months", 
        "insights": insights,
        "llm_reasoning": llm_reasoning
    }


@router.get("/account-insights")
async def account_insights(current_user: dict = Depends(get_current_user)):
    """AI-powered nudges based on encrypted overall account structure."""
    user_id = str(current_user["_id"])
    db = get_database()

    accounts = await db.accounts.find({"user_id": user_id}).to_list(10)
    total_balance = 0.0
    for acc in accounts:
        decrypted = decrypt_user_data(acc)
        acc.clear()
        acc.update(decrypted)
        total_balance += float(acc.get("balance", 0.0))
    enc_balance = MockHomomorphicEncryption.encrypt_val(total_balance)
    
    nudge = "Maintain healthy emergency savings in your primary account."
    if settings.GROQ_API_KEY and True:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            prompt = (
                f"You are a behavioral finance AI. The user has {len(accounts)} accounts. "
                f"Total HE_CT (homomorphically encrypted balance): {enc_balance}. "
                f"Write exactly 1 short sentence giving a direct behavioral financial nudge indicating if they should deposit more into savings or diversify into investments."
            )
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": prompt}],
                temperature=0.6,
                max_tokens=60,
            )
            nudge = MockHomomorphicEncryption.decode_llm_response(chat.choices[0].message.content)
        except Exception as e:
            log.warning(f"LLM Account Insights HE Failed: {e}")

    return {"llm_nudge": nudge}


@router.get("/sip-insights")
async def sip_insights(current_user: dict = Depends(get_current_user)):
    """AI nudge for SIP optimization and return rates."""
    user_id = str(current_user["_id"])
    db = get_database()
    sips = await db.sips.find({"user_id": user_id}).to_list(10)
    total_sip = 0.0
    for s in sips:
        decrypted = decrypt_user_data(s)
        s.clear()
        s.update(decrypted)
        total_sip += float(s.get("amount", 0.0))
    enc_sip = MockHomomorphicEncryption.encrypt_val(total_sip)
    
    nudge = "Consider increasing SIP amounts into high-yield equity funds despite short-term volatility."
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            prompt = (
                f"You are a financial AI. The user has {len(sips)} SIPs totaling HE_CT (encrypted): {enc_sip}. "
                f"Write exactly 2 short sentences suggesting an optimal interest/return rate threshold for their SIPs to beat inflation, "
                f"and explain a brief tradeoff (e.g., higher returns mean higher risk volatility)."
            )
            chat = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "system", "content": prompt}], max_tokens=100)
            nudge = MockHomomorphicEncryption.decode_llm_response(chat.choices[0].message.content)
        except: pass
    return {"llm_nudge": nudge}


@router.get("/asset-insights")
async def asset_insights(current_user: dict = Depends(get_current_user)):
    """AI nudge for Asset vault and ratio recommendations."""
    user_id = str(current_user["_id"])
    db = get_database()
    assets = await db.assets.find({"user_id": user_id}).to_list(10)
    total_val = 0.0
    for a in assets:
        decrypted = decrypt_user_data(a)
        a.clear()
        a.update(decrypted)
        total_val += float(a.get("current_valuation", 0.0))
    enc_val = MockHomomorphicEncryption.encrypt_val(total_val)
    
    nudge = "A balanced portfolio ideally spans real estate, liquid stocks, and gold to mitigate localized market crashes."
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            prompt = (
                f"You are a wealth advisor AI. User tracks {len(assets)} physical/digital assets. HE_CT (encrypted value): {enc_val}. "
                f"Write exactly 2 short sentences talking about the ideal diversification ratio for asset classes, and recommend one strong modern asset sector to look into."
            )
            chat = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "system", "content": prompt}], max_tokens=100)
            nudge = MockHomomorphicEncryption.decode_llm_response(chat.choices[0].message.content)
        except: pass
    return {"llm_nudge": nudge}


@router.get("/loan-insights")
async def loan_insights(current_user: dict = Depends(get_current_user)):
    """AI nudge for Loan optimization."""
    user_id = str(current_user["_id"])
    db = get_database()
    loans = await db.loans.find({"user_id": user_id}).to_list(10)
    total_loan = 0.0
    for l in loans:
        decrypted = decrypt_user_data(l)
        l.clear()
        l.update(decrypted)
        total_loan += float(l.get("amount", 0.0))
    enc_loan = MockHomomorphicEncryption.encrypt_val(total_loan)
    
    nudge = "Focus on clearing high-interest debt first before expanding your investment portfolio."
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            prompt = (
                f"You are a credit management AI. The user has {len(loans)} active/pending loan applications. HE_CT encrypted total liability: {enc_loan}. "
                f"Write exactly 1 short sentence giving a hyper-relevant insight on intelligently managing or restructuring loan debt."
            )
            chat = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "system", "content": prompt}], max_tokens=60)
            nudge = MockHomomorphicEncryption.decode_llm_response(chat.choices[0].message.content)
        except: pass
    return {"llm_nudge": nudge}

@router.post("/whatif-scenario")
async def whatif_scenario(data: ScenarioRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"LLM Scenario Simulation: {data.scenario_type} user={user_id}")
    
    prompt = ""
    if data.scenario_type == "custom":
        prompt = f"User is running a custom WealthVault simulation. Their query: '{data.custom_query}'. Provide a personalized, intelligent financial projection or insight in EXACTLY 2 sentences considering Indian context."
    elif data.scenario_type == "aa_sweep":
        prompt = "User has an idle bank balance of 350,000 INR based on Account Aggregator data. Suggest in exactly 2 detailed sentences the financial rationale and compounding potential of sweeping 50% into a Liquid Mutual fund."
    elif data.scenario_type == "loan_arbitrage":
        prompt = "User has a 14% p.a. personal loan, and a Gold Asset Vault. Explain in exactly 2 concise sentences the debt arbitrage benefit of liquidating 10% of gold assets to prepay the high-interest personal loan principal early."
    elif data.scenario_type == "market_stress":
        prompt = "You are a Homomorphically Encrypted Market Simulator. Simulate a 20% drop in NIFTY 50. Explain in exactly 2 concise sentences how physical assets like Real Estate and Gold act as a hedge and stabilize the portfolio against liquid equity drawdowns."
    else:
        prompt = "Provide a brief financial insight on wealth management."
        
    nudge = "Simulation completed. Potential optimization identified."
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": prompt}],
                temperature=0.7,
                max_tokens=150,
            )
            nudge = MockHomomorphicEncryption.decode_llm_response(chat.choices[0].message.content)
        except Exception as e:
            log.warning(f"WhatIf Scenario LLM failed: {e}")
            
    return {"llm_response": nudge}


@router.post("/chatbot")
async def chatbot(data: ChatbotRequest, current_user: dict = Depends(get_current_user)):
    """AI Financial Advisor powered by Groq LLM with real user data context."""
    user_id = str(current_user["_id"])
    log.info(f"Chatbot query: user={user_id}, message_length={len(data.message)}")
    db = get_database()

    # 1. Fetch user's financial data
    # Accounts
    accounts = await db.accounts.find({"user_id": user_id}).to_list(10)
    total_balance = 0.0
    for acc in accounts:
        decrypted = decrypt_user_data(acc)
        acc.clear()
        acc.update(decrypted)
        total_balance += float(acc.get("balance", 0.0))
    
    # Investments
    investments = await db.investments.find({"user_id": user_id}).to_list(50)
    total_invested = 0.0
    for inv in investments:
        decrypted = decrypt_user_data(inv)
        inv.clear()
        inv.update(decrypted)
        total_invested += float(inv.get("amount", 0.0))
    
    # Transactions (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    transactions = await db.transactions.find({
        "user_id": user_id,
        "created_at": {"$gte": thirty_days_ago}
    }).to_list(100)
    
    for txn in transactions:
        decrypted = decrypt_user_data(txn)
        txn.clear()
        txn.update(decrypted)
    
    # 2. Build spending analysis
    spending_by_category = {}
    total_spent = 0
    total_earned = 0
    
    for txn in transactions:
        category = txn.get("category", "other")
        amount = txn.get("amount", 0)
        txn_type = txn.get("transaction_type", "")
        
        if txn_type == "debit":
            spending_by_category[category] = spending_by_category.get(category, 0) + amount
            total_spent += amount
        elif txn_type == "credit":
            total_earned += amount
    
    # Get top 3 spending categories
    top_categories = sorted(spending_by_category.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # Recent transactions (last 5)
    recent_txns = sorted(transactions, key=lambda x: x.get("created_at", datetime.min), reverse=True)[:5]
    recent_txns_summary = [
        f"₹{t.get('amount', 0):,.0f} on {t.get('category', 'other')} ({t.get('transaction_type', 'unknown')})"
        for t in recent_txns
    ]
    
    log.debug(f"Chatbot context built: user={user_id}, balance=₹{total_balance:.0f}, invested=₹{total_invested:.0f}, spent=₹{total_spent:.0f}")

    # --- M3 Stress Detection Integration ---
    stress_results = ml_client.detect_stress(data.message)
    _chat_stress_cache[user_id] = {
        "val": stress_results["chat_stress_language"],
        "expiry": datetime.now() + timedelta(minutes=15),
    }
    log.info(f"Chat stress analysis for user={user_id}: {stress_results}")
    
    stress_context = "URGENT/STRESSED" if stress_results["chat_stress_language"] == 1 else "NORMAL"

    # 3. Build comprehensive context for LLM
    context_parts = [
        f"User: {current_user['full_name']}",
        f"Total Balance: ₹{total_balance:,.0f} across {len(accounts)} accounts",
        f"Investments: ₹{total_invested:,.0f} in {len(investments)} positions",
        f"Last 30 days: Spent ₹{total_spent:,.0f}, Earned ₹{total_earned:,.0f}",
    ]
    
    if top_categories:
        top_cat_str = ", ".join([f"{cat}: ₹{amt:,.0f}" for cat, amt in top_categories])
        context_parts.append(f"Top spending: {top_cat_str}")
    
    if recent_txns_summary:
        context_parts.append(f"Recent: {'; '.join(recent_txns_summary[:3])}")
    
    context_parts.append(f"Chat Tone: {stress_context}")
    
    context = ". ".join(context_parts) + "."

    # 4. Try Groq API with enhanced context
    if settings.GROQ_API_KEY:
        log.info(f"Calling Groq LLM API with real user data: user={user_id}")
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            system_prompt = (
                f"You are a certified Indian financial advisor at WealthVault Bank. "
                f"Be helpful, concise, and data-driven. Use the user's actual financial data to provide personalized advice. "
                f"User context: {context}. "
                f"IMPORTANT: Respond ONLY in the following language: {current_user.get('language', 'en')}. "
                f"Answer in 2-4 sentences max. Use specific numbers from their data when relevant."
            )
            
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": data.message},
                ],
                temperature=0.7,
                max_tokens=300,
            )
            response = chat.choices[0].message.content
            log.info(f"Groq API response received: user={user_id}, tokens_used=~{len(response.split())}")
            return {
                "response": response, 
                "source": "groq_llm",
                "chat_stress_language": stress_results["chat_stress_language"],
                "risk_pts": stress_results["risk_pts"]
            }
        except Exception as e:
            log.error(f"Groq API error: user={user_id}, error={e}", exc_info=True)
            log.warning("Falling back to mock response")

    # 5. Enhanced fallback mock responses with real data
    log.info(f"Using enhanced mock chatbot response: user={user_id} (no GROQ_API_KEY)")
    
    msg_lower = data.message.lower()
    
    # Build data-driven responses
    if "spend" in msg_lower or "spending" in msg_lower:
        if top_categories:
            top_cat, top_amt = top_categories[0]
            response = f"You spent ₹{total_spent:,.0f} in the last 30 days. Your highest spending was on {top_cat} (₹{top_amt:,.0f}). Consider setting a budget to optimize this category."
        else:
            response = f"You spent ₹{total_spent:,.0f} in the last 30 days. Great job tracking your expenses!"
    
    elif "invest" in msg_lower or "investment" in msg_lower:
        response = f"You currently have ₹{total_invested:,.0f} invested across {len(investments)} positions. Based on your balance of ₹{total_balance:,.0f}, I recommend diversifying into a mix of large-cap stocks and debt mutual funds."
    
    elif "save" in msg_lower or "saving" in msg_lower:
        net_flow = total_earned - total_spent
        if net_flow > 0:
            response = f"Great! You saved ₹{net_flow:,.0f} this month (earned ₹{total_earned:,.0f}, spent ₹{total_spent:,.0f}). Consider the 50-30-20 rule for optimal allocation."
        else:
            response = f"You spent ₹{abs(net_flow):,.0f} more than you earned this month. Let's work on a budget to improve your savings rate."
    
    elif "balance" in msg_lower or "account" in msg_lower:
        response = f"You have ₹{total_balance:,.0f} across {len(accounts)} accounts. Your funds are well-distributed for liquidity and growth."
    
    elif "budget" in msg_lower:
        if top_categories:
            top_cat, top_amt = top_categories[0]
            pct = (top_amt / total_spent * 100) if total_spent > 0 else 0
            response = f"Your {top_cat} spending is ₹{top_amt:,.0f} ({pct:.0f}% of total). I recommend capping it at ₹{top_amt * 0.85:,.0f} to save ₹{top_amt * 0.15:,.0f} monthly."
        else:
            response = "Let's set up a budget! The 50-30-20 rule is a great starting point: 50% needs, 30% wants, 20% savings."
    
    else:
        # Default response with user data
        response = f"I'm your WealthVault AI advisor! You have ₹{total_balance:,.0f} in accounts and ₹{total_invested:,.0f} invested. You spent ₹{total_spent:,.0f} last month. How can I help with budgeting, investing, or planning?"

    log.debug(f"Enhanced mock response generated for user={user_id}")
    return {
        "response": response, 
        "source": "mock",
        "chat_stress_language": stress_results["chat_stress_language"],
        "risk_pts": stress_results["risk_pts"]
    }


@router.post("/classify-transaction")
async def classify_transaction(data: ClassifyRequest):
    """Categorize a transaction description — M2 BERT multilingual via gRPC."""
    log.info(f"Classifying transaction text: '{data.text}'")
    return ml_client.classify_transaction(data.text)


@router.post("/voice-agent")
async def voice_agent(data: ChatbotRequest, current_user: dict = Depends(get_current_user)):
    """Dedicated voice agent endpoint for real-time web calls. 
    Returns short, natural responses suitable for text-to-speech."""
    user_id = str(current_user["_id"])
    log.info(f"Voice agent call: user={user_id}, query='{data.message}'")
    db = get_database()

    # Minimal context for voice to keep latency low
    accounts = await db.accounts.find({"user_id": user_id}).to_list(5)
    total_balance = sum(float(decrypt_user_data(a).get("balance", 0) or 0) for a in accounts)

    # Specific system prompt for VOICE interaction
    voice_system_prompt = (
        "You are Vaulty, a professional and friendly voice support agent for WealthVault Bank. "
        "You are speaking on a phone call. "
        f"IMPORTANT: Respond ONLY in the following language: {current_user.get('language', 'en')}. "
        "Rules: "
        "1. Keep responses extremely short (1-2 sentences). "
        "2. Be conversational and natural. Avoid bullet points or complex lists. "
        "3. If the user is reporting fraud or a lost card, tell them you've flagged it and ask them to confirm if they want to freeze their account. "
        f"User name: {current_user['full_name']}. Balance: INR {total_balance:,.0f}."
    )

    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": voice_system_prompt},
                    {"role": "user", "content": data.message},
                ],
                temperature=0.6,
                max_tokens=150,
            )
            return {"response": chat.choices[0].message.content}
        except Exception as e:
            log.error(f"Voice Agent Groq Error: {e}")
            
    return {"response": "I'm sorry, I'm having trouble connecting to my brain right now. Can you repeat that?"}

