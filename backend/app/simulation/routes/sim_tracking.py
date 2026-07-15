"""Token-based simulation tracking — no authentication required, accessed from email clients."""
import os
from fastapi import APIRouter
from app.core.config import settings
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Any
from app.core.database import get_database
from app.core.security import create_access_token
from app.simulation.services.token_service import decode_tracking_token
from app.simulation.services.campaign_service import log_action, complete_attempt
from app.simulation.services.scoring import score_phishing, score_social_eng, score_incident_drill
from app.simulation.models.simulation import ScenarioResponseRequest, IncidentSubmitRequest
from datetime import datetime, timedelta

router = APIRouter(prefix="/sim", tags=["sim-tracking"])

_FRONTEND = settings.SENTINEL_BASE_URL
_MOCK_FRONTEND = settings.MOCK_PORTAL_BASE_URL


# ─── Task context map keyed by harvest_page_type ───
_TASK_CONTEXT = {
    "hr_portal": {
        "task_title": "Pending HR Declaration",
        "task_description": "Complete your Annual Staff Declaration Form 2025",
        "task_cta": "Complete Declaration",
    },
    "internal_it": {
        "task_title": "Password Reset Required",
        "task_description": "Your portal password must be reset immediately per IT Security Policy",
        "task_cta": "Reset Password",
    },
    "rbi_portal": {
        "task_title": "RBI Verification Pending",
        "task_description": "Complete identity verification per RBI circular RE-SEC/2025/47",
        "task_cta": "Verify Identity",
    },
    "upi_verification": {
        "task_title": "UPI Limit Verification Required",
        "task_description": "Verify your UPI credentials to maintain transaction limits",
        "task_cta": "Verify Account",
    },
}


class BehaviorEventItem(BaseModel):
    type: str
    page: str
    data: Any = None
    ts: int


class BehaviorBatchRequest(BaseModel):
    events: List[BehaviorEventItem]


# ─── Mock Portal Session ──────────────────────────────────────────────────────

@router.get("/phishing/portal-session/{token}")
async def get_portal_session(token: str):
    """
    Called by the mock employee portal on page load.
    Validates the phishing tracking token and returns a portal JWT + employee + context.
    No existing employee account needed — works with fake employee data.
    """
    try:
        payload = decode_tracking_token(token)
    except ValueError:
        return JSONResponse({"detail": "Invalid or expired simulation link."}, status_code=400)

    db = get_database()
    attempt_id = payload["attempt_id"]
    employee_id_hash = payload.get("employee_id_hash", "")

    # Load the simulation attempt
    attempt = await db.simulation_attempts.find_one({"attempt_id": attempt_id})
    if not attempt:
        return JSONResponse({"detail": "Simulation attempt not found."}, status_code=404)

    # Load the template for context
    template = await db.simulation_templates.find_one({"template_id": attempt.get("template_id", "")})
    content = template.get("content", {}) if template else {}

    # Resolve harvest page type
    harvest_type = _resolve_harvest_type(content)
    task_ctx = _TASK_CONTEXT.get(harvest_type, _TASK_CONTEXT["hr_portal"])

    # Load fake employee data
    fake_emp = await db.fake_employees.find_one({"employee_id_hash": employee_id_hash})

    # Build user object from fake employee or attempt data
    if fake_emp:
        name = fake_emp.get("name", "Employee")
        email = fake_emp.get("email", "employee@psb.co.in")
        department = fake_emp.get("department", "Operations")
        emp_role = fake_emp.get("role", "teller")
        employee_id = fake_emp.get("employee_id", "EMP-0001")
    else:
        # fallback: use attempt metadata
        name = attempt.get("employee_name", "Employee")
        email = attempt.get("employee_email", "employee@psb.co.in")
        department = attempt.get("department", "Operations")
        emp_role = "employee"
        employee_id = f"EMP-{attempt_id[:6].upper()}"

    initials = "".join(w[0] for w in name.split()[:2]).upper() or "EP"

    # Find the real user by employee_id_hash so the JWT sub is a valid ObjectId
    real_user = await db.users.find_one({"employee_id_hash": employee_id_hash})
    if not real_user:
        # fallback: find by hashed email
        from app.services.deterministic_hash import generate_deterministic_hash
        hashed_email = generate_deterministic_hash(email)
        real_user = await db.users.find_one({"hashed_email": hashed_email})

    if real_user:
        token_sub = str(real_user["_id"])
        token_role = real_user.get("role", emp_role)
        # Prefer real user's verified email over fake_employee placeholder
        real_email = real_user.get("email") or real_user.get("hashed_email")
        if real_email and "@" in real_email:
            email = real_email
    else:
        # No real user — use a placeholder; admin API calls will 401 gracefully
        token_sub = employee_id_hash[:24].ljust(24, "0")
        token_role = emp_role

    # Issue a 4-hour access token (type:"access" is set automatically by create_access_token)
    portal_jwt = create_access_token(
        {"sub": token_sub, "role": token_role, "attempt_id": attempt_id},
        expires_delta=timedelta(hours=4),
    )

    # Log portal access; clicked_link is only logged by the external click-tracker endpoint
    await log_action(db, attempt_id, "portal_session_started")

    # Determine the phishing email ID for the mock inbox
    sim_email = await db.sim_inbox_emails.find_one({"attempt_id": attempt_id})
    phishing_email_id = sim_email.get("email_id", "phishing-sim") if sim_email else "phishing-sim"

    return {
        "jwt": portal_jwt,
        "user": {
            "id": employee_id_hash,
            "name": name,
            "email": email,
            "department": department,
            "role": emp_role,
            "employee_id": employee_id,
            "initials": initials,
        },
        "context": {
            "attempt_id": attempt_id,
            "campaign_id": attempt.get("campaign_id", ""),
            "template_id": attempt.get("template_id", ""),
            "harvest_page_type": harvest_type,
            "email_subject": content.get("subject", task_ctx["task_title"]),
            "sender_name": content.get("sender_name", "HR Department"),
            "sender_email": content.get("sender_email", "hr-policy@internal-psb-portal.in"),
            "task_title": task_ctx["task_title"],
            "task_description": task_ctx["task_description"],
            "task_cta": task_ctx["task_cta"],
            "phishing_email_id": phishing_email_id,
        },
    }


