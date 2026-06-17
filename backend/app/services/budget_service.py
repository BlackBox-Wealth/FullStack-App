from datetime import datetime
from app.core.database import get_database
from app.helper.utils import decrypt_user_data

class BudgetService:
    @staticmethod
    async def get_spent_amount(user_id: str, category: str):
        db = get_database()
        start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        query = {"user_id": user_id, "created_at": {"$gte": start_of_month}}
        if category and category.lower() != "general":
            query["category"] = category.lower()

        cursor = db.transactions.find(query)
        txns = await cursor.to_list(2000)
        
        total = 0
        for t in txns:
            dec = decrypt_user_data(t)
            if dec.get("transaction_type") == "debit":
                total += dec.get("amount", 0)
        return total

    @staticmethod
    async def check_budget_breach(user_id: str, category: str, new_amount: float):
        db = get_database()
        # Check both category and General
        budgets = await db.budgets.find({"user_id": user_id, "category": {"$in": [category.lower(), "General"]}}).to_list(5)
        
        alerts = []
        for b in budgets:
            spent = await BudgetService.get_spent_amount(user_id, b["category"])
            if spent + new_amount > b["amount_limit"]:
                alerts.append(f"Budget exceeded for {b['category']}! Limit: ₹{b['amount_limit']:.0f}")
            elif spent + new_amount > b["amount_limit"] * 0.8:
                alerts.append(f"Approaching budget limit for {b['category']} (80% used)")
        
        return " | ".join(alerts) if alerts else None

budget_service = BudgetService()
