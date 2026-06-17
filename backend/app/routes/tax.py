"""Tax optimization and planning routes."""
from fastapi import APIRouter, Depends
from app.core.database import get_database
from app.core.security import get_current_user
from app.helper.utils import decrypt_user_data
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,
)

router = APIRouter(prefix="/tax", tags=["Tax"])

# Tax-saving investment types
TAX_SAVING_INSTRUMENTS = {
    "elss": "ELSS Mutual Funds",
    "ppf": "Public Provident Fund",
    "nsc": "National Savings Certificate",
    "tax_saver_fd": "Tax Saver Fixed Deposit",
    "ulip": "Unit Linked Insurance Plan",
    "nps": "National Pension System",
}

# 80C limit for FY 2024-25
SECTION_80C_LIMIT = 150000


@router.get("/summary")
async def get_tax_summary(current_user: dict = Depends(get_current_user)):
    """Get tax optimization summary with 80C calculations."""
    user_id = str(current_user["_id"])
    log.info(f"Tax summary requested: user={user_id}")
    db = get_database()

    # Fetch all user investments
    investments = await db.investments.find({"user_id": user_id}).to_list(100)
    
    total_tax_saving = 0
    tax_saving_investments = []
    
    for inv in investments:
        decrypted_inv = decrypt_user_data(inv)
        inv.clear()
        inv.update(decrypted_inv)
        
        # Check if investment is tax-saving
        inv_type = inv.get("investment_type", "").lower()
        symbol = inv.get("symbol", "").lower()
        
        # Identify tax-saving instruments
        is_tax_saving = False
        instrument_name = None
        
        if inv_type in TAX_SAVING_INSTRUMENTS:
            is_tax_saving = True
            instrument_name = TAX_SAVING_INSTRUMENTS[inv_type]
        elif "elss" in symbol or "tax" in symbol:
            is_tax_saving = True
            instrument_name = "ELSS/Tax Saver Fund"
        elif "ppf" in symbol:
            is_tax_saving = True
            instrument_name = "PPF"
        elif "nps" in symbol:
            is_tax_saving = True
            instrument_name = "NPS"
        
        if is_tax_saving:
            amount = inv.get("amount", 0)
            total_tax_saving += amount
            tax_saving_investments.append({
                "symbol": inv.get("symbol"),
                "type": instrument_name or inv_type,
                "amount": amount,
                "invested_on": str(inv.get("created_at", ""))
            })
    
    # Calculate remaining limit
    remaining_limit = max(0, SECTION_80C_LIMIT - total_tax_saving)
    utilization_pct = round((total_tax_saving / SECTION_80C_LIMIT * 100), 1) if SECTION_80C_LIMIT > 0 else 0
    
    # Generate suggestions
    suggestions = []
    
    if remaining_limit > 0:
        if remaining_limit >= 50000:
            suggestions.append(f"You have ₹{remaining_limit:,.0f} remaining in 80C limit. Consider investing in ELSS funds for tax savings and wealth creation.")
            suggestions.append("ELSS funds offer dual benefits: tax deduction under 80C and potential for higher returns.")
        elif remaining_limit >= 20000:
            suggestions.append(f"Invest the remaining ₹{remaining_limit:,.0f} in PPF or Tax Saver FD for guaranteed returns.")
        else:
            suggestions.append(f"You're close to the limit! Consider investing the remaining ₹{remaining_limit:,.0f} to maximize tax benefits.")
    else:
        suggestions.append("Congratulations! You've fully utilized your 80C limit of ₹1,50,000.")
        suggestions.append("Explore other tax-saving options like 80D (health insurance) or NPS (additional ₹50,000 under 80CCD(1B)).")
    
    # Additional suggestions based on utilization
    if utilization_pct < 50:
        suggestions.append("Increase your SIP in ELSS funds to systematically build your 80C portfolio.")
    
    if total_tax_saving == 0:
        suggestions.append("Start with a small ELSS SIP of ₹5,000/month to begin your tax-saving journey.")
    
    # Calculate potential tax savings
    # Assuming 30% tax bracket (highest slab)
    potential_tax_saved = round(total_tax_saving * 0.30, 2)
    max_possible_savings = round(SECTION_80C_LIMIT * 0.30, 2)
    additional_savings_possible = round(remaining_limit * 0.30, 2)
    
    log.info(
        f"Tax summary computed: user={user_id}, invested=₹{total_tax_saving:.0f}, "
        f"remaining=₹{remaining_limit:.0f}, utilization={utilization_pct}%"
    )
    
    return {
        "section_80c_limit": SECTION_80C_LIMIT,
        "total_invested": round(total_tax_saving, 2),
        "remaining_limit": round(remaining_limit, 2),
        "utilization_pct": utilization_pct,
        "tax_saving_investments": tax_saving_investments,
        "potential_tax_saved": potential_tax_saved,
        "max_possible_savings": max_possible_savings,
        "additional_savings_possible": additional_savings_possible,
        "suggestions": suggestions,
    }