# ─── Behavior Tracking ────────────────────────────────────────────────────────

# Events that definitively end the simulation (only trigger complete_attempt once)
_TERMINAL_EVENTS = {
    "credentials_submitted",
    "task_completed",
    "reported_phishing",
}

# Score mapping for terminal events from mock portal
_TERMINAL_SCORES = {
    "reported_phishing": (80, True),    # reported WITHOUT submitting credentials → good outcome
    "credentials_submitted": (0, False),
    "task_completed": (0, False),        # completed the phishing task = worst outcome
}


@router.post("/behavior/{attempt_id}")
async def record_behavior_events(attempt_id: str, body: BehaviorBatchRequest):
    """Receives batched behavior events from the mock employee portal."""
    db = get_database()

    if not body.events:
        return {"success": True, "stored": 0}

    docs = [
        {
            "attempt_id": attempt_id,
            "event_type": e.type,
            "page": e.page,
            "event_data": e.data or {},
            "timestamp": datetime.utcfromtimestamp(e.ts / 1000).isoformat(),
        }
        for e in body.events
    ]

    await db.behavior_events.insert_many(docs)

    # Log critical events as simulation actions
    critical = {"credentials_submitted", "task_completed", "reported_phishing", "phishing_email_opened"}
    for e in body.events:
        if e.type in critical:
            await log_action(db, attempt_id, e.type)

    # Check if any terminal event arrives AND attempt not yet completed
    attempt = await db.simulation_attempts.find_one({"attempt_id": attempt_id})
    if attempt and not attempt.get("completed_at"):
        event_types = {e.type for e in body.events}
        terminal = event_types & _TERMINAL_EVENTS

        if terminal:
            # Pick the "worst" terminal event for scoring
            # Priority: task_completed > credentials_submitted > reported_phishing
            priority = ["task_completed", "credentials_submitted", "reported_phishing"]
            chosen = next((t for t in priority if t in terminal), None)

            if chosen:
                # Reporting phishing is always a pass; use score_phishing for accurate time-weighted score
                if chosen == "reported_phishing":
                    started_iso = attempt.get("started_at", datetime.utcnow().isoformat())
                    started_dt = datetime.fromisoformat(started_iso)
                    all_actions = attempt.get("actions", [])
                    score, passed = score_phishing(
                        all_actions + [{"action": "reported_phishing"}],
                        datetime.utcnow(),
                        started_dt,
                    )
                else:
                    score, passed = _TERMINAL_SCORES[chosen]

                await complete_attempt(db, attempt_id, score, passed)
                # After completing attempt, check if the whole campaign is done
                await _maybe_complete_campaign(db, attempt_id)

    return {"success": True, "stored": len(docs)}


