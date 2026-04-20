"""Loan application routes."""
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.core.database import get_database
from app.core.security import get_current_user
from app.helper.utils import encrypt_user_data, decrypt_user_data
from app.core.kafka_service import kafka_service
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
from app.models.account import LoanApplication
router = APIRouter(prefix="/loans", tags=["Loans"])

# Interest rates by loan type
INTEREST_RATES = {
    "personal": 12.5,
    "home": 8.5,
    "vehicle": 9.5,
    "education": 7.5,
    "business": 14.0,
}


@router.post("/apply", status_code=201)
async def apply_loan(data: LoanApplication, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Loan application: user={user_id}, type={data.loan_type}, amount=₹{data.amount}, tenure={data.tenure_months}m")
    db = get_database()

    interest = INTEREST_RATES.get(data.loan_type, 12.0)
    monthly_rate = interest / 12 / 100
    tenure = data.tenure_months

    # Calculate EMI
    if monthly_rate > 0:
        emi = data.amount * monthly_rate * (1 + monthly_rate) ** tenure / ((1 + monthly_rate) ** tenure - 1)
    else:
        emi = data.amount / tenure
    emi = round(emi, 2)

    log.info(f"EMI calculated: rate={interest}%, monthly_rate={monthly_rate:.6f}, EMI=₹{emi}")

    loan_doc = {
        "user_id": user_id,
        "loan_type": data.loan_type,
        "amount": data.amount,
        "tenure_months": tenure,
        "interest_rate": interest,
        "emi": emi,
        "status": "pending",
        "purpose": data.purpose,
        "created_at": datetime.utcnow(),
    }

    encrypted_loan_doc = encrypt_user_data(loan_doc)  # Encrypt sensitive fields if needed
    result = await db.loans.insert_one(encrypted_loan_doc)
    loan_doc["id"] = str(result.inserted_id)
    loan_doc.pop("_id", None)

    log.info(f"Loan application submitted: id={result.inserted_id}, status=pending")

    await kafka_service.publish("user.activity", {
        "action": "loan_applied",
        "user_id": user_id,
        "loan_id": str(result.inserted_id),
        "amount": data.amount,
        "type": data.loan_type,
    })

    await kafka_service.publish("notifications.send", {
        "user_id": user_id,
        "type": "loan_update",
        "message": f"Your {data.loan_type} loan application of ₹{data.amount:,.0f} has been submitted. EMI: ₹{emi:,.0f}/month",
    })

    log.info(f"Loan events published: loan={result.inserted_id}")
    return loan_doc


@router.get("/")
async def get_loans(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Fetching loans: user={user_id}")
    db = get_database()
    cursor = db.loans.find({"user_id": user_id}).sort("created_at", -1)
    loans = await cursor.to_list(50)
    for l in loans:
        decrypted_loan = decrypt_user_data(l)  # Decrypt fields if needed
        l.clear()  # Clear original dict
        l.update(decrypted_loan)  # Update original dict with decrypted values
        l["id"] = str(l["_id"])
        del l["_id"]
    log.info(f"Returned {len(loans)} loans for user={user_id}")
    return loans


@router.get("/{loan_id}")
async def get_loan(loan_id: str, current_user: dict = Depends(get_current_user)):
    log.debug(f"Fetching loan: id={loan_id}")
    db = get_database()
    loan = await db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        log.warning(f"Loan not found: id={loan_id}")
        raise HTTPException(status_code=404, detail="Loan not found")
    loan = decrypt_user_data(loan) if loan else None  # Decrypt fields if loan exists
    if loan["user_id"] != str(current_user["_id"]) and current_user["role"] == "customer":
        log.warning(f"Loan access denied: user={current_user['id']}, loan={loan_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    loan["id"] = str(loan["_id"])
    del loan["_id"]
    return loan
