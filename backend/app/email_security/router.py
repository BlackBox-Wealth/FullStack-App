"""
Email Security API routes.

POST /email-security/analyze        — analyze inbound email (Claims 2 + 3)
POST /email-security/interaction    — record employee action → PAM update (Claim 1)
GET  /email-security/stats/{hash}   — per-employee email threat history
GET  /email-security/dashboard      — admin aggregate view
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.core.database import get_database
from app.email_security.models import (
    InboundEmailRequest, EmailInteractionEvent, EmailRiskResult,
)
from app.email_security.analyzer import analyze_email_risk
from app.email_security.pam_service import handle_email_interaction

router = APIRouter(prefix="/email-security", tags=["Email Security"])


@router.post("/analyze", response_model=EmailRiskResult)
async def analyze_incoming_email(body: InboundEmailRequest):
    """
    Analyzes an inbound employee email for phishing / social engineering.

    Claim 3: PII stripped via MockHomomorphic encoding before Groq call.
    Claim 2: Multilingual detection — English, Hindi (Devanagari), Punjabi (Gurmukhi).
    Result stored in email_risk_events for dashboard queries.
    """
    result = await analyze_email_risk(
        email_id=body.email_id,
        subject=body.subject,
        body=body.body,
        sender_email=body.sender_email,
        sender_name=body.sender_name,
    )

    db = get_database()
    await db.email_risk_events.insert_one({
        **result.model_dump(),
        "employee_id_hash": body.employee_id_hash,
        "sender_email":     body.sender_email,
        "sender_name":      body.sender_name,
        "analyzed_at":      datetime.utcnow(),
    })

    return result


@router.post("/interaction")
async def record_email_interaction(body: EmailInteractionEvent):
    """
    Records what the employee did after receiving a risk-scored email.

    Claim 1: Updates PAM trust score via the Sentinel simulation_profiles
    collection. Real threats and simulated threats update the same score.
    Low-risk (legitimate) emails are ignored — only medium/high affect PAM.
    """
    result = await handle_email_interaction(
        employee_id_hash=body.employee_id_hash,
        email_id=body.email_id,
        action=body.action,
        risk_score=body.risk_score,
        risk_level=body.risk_level,
    )
    return {"success": True, "data": result}


@router.get("/stats/{employee_id_hash}")
async def get_employee_email_stats(employee_id_hash: str):
    """Per-employee email threat interaction summary for admin panel."""
    db = get_database()

    events = await db.email_risk_events.find(
        {"employee_id_hash": employee_id_hash}
    ).sort("analyzed_at", -1).limit(50).to_list(50)

    profile   = await db.simulation_profiles.find_one({"employee_id_hash": employee_id_hash})
    history   = profile.get("history", []) if profile else []
    real_evts = [h for h in history if h.get("module") == "real_email_threat"]

    clicked  = sum(1 for h in real_evts if h.get("score", 100) < 30)
    reported = sum(1 for h in real_evts if h.get("score", 0) >= 70)

    return {
        "success": True,
        "data": {
            "employee_id_hash":       employee_id_hash,
            "pam_trust_score":        profile.get("pam_trust_score", 0.6) if profile else 0.6,
            "total_flagged_received": len(events),
            "clicked_high_risk":      clicked,
            "reported":               reported,
            "recent_events": [
                {
                    "email_id":          e.get("email_id"),
                    "risk_score":        e.get("risk_score"),
                    "risk_level":        e.get("risk_level"),
                    "flags":             e.get("flags", []),
                    "language_detected": e.get("language_detected"),
                    "analyzed_at":       str(e.get("analyzed_at", "")),
                }
                for e in events[:10]
            ],
        },
    }


@router.get("/dashboard")
async def get_email_security_dashboard():
    """Admin aggregate view across all employees."""
    db = get_database()

    risk_dist = await db.email_risk_events.aggregate([
        {"$group": {
            "_id":           "$risk_level",
            "count":         {"$sum": 1},
            "avg_risk_score": {"$avg": "$risk_score"},
        }}
    ]).to_list(10)

    top_flags = await db.email_risk_events.aggregate([
        {"$unwind": "$flags"},
        {"$group": {"_id": "$flags", "count": {"$sum": 1}}},
        {"$sort":  {"count": -1}},
        {"$limit": 7},
    ]).to_list(7)

    lang_dist = await db.email_risk_events.aggregate([
        {"$group": {"_id": "$language_detected", "count": {"$sum": 1}}},
        {"$sort":  {"count": -1}},
    ]).to_list(10)

    recent_high = await db.email_risk_events.find(
        {"risk_level": "high"}
    ).sort("analyzed_at", -1).limit(10).to_list(10)

    return {
        "success": True,
        "data": {
            "risk_distribution":     risk_dist,
            "top_threat_flags":      top_flags,
            "language_distribution": lang_dist,
            "recent_high_risk": [
                {
                    "email_id":          e.get("email_id"),
                    "employee_id_hash":  e.get("employee_id_hash"),
                    "flags":             e.get("flags", []),
                    "risk_score":        e.get("risk_score"),
                    "language_detected": e.get("language_detected"),
                    "analyzed_at":       str(e.get("analyzed_at", "")),
                }
                for e in recent_high
            ],
        },
    }