"""
AI Agents routes for Wealth Advisor and Wealth Teacher.
Provides encrypted endpoints for financial advice and daily lessons.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from app.core.security import get_current_user
from app.core.database import get_database
from app.helper.encryption_utils import decrypt_data, encrypt_data
from app.helper.wealth_advisor_agent import WealthAdvisorAgent
from app.helper.wealth_teacher_agent import WealthTeacherAgent

router = APIRouter(
    prefix="/agents",
    tags=["agents"]
)

# Initialize the agents once
advisor_agent = WealthAdvisorAgent()
teacher_agent = WealthTeacherAgent()

class EncryptedPayloadRequest(BaseModel):
    encrypted_token: str

class EncryptedPayloadResponse(BaseModel):
    encrypted_token: str

async def get_user_profile(user_id: str, db):
    """Fetch real user profile data from database"""
    try:
        from bson import ObjectId
        from app.helper.utils import decrypt_user_data
        
        # Get user details
        user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            return None
        user = decrypt_user_data(user_doc)
        
        # Get user's accounts and transactions for financial profile
        accounts = await db["accounts"].find({"user_id": user_id}).to_list(100)
        transactions = await db["transactions"].find({"user_id": user_id}).sort("created_at", -1).limit(100).to_list(100)
        investments = await db["investments"].find({"user_id": user_id}).to_list(100)
        
        # Calculate profile metrics
        total_balance = 0.0
        for acc in accounts:
            decrypted = decrypt_user_data(acc)
            acc.clear()
            acc.update(decrypted)
            total_balance += float(acc.get("balance", 0.0))
            
        monthly_income = user.get("monthly_income", 75000)
        credit_score = user.get("credit_score", 750)
        
        # Calculate monthly expenses from recent transactions
        monthly_expenses = 0.0
        investment_types = set()
        
        for t in transactions:
            decrypted = decrypt_user_data(t)
            t.clear()
            t.update(decrypted)
            amt = float(t.get("amount", 0.0))
            cat = t.get("category", "")
            txn_type = t.get("transaction_type", "")
            
            if txn_type == "debit" and cat != "investment":
                monthly_expenses += amt
        
        for inv in investments:
            decrypted = decrypt_user_data(inv)
            inv.clear()
            inv.update(decrypted)
            investment_types.add(inv.get("investment_type", "unknown"))
        
        return {
            "user_id": str(user_id),
            "balance": total_balance,
            "monthly_income": monthly_income,
            "monthly_expenses": monthly_expenses,
            "savings_rate": (monthly_income - monthly_expenses) / monthly_income if monthly_income > 0 else 0,
            "investment_portfolio": list(investment_types),
            "credit_score": credit_score,
            "loan_balance": user.get("loan_balance", 0),
            "age": user.get("age", 30),
            "job_type": user.get("job_type", "salaried"),
            "account_count": len(accounts),
            "transaction_count": len(transactions),
            "investment_count": len(investments)
        }
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None

async def get_user_activity(user_id: str, db):
    """Fetch real user activity from database"""
    try:
        from app.helper.utils import decrypt_user_data
        
        transactions = await db["transactions"].find({"user_id": user_id}).sort("created_at", -1).limit(100).to_list(100)
        
        # Decrypt and analyze
        total_transactions = len(transactions)
        online_shopping = 0
        bill_payments = 0
        investments = 0
        high_value_txns = 0
        total_amount = 0.0
        
        for t in transactions:
            decrypted = decrypt_user_data(t)
            t.clear()
            t.update(decrypted)
            amt = float(t.get("amount", 0.0))
            cat = t.get("category", "")
            
            total_amount += amt
            if cat == "shopping": online_shopping += 1
            if cat == "bills": bill_payments += 1
            if cat == "investment": investments += 1
            if amt > 10000: high_value_txns += 1
            
        avg_transaction = total_amount / total_transactions if total_transactions > 0 else 0
        
        return {
            "transactions_last_month": total_transactions,
            "avg_transaction_value": int(avg_transaction),
            "high_value_transactions": high_value_txns,
            "online_shopping": online_shopping,
            "bill_payments": bill_payments,
            "investments": investments,
            "loan_inquiries": 0,
            "fraud_risk": "low"
        }
    except Exception as e:
        print(f"Error fetching user activity: {e}")
        return None

@router.post("/advisor")
async def wealth_advisor_endpoint(
    request: Request,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Agent 1: Wealth Advisor.
    Accepts plaintext JSON and returns plaintext JSON.
    """
    try:
        try:
            payload = await request.json()
        except Exception:
            payload = {}
            
        # Fetch real user profile
        user_id = current_user.get("id")
        
        user_profile = await get_user_profile(user_id, db)
        if not user_profile:
            raise ValueError("Could not fetch user profile")
        
        # Use user query from payload if provided
        user_query = payload.get("user_query")
        language = payload.get("language", "en")

        # Agent processes request with real user data
        result = advisor_agent.generate_advice(
            user_profile=user_profile,
            market_context=None,
            user_query=user_query,
            language=language
        )

        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/teacher")
async def wealth_teacher_endpoint(
    request: Request,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Agent 2: Wealth Teacher.
    Accepts plaintext JSON and returns plaintext JSON.
    """
    try:
        try:
            payload = await request.json()
        except Exception:
            payload = {}
            
        # Fetch real user activity
        user_id = current_user.get("id")
        language = payload.get("language", "en")
        
        user_activity = await get_user_activity(user_id, db)
        if not user_activity:
            raise ValueError("Could not fetch user activity")

        # Agent processes request with real user data
        result = teacher_agent.generate_daily_lessons(
            user_activity=user_activity,
            language=language
        )

        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