async def _maybe_complete_campaign(db, attempt_id: str):
    """If every assignment in this attempt's campaign is completed/cancelled, mark campaign completed."""
    assignment = await db.simulation_assignments.find_one({"attempt_id": attempt_id})
    if not assignment:
        return

    campaign_id = assignment.get("campaign_id")
    if not campaign_id:
        return

    campaign = await db.simulation_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign or campaign.get("status") != "active":
        return

    # Count outstanding (non-terminal) assignments
    outstanding = await db.simulation_assignments.count_documents({
        "campaign_id": campaign_id,
        "status": {"$nin": ["completed", "cancelled", "expired"]},
    })

    if outstanding == 0:
        # All done — compute final pass rate and mark campaign completed
        total = await db.simulation_assignments.count_documents({"campaign_id": campaign_id})

        # Materialize assignment IDs (async generator can't be used inline)
        all_assignments = await db.simulation_assignments.find(
            {"campaign_id": campaign_id}, {"assignment_id": 1}
        ).to_list(length=None)
        assignment_ids = [a["assignment_id"] for a in all_assignments]

        passed_count = await db.simulation_attempts.count_documents({
            "assignment_id": {"$in": assignment_ids},
            "passed": True,
        })
        pass_rate = round((passed_count / total) * 100, 1) if total else 0

        await db.simulation_campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "pass_rate": pass_rate,
            }},
        )


def _resolve_harvest_type(content: dict) -> str:
    explicit = (content or {}).get("harvest_page_type")
    if explicit in {"rbi_portal", "internal_it", "upi_verification", "hr_portal"}:
        return explicit

    target = str((content or {}).get("impersonation_target", "")).lower()
    subject = str((content or {}).get("subject", "")).lower()
    sender = str((content or {}).get("sender_name", "")).lower()
    body = str((content or {}).get("body_html", "")).lower()

    if "upi" in target or "upi" in subject or "upi" in sender or "upi" in body:
        return "upi_verification"
    if "hr" in target or "payroll" in target or "salary" in subject or "payroll" in subject:
        return "hr_portal"
    if "it" in target or "password" in subject or "login" in subject or "helpdesk" in sender:
        return "internal_it"
    return "rbi_portal"

# ---- Phishing ----

@router.get("/phishing/click/{token}")
async def phishing_click(token: str):
    try:
        payload = decode_tracking_token(token)
    except ValueError:
        return RedirectResponse(url=f"{_FRONTEND}/portal/inbox")

    db = get_database()
    attempt_id = payload["attempt_id"]
    await log_action(db, attempt_id, "clicked_link")

    return RedirectResponse(url=f"{_MOCK_FRONTEND}/phishing?token={token}")


@router.post("/phishing/credentials/{token}")
async def phishing_credentials(token: str):
    try:
        payload = decode_tracking_token(token)
    except ValueError:
        # SENTINEL-AUDIT-FIX: use env-driven _FRONTEND var, not hardcoded localhost
        return JSONResponse({"redirect": f"{_FRONTEND}/portal/inbox"})

    db = get_database()
    attempt_id = payload["attempt_id"]
    await log_action(db, attempt_id, "submitted_credentials")

    attempt = await db.simulation_attempts.find_one({"attempt_id": attempt_id})
    if attempt and not attempt.get("completed_at"):
        started = datetime.fromisoformat(attempt["started_at"])
        score, passed = score_phishing(
            attempt.get("actions", []) + [{"action": "submitted_credentials"}],
            datetime.utcnow(),
            started,
        )
        await complete_attempt(db, attempt_id, score, passed)
        await _maybe_complete_campaign(db, attempt_id)

    return JSONResponse({"redirect": f"{_FRONTEND}/sentinel/landing/harvest/error"})


@router.get("/phishing/error", response_class=HTMLResponse)
async def phishing_error():
    return HTMLResponse(content="""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;text-align:center;padding:80px;">
<h2 style="color:#6b7280;">Service Temporarily Unavailable</h2>
<p style="color:#9ca3af;">We are unable to process your request at this time. Please try again later.</p>
<p style="color:#9ca3af;font-size:12px;">Error Code: 503 — Gateway Timeout</p>
</body></html>""")


