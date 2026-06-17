import os
from datetime import datetime
from typing import Any
from app.services.encryption import EncryptionHelper
from dotenv import load_dotenv
from logifyx import Logifyx
from app.core.config import settings

log = Logifyx(
    name="wealthvault",
    color=True,
)

load_dotenv()
encryption_helper = EncryptionHelper(settings.DATA_ENCRYPTION_KEY)

NEVER_ENCRYPT_FIELDS = {
    "_id", "id", "password", "password_hash", "hashed_email", "hashed_phone",
    "hashed_account_number", "created_at", "updated_at", "completed_at",
    "approved_at", "resolved_at", "read_at",
    # Operational keys required for filtering, relations, counters and pipelines.
    # We keep these as plaintext so MongoDB indexes and queries still work.
    "user_id", "account_id", "from_account_id", "to_account_id", "to_user_id",
    "payment_id", "transaction_id", "loan_id", "target_user",
    "category", "transaction_type", "type", "currency",
}

LOG_EXEMPT_FIELDS = {
    "performed_by", "action", "reason", "resolved_by", "approved_by", "rejected_by",
}

# Encrypt these fields even when they are numeric or critical status strings.
FORCE_ENCRYPT_FIELDS = {
    "target_amount", "current_amount", "progress_pct", "step_up_pct",
    "installments_count", "current_value", "total_invested", "profit_loss",
    "profit_loss_pct", "buy_price", "quantity",
    "amount", "balance", "risk_score", "interest_rate", "emi", "tenure_months",
    "role", "kyc_status", "status", "is_active", "is_external", "read", "verified", "otp",
}

FLOAT_FIELDS = {
    "amount", "balance", "buy_price", "quantity", "risk_score", "emi", "interest_rate",
    "target_amount", "current_amount", "progress_pct", "step_up_pct",
    "current_value", "total_invested", "profit_loss", "profit_loss_pct",
}
INT_FIELDS = {"tenure_months", "installments_count"}
BOOL_FIELDS = {"is_active", "is_external", "read", "verified"}
DATETIME_FIELDS = {"created_at", "updated_at", "completed_at", "approved_at", "resolved_at", "read_at"}


def _coerce_decrypted_value(key: str, value: Any) -> Any:
    if not isinstance(value, str):
        return value

    if key in BOOL_FIELDS:
        lower = value.lower()
        if lower == "true":
            return True
        if lower == "false":
            return False

    if key in FLOAT_FIELDS:
        try:
            return float(value)
        except ValueError:
            return value

    if key in INT_FIELDS:
        try:
            return int(float(value))
        except ValueError:
            return value

    if key in DATETIME_FIELDS:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return value

    return value

def encrypt_user_data(user_data: dict):
    """
    Encrypt sensitive user data before storing.
    
    Args:
        user_data: Dictionary containing user data
        
    Returns:
        dict: Dictionary with encrypted user data
    """
    encrypted_user_data = {}
    for key, value in user_data.items():
        if key in NEVER_ENCRYPT_FIELDS or key in LOG_EXEMPT_FIELDS or value is None:
            encrypted_user_data[key] = value
            continue

        if key in FORCE_ENCRYPT_FIELDS:
            encrypted_user_data[key] = encryption_helper.encrypt(str(value))
            continue

        if isinstance(value, dict):
            encrypted_user_data[key] = encrypt_user_data(value)
            continue

        if isinstance(value, list):
            encrypted_items = []
            for item in value:
                if isinstance(item, dict):
                    encrypted_items.append(encrypt_user_data(item))
                elif isinstance(item, str):
                    encrypted_items.append(encryption_helper.encrypt(item))
                else:
                    encrypted_items.append(item)
            encrypted_user_data[key] = encrypted_items
            continue

        # Encrypt all non-exempt string fields by default.
        if isinstance(value, str):
            encrypted_user_data[key] = encryption_helper.encrypt(value)
        else:
            encrypted_user_data[key] = value

    log.debug("Encrypted sensitive user data fields")
    return encrypted_user_data

def decrypt_user_data(encrypted_data: dict):
    """
    Decrypt sensitive user data after retrieving.
    
    Args:
        encrypted_data: Dictionary containing encrypted user data
        
    Returns:
        dict: Dictionary with decrypted user data
    """
    if not encrypted_data:
        return encrypted_data

    decrypted_user_data = {}
    for key, value in encrypted_data.items():
        if key in NEVER_ENCRYPT_FIELDS or key in LOG_EXEMPT_FIELDS or value is None:
            decrypted_user_data[key] = value
            continue

        if isinstance(value, dict):
            decrypted_user_data[key] = decrypt_user_data(value)
            continue

        if isinstance(value, list):
            decrypted_items = []
            for item in value:
                if isinstance(item, dict):
                    decrypted_items.append(decrypt_user_data(item))
                elif isinstance(item, str):
                    try:
                        decrypted_items.append(encryption_helper.decrypt(item))
                    except Exception:
                        decrypted_items.append(item)
                else:
                    decrypted_items.append(item)
            decrypted_user_data[key] = decrypted_items
            continue

        if isinstance(value, str):
            try:
                decrypted = encryption_helper.decrypt(value)
                decrypted_user_data[key] = _coerce_decrypted_value(key, decrypted)
                continue
            except Exception:
                # Preserve plaintext values for non-encrypted or legacy records.
                pass

        decrypted_user_data[key] = value

    log.debug("Decrypted user data fields")
    return decrypted_user_data


def encrypt_update_fields(update_fields: dict) -> dict:
    """Encrypt update payloads consistently before applying $set operations."""
    return encrypt_user_data(update_fields)