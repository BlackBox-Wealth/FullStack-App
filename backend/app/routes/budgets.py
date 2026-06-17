from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.budget import BudgetCreate, BudgetResponse
from app.helper.utils import encrypt_user_data, decrypt_user_data
from app.services.budget_service import budget_service
from logifyx import Logifyx

log = Logifyx(name="wealthvault", color=True)

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.post("/", response_model=BudgetResponse, status_code=201)
async def set_budget(data: BudgetCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Setting budget limit: user={user_id}, category={data.category}, limit=₹{data.amount_limit}")
    db = get_database()

    # If exists for same category, update it
    existing = await db.budgets.find_one({"user_id": user_id, "category": data.category})
    
    budget_doc = {
        "user_id": user_id,
        "category": data.category,
        "amount_limit": data.amount_limit,
        "period": data.period.value,
        "updated_at": datetime.utcnow()
    }

    if existing:
        await db.budgets.update_one({"_id": existing["_id"]}, {"$set": budget_doc})
        budget_id = str(existing["_id"])
    else:
        budget_doc["created_at"] = datetime.utcnow()
        result = await db.budgets.insert_one(budget_doc)
        budget_id = str(result.inserted_id)

    # Calculate current spent for response
    spent = await budget_service.get_spent_amount(user_id, data.category)
    
    return {
        "id": budget_id,
        "user_id": user_id,
        "category": data.category,
        "amount_limit": data.amount_limit,
        "current_spent": spent,
        "remaining": data.amount_limit - spent,
        "period": data.period.value,
        "status": "exceeded" if spent > data.amount_limit else "warning" if spent > data.amount_limit * 0.8 else "healthy"
    }


@router.get("/", response_model=list[BudgetResponse])
async def get_budgets(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_database()
    cursor = db.budgets.find({"user_id": user_id})
    budgets = await cursor.to_list(100)
    
    results = []
    for b in budgets:
        spent = await budget_service.get_spent_amount(user_id, b["category"])
        results.append({
            "id": str(b["_id"]),
            "user_id": user_id,
            "category": b["category"],
            "amount_limit": b["amount_limit"],
            "current_spent": spent,
            "remaining": b["amount_limit"] - spent,
            "period": b["period"],
            "status": "exceeded" if spent > b["amount_limit"] else "warning" if spent > b["amount_limit"] * 0.8 else "healthy"
        })
    return results


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(budget_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Deleting budget: id={budget_id}, user={user_id}")
    db = get_database()
    
    result = await db.budgets.delete_one({"_id": ObjectId(budget_id), "user_id": user_id})
    if result.deleted_count == 0:
        log.warning(f"Budget delete failed: budget={budget_id} not found or not owned by user={user_id}")
        raise HTTPException(status_code=404, detail="Budget not found")
        
    log.info(f"Budget deleted successfully: budget={budget_id}")
    return None