# ---- Social Engineering ----

@router.get("/social/{token}")
async def get_scenario_node(token: str):
    try:
        payload = decode_tracking_token(token)
    except ValueError:
        return JSONResponse({"error": "Invalid token"}, status_code=400)

    db = get_database()
    attempt = await db.simulation_attempts.find_one({"attempt_id": payload["attempt_id"]})
    if not attempt:
        return JSONResponse({"error": "Attempt not found"}, status_code=404)

    template = await db.simulation_templates.find_one({"template_id": attempt["template_id"]})
    if not template:
        return JSONResponse({"error": "Template not found"}, status_code=404)

    content = template.get("content", {})
    nodes = content.get("nodes", {})
    current_node_id = attempt.get("current_node_id", "1")
    node = nodes.get(current_node_id)

    if not node:
        return JSONResponse({"error": "Node not found"}, status_code=404)

    # Strip feedback from options (shown only after response)
    safe_options = [{"text": o["text"], "index": i} for i, o in enumerate(node.get("options", []))]

    return JSONResponse({
        "success": True,
        "data": {
            "node_id": current_node_id,
            "situation": node.get("situation"),
            "options": safe_options,
            "scenario_title": content.get("scenario_intro", "Scenario"),
            "landing_page_title": content.get("landing_page_title", "PSB Internal Audit Portal"),
            "landing_page_subtitle": content.get("landing_page_subtitle", "Compliance Response System"),
            "completed": False,
        },
    })


@router.post("/social/respond/{token}")
async def respond_to_scenario(token: str, body: ScenarioResponseRequest):
    try:
        payload = decode_tracking_token(token)
    except ValueError:
        return JSONResponse({"error": "Invalid token"}, status_code=400)

    db = get_database()
    attempt_id = payload["attempt_id"]
    attempt = await db.simulation_attempts.find_one({"attempt_id": attempt_id})
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    template = await db.simulation_templates.find_one({"template_id": attempt["template_id"]})
    content = template.get("content", {}) if template else {}
    nodes = content.get("nodes", {})
    current_node_id = attempt.get("current_node_id", "1")
    node = nodes.get(current_node_id, {})
    options = node.get("options", [])

    if body.option_index >= len(options):
        return JSONResponse({"error": "Invalid option"}, status_code=400)

    chosen = options[body.option_index]
    feedback = chosen.get("feedback", "")
    next_node = chosen.get("next", "terminal_fail")
    await log_action(db, attempt_id, f"chose_option_{body.option_index}_node_{current_node_id}")

    # Track chosen options for scoring
    chosen_options = attempt.get("chosen_options", [])
    chosen_options.append(body.option_index)
    await db.simulation_attempts.update_one(
        {"attempt_id": attempt_id},
        {"$set": {"current_node_id": next_node, "chosen_options": chosen_options}},
    )

    is_terminal = next_node.startswith("terminal")
    response_data = {
        "feedback": feedback,
        "next_node_id": next_node,
        "completed": is_terminal,
    }

    if is_terminal:
        all_nodes = [nodes[str(i+1)] for i in range(len(nodes)) if str(i+1) in nodes]
        score, passed = score_social_eng(all_nodes, chosen_options)
        await complete_attempt(db, attempt_id, score, passed)
        response_data["score"] = score
        response_data["passed"] = passed
    else:
        next_node_data = nodes.get(next_node, {})
        safe_options = [{"text": o["text"], "index": i} for i, o in enumerate(next_node_data.get("options", []))]
        response_data["next_node"] = {
            "node_id": next_node,
            "situation": next_node_data.get("situation"),
            "options": safe_options,
        }

    return JSONResponse({"success": True, "data": response_data})


# ---- Incident Drill ----

@router.get("/incident/form/{token}")
async def get_incident_form(token: str):
    try:
        payload = decode_tracking_token(token)
    except ValueError:
        return JSONResponse({"error": "Invalid token"}, status_code=400)

    db = get_database()
    attempt = await db.simulation_attempts.find_one({"attempt_id": payload["attempt_id"]})
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    template = await db.simulation_templates.find_one({"template_id": attempt["template_id"]})
    content = template.get("content", {}) if template else {}

    return JSONResponse({
        "success": True,
        "data": {
            "trigger_scenario": content.get("trigger_scenario", "A security incident has been detected."),
            "time_limit_seconds": content.get("time_limit_seconds", 300),
            "required_fields": content.get("required_fields", []),
            "started_at": attempt.get("started_at"),
        },
    })


