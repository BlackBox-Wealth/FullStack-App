"""Investment, portfolio, and financial goals routes."""
import asyncio
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.core.database import get_database
from app.core.config import settings
from app.core.security import get_current_user
from app.core.kafka_service import kafka_service
from app.helper.utils import encrypt_user_data, decrypt_user_data, encrypt_update_fields
from app.services.credit_score_service import update_user_credit_score
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
from app.models.investment import InvestmentCreate, InvestmentResponse, FinancialGoalCreate, SIPCreate, SIPResponse, SIPUpdate
import json
import re
import xml.etree.ElementTree as ET
import httpx
router = APIRouter(prefix="/investments", tags=["Investments"])

# Simulated stock data
STOCK_DATA = [
    {"symbol": "RELIANCE", "name": "Reliance Industries", "price": 2456.75, "change_pct": 1.23, "volume": 15690000},
    {"symbol": "TCS", "name": "Tata Consultancy Services", "price": 3567.40, "change_pct": -0.45, "volume": 5430000},
    {"symbol": "INFY", "name": "Infosys Limited", "price": 1489.30, "change_pct": 2.10, "volume": 12340000},
    {"symbol": "HDFCBANK", "name": "HDFC Bank", "price": 1678.90, "change_pct": 0.78, "volume": 8900000},
    {"symbol": "ICICIBANK", "name": "ICICI Bank", "price": 987.55, "change_pct": -1.34, "volume": 7650000},
    {"symbol": "WIPRO", "name": "Wipro Limited", "price": 412.60, "change_pct": 0.56, "volume": 6780000},
    {"symbol": "SBIN", "name": "State Bank of India", "price": 623.45, "change_pct": 1.89, "volume": 18900000},
    {"symbol": "BHARTI", "name": "Bharti Airtel", "price": 1234.80, "change_pct": -0.67, "volume": 4560000},
    {"symbol": "HCLTECH", "name": "HCL Technologies", "price": 1345.20, "change_pct": 3.21, "volume": 3890000},
    {"symbol": "TATAMOTORS", "name": "Tata Motors", "price": 678.90, "change_pct": -2.45, "volume": 21000000},
]


@router.post("/", response_model=InvestmentResponse, status_code=201)
async def create_investment(data: InvestmentCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Investment creation: user={user_id}, type={data.investment_type}, symbol={data.symbol}, amount=₹{data.amount}, qty={data.quantity}")
    db = get_database()

    inv_doc = {
        "user_id": user_id,
        "investment_type": data.investment_type.value,
        "symbol": data.symbol,
        "amount": data.amount,
        "quantity": data.quantity,
        "buy_price": round(data.amount / data.quantity, 2) if data.quantity > 0 else data.amount,
        "created_at": datetime.utcnow(),
    }

    encrypted_inv_doc = encrypt_user_data(inv_doc)  # Encrypt sensitive fields if needed

    result = await db.investments.insert_one(encrypted_inv_doc)
    inv_doc["_id"] = result.inserted_id
    log.info(f"Investment created: id={result.inserted_id}, symbol={data.symbol}, buy_price=₹{inv_doc['buy_price']}")

    await kafka_service.publish("user.activity", {
        "action": "investment_created",
        "user_id": user_id,
        "symbol": data.symbol,
        "amount": data.amount,
    })
    
    # Mark user as no longer a first-time investor
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_first_time_investor": False}}
    )

    asyncio.create_task(update_user_credit_score(db, user_id))

    return InvestmentResponse(
        id=str(inv_doc["_id"]),
        user_id=user_id,
        investment_type=inv_doc["investment_type"],
        symbol=inv_doc["symbol"],
        amount=inv_doc["amount"],
        quantity=inv_doc["quantity"],
        buy_price=inv_doc["buy_price"],
        current_price=inv_doc["buy_price"] * (1 + random.uniform(-0.1, 0.15)),
        profit_loss=0,
        profit_loss_pct=0,
        created_at=str(inv_doc["created_at"]),
    )


