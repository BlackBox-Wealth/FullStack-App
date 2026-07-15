import os
import uuid
import random
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from app.core.database import get_database
from app.core.config import settings
from app.simulation.services.token_service import create_tracking_token
from app.simulation.services.email_service import send_simulation_email
from app.simulation.services.report_generator import generate_report, build_report_email_html
from app.simulation.services.email_service import send_report_email
from app.simulation.services.scoring import update_profile_after_attempt
from jinja2 import Template


async def pick_template_for_employee(db, module: str, role: str, template_id: Optional[str] = None) -> Optional[Dict]:
    if template_id and template_id != 'random':
        return await db.simulation_templates.find_one({"template_id": template_id, "active": True})

    query = {
        "module": module,
        "active": True,
        "role_relevance": {"$in": [role, "all"]},
    }
    templates = await db.simulation_templates.find(query).to_list(length=100)
    return random.choice(templates) if templates else None


async def create_assignment(
    db,
    campaign_id: str,
    employee_id_hash: str,
    template: Dict,
    due_in_hours: int,
    triggered_by: str,
) -> Dict:
    assignment_id = str(uuid.uuid4())
    attempt_id = str(uuid.uuid4())
    now = datetime.utcnow()
    due_by = now + timedelta(hours=due_in_hours)

    token = create_tracking_token(
        attempt_id=attempt_id,
        assignment_id=assignment_id,
        employee_id_hash=employee_id_hash,
        module=template["module"],
    )

    assignment = {
        "assignment_id": assignment_id,
        "campaign_id": campaign_id,
        "employee_id_hash": employee_id_hash,
        "template_id": template["template_id"],
        "module": template["module"],
        "assigned_at": now.isoformat(),
        "due_by": due_by.isoformat(),
        "email_delivery_status": "pending",
        "delivery_timestamp": None,
        "status": "pending",
        "attempt_id": attempt_id,
        "tracking_token": token,
    }

    await db.simulation_assignments.insert_one(assignment)

    attempt = {
        "attempt_id": attempt_id,
        "assignment_id": assignment_id,
        "employee_id_hash": employee_id_hash,
        "department": None,
        "role": None,
        "template_id": template["template_id"],
        "module": template["module"],
        "difficulty": template.get("difficulty", "medium"),
        "started_at": now.isoformat(),
        "completed_at": None,
        "duration_ms": None,
        "actions": [],
        "score": None,
        "passed": None,
        "report_delivered": False,
        "report_delivered_at": None,
    }
    await db.simulation_attempts.insert_one(attempt)
    return assignment


async def deliver_phishing_email(db, assignment: Dict, template: Dict, employee_email: str, employee_name: str, department: str):
    content = template.get("content", {})
    body_html = content.get("body_html", "")
    tracking_token = assignment["tracking_token"]

    frontend_url = settings.MOCK_PORTAL_BASE_URL.rstrip("/")
    body_html = (
        body_html
        .replace("{{employee_name}}", employee_name)
        .replace("{{department}}", department)
        .replace("{{bank_name}}", "Punjab & Sind Bank")
    )

    tracking_url = f"{frontend_url}/phishing?token={tracking_token}"
    for link in content.get("embedded_links", []):
        if link.get("is_trap"):
            body_html = body_html.replace(
                link.get("tracking_endpoint", ""),
                tracking_url,
            )
    body_html = body_html.replace("{{token}}", tracking_url)

    success, msg_id = await send_simulation_email(
        to_address=employee_email,
        subject=content.get("subject", "Important: Action Required").replace("{{department}}", department),
        html_body=body_html,
        from_name=content.get("sender_name", "PSB Security"),
        from_address=content.get("sender_email", "security@psb-internal.in"),
    )

    status = "delivered" if success else "failed"
    await db.simulation_assignments.update_one(
        {"assignment_id": assignment["assignment_id"]},
        {"$set": {"email_delivery_status": status, "delivery_timestamp": datetime.utcnow().isoformat()}},
    )

    inbox_email = {
        "email_id": str(uuid.uuid4()),
        "employee_id_hash": assignment["employee_id_hash"],
        "assignment_id": assignment["assignment_id"],
        "attempt_id": assignment["attempt_id"],
        "tracking_token": tracking_token,
        "is_simulation": True,
        "module": template["module"],
        "sender_name": content.get("sender_name", "PSB Security"),
        "sender_email": content.get("sender_email", "security@psb-internal.in"),
        "subject": content.get("subject", "Important Notice").replace("{{department}}", department),
        "body_html": body_html,
        "preview": (body_html[:120] + "...") if len(body_html) > 120 else body_html,
        "timestamp": datetime.utcnow().isoformat(),
        "read": False,
        "reported": False,
    }
    await db.sim_inbox_emails.insert_one(inbox_email)