@router.post("/incident/submit/{token}")
async def submit_incident_form(token: str, body: IncidentSubmitRequest):
    try:
        payload = decode_tracking_token(token)
    except ValueError:
        return JSONResponse({"error": "Invalid token"}, status_code=400)

    db = get_database()
    attempt_id = payload["attempt_id"]
    attempt = await db.simulation_attempts.find_one({"attempt_id": attempt_id})
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    template = await db.simulation_templates.find_one({"template_id": attempt["template_id"]})
    content = template.get("content", {}) if template else {}

    started = datetime.fromisoformat(attempt["started_at"])
    elapsed = (datetime.utcnow() - started).total_seconds()

    fields = body.dict()
    score, passed = score_incident_drill(
        fields=fields,
        required_fields=content.get("required_fields", list(fields.keys())),
        correct_escalation=content.get("correct_escalation_path", ""),
        time_limit_seconds=content.get("time_limit_seconds", 300),
        elapsed_seconds=elapsed,
    )

    await log_action(db, attempt_id, "submitted_incident_report")
    await complete_attempt(db, attempt_id, score, passed)

    return JSONResponse({"success": True, "data": {"score": score, "passed": passed, "ticket_number": f"INC-{attempt_id[:8].upper()}"}})


# ---- Harvest Pages ----

def _build_harvest_page(token: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
<title>RBI Verification Portal — Secure Login</title>
<meta charset="utf-8">
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: Arial, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }}
.card {{ background: #fff; border-radius: 8px; padding: 40px; width: 420px; box-shadow: 0 2px 16px rgba(0,0,0,0.12); }}
.header {{ text-align: center; margin-bottom: 28px; }}
.header img {{ width: 60px; margin-bottom: 12px; }}
.header h2 {{ color: #1a2b4a; font-size: 20px; margin-bottom: 4px; }}
.header p {{ color: #6b7280; font-size: 13px; }}
.badge {{ background: #fef3c7; color: #92400e; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 20px; }}
.form-group {{ margin-bottom: 16px; }}
label {{ display: block; font-size: 13px; color: #374151; font-weight: 600; margin-bottom: 6px; }}
input {{ width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; }}
input:focus {{ border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.1); }}
button {{ width: 100%; padding: 12px; background: #1d4ed8; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; }}
.footer {{ text-align: center; margin-top: 20px; font-size: 11px; color: #9ca3af; }}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div style="width:60px;height:60px;background:#1a2b4a;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
      <span style="color:white;font-weight:800;font-size:18px;">RBI</span>
    </div>
    <h2>Reserve Bank of India</h2>
    <p>Regulated Entities Verification Portal</p>
  </div>
  <div style="text-align:center;">
    <div class="badge">⚠️ Verification Required</div>
  </div>
  <p style="color:#374151;font-size:14px;margin-bottom:20px;line-height:1.6;">Your institution requires immediate credential verification to comply with the latest RBI circular RE-SEC/2025/47. Please log in to confirm your identity.</p>
  <form id="form" method="post" action="">
    <div class="form-group">
      <label>Employee ID / Username</label>
      <input type="text" name="username" placeholder="Enter your Employee ID" required>
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" name="password" placeholder="Enter your password" required>
    </div>
    <button type="submit" id="btn">Verify Identity</button>
  </form>
  <div class="footer">
    Secured by RBI Verification Authority · rbi-verify.in<br>
    © 2025 Reserve Bank of India
  </div>
</div>
<script>
document.getElementById('form').addEventListener('submit', function(e) {{
  e.preventDefault();
  document.getElementById('btn').textContent = 'Verifying...';
  document.getElementById('btn').disabled = true;
  fetch('/api/sim/phishing/credentials/{token}', {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{submitted: true}})
  }}).then(r => r.json()).then(d => {{
    if (d.redirect) window.location.href = d.redirect;
    else window.location.href = '/api/sim/phishing/error';
  }}).catch(() => {{ window.location.href = '/api/sim/phishing/error'; }});
}});
</script>
</body>
</html>"""
