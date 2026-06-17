"""Cloudflare Turnstile CAPTCHA verification service."""
import httpx
from app.core.config import settings
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,
)


class TurnstileService:
    """Service for verifying Cloudflare Turnstile CAPTCHA tokens."""
    
    VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    
    @staticmethod
    async def verify_token(token: str, remote_ip: str = None) -> dict:
        """
        Verify a Turnstile token with Cloudflare.
        
        Args:
            token: The Turnstile token from the client
            remote_ip: Optional IP address of the requester
            
        Returns:
            dict with 'success' bool and additional metadata
        """
        if not settings.ENABLE_TURNSTILE:
            log.info("Turnstile verification disabled")
            return {"success": True, "reason": "disabled"}
        
        if not settings.TURNSTILE_SECRET_KEY:
            log.warning("Turnstile secret key not configured")
            return {"success": False, "error": "Turnstile not configured"}
        
        if not token or token.strip() == "":
            log.warning("Empty Turnstile token")
            return {"success": False, "error": "Missing token"}
        
        try:
            payload = {
                "secret": settings.TURNSTILE_SECRET_KEY,
                "response": token,
            }
            
            if remote_ip:
                payload["remoteip"] = remote_ip
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    TurnstileService.VERIFY_URL,
                    data=payload
                )
            
            result = response.json()
            log.info(f"Turnstile verification result: {result}")
            
            success = result.get("success", False)
            log.info(f"Turnstile token verified: success={success}")
            
            return {
                "success": success,
                "challenge_ts": result.get("challenge_ts"),
                "hostname": result.get("hostname"),
                "error_codes": result.get("error-codes", []),
                "error": None if success else "Captcha verification failed"
            }
            
        except httpx.RequestError as e:
            log.error(f"Turnstile verification request failed: {e}")
            return {"success": False, "error": f"Request error: {str(e)}"}
        except Exception as e:
            log.error(f"Turnstile verification error: {e}")
            return {"success": False, "error": f"Verification error: {str(e)}"}


turnstile_service = TurnstileService()