async def deliver_social_eng_email(db, assignment: Dict, template: Dict, employee_email: str, employee_name: str, department: str):
    content = template.get("content", {})
    tracking_token = assignment["tracking_token"]
    frontend_url = settings.MOCK_PORTAL_BASE_URL.rstrip("/")

    base_body = content.get("memo_body_html", "<p>Please review the attached request.</p>")
    base_body = (
        base_body
        .replace("{{employee_name}}", employee_name)
        .replace("{{department}}", department)
    )
    cta_url = f"{frontend_url}/phishing?token={tracking_token}"
    body_html = base_body + f"""
<p style="text-align:center;margin:24px 0;">
  <a href="{cta_url}" style="background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">Respond to Request</a>
</p>"""

    success, _ = await send_simulation_email(
        to_address=employee_email,
        subject=content.get("memo_subject", "Internal Request — Action Required"),
        html_body=body_html,
        from_name=content.get("memo_sender_name", "PSB Internal"),
        from_address=content.get("memo_sender_email", "internal@psb-internal.in"),
    )

    status = "delivered" if success else "failed"
    await db.simulation_assignments.update_one(
        {"assignment_id": assignment["assignment_id"]},
        {"$set": {"email_delivery_status": status, "delivery_timestamp": datetime.utcnow().isoformat()}},
    )

    inbox_email = {
        "email_id": str(uuid.uuid4()),
        "employee_id_hash": assignment["employee_id_hash"],
        "assignment_id": assignment["assignment_id"],
        "attempt_id": assignment["attempt_id"],
        "tracking_token": tracking_token,
        "is_simulation": True,
        "module": template["module"],
        "sender_name": content.get("memo_sender_name", "PSB Internal"),
        "sender_email": content.get("memo_sender_email", "internal@psb-internal.in"),
        "subject": content.get("memo_subject", "Internal Request — Action Required"),
        "body_html": body_html,
        "preview": (base_body[:120] + "...") if len(base_body) > 120 else base_body,
        "timestamp": datetime.utcnow().isoformat(),
        "read": False,
        "reported": False,
    }
    await db.sim_inbox_emails.insert_one(inbox_email)


async def deliver_incident_drill_email(db, assignment: Dict, template: Dict, employee_email: str, employee_name: str, department: str):
    content = template.get("content", {})
    tracking_token = assignment["tracking_token"]
    frontend_url = settings.MOCK_PORTAL_BASE_URL.rstrip("/")

    base_body = content.get("alert_body_html", "<p>A security incident requires your immediate response.</p>")
    base_body = (
        base_body
        .replace("{{employee_name}}", employee_name)
        .replace("{{department}}", department)
    )
    cta_url = f"{frontend_url}/phishing?token={tracking_token}"
    body_html = base_body + f"""
<p style="text-align:center;margin:24px 0;">
  <a href="{cta_url}" style="background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">File Incident Report</a>
</p>"""

    success, _ = await send_simulation_email(
        to_address=employee_email,
        subject=content.get("alert_subject", "URGENT: Incident Response Required"),
        html_body=body_html,
        from_name=content.get("alert_sender", "PSB Security Operations"),
        from_address="security-ops@psb-internal.in",
    )

    status = "delivered" if success else "failed"
    await db.simulation_assignments.update_one(
        {"assignment_id": assignment["assignment_id"]},
        {"$set": {"email_delivery_status": status, "delivery_timestamp": datetime.utcnow().isoformat()}},
    )

    inbox_email = {
        "email_id": str(uuid.uuid4()),
        "employee_id_hash": assignment["employee_id_hash"],
        "assignment_id": assignment["assignment_id"],
        "attempt_id": assignment["attempt_id"],
        "tracking_token": tracking_token,
        "is_simulation": True,
        "module": template["module"],
        "sender_name": content.get("alert_sender", "PSB Security Operations"),
        "sender_email": "security-ops@psb-internal.in",
        "subject": content.get("alert_subject", "URGENT: Incident Response Required"),
        "body_html": body_html,
        "preview": (base_body[:120] + "...") if len(base_body) > 120 else base_body,
        "timestamp": datetime.utcnow().isoformat(),
        "read": False,
        "reported": False,
    }
    await db.sim_inbox_emails.insert_one(inbox_email)


