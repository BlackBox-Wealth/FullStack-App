from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AssetType(str, Enum):
    PROPERTY = "property"
    GOLD = "gold"
    VEHICLE = "vehicle"
    JEWELLERY = "jewellery"
    OTHER = "other"


class AssetCreate(BaseModel):
    name: str
    asset_type: AssetType
    purchase_price: float = Field(..., gt=0)
    current_valuation: float = Field(..., gt=0)
    purchase_date: Optional[str] = None
    description: Optional[str] = None


class AssetResponse(BaseModel):
    id: str
    user_id: str
    name: str
    asset_type: str
    purchase_price: float
    current_valuation: float
    appreciation: float
    appreciation_pct: float
    purchase_date: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[str] = None


class NetWorthSummary(BaseModel):
    liquid_cash: float
    investments: float
    physical_assets: float
    total_net_worth: float
    asset_distribution: dict  # e.g. {"Property": 5000000, "Gold": 200000}