@router.get("/", response_model=list[InvestmentResponse])
async def get_investments(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Fetching investments: user={user_id}")
    db = get_database()
    cursor = db.investments.find({"user_id": user_id})
    investments = await cursor.to_list(100)
    log.info(f"Found {len(investments)} investments for user={user_id}")

    results = []
    for inv in investments:
        decrypyed_inv = decrypt_user_data(inv)  # Decrypt fields if needed
        inv.clear()  # Clear original dict
        inv.update(decrypyed_inv)  # Update original dict with decrypted values
        # Simulate current price movement
        current_price = inv["buy_price"] * (1 + random.uniform(-0.15, 0.25))
        current_value = inv["quantity"] * current_price
        profit_loss = current_value - inv["amount"]
        profit_loss_pct = (profit_loss / inv["amount"] * 100) if inv["amount"] > 0 else 0

        results.append(InvestmentResponse(
            id=str(inv["_id"]),
            user_id=inv["user_id"],
            investment_type=inv["investment_type"],
            symbol=inv["symbol"],
            amount=inv["amount"],
            quantity=inv["quantity"],
            buy_price=inv["buy_price"],
            current_price=round(current_price, 2),
            current_value=round(current_value, 2),
            profit_loss=round(profit_loss, 2),
            profit_loss_pct=round(profit_loss_pct, 2),
            created_at=str(inv["created_at"]),
        ))

    return results


@router.get("/portfolio")
async def get_portfolio(current_user: dict = Depends(get_current_user)):
    """Get user's portfolio summary."""
    user_id = str(current_user["_id"])
    log.info(f"Portfolio summary: user={user_id}")
    db = get_database()
    cursor = db.investments.find({"user_id": user_id})
    investments_raw = await cursor.to_list(100)

    total_invested = 0.0
    current_value = 0.0
    inv_list = []

    for inv_raw in investments_raw:
        inv = decrypt_user_data(inv_raw)
        
        # Calculate market performance (mocked)
        cp = inv["buy_price"] * (1 + random.uniform(-0.1, 0.2))
        cv = inv["quantity"] * cp
        pl = cv - inv["amount"]
        plp = (pl / inv["amount"] * 100) if inv["amount"] > 0 else 0
        
        total_invested += inv["amount"]
        current_value += cv

        inv_list.append({
            "id": str(inv["_id"]),
            "investment_type": inv["investment_type"],
            "symbol": inv["symbol"],
            "quantity": inv["quantity"],
            "buy_price": inv["buy_price"],
            "current_price": round(cp, 2),
            "current_value": round(cv, 2),
            "profit_loss": round(pl, 2),
            "profit_loss_pct": round(plp, 2),
        })

    total_profit_loss = current_value - total_invested
    total_pct = (total_profit_loss / total_invested * 100) if total_invested > 0 else 0
    risk_profile = "aggressive" if total_invested > 500000 else "moderate" if total_invested > 100000 else "conservative"

    log.info(
        f"Portfolio computed: user={user_id}, invested=₹{total_invested:.0f}, "
        f"value=₹{current_value:.0f}, P&L=₹{total_profit_loss:.0f} ({total_pct:.1f}%), "
        f"risk={risk_profile}"
    )

    return {
        "total_invested": round(total_invested, 2),
        "current_value": round(current_value, 2),
        "total_profit_loss": round(total_profit_loss, 2),
        "total_profit_loss_pct": round(total_pct, 2),
        "risk_profile": risk_profile,
        "investments": inv_list,
    }


REALTIME_SYMBOLS = {
    "RELIANCE.NS": "Reliance Industries",
    "TCS.NS": "Tata Consultancy Services",
    "INFY.NS": "Infosys Limited",
    "HDFCBANK.NS": "HDFC Bank",
    "ICICIBANK.NS": "ICICI Bank",
    "WIPRO.NS": "Wipro Limited",
    "SBIN.NS": "State Bank of India",
    "BHARTIARTL.NS": "Bharti Airtel",
    "HCLTECH.NS": "HCL Technologies",
    "TATAMOTORS.NS": "Tata Motors"
}

_YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

async def _fetch_yahoo_quotes() -> list:
    """Fetch live NSE quotes via Yahoo Finance using the crumb handshake."""
    symbols_str = ",".join(REALTIME_SYMBOLS.keys())
    async with httpx.AsyncClient(headers=_YF_HEADERS, follow_redirects=True, timeout=12) as client:
        # 1. Establish session cookie
        await client.get("https://finance.yahoo.com")
        # 2. Get crumb tied to that cookie
        crumb_resp = await client.get("https://query2.finance.yahoo.com/v1/test/getcrumb")
        crumb = crumb_resp.text.strip()
        if not crumb or len(crumb) < 3:
            raise ValueError(f"Bad crumb: {crumb!r}")
        # 3. Fetch quotes
        url = (
            f"https://query1.finance.yahoo.com/v7/finance/quote"
            f"?symbols={symbols_str}&crumb={crumb}"
        )
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json().get("quoteResponse", {}).get("result", [])


@router.get("/stocks")
async def get_stocks():
    """Get real-time Indian stock market data (Yahoo Finance) with mock fallback."""
    log.info("Real-time stock data requested")
    data = []

    try:
        quotes = await _fetch_yahoo_quotes()
        for q in quotes:
            price = q.get("regularMarketPrice", 0)
            if price <= 0:
                continue
            sym_ns = q.get("symbol", "")
            data.append({
                "symbol": sym_ns.replace(".NS", ""),
                "name": REALTIME_SYMBOLS.get(sym_ns, sym_ns),
                "price": round(price, 2),
                "change_pct": round(q.get("regularMarketChangePercent", 0), 2),
                "volume": int(q.get("regularMarketVolume", 0)),
            })
        log.info(f"Fetched {len(data)} real-time stocks from Yahoo Finance")
    except Exception as e:
        log.warning(f"Yahoo Finance failed: {e}. Falling back to mock data.")

    if not data:
        for stock in STOCK_DATA:
            v = random.uniform(-3, 3)
            data.append({
                **stock,
                "price": round(stock["price"] * (1 + v / 100), 2),
                "change_pct": round(stock["change_pct"] + v, 2),
                "volume": int(stock["volume"] * random.uniform(0.8, 1.2)),
            })

    return data


@router.get("/news")
async def get_market_news():
    """Scrape Indian market news directly from Economic Times RSS feed."""
    log.info("Market news requested")
    rss_url = "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(rss_url, headers={"User-Agent": _YF_HEADERS["User-Agent"]})
            resp.raise_for_status()
        root = ET.fromstring(resp.text)
        items = []
        for item in root.findall(".//item")[:15]:
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            raw_desc = (item.findtext("description") or "").strip()
            description = re.sub(r"<[^>]+>", "", raw_desc)[:250].strip()
            items.append({
                "title": title,
                "link": (item.findtext("link") or "").strip(),
                "pubDate": (item.findtext("pubDate") or "").strip(),
                "description": description,
            })
        log.info(f"Fetched {len(items)} news items from ET RSS")
        return items
    except Exception as e:
        log.warning(f"News fetch failed: {e}")
        return []


@router.get("/goals/smart-insights")
async def goals_smart_insights(current_user: dict = Depends(get_current_user)):
    """Compute monthly savings potential from spending habits and project each goal's timeline."""
    from app.services.budget_service import budget_service
    from app.helper.utils import decrypt_user_data

    user_id = str(current_user["_id"])
    db = get_database()
    today = datetime.now()

    # ── 1. Budget remaining per category ──────────────────────────────────────
    raw_budgets = await db.budgets.find({"user_id": user_id}).to_list(100)
    budget_stats = []
    total_saveable = 0.0

    for b in raw_budgets:
        spent = await budget_service.get_spent_amount(user_id, b["category"])
        limit = b.get("amount_limit", 0)
        remaining = limit - spent
        status = "exceeded" if spent > limit else "warning" if spent > limit * 0.8 else "healthy"
        saveable = max(remaining, 0)
        total_saveable += saveable
        budget_stats.append({
            "category": b["category"],
            "limit": round(limit, 2),
            "spent": round(spent, 2),
            "remaining": round(remaining, 2),
            "status": status,
            "saveable": round(saveable, 2),
        })

    n = len(budget_stats)
    avg_monthly_savings = round(total_saveable / n, 2) if n > 0 else 0.0

    # ── 2. Project each goal ──────────────────────────────────────────────────
    goals_raw = await db.financial_goals.find({"user_id": user_id}).to_list(50)
    goal_insights = []

    for g_raw in goals_raw:
        g = decrypt_user_data(g_raw)
        target = g.get("target_amount", 0)
        current = g.get("current_amount", 0)
        gap = max(target - current, 0)
        progress_pct = round((current / target * 100) if target > 0 else 0, 1)

        try:
            deadline = datetime.strptime(g["deadline"], "%Y-%m-%d")
        except Exception:
            deadline = today + timedelta(days=365)

        months_to_deadline = max((deadline - today).days / 30.44, 0.1)

        if avg_monthly_savings > 0:
            months_to_goal = gap / avg_monthly_savings
            projected_date = today + timedelta(days=months_to_goal * 30.44)
            projected_completion = projected_date.strftime("%Y-%m-%d")
            projected_savings_by_deadline = round(min(avg_monthly_savings * months_to_deadline, gap), 2)
        else:
            months_to_goal = None
            projected_completion = None
            projected_savings_by_deadline = 0.0

        is_on_track = months_to_goal is not None and months_to_goal <= months_to_deadline
        months_delay = round(months_to_goal - months_to_deadline, 1) if months_to_goal and not is_on_track else 0
        required_monthly = round(gap / months_to_deadline, 2) if months_to_deadline > 0 else None

        goal_insights.append({
            "goal_id": str(g_raw["_id"]),
            "goal_name": g.get("name", ""),
            "target_amount": target,
            "current_amount": current,
            "progress_pct": progress_pct,
            "deadline": g.get("deadline", ""),
            "months_to_deadline": round(months_to_deadline, 1),
            "months_to_goal": round(months_to_goal, 1) if months_to_goal is not None else None,
            "projected_completion": projected_completion,
            "is_on_track": is_on_track,
            "months_delay": months_delay,
            "projected_savings_by_deadline": projected_savings_by_deadline,
            "required_monthly": required_monthly,
        })

    # ── 3. Groq insight ───────────────────────────────────────────────────────
    groq_insight = None
    if settings.GROQ_API_KEY and (goal_insights or budget_stats):
        try:
            from groq import Groq
            budget_lines = "\n".join(
                f"  {b['category']}: limit=₹{b['limit']}, spent=₹{b['spent']}, remaining=₹{b['remaining']} [{b['status']}]"
                for b in budget_stats
            )
            goal_lines = "\n".join(
                f"  '{g['goal_name']}': ₹{g['current_amount']}/₹{g['target_amount']}, deadline={g['deadline']}, on_track={g['is_on_track']}"
                for g in goal_insights
            )
            prompt = (
                f"You are a concise financial advisor for WealthVault, an Indian banking app.\n"
                f"Customer: {current_user.get('full_name', 'Customer')}\n"
                f"Average monthly savings potential from spending habits: ₹{avg_monthly_savings:,.0f}\n"
                f"Spending budgets:\n{budget_lines}\n"
                f"Financial goals:\n{goal_lines}\n\n"
                f"Give exactly 2-3 SHORT, specific, actionable insights in plain English. "
                f"Mention: how much they can save/month, which goal is most at risk (if any), one concrete tip. "
                f"No bullet formatting fluff. Under 80 words total."
            )
            client = Groq(api_key=settings.GROQ_API_KEY)
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=160,
            )
            groq_insight = resp.choices[0].message.content.strip()
        except Exception as e:
            log.error(f"Groq goal insights failed: {e}")

    log.info(f"Smart insights computed: user={user_id}, avg_savings=₹{avg_monthly_savings}, goals={len(goal_insights)}")
    return {
        "avg_monthly_savings": avg_monthly_savings,
        "total_saveable": round(total_saveable, 2),
        "budget_count": n,
        "budget_stats": budget_stats,
        "goal_insights": goal_insights,
        "groq_insight": groq_insight,
    }


