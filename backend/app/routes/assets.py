from typing import List
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.asset import AssetCreate, AssetResponse, NetWorthSummary, AssetType
from app.helper.utils import encrypt_user_data, decrypt_user_data
from logifyx import Logifyx

log = Logifyx(name="wealthvault", color=True)

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.post("/", response_model=AssetResponse, status_code=201)
async def add_asset(data: AssetCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Adding physical asset: user={user_id}, name='{data.name}', type={data.asset_type}")
    db = get_database()

    asset_doc = {
        "user_id": user_id,
        "name": data.name,
        "asset_type": data.asset_type.value,
        "purchase_price": data.purchase_price,
        "current_valuation": data.current_valuation,
        "purchase_date": data.purchase_date,
        "description": data.description,
        "created_at": datetime.utcnow(),
    }

    encrypted_doc = encrypt_user_data(asset_doc)
    result = await db.assets.insert_one(encrypted_doc)
    
    asset_doc["id"] = str(result.inserted_id)
    asset_doc["appreciation"] = data.current_valuation - data.purchase_price
    asset_doc["appreciation_pct"] = (asset_doc["appreciation"] / data.purchase_price * 100) if data.purchase_price > 0 else 0
    asset_doc["created_at"] = str(asset_doc["created_at"])
    
    return asset_doc


@router.get("/", response_model=List[AssetResponse])
async def get_assets(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_database()
    cursor = db.assets.find({"user_id": user_id})
    assets = await cursor.to_list(100)
    
    results = []
    for asset in assets:
        dec = decrypt_user_data(asset)
        dec["id"] = str(asset["_id"])
        dec["appreciation"] = dec["current_valuation"] - dec["purchase_price"]
        dec["appreciation_pct"] = (dec["appreciation"] / dec["purchase_price"] * 100) if dec["purchase_price"] > 0 else 0
        dec["created_at"] = str(dec.get("created_at", ""))
        results.append(dec)
    
    return results


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_database()
    result = await db.assets.delete_one({"_id": ObjectId(asset_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    return None


@router.get("/net-worth-summary", response_model=NetWorthSummary)
async def get_net_worth(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_database()

    # 1. Liquid Cash
    accounts_cursor = db.accounts.find({"user_id": user_id})
    accounts = await accounts_cursor.to_list(100)
    liquid_cash = 0
    for acc in accounts:
        dec = decrypt_user_data(acc)
        liquid_cash += dec.get("balance", 0)

    # 2. Investments
    inv_cursor = db.investments.find({"user_id": user_id})
    investments = await inv_cursor.to_list(100)
    sip_cursor = db.sips.find({"user_id": user_id})
    sips = await sip_cursor.to_list(100)
    
    investment_value = 0
    for inv in investments:
        dec = decrypt_user_data(inv)
        investment_value += dec.get("amount", 0)
    for sip in sips:
        dec = decrypt_user_data(sip)
        investment_value += dec.get("current_value", dec.get("total_invested", 0))

    # 3. Physical Assets
    asset_cursor = db.assets.find({"user_id": user_id})
    assets_docs = await asset_cursor.to_list(100)
    physical_assets_value = 0
    distribution = {"Property": 0, "Gold": 0, "Vehicle": 0, "Jewellery": 0, "Other": 0}
    
    for asset in assets_docs:
        dec = decrypt_user_data(asset)
        val = dec.get("current_valuation", 0)
        physical_assets_value += val
        atype = dec.get("asset_type", "other").capitalize()
        distribution[atype] = distribution.get(atype, 0) + val

    return {
        "liquid_cash": round(liquid_cash, 2),
        "investments": round(investment_value, 2),
        "physical_assets": round(physical_assets_value, 2),
        "total_net_worth": round(liquid_cash + investment_value + physical_assets_value, 2),
        "asset_distribution": distribution
    }
