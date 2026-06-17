"""Credit score routes."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.core.database import get_database
from app.core.security import get_current_user
from app.services.credit_score_service import compute_credit_score
from logifyx import Logifyx

log = Logifyx(name="wealthvault-credit", color=True)
router = APIRouter(prefix="/credit", tags=["Credit"])


@router.get("/score")
async def get_credit_score(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    log.info(f"Credit score requested: user={user_id}")
    db = get_database()

    # Compute fresh factors from current financial data (deterministic, read-only).
    # The displayed score is the user's stored personal score — only updated by
    # real transaction events, so page reloads never drift the score upward.
    result = await compute_credit_score(db, user_id, current_user)

    personal_score = int(current_user.get("credit_score") or 650)
    previous = int(current_user.get("credit_score_previous") or personal_score)
    delta = personal_score - previous

    last_updated = current_user.get("credit_score_updated_at")
    if isinstance(last_updated, datetime):
        last_updated_str = last_updated.isoformat()
    else:
        last_updated_str = datetime.now(timezone.utc).isoformat()

    # Derive rating from stored personal score, not the computed target
    if personal_score >= 750:
        rating = "Good"
    elif personal_score >= 600:
        rating = "Average"
    else:
        rating = "Poor"

    log.info(f"Credit score returned: user={user_id}, score={personal_score}, delta={delta}")
    return {
        "score": personal_score,
        "rating": rating,
        "factors": result["factors"],
        "score_delta": delta,
        "last_updated": last_updated_str,
    }