@router.post("/goals", status_code=201)
async def create_goal(data: FinancialGoalCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Goal creation: user={user_id}, name='{data.name}', target=₹{data.target_amount}")
    db = get_database()

    goal_doc = {
        "user_id": user_id,
        "name": data.name,
        "target_amount": data.target_amount,
        "current_amount": data.current_amount,
        "deadline": data.deadline,
        "funding_channels": data.funding_channels,
        "status": "active",
        "progress_pct": round((data.current_amount / data.target_amount * 100) if data.target_amount > 0 else 0, 1),
        "created_at": datetime.utcnow(),
    }

    encrypted_goal_doc = encrypt_user_data(goal_doc)  # Encrypt sensitive fields if needed

    result = await db.financial_goals.insert_one(encrypted_goal_doc)
    goal_doc["id"] = str(result.inserted_id)
    goal_doc.pop("_id", None)
    log.info(f"Goal created: id={result.inserted_id}, progress={goal_doc['progress_pct']}%")
    return goal_doc


@router.get("/goals")
async def get_goals(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Fetching goals: user={user_id}")
    db = get_database()
    cursor = db.financial_goals.find({"user_id": user_id}).sort("created_at", -1)
    goals = await cursor.to_list(50)

    for g in goals:
        decrypted_goal = decrypt_user_data(g)  # Decrypt fields if needed
        g.clear()  # Clear original dict
        g.update(decrypted_goal)  # Update original dict with decrypted values
        g["id"] = str(g["_id"])
        g["progress_pct"] = round((g["current_amount"] / g["target_amount"] * 100) if g["target_amount"] > 0 else 0, 1)
        g["funding_channels"] = g.get("funding_channels", [])
        del g["_id"]

    log.info(f"Returned {len(goals)} goals for user={user_id}")
    return goals


@router.delete("/goals/{goal_id}", status_code=204)
async def delete_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Deleting goal: id={goal_id}, user={user_id}")
    db = get_database()
    
    result = await db.financial_goals.delete_one({"_id": ObjectId(goal_id), "user_id": user_id})
    if result.deleted_count == 0:
        log.warning(f"Goal delete failed: goal={goal_id} not found or not owned by user={user_id}")
        raise HTTPException(status_code=404, detail="Goal not found")
        
    log.info(f"Goal deleted successfully: goal={goal_id}")
    return None


@router.post("/sips", response_model=SIPResponse, status_code=201)
async def create_sip(data: SIPCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"SIP creation: user={user_id}, fund='{data.fund_name}', amount=₹{data.amount}")
    db = get_database()

    sip_doc = {
        "user_id": user_id,
        "account_id": data.account_id,
        "name": data.name,
        "fund_name": data.fund_name,
        "fund_category": data.fund_category.value,
        "amount": data.amount,
        "frequency": data.frequency.value,
        "status": "active",
        "start_date": data.start_date,
        "next_installment": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "total_invested": data.amount, # First installment simulated
        "current_value": data.amount,
        "profit_loss": 0.0,
        "profit_loss_pct": 0.0,
        "installments_count": 1,
        "step_up_pct": data.step_up_pct,
        "goal_id": data.goal_id,
        "risk_level": "moderate" if data.fund_category == "hybrid" else "aggressive" if data.fund_category == "equity" else "conservative",
        "created_at": datetime.utcnow(),
    }

    encrypted_sip_doc = encrypt_user_data(sip_doc)  # Encrypt sensitive fields if needed

    result = await db.sips.insert_one(encrypted_sip_doc)
    sip_doc["id"] = str(result.inserted_id)
    sip_doc["created_at"] = str(sip_doc["created_at"])
    sip_doc.pop("_id", None)
    return sip_doc


@router.get("/sips", response_model=list[SIPResponse])
async def get_sips(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Fetching SIPs: user={user_id}")
    db = get_database()
    cursor = db.sips.find({"user_id": user_id}).sort("created_at", -1)
    sips = await cursor.to_list(50)

    for s in sips:
        decrypted_sip = decrypt_user_data(s)
        s.clear()
        s.update(decrypted_sip)
        s["id"] = str(s["_id"])
        # Support legacy records
        if "fund_name" not in s: s["fund_name"] = s.get("name", "Legacy Plan")
        if "fund_category" not in s: s["fund_category"] = "equity"
        if "step_up_pct" not in s: s["step_up_pct"] = 0
        if "risk_level" not in s: s["risk_level"] = "moderate"
        if "current_value" not in s: s["current_value"] = s.get("total_invested", 0)

        # Simulate small growth
        if s["status"] == "active":
            growth_factor = 1 + random.uniform(-0.02, 0.08)
            s["current_value"] = round(s["current_value"] * growth_factor, 2)
            s["total_invested"] = s.get("total_invested", 5000) # Baseline for legacy
            s["profit_loss"] = round(s["current_value"] - s["total_invested"], 2)
            s["profit_loss_pct"] = round((s["profit_loss"] / s["total_invested"] * 100) if s["total_invested"] > 0 else 0, 2)
        
        s["created_at"] = str(s.get("created_at", ""))
        del s["_id"]

    log.info(f"Returned {len(sips)} SIPs for user={user_id}")
    return sips


@router.patch("/sips/{sip_id}", response_model=SIPResponse)
async def update_sip(sip_id: str, data: SIPUpdate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"SIP update: id={sip_id}, user={user_id}")
    db = get_database()

    update_data = {k: v.value if hasattr(v, 'value') else v for k, v in data.dict(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    encrypted_update_data = encrypt_update_fields(update_data)

    result = await db.sips.find_one_and_update(
        {"_id": ObjectId(sip_id), "user_id": user_id},
        {"$set": encrypted_update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="SIP not found")

    result = decrypt_user_data(result)

    result["id"] = str(result["_id"])
    result["created_at"] = str(result.get("created_at", ""))
    del result["_id"]
    return result


@router.get("/first-time-tips")
async def get_first_time_tips(current_user: dict = Depends(get_current_user)):
    """Get personalized investment tips for first-time investors using Groq LLM."""
    user_id = str(current_user["_id"])
    log.info(f"First-time tips requested: user={user_id}")
    
    # Check if user is actually a first-time investor
    is_first_time = current_user.get("is_first_time_investor", True)
    if not is_first_time:
        log.info(f"User {user_id} is not a first-time investor, but requested tips. Providing anyway.")

    # Fetch some context (news) — reuse the same direct RSS parser
    news_context = ""
    try:
        news_items = await get_market_news()
        if news_items:
            titles = [n["title"] for n in news_items[:5]]
            news_context = " Recent market news: " + " | ".join(titles)
    except Exception as e:
        log.warning(f"Failed to fetch news for tips: {e}")

    prompt = (
        f"You are a friendly and expert financial advisor at WealthVault Bank. "
        f"A user named {current_user['full_name']} is looking to make their VERY FIRST investment. "
        f"{news_context} "
        f"Desired Output Language: {current_user.get('language', 'en')}. "
        f"Based on this, provide exactly 3 concise, encouraging tips for a beginner investor in India in the Desired Output Language. "
        f"Keep the tone professional yet welcoming. Format as a bulleted list."
    )

    tips = "1. Start small and be consistent.\n2. Diversify your portfolio.\n3. Think long-term."
    
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            chat = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": prompt}],
                temperature=0.7,
                max_tokens=300,
            )
            tips = chat.choices[0].message.content
        except Exception as e:
            log.error(f"Groq failed for first-time tips: {e}")

    return {"tips": tips}


@router.post("/mark-invested")
async def mark_invested(current_user: dict = Depends(get_current_user)):
    """Manually mark the user as no longer a first-time investor."""
    user_id = str(current_user["_id"])
    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_first_time_investor": False}}
    )
    log.info(f"User {user_id} marked as no longer first-time investor")
    return {"message": "Status updated successfully"}
