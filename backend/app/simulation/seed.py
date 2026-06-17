"""
Simulation seed — inserts all templates, fake employees, and initial profiles.
Run from backend/ directory:
    python -m app.simulation.seed
"""
import asyncio
import hashlib
import uuid
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))  # Add backend/ to path
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import get_password_hash


# ── helpers ──────────────────────────────────────────────────────────────────

def h(val: str) -> str:
    return hashlib.sha256(val.encode()).hexdigest()


# ── templates ────────────────────────────────────────────────────────────────

PHISHING_TEMPLATES = [
    {
        "template_id": "phish-001",
        "module": "phishing",
        "difficulty": "medium",
        "role_relevance": ["all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "sender_name": "RBI Security Helpdesk",
            "sender_email": "security@rbi-verify.in",
            "reply_to": "noreply@rbi-verify.in",
            "subject": "Urgent: Verify your {{department}} portal credentials",
                        "harvest_page_type": "rbi_portal",
            "body_html": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
<div style="background:#1a2b4a;padding:16px 20px;border-radius:6px 6px 0 0;margin:-24px -24px 20px;">
  <p style="color:#fff;font-size:13px;margin:0;font-weight:700;">RESERVE BANK OF INDIA — OFFICIAL COMMUNICATION</p>
</div>
<p>Dear {{employee_name}},</p>
<p>The Reserve Bank of India has issued a mandatory security verification for all bank employees as part of <strong>Circular RBI/2025/SEC-47</strong>. Your {{department}} portal access requires immediate verification before <strong>23:59 today</strong>.</p>
<p>Failure to verify within the deadline will result in temporary suspension of your system access pending manual review.</p>
<p style="text-align:center;margin:24px 0;">
  <a href="{{token}}" style="background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">Verify Credentials Now</a>
</p>
<p style="color:#6b7280;font-size:12px;">This link will expire in 4 hours. If you believe you received this in error, contact your branch manager.</p>
<p style="color:#6b7280;font-size:12px;">Reserve Bank of India — Regulated Entities Division<br>security@rbi-verify.in</p>
</div>""",
            "embedded_links": [{"link_id": str(uuid.uuid4()), "display_text": "Verify Credentials Now", "tracking_endpoint": "{{token}}", "is_trap": True}],
            "credential_harvest_page": True,
            "red_flags": ["spoofed domain rbi-verify.in", "urgency language", "requests credentials via link", "deadline pressure"],
            "correct_action": "report_to_security",
            "impersonation_target": "RBI",
        },
    },
    {
        "template_id": "phish-002",
        "module": "phishing",
        "difficulty": "high",
        "role_relevance": ["IT_admin", "all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "sender_name": "PSB IT Helpdesk",
            "sender_email": "helpdesk@psb-it-support.in",
            "reply_to": "noreply@psb-it-support.in",
            "subject": "CRITICAL: Your system password expires in 2 hours",
            "harvest_page_type": "internal_it",
            "body_html": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
<p><strong>PSB Internal IT Support</strong></p>
<p>Dear {{employee_name}},</p>
<p>Our systems show that your network account password <strong>expires in 2 hours</strong>. If you do not reset it, you will be locked out of all internal systems including CBS, HRMS, and email.</p>
<p>Reset immediately using the secure portal below:</p>
<p style="text-align:center;"><a href="{{token}}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">Reset Password Now</a></p>
<p style="font-size:12px;color:#6b7280;">IT Helpdesk | helpdesk@psb-it-support.in | Ext: 1234</p>
</div>""",
            "embedded_links": [{"link_id": str(uuid.uuid4()), "display_text": "Reset Password Now", "tracking_endpoint": "{{token}}", "is_trap": True}],
            "credential_harvest_page": True,
            "red_flags": ["spoofed domain psb-it-support.in", "urgency language", "credential request via link", "fake deadline"],
            "correct_action": "report_to_security",
            "impersonation_target": "IT Helpdesk",
        },
    },
    {
        "template_id": "phish-003",
        "module": "phishing",
        "difficulty": "low",
        "role_relevance": ["teller", "all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "sender_name": "UPI Payments Support",
            "sender_email": "support@upi-limit-update.in",
            "reply_to": "noreply@upi-limit-update.in",
            "subject": "Action Required: UPI Transaction Limit Update for {{bank_name}}",
            "harvest_page_type": "upi_verification",
            "body_html": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
<p>Dear {{employee_name}},</p>
<p>As per NPCI guidelines, your UPI transaction limits require annual re-verification. Please log in with your PSB credentials to update your UPI profile.</p>
<p style="text-align:center;"><a href="{{token}}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">Update UPI Limits</a></p>
<p style="font-size:12px;color:#6b7280;">NPCI / UPI Support | support@upi-limit-update.in</p>
</div>""",
            "embedded_links": [{"link_id": str(uuid.uuid4()), "display_text": "Update UPI Limits", "tracking_endpoint": "{{token}}", "is_trap": True}],
            "credential_harvest_page": True,
            "red_flags": ["spoofed domain upi-limit-update.in", "impersonating NPCI", "requests credentials"],
            "correct_action": "report_to_security",
            "impersonation_target": "NPCI/UPI",
        },
    },
    {
        "template_id": "phish-004",
        "module": "phishing",
        "difficulty": "medium",
        "role_relevance": ["all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "sender_name": "HR Department",
            "sender_email": "hr-salary@psb-payroll.in",
            "subject": "Your Salary Slip — April 2025 Available",
            "harvest_page_type": "hr_portal",
            "body_html": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
<p>Dear {{employee_name}},</p>
<p>Your April 2025 salary slip is ready. Please log in to the PSB Payroll Portal to view and download your slip.</p>
<p style="text-align:center;"><a href="{{token}}" style="background:#0f9d58;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">View Salary Slip</a></p>
<p style="font-size:12px;color:#6b7280;">HR Department | hr-salary@psb-payroll.in</p>
</div>""",
            "embedded_links": [{"link_id": str(uuid.uuid4()), "display_text": "View Salary Slip", "tracking_endpoint": "{{token}}", "is_trap": True}],
            "credential_harvest_page": True,
            "red_flags": ["spoofed domain psb-payroll.in", "credential harvest disguised as payroll portal"],
            "correct_action": "report_to_security",
            "impersonation_target": "HR/Payroll",
        },
    },
    {
        "template_id": "phish-005",
        "module": "phishing",
        "difficulty": "high",
        "role_relevance": ["all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "sender_name": "CERT-In Security Alert",
            "sender_email": "alert@cert-in-advisory.in",
            "subject": "CERT-In Advisory: Immediate Action Required for Your System",
            "harvest_page_type": "rbi_portal",
            "body_html": """<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
<p><strong style="color:#dc2626;">CERT-In Critical Advisory — CIVN-2025-0147</strong></p>
<p>Dear {{employee_name}},</p>
<p>CERT-In has identified a critical vulnerability in systems used by {{bank_name}}. You are required to verify your access credentials immediately to confirm system integrity.</p>
<p style="text-align:center;"><a href="{{token}}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">Verify System Access</a></p>
<p style="font-size:12px;color:#6b7280;">CERT-In | alert@cert-in-advisory.in</p>
</div>""",
            "embedded_links": [{"link_id": str(uuid.uuid4()), "display_text": "Verify System Access", "tracking_endpoint": "{{token}}", "is_trap": True}],
            "credential_harvest_page": True,
            "red_flags": ["spoofed domain cert-in-advisory.in (official is cert-in.org.in)", "urgency and authority manipulation", "credential request"],
            "correct_action": "report_to_security",
            "impersonation_target": "CERT-In",
        },
    },
]

