"""
Encryption utilities for secure agent communication.
Provides PII anonymization and data encryption/decryption using Fernet.
Uses symmetric encryption for data security.
"""
import json
import base64
import os
from cryptography.fernet import Fernet
from typing import Any, Dict, Union

# Get encryption key from environment or use a default key
# For production: ensure ENCRYPTION_KEY is securely set in environment
_ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "Y9b5y9ej0lVbAxJg2YVuNI1DVrLmvOWsd0kuJ9onoHE=")

try:
    # Ensure the key is in the correct format
    if isinstance(_ENCRYPTION_KEY, str):
        _key_bytes = _ENCRYPTION_KEY.encode('utf-8') if not isinstance(_ENCRYPTION_KEY, bytes) else _ENCRYPTION_KEY
    else:
        _key_bytes = _ENCRYPTION_KEY
    _fernet = Fernet(_key_bytes)
except Exception as e:
    raise ValueError(f"Invalid ENCRYPTION_KEY format: {str(e)}. Key must be a valid Fernet key.")

def get_encryption_key() -> str:
    """Returns the encryption key (for frontend to use same key)"""
    return _ENCRYPTION_KEY if isinstance(_ENCRYPTION_KEY, str) else _ENCRYPTION_KEY.decode('utf-8')

def encrypt_data(data: Union[Dict[str, Any], str]) -> str:
    """
    Encrypts a dictionary or string using Fernet symmetric encryption.
    Provides strong security for sensitive data.
    """
    if isinstance(data, dict):
        data_str = json.dumps(data)
    else:
        data_str = str(data)
        
    encrypted_bytes = _fernet.encrypt(data_str.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_data(encrypted_token: str) -> Union[Dict[str, Any], str]:
    """
    Decrypts a Fernet-encrypted token back into a dictionary or string.
    """
    try:
        decrypted_bytes = _fernet.decrypt(encrypted_token.encode('utf-8'))
        decrypted_str = decrypted_bytes.decode('utf-8')
        
        # Try parsing as JSON first
        try:
            return json.loads(decrypted_str)
        except json.JSONDecodeError:
            return decrypted_str
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")

def anonymize_pii(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Strips or masks Personally Identifiable Information (PII) before sending 
    data to external LLMs (Groq).
    """
    anonymized = user_data.copy()
    
    # Masking rules
    if "name" in anonymized:
        anonymized["name"] = "***"
    if "email" in anonymized:
        anonymized["email"] = "***@***.com"
    if "phone" in anonymized:
        anonymized["phone"] = "XXXXX-XXXXX"
    if "account_number" in anonymized:
        acc = str(anonymized["account_number"])
        anonymized["account_number"] = f"XXX{acc[-4:]}" if len(acc) >= 4 else "XXX"
        
    return anonymized

def prepare_llm_payload(user_data: Dict[str, Any]) -> str:
    """
    Prepares data for LLM by ensuring PII is removed, returning JSON string.
    """
    clean_data = anonymize_pii(user_data)
    return json.dumps(clean_data, indent=2)
