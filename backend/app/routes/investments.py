"""Investment, portfolio, and financial goals routes."""
import random
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.core.database import get_database
from app.core.security import get_current_user
from app.core.kafka_service import kafka_service
from app.helper.utils import encrypt_user_data, decrypt_user_data, encrypt_update_fields
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
from app.models.investment import InvestmentCreate, InvestmentResponse, FinancialGoalCreate, SIPCreate, SIPResponse, SIPUpdate
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
    investments = await cursor.to_list(100)

    total_invested = sum(inv["amount"] for inv in investments)
    current_value = 0
    inv_list = []

    for inv in investments:
        decrypyed_inv = decrypt_user_data(inv)  # Decrypt fields if needed
        inv.clear()  # Clear original dict
        inv.update(decrypyed_inv)  # Update original dict with decrypted values
        cp = inv["buy_price"] * (1 + random.uniform(-0.1, 0.2))
        cv = inv["quantity"] * cp
        pl = cv - inv["amount"]
        plp = (pl / inv["amount"] * 100) if inv["amount"] > 0 else 0
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


@router.get("/stocks")
async def get_stocks():
    """Get simulated stock market data."""
    log.info("Stock data requested")
    data = []
    for stock in STOCK_DATA:
        variation = random.uniform(-3, 3)
        price = stock["price"] * (1 + variation / 100)
        data.append({
            **stock,
            "price": round(price, 2),
            "change_pct": round(stock["change_pct"] + variation, 2),
            "volume": int(stock["volume"] * random.uniform(0.8, 1.2)),
        })
    log.debug(f"Returning {len(data)} stock market entries")
    return data


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
        del g["_id"]

    log.info(f"Returned {len(goals)} goals for user={user_id}")
    return goals


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