SOCIAL_ENG_TEMPLATES = [
    {
        "template_id": "social-001",
        "module": "social_eng",
        "difficulty": "medium",
        "role_relevance": ["teller", "all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "memo_sender_name": "Rajesh Kumar, Internal Audit",
            "memo_sender_email": "r.kumar.audit@psb-internal.in",
            "memo_subject": "URGENT: Audit Access Request — Respond Within 2 Hours",
            "memo_body_html": "<p>Dear Team Member,</p><p>I am the assigned internal auditor for your branch this quarter. We have an RBI deadline in 2 hours and I need immediate access to verify your credentials. Please click the button below to begin the audit response procedure.</p><p>Regards,<br>Rajesh Kumar<br>Internal Audit Division</p>",
            "scenario_intro": "You have received an urgent memo from someone claiming to be an Internal Auditor. They are requesting your system credentials to complete an audit before an RBI deadline.",
            "nodes": {
                "1": {
                    "situation": "The auditor on the phone is insisting you provide your system credentials immediately to complete the audit before the RBI deadline in 2 hours. He says your manager has already approved this.",
                    "options": [
                        {"text": "Provide credentials to avoid audit failure", "next": "terminal_fail", "score": 0, "feedback": "Never share credentials — even with auditors. Real audits use official access request procedures through IT Helpdesk."},
                        {"text": "Ask for an official access request through IT Helpdesk", "next": "2", "score": 20, "feedback": "Correct instinct. All privileged access must go through official channels. Let's continue."},
                        {"text": "Hang up and report to your supervisor", "next": "2b", "score": 10, "feedback": "Good instinct but reporting to IT Security directly is the correct escalation path."},
                        {"text": "Hang up and call IT Security on the official directory number", "next": "terminal_pass", "score": 25, "feedback": "Perfect. This is exactly the right response."},
                    ],
                },
                "2": {
                    "situation": "You told the auditor to raise an IT Helpdesk request. He becomes aggressive and says 'Your manager has authorised this verbally — do you want to delay the RBI inspection?'",
                    "options": [
                        {"text": "Give the credentials since manager approved verbally", "next": "terminal_fail", "score": 0, "feedback": "Verbal approval from a manager does not override security policy. Credential requests always require formal documentation."},
                        {"text": "Remain firm and insist on official process", "next": "terminal_pass", "score": 25, "feedback": "Excellent. Staying firm under social pressure is the correct response."},
                        {"text": "Call the manager to verify approval", "next": "terminal_pass", "score": 20, "feedback": "Good — verifying with your manager is a solid response, though IT Security should still be notified."},
                    ],
                },
                "2b": {
                    "situation": "Your supervisor says they haven't heard anything about an audit today. What do you do next?",
                    "options": [
                        {"text": "Report the call to IT Security immediately", "next": "terminal_pass", "score": 25, "feedback": "Correct. This is the right escalation path."},
                        {"text": "Ignore it — probably a mistake", "next": "terminal_fail", "score": 0, "feedback": "Social engineering attempts should always be reported even if not acted upon."},
                    ],
                },
            },
            "red_flags": ["urgency pressure", "credential request", "unfamiliar caller", "bypasses official process", "verbal approval claim"],
            "correct_action": "report_to_IT_security",
        },
    },
    {
        "template_id": "social-002",
        "module": "social_eng",
        "difficulty": "high",
        "role_relevance": ["loan_officer", "all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "memo_sender_name": "Branch Manager",
            "memo_sender_email": "manager@psb-internal.in",
            "memo_subject": "Urgent: Approve Transaction for VIP Customer",
            "memo_body_html": "<p>Please handle this VIP customer transaction immediately. Full details in the scenario.</p>",
            "scenario_intro": "A customer at the counter claims they are a VIP client and their manager has approved a large cash withdrawal. They are becoming impatient.",
            "nodes": {
                "1": {
                    "situation": "A customer demands ₹5,00,000 cash withdrawal and claims their relationship manager 'Mr. Sharma' verbally approved bypassing the standard withdrawal limit for VIP clients.",
                    "options": [
                        {"text": "Process the withdrawal since the RM approved it", "next": "terminal_fail", "score": 0, "feedback": "Verbal RM approval does not override transaction limits. All limit overrides require written authorization."},
                        {"text": "Politely ask for written authorization and call the RM to verify", "next": "terminal_pass", "score": 25, "feedback": "Correct. Always verify via official channels and require written documentation for limit overrides."},
                        {"text": "Ask a senior colleague to handle it", "next": "2", "score": 10, "feedback": "Passing the issue is better than complying, but you should handle it through proper channels."},
                    ],
                },
                "2": {
                    "situation": "Your senior colleague also hesitates. The customer escalates and threatens to complain to the branch manager. What do you do?",
                    "options": [
                        {"text": "Process the transaction to avoid complaint", "next": "terminal_fail", "score": 0, "feedback": "Customer pressure and complaint threats must never influence security decisions."},
                        {"text": "Politely explain limits and direct the customer to the branch manager", "next": "terminal_pass", "score": 25, "feedback": "Correct. Involving the branch manager through official channels is appropriate."},
                    ],
                },
            },
            "red_flags": ["verbal authorization claim", "urgency pressure", "VIP pressure", "threat of complaint"],
            "correct_action": "verify_via_official_channels",
        },
    },
    {
        "template_id": "social-003",
        "module": "social_eng",
        "difficulty": "medium",
        "role_relevance": ["IT_admin", "all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "memo_sender_name": "Priya Iyer, Systems Team",
            "memo_sender_email": "p.iyer.sys@psb-internal.in",
            "memo_subject": "Quick Favour — Can You Log Me In?",
            "memo_body_html": "<p>Hi, I'm working remotely and my access token isn't working. Can you log into the admin console for me? It's urgent.</p>",
            "scenario_intro": "A colleague from IT says they are working from home and needs you to log into an admin system on their behalf.",
            "nodes": {
                "1": {
                    "situation": "Your colleague asks you to use your admin credentials to log in and make a configuration change on their behalf since their remote access is broken.",
                    "options": [
                        {"text": "Log in and help since you trust the colleague", "next": "terminal_fail", "score": 0, "feedback": "Sharing access or acting on behalf of another user is strictly prohibited. Each action must be tied to the responsible user's own credentials."},
                        {"text": "Suggest they raise a ticket with IT Helpdesk to fix their access", "next": "terminal_pass", "score": 25, "feedback": "Correct. The proper resolution is restoring their legitimate access, not sharing yours."},
                        {"text": "Ask them to come into the office", "next": "2", "score": 15, "feedback": "Reasonable but incomplete — you should also report this request to IT Security."},
                    ],
                },
                "2": {
                    "situation": "The colleague insists it will only take 5 minutes and promises to raise a ticket later. They mention a senior manager is waiting for the change.",
                    "options": [
                        {"text": "Do it quickly since a senior is waiting", "next": "terminal_fail", "score": 0, "feedback": "Senior authority pressure is a classic social engineering tactic. Security policy applies regardless of who is waiting."},
                        {"text": "Decline and escalate the request to your supervisor", "next": "terminal_pass", "score": 25, "feedback": "Perfect response."},
                    ],
                },
            },
            "red_flags": ["credential sharing request", "urgency pressure", "colleague trust exploitation", "senior authority claim"],
            "correct_action": "decline_and_report",
        },
    },
]

INCIDENT_DRILL_TEMPLATES = [
    {
        "template_id": "incident-001",
        "module": "incident_drill",
        "difficulty": "medium",
        "role_relevance": ["all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "alert_sender": "PSB IT Security Operations",
            "alert_subject": "URGENT: Suspicious Login Activity Detected on Your Account",
            "alert_body_html": "<p><strong>SECURITY ALERT:</strong> Three failed login attempts were detected on your account from an unrecognized device (IP: 103.21.244.17, Location: Chennai) at 03:42 AM. Immediate action required.</p><p>Please file an incident report immediately using the button below.</p>",
            "trigger_scenario": "Three failed login attempts were detected on your account from an unrecognized device at 03:42 AM. Please file an incident report immediately.",
            "time_limit_seconds": 300,
            "required_fields": ["incident_type", "affected_system", "time_detected", "description", "immediate_action_taken", "escalation_path"],
            "correct_escalation_path": "IT Security Team → CISO → Branch Manager",
            "scoring_rubric": {"completeness": 40, "time_bonus": 20, "correct_escalation": 30, "detail_quality": 10},
        },
    },
    {
        "template_id": "incident-002",
        "module": "incident_drill",
        "difficulty": "high",
        "role_relevance": ["teller", "loan_officer", "all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "alert_sender": "PSB CBS Security Monitor",
            "alert_subject": "ALERT: Unusual After-Hours Bulk Transfer Detected",
            "alert_body_html": "<p><strong>CBS SECURITY ALERT:</strong> An unusual bulk transfer of ₹47,00,000 was initiated from your branch after business hours (22:15). Your credentials were used. Report immediately.</p>",
            "trigger_scenario": "An unusual bulk transfer of ₹47,00,000 was initiated from your branch after business hours using credentials associated with your profile. File an incident report immediately.",
            "time_limit_seconds": 300,
            "required_fields": ["incident_type", "affected_system", "time_detected", "description", "immediate_action_taken", "escalation_path"],
            "correct_escalation_path": "IT Security Team → CISO → Branch Manager",
            "scoring_rubric": {"completeness": 40, "time_bonus": 20, "correct_escalation": 30, "detail_quality": 10},
        },
    },
    {
        "template_id": "incident-003",
        "module": "incident_drill",
        "difficulty": "low",
        "role_relevance": ["IT_admin", "all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "alert_sender": "PSB Endpoint Security",
            "alert_subject": "ALERT: Malware Indicators Detected on Your Workstation",
            "alert_body_html": "<p><strong>ENDPOINT ALERT:</strong> Suspicious process activity consistent with malware was detected on your workstation (WS-BRN-0042) at 11:30 AM today. Do not shut down the system. File an incident report immediately.</p>",
            "trigger_scenario": "Suspicious process activity consistent with known malware signatures was detected on your workstation. Do not power off the device. File an incident report immediately.",
            "time_limit_seconds": 300,
            "required_fields": ["incident_type", "affected_system", "time_detected", "description", "immediate_action_taken", "escalation_path"],
            "correct_escalation_path": "IT Security Team → CISO → Branch Manager",
            "scoring_rubric": {"completeness": 40, "time_bonus": 20, "correct_escalation": 30, "detail_quality": 10},
        },
    },
    {
        "template_id": "incident-004",
        "module": "incident_drill",
        "difficulty": "high",
        "role_relevance": ["all"],
        "source": "manual",
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "content": {
            "alert_sender": "PSB DLP Monitor",
            "alert_subject": "ALERT: Unauthorized Data Export Attempt Blocked",
            "alert_body_html": "<p><strong>DLP ALERT:</strong> Your account attempted to export a file containing 12,000 customer records to an external USB device at 14:22. The transfer was blocked. This may be unauthorized access. File an incident report immediately.</p>",
            "trigger_scenario": "Your account attempted to export a file containing customer PII to an unauthorized external device. The transfer was blocked by DLP. File an incident report.",
            "time_limit_seconds": 300,
            "required_fields": ["incident_type", "affected_system", "time_detected", "description", "immediate_action_taken", "escalation_path"],
            "correct_escalation_path": "IT Security Team → CISO → Branch Manager",
            "scoring_rubric": {"completeness": 40, "time_bonus": 20, "correct_escalation": 30, "detail_quality": 10},
        },
    },
]

FAKE_EMPLOYEES = [
    {"name": "Madhur", "email": "madhurprakash2005@gmail.com", "department": "IT", "role": "IT_admin"},
    {"name": "Arjun Mehta", "email": "arjun.mehta@psb-test.in", "department": "Retail Banking", "role": "teller"},
    {"name": "Priya Sharma", "email": "priya.sharma@psb-test.in", "department": "Loans", "role": "loan_officer"},
    {"name": "Kiran Rao", "email": "kiran.rao@psb-test.in", "department": "IT", "role": "IT_admin"},
    {"name": "Neha Joshi", "email": "neha.joshi@psb-test.in", "department": "Retail Banking", "role": "teller"},
    {"name": "Rahul Singh", "email": "rahul.singh@psb-test.in", "department": "Loans", "role": "loan_officer"},
    {"name": "Ananya Patel", "email": "ananya.patel@psb-test.in", "department": "Compliance", "role": "compliance_officer"},
    {"name": "Vikram Nair", "email": "vikram.nair@psb-test.in", "department": "IT", "role": "IT_admin"},
    {"name": "Sunita Gupta", "email": "sunita.gupta@psb-test.in", "department": "Retail Banking", "role": "teller"},
    {"name": "Manish Reddy", "email": "manish.reddy@psb-test.in", "department": "Operations", "role": "teller"},
    {"name": "Deepa Iyer", "email": "deepa.iyer@psb-test.in", "department": "Loans", "role": "loan_officer"},
    {"name": "Amit Verma", "email": "amit.verma@psb-test.in", "department": "IT", "role": "IT_admin"},
    {"name": "Kavya Shetty", "email": "kavya.shetty@psb-test.in", "department": "Retail Banking", "role": "teller"},
    {"name": "Suresh Pillai", "email": "suresh.pillai@psb-test.in", "department": "Operations", "role": "teller"},
    {"name": "Ritu Kapoor", "email": "ritu.kapoor@psb-test.in", "department": "Compliance", "role": "compliance_officer"},
    {"name": "Naveen Kumar", "email": "naveen.kumar@psb-test.in", "department": "Loans", "role": "loan_officer"},
    {"name": "Pooja Agarwal", "email": "pooja.agarwal@psb-test.in", "department": "Retail Banking", "role": "teller"},
    {"name": "Rajesh Bhat", "email": "rajesh.bhat@psb-test.in", "department": "IT", "role": "IT_admin"},
    {"name": "Swati Mishra", "email": "swati.mishra@psb-test.in", "department": "Operations", "role": "teller"},
    {"name": "Arun Desai", "email": "arun.desai@psb-test.in", "department": "Loans", "role": "loan_officer"},
    {"name": "Meena Krishnan", "email": "meena.krishnan@psb-test.in", "department": "Retail Banking", "role": "teller"},
    {"name": "Nandika G", "email": "naragottanochill@gmail.com", "department": "IT", "role": "IT_admin"},
]


async def seed():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    print(f"Connected to MongoDB: {settings.MONGODB_DB_NAME}")

    # Ensure hashed_phone index is a partial index (excludes null/absent).
    # The regular unique index causes DuplicateKeyError when multiple users have no phone.
    existing_indexes = await db.users.index_information()
    if "hashed_phone_1" in existing_indexes:
        info = existing_indexes["hashed_phone_1"]
        is_partial = "partialFilterExpression" in info
        if not is_partial:
            await db.users.drop_index("hashed_phone_1")
            # Unset any explicit null values so existing docs don't conflict
            await db.users.update_many({"hashed_phone": None}, {"$unset": {"hashed_phone": ""}})
            await db.users.create_index(
                "hashed_phone",
                name="hashed_phone_1",
                unique=True,
                partialFilterExpression={"hashed_phone": {"$type": "string"}},
            )
            print("hashed_phone_1 index rebuilt as partial unique index")

    # --- Templates ---
    all_templates = PHISHING_TEMPLATES + SOCIAL_ENG_TEMPLATES + INCIDENT_DRILL_TEMPLATES
    inserted_t = 0
    for tmpl in all_templates:
        existing = await db.simulation_templates.find_one({"template_id": tmpl["template_id"]})
        if not existing:
            await db.simulation_templates.insert_one(tmpl)
            inserted_t += 1
    print(f"Templates: {inserted_t} inserted (already existing skipped)")

    # --- Fake Employees ---
    inserted_e = 0
    patched_e = 0
    for emp in FAKE_EMPLOYEES:
        existing = await db.users.find_one({"email": emp["email"]})
        if not existing:
            emp_id = f"EMP-{str(uuid.uuid4())[:6].upper()}"
            emp_id_hash = h(emp_id)
            user_doc = {
                "user_id": str(uuid.uuid4()),
                "employee_id": emp_id,
                "employee_id_hash": emp_id_hash,
                "full_name": emp["name"],
                "email": emp["email"],
                "hashed_email": h(emp["email"].strip().lower()),
                "phone": "",
                "department": emp["department"],
                "role": emp["role"],
                "password_hash": get_password_hash("SimTest@2025"),
                "is_active": True,
                "theme_mode": "midnight",
                "accessibility_modes": [],
                "created_at": datetime.utcnow().isoformat(),
                "last_login": None,
                "kyc_status": "verified",
                "simulation_profile_ref": None,
            }
            result = await db.users.insert_one(user_doc)
            emp_id_hash_to_use = emp_id_hash
            user_oid = result.inserted_id
            inserted_e += 1
        else:
            emp_id_hash_to_use = existing.get("employee_id_hash")
            user_oid = existing["_id"]

        # Create simulation profile if missing (handles users inserted before a prior crash)
        if emp_id_hash_to_use:
            profile_exists = await db.employee_simulation_profiles.find_one(
                {"employee_id_hash": emp_id_hash_to_use}
            )
            if not profile_exists:
                profile = {
                    "employee_id_hash": emp_id_hash_to_use,
                    "department": emp["department"],
                    "role": emp["role"],
                    "certification_status": "needs_training",
                    "average_score": 0.0,
                    "total_attempts": 0,
                    "module_scores": {},
                    "module_attempt_counts": {},
                    "last_simulation": None,
                    "pam_trust_score": 0.6,
                    "flagged": False,
                    "flag_reason": None,
                    "history": [],
                    "_all_scores": [],
                }
                await db.employee_simulation_profiles.insert_one(profile)
                await db.users.update_one(
                    {"_id": user_oid},
                    {"$set": {"simulation_profile_ref": emp_id_hash_to_use}}
                )
                patched_e += 1

    print(f"Fake employees: {inserted_e} inserted, {patched_e} profiles backfilled")

    # --- Super Admin ---
    admin_id = "ADMIN-001"
    admin_doc = {
        "user_id": str(uuid.uuid4()),
        "employee_id": admin_id,
        "employee_id_hash": h(admin_id),
        "full_name": "Security Admin",
        "email": "admin@psb-sentinel.in",
        "hashed_email": h("admin@psb-sentinel.in"),
        "phone": "",
        "department": "Security",
        "role": "superadmin",
        "password_hash": get_password_hash("Admin@Sentinel2025"),
        "is_active": True,
        "theme_mode": "midnight",
        "accessibility_modes": [],
        "created_at": datetime.utcnow().isoformat(),
        "last_login": None,
        "kyc_status": "verified",
    }
    existing_admin = await db.users.find_one({"email": "admin@psb-sentinel.in"})
    if not existing_admin:
        await db.users.insert_one(admin_doc)
        print("Super admin created: admin@psb-sentinel.in / Admin@Sentinel2025")
    else:
        # Patch existing record — ensure hashed_email, password_hash, and role are current
        await db.users.update_one(
            {"email": "admin@psb-sentinel.in"},
            {"$set": {
                "hashed_email": h("admin@psb-sentinel.in"),
                "employee_id_hash": h(admin_id),
                "password_hash": get_password_hash("Admin@Sentinel2025"),
                "role": "superadmin",
                "is_active": True,
            }}
        )
        print("Super admin patched (hashed_email / credentials refreshed)")

    client.close()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