async def log_action(db, attempt_id: str, action: str):
    await db.simulation_attempts.update_one(
        {"attempt_id": attempt_id},
        {"$push": {"actions": {"action": action, "timestamp": datetime.utcnow().isoformat()}}},
    )


async def complete_attempt(db, attempt_id: str, score: int, passed: bool):
    now = datetime.utcnow()
    attempt = await db.simulation_attempts.find_one({"attempt_id": attempt_id})
    if not attempt:
        return

    started = datetime.fromisoformat(attempt["started_at"])
    duration_ms = int((now - started).total_seconds() * 1000)

    await db.simulation_attempts.update_one(
        {"attempt_id": attempt_id},
        {"$set": {
            "completed_at": now.isoformat(),
            "duration_ms": duration_ms,
            "score": score,
            "passed": passed,
        }},
    )
    await db.simulation_assignments.update_one(
        {"attempt_id": attempt_id},
        {"$set": {"status": "completed"}},
    )

    attempt_updated = await db.simulation_attempts.find_one({"attempt_id": attempt_id})
    template = await db.simulation_templates.find_one({"template_id": attempt_updated.get("template_id")})

    user = await db.users.find_one({"employee_id_hash": attempt["employee_id_hash"]})
    employee_name = (user.get("full_name") or user.get("name", "Employee")) if user else "Employee"
    employee_email = user.get("email", "") if user else ""

    report_data = generate_report(attempt_updated, template or {}, employee_name)
    await db.analysis_reports.insert_one(report_data)

    if employee_email:
        sim_date = attempt_updated.get("started_at", "")[:10]
        # Prefer a contact email defined on the template content, otherwise use env var
        contact_email = (template or {}).get("content", {}).get("contact_email") or os.getenv("SECURITY_CONTACT_EMAIL", "security@psb-internal.in")
        html = build_report_email_html(report_data, employee_name, sim_date, contact_email)
        success, msg_id = await send_report_email(employee_email, html, sim_date)
        if success:
            await db.simulation_attempts.update_one(
                {"attempt_id": attempt_id},
                {"$set": {"report_delivered": True, "report_delivered_at": now.isoformat()}},
            )
            await db.analysis_reports.update_one(
                {"report_id": report_data["report_id"]},
                {"$set": {"delivered_at": now.isoformat(), "email_message_id": msg_id}},
            )

        report_inbox_email = {
            "email_id": str(uuid.uuid4()),
            "employee_id_hash": attempt["employee_id_hash"],
            "assignment_id": None,
            "attempt_id": attempt_id,
            "tracking_token": None,
            "is_simulation": False,
            "is_report": True,
            "module": attempt_updated.get("module"),
            "sender_name": "PSB Security Team",
            "sender_email": contact_email,
            "subject": f"Security Awareness Report — Action Required",
            "body_html": html if employee_email else "",
            "preview": "The simulation you received has concluded. View your full analysis report.",
            "timestamp": now.isoformat(),
            "read": False,
            "reported": False,
        }
        await db.sim_inbox_emails.insert_one(report_inbox_email)

    profile = await db.employee_simulation_profiles.find_one({"employee_id_hash": attempt["employee_id_hash"]})
    if profile:
        updated = update_profile_after_attempt(profile, {**attempt_updated, "score": score, "passed": passed})
        await db.employee_simulation_profiles.update_one(
            {"employee_id_hash": attempt["employee_id_hash"]},
            {"$set": updated},
        )
