"""
Claim 1 — Email behavior → PAM trust score → maker-checker thresholds.

An employee who clicks a high-risk real email receives the same PAM score
penalty as clicking a phishing link in a Sentinel simulation.
An employee who reports it receives the same reward as reporting in Sentinel.

The PAM trust score (0-1) is stored in simulation_profiles — the same
MongoDB collection Sentinel writes to. A score below 0.5 triggers elevated
maker-checker thresholds in the main banking backend.
"""
import asyncio
from datetime import datetime
from app.core.database import get_database
from app.core.kafka_service import kafka_service
from app.simulation.services.scoring import compute_pam_trust_score, update_profile_after_attempt

# Action → base score (mirrors Sentinel phishing scoring thresholds)
_ACTION_SCORES: dict[str, int] = {
    "reported_phishing": 90,
    "opened_only":       40,
    "no_action":         25,
    "clicked_link":      10,
    "forwarded":          5,
}

# Weight by risk level: high-risk emails have full PAM impact; medium half
_RISK_WEIGHT: dict[str, float] = {
    "high":   1.0,
    "medium": 0.5,
    "low":    0.0,  # Legitimate emails never affect PAM
}


async def handle_email_interaction(
    employee_id_hash: str,
    email_id:         str,
    action:           str,
    risk_score:       float,
    risk_level:       str,
) -> dict:
    """
    Core Claim 1 logic:
      1. Compute weighted score from action × risk level
      2. Update simulation_profiles (shared with Sentinel)
      3. Publish to employee.email.risk_event Kafka topic
    """
    weight = _RISK_WEIGHT.get(risk_level, 0.0)
    if weight == 0.0:
        return {"pam_score": None, "flagged": False, "score_applied": None}

    base     = _ACTION_SCORES.get(action, 25)
    # Interpolate toward neutral (50) for medium-risk emails
    weighted = int(base * weight + 50 * (1 - weight))
    passed   = weighted >= 70

    attempt = {
        "attempt_id":   f"email_{email_id}",
        "module":       "real_email_threat",
        "score":        weighted,
        "passed":       passed,
        "completed_at": datetime.utcnow().isoformat(),
        "actions":      [{"action": action, "timestamp": datetime.utcnow().isoformat()}],
        "source":       "real_threat",
        "risk_score":   risk_score,
        "risk_level":   risk_level,
    }

    db      = get_database()
    profile = await db.simulation_profiles.find_one({"employee_id_hash": employee_id_hash})

    if not profile:
        profile = {
            "employee_id_hash":      employee_id_hash,
            "total_attempts":        0,
            "average_score":         0,
            "pam_trust_score":       0.6,
            "flagged":               False,
            "history":               [],
            "_all_scores":           [],
            "module_scores":         {},
            "module_attempt_counts": {},
            "certification_status":  "needs_training",
        }

    updated = update_profile_after_attempt(profile, attempt)

    # Immediate flag + hard PAM drop on confirmed high-risk click
    if action == "clicked_link" and risk_level == "high":
        updated["flagged"]         = True
        updated["flag_reason"]     = f"Clicked high-risk email link — email_id: {email_id}"
        updated["pam_trust_score"] = compute_pam_trust_score(
            updated.get("history", []), flagged=True
        )

    await db.simulation_profiles.update_one(
        {"employee_id_hash": employee_id_hash},
        {"$set": updated},
        upsert=True,
    )

    kafka_event = {
        "employee_id_hash": employee_id_hash,
        "email_id":         email_id,
        "action":           action,
        "score":            weighted,
        "passed":           passed,
        "risk_level":       risk_level,
        "new_pam_score":    updated["pam_trust_score"],
        "flagged":          updated.get("flagged", False),
        "source":           "real_email_threat",
    }
    asyncio.create_task(kafka_service.publish("employee.email.risk_event", kafka_event))

    return {
        "pam_score":     updated["pam_trust_score"],
        "flagged":       updated.get("flagged", False),
        "score_applied": weighted,
    }