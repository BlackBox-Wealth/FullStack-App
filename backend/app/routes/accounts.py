"""Account management routes."""
import random
import string
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.core.database import get_database
from app.core.security import get_current_user, require_role
from app.helper.utils import encrypt_user_data, decrypt_user_data, encrypt_update_fields
from app.services.deterministic_hash import generate_deterministic_hash
from app.core.kafka_service import kafka_service
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)   
from app.models.account import (
    AccountCreate, AccountResponse, LinkExternalAccount, AccountStatus
)
router = APIRouter(prefix="/accounts", tags=["Accounts"])


def generate_account_number():
    return "".join(random.choices(string.digits, k=12))


def account_to_response(acc: dict) -> AccountResponse:
    return AccountResponse(
        id=str(acc["_id"]),
        user_id=str(acc["user_id"]),
        account_number=acc["account_number"],
        account_type=acc["account_type"],
        bank_name=acc["bank_name"],
        balance=acc["balance"],
        currency=acc["currency"],
        status=acc["status"],
        is_external=acc.get("is_external", False),
        created_at=str(acc.get("created_at", "")),
    )


@router.post("/", response_model=AccountResponse, status_code=201)
async def create_account(data: AccountCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Account creation: user={user_id}, type={data.account_type}, bank={data.bank_name}")
    db = get_database()

    acc_number = generate_account_number()
    account_doc = {
        "user_id": user_id,
        "account_number": acc_number,
        "account_type": data.account_type.value,
        "bank_name": data.bank_name,
        "balance": data.initial_deposit,
        "currency": data.currency,
        "status": "active",
        "is_external": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    # create deterministic hash for lookup
    hashed_acc_number = generate_deterministic_hash(acc_number)

    # encrypt user data before storing
    encrypted_account_doc = encrypt_user_data(account_doc)

    # add hashed fields for lookup
    encrypted_account_doc["hashed_account_number"] = hashed_acc_number
    result = await db.accounts.insert_one(encrypted_account_doc)
    account_doc["_id"] = result.inserted_id
    log.info(f"Account created: id={result.inserted_id}, number=***{acc_number[-4:]}, deposit=₹{data.initial_deposit}")

    await kafka_service.publish("user.activity", {
        "action": "account_created",
        "user_id": user_id,
        "account_id": str(result.inserted_id),
    })

    return account_to_response(account_doc)


@router.get("/", response_model=list[AccountResponse])
async def get_accounts(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Fetching accounts: user={user_id}")
    db = get_database()
    cursor = db.accounts.find({"user_id": user_id})
    accounts = await cursor.to_list(100)
    for acc in accounts:
        decrypted_acc = decrypt_user_data(acc)  # Decrypt fields if needed
        acc.clear()  # Clear original dict
        acc.update(decrypted_acc)  # Update original dict with decrypted values
    log.info(f"Found {len(accounts)} accounts for user={user_id}")
    return [account_to_response(acc) for acc in accounts]


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(account_id: str, current_user: dict = Depends(get_current_user)):
    log.info(f"Fetching account: id={account_id}, user={current_user['id']}")
    db = get_database()
    account = await db.accounts.find_one({"_id": ObjectId(account_id)})
    account = decrypt_user_data(account) if account else None  # Decrypt fields if account exists

    if not account:
        log.warning(f"Account not found: id={account_id}")
        raise HTTPException(status_code=404, detail="Account not found")

    if account["user_id"] != str(current_user["_id"]) and current_user["role"] == "customer":
        log.warning(f"Access denied: user={current_user['id']} tried to access account={account_id}")
        raise HTTPException(status_code=403, detail="Access denied")

    return account_to_response(account)


@router.post("/link-external", response_model=AccountResponse, status_code=201)
async def link_external_account(data: LinkExternalAccount, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Linking external account: user={user_id}, bank={data.bank_name}, acc=***{data.account_number[-4:]}")
    db = get_database()

    account_doc = {
        "user_id": user_id,
        "account_number": data.account_number,
        "account_type": "external",
        "bank_name": data.bank_name,
        "balance": 0,
        "currency": "INR",
        "status": "active",
        "is_external": True,
        "ifsc_code": data.ifsc_code,
        "account_holder_name": data.account_holder_name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    # encrypt user data before storing
    encrypted_account_doc = encrypt_user_data(account_doc)

    # add hashed fields for lookup
    hashed_acc_number = generate_deterministic_hash(data.account_number)
    encrypted_account_doc["hashed_account_number"] = hashed_acc_number

    result = await db.accounts.insert_one(encrypted_account_doc)
    account_doc["_id"] = result.inserted_id
    log.info(f"External account linked: id={result.inserted_id}, bank={data.bank_name}")
    return account_to_response(account_doc)


@router.put("/{account_id}/freeze")
async def freeze_account(
    account_id: str,
    current_user: dict = Depends(require_role("super_admin", "relationship_manager"))
):
    log.warning(f"Account freeze requested: account={account_id}, by={current_user['id']} (role={current_user['role']})")
    db = get_database()
    update_fields = encrypt_update_fields({"status": "frozen", "updated_at": datetime.utcnow()})
    result = await db.accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": update_fields}
    )
    if result.modified_count == 0:
        log.warning(f"Account freeze failed: account={account_id} not found")
        raise HTTPException(status_code=404, detail="Account not found")

    await kafka_service.publish("user.activity", {
        "action": "account_frozen",
        "account_id": account_id,
        "by_user": str(current_user["_id"]),
    })

    log.info(f"Account frozen successfully: account={account_id}")
    return {"message": "Account frozen successfully"}


@router.put("/{account_id}/unfreeze")
async def unfreeze_account(
    account_id: str,
    current_user: dict = Depends(require_role("super_admin"))
):
    log.info(f"Account unfreeze requested: account={account_id}, by={current_user['id']}")
    db = get_database()
    update_fields = encrypt_update_fields({"status": "active", "updated_at": datetime.utcnow()})
    result = await db.accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": update_fields}
    )
    if result.modified_count == 0:
        log.warning(f"Account unfreeze failed: account={account_id} not found")
        raise HTTPException(status_code=404, detail="Account not found")
    log.info(f"Account unfrozen successfully: account={account_id}")
    return {"message": "Account unfrozen successfully"}
