"""Employee Portal API routes — these appear as normal banking portal endpoints."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.database import get_database
from app.core.security import get_current_user, verify_password, create_access_token
from app.services.deterministic_hash import generate_deterministic_hash
from app.helper.utils import decrypt_user_data
from app.simulation.models.simulation import StandardResponse
from app.simulation.services.campaign_service import log_action

router = APIRouter(prefix="/portal", tags=["portal"])


class PortalLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def portal_login(body: PortalLoginRequest):
    """Lightweight login for sentinel employee portal — no sessions, no device detection."""
    db = get_database()
    hashed_email = generate_deterministic_hash(body.email)
    user = await db.users.find_one({"hashed_email": hashed_email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        user = decrypt_user_data(user)
    except Exception:
        pass

    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    user_id = str(user["_id"])
    access_token = create_access_token({"sub": user_id, "role": user.get("role", "employee")})

    return {
        "data": {
            "access_token": access_token,
            "user": {
                "id": user_id,
                "email": user.get("email", body.email),
                "full_name": user.get("full_name", "Employee"),
                "name": user.get("full_name", "Employee"),
                "role": user.get("role", "employee"),
                "department": user.get("department", ""),
                "employee_id": user.get("employee_id", ""),
                "kyc_status": user.get("kyc_status", "verified"),
            },
        }
    }

# Static fake benign emails always present in every inbox
_FAKE_EMAILS = [
    {
        "email_id": "fake-001",
        "sender_name": "HR Department",
        "sender_email": "hr@psb-internal.in",
        "subject": "Reminder: Annual Leave Balance Update — FY 2025-26",
        "preview": "Dear Team, Please review your leave balance before the quarter closes...",
        "body_html": "<p>Dear Team,</p><p>This is a reminder to review your annual leave balance before the end of Q2. Unused leave beyond the carry-forward limit will lapse on 30th September 2025.</p><p>Login to the HR portal to check your balance and apply for leave.</p><p>Regards,<br>HR Department<br>Punjab &amp; Sind Bank</p>",
        "timestamp": "2025-05-24T09:15:00",
        "read": True,
        "reported": False,
        "is_simulation": False,
    },
    {
        "email_id": "fake-002",
        "sender_name": "IT Helpdesk",
        "sender_email": "helpdesk@psb-internal.in",
        "subject": "Action Required: Password Expiry in 30 Days",
        "preview": "Your system password will expire on 25th June 2025. Please reset it at your earliest convenience...",
        "body_html": "<p>Dear User,</p><p>This is an automated reminder that your network password will expire in <strong>30 days</strong> (25th June 2025).</p><p>Please reset your password by visiting the IT Self-Service Portal: <a href='#'>Change Password</a></p><p>If you require assistance, raise a ticket via the IT Support portal.</p><p>IT Helpdesk<br>Punjab &amp; Sind Bank</p>",
        "timestamp": "2025-05-23T14:30:00",
        "read": True,
        "reported": False,
        "is_simulation": False,
    },
    {
        "email_id": "fake-003",
        "sender_name": "Finance Team",
        "sender_email": "finance@psb-internal.in",
        "subject": "Expense Submission Deadline — 31st May 2025",
        "preview": "All Q1 expense claims must be submitted by 31st May. Late submissions will not be processed...",
        "body_html": "<p>Dear All,</p><p>This is a reminder that all Q1 FY2025-26 expense reimbursement claims must be submitted via the Finance Portal by <strong>31st May 2025</strong>.</p><p>Claims submitted after the deadline will be processed in the next cycle.</p><p>Please ensure all receipts are attached before submission.</p><p>Regards,<br>Finance Team</p>",
        "timestamp": "2025-05-22T11:00:00",
        "read": False,
        "reported": False,
        "is_simulation": False,
    },
    {
        "email_id": "fake-004",
        "sender_name": "Branch Manager",
        "sender_email": "manager@psb-internal.in",
        "subject": "Team Meeting — Monday 27th May, 10:00 AM",
        "preview": "Team, quick reminder about our weekly sync on Monday morning. Please come prepared with your weekly status...",
        "body_html": "<p>Team,</p><p>Quick reminder about our weekly sync meeting:</p><ul><li><strong>Date:</strong> Monday, 27th May 2025</li><li><strong>Time:</strong> 10:00 AM – 10:45 AM</li><li><strong>Venue:</strong> Conference Room B, Ground Floor</li></ul><p>Please come prepared with your weekly status update.</p><p>Regards,<br>Branch Manager</p>",
        "timestamp": "2025-05-21T16:45:00",
        "read": False,
        "reported": False,
        "is_simulation": False,
    },
    {
        "email_id": "fake-005",
        "sender_name": "Compliance Team",
        "sender_email": "compliance@psb-internal.in",
        "subject": "Q2 Compliance Training — Enrollment Open",
        "preview": "The Q2 mandatory compliance training modules are now open. Please complete all modules by 15th June...",
        "body_html": "<p>Dear Employee,</p><p>The Q2 FY2025-26 mandatory compliance training modules are now open for enrollment on the Learning Management System.</p><p><strong>Modules to complete by 15th June 2025:</strong></p><ul><li>AML/CFT Refresher (45 min)</li><li>Data Privacy &amp; DPDP Act Overview (30 min)</li><li>Customer Due Diligence Update (20 min)</li></ul><p>Non-completion will be flagged to HR. Please complete at the earliest.</p><p>Compliance Team<br>Punjab &amp; Sind Bank</p>",
        "timestamp": "2025-05-20T08:00:00",
        "read": True,
        "reported": False,
        "is_simulation": False,
    },
]


@router.get("/dashboard", response_model=StandardResponse)
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    data = {
        "employee": {
            # SENTINEL-AUDIT-FIX: seed stores full_name not name; fall back to name for safety
            "name": current_user.get("full_name") or current_user.get("name", "Employee"),
            "role": current_user.get("role", "teller"),
            "department": current_user.get("department", "Operations"),
            "employee_id": current_user.get("employee_id", "EMP-0001"),
        },
        "pending_approvals": 7,
        "activity_feed": [
            {"icon": "wrench", "text": "System maintenance scheduled for Sunday 02:00–04:00 AM.", "time": "2h ago"},
            {"icon": "file", "text": "Updated KYC procedure circular issued by Compliance Team.", "time": "1d ago"},
            {"icon": "calendar", "text": "End of quarter reporting deadline: 31st May 2025.", "time": "2d ago"},
            {"icon": "bell", "text": "New circular from RBI regarding UPI transaction limits.", "time": "3d ago"},
        ],
        "quick_links": [
            {"label": "HR Portal", "icon": "users", "url": "#"},
            {"label": "IT Support", "icon": "headset", "url": "/it-support"},
            {"label": "Expense Claims", "icon": "receipt", "url": "#"},
            {"label": "Policy Library", "icon": "book", "url": "#"},
        ],
        "unread_mail_count": 2,
    }
    return StandardResponse(success=True, data=data)


@router.get("/inbox", response_model=StandardResponse)
async def get_inbox(current_user: dict = Depends(get_current_user)):
    db = get_database()
    employee_id_hash = current_user.get("employee_id_hash") or _hash_email(current_user.get("email", ""))

    sim_emails = await db.sim_inbox_emails.find(
        {"employee_id_hash": employee_id_hash}
    ).sort("timestamp", -1).to_list(length=50)

    for e in sim_emails:
        e["_id"] = str(e["_id"]) if "_id" in e else None

    merged = list(_FAKE_EMAILS) + [
        {
            "email_id": e.get("email_id"),
            "sender_name": e.get("sender_name"),
            "sender_email": e.get("sender_email"),
            "subject": e.get("subject"),
            "preview": e.get("preview", ""),
            "timestamp": e.get("timestamp"),
            "read": e.get("read", False),
            "reported": e.get("reported", False),
            "is_simulation": e.get("is_simulation", True),
        }
        for e in sim_emails
    ]

    merged.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return StandardResponse(success=True, data={"emails": merged, "unread_count": sum(1 for e in merged if not e.get("read"))})


@router.get("/inbox/{email_id}", response_model=StandardResponse)
async def get_email(email_id: str, current_user: dict = Depends(get_current_user)):
    # Check static fake emails first
    for e in _FAKE_EMAILS:
        if e["email_id"] == email_id:
            return StandardResponse(success=True, data=e)

    db = get_database()
    employee_id_hash = current_user.get("employee_id_hash") or _hash_email(current_user.get("email", ""))
    email = await db.sim_inbox_emails.find_one({"email_id": email_id, "employee_id_hash": employee_id_hash})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    email["_id"] = str(email["_id"])

    # Log email_opened action if this is a simulation email with an attempt
    if email.get("is_simulation") and email.get("attempt_id") and not email.get("read"):
        await log_action(db, email["attempt_id"], "email_opened")
        await db.sim_inbox_emails.update_one({"email_id": email_id}, {"$set": {"read": True}})

    return StandardResponse(success=True, data=email)


@router.post("/inbox/{email_id}/report", response_model=StandardResponse)
async def report_email(email_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    employee_id_hash = current_user.get("employee_id_hash") or _hash_email(current_user.get("email", ""))
    email = await db.sim_inbox_emails.find_one({"email_id": email_id, "employee_id_hash": employee_id_hash})

    if not email:
        return StandardResponse(success=True, data={"message": "Report received"})

    if email.get("is_simulation") and email.get("attempt_id"):
        from app.simulation.services.scoring import score_phishing
        from app.simulation.services.campaign_service import complete_attempt

        await log_action(db, email["attempt_id"], "reported_phishing")
        attempt = await db.simulation_attempts.find_one({"attempt_id": email["attempt_id"]})
        if attempt and not attempt.get("completed_at"):
            started = datetime.fromisoformat(attempt["started_at"])
            score, passed = score_phishing(
                attempt.get("actions", []) + [{"action": "reported_phishing"}],
                datetime.utcnow(),
                started,
            )
            await complete_attempt(db, email["attempt_id"], score, passed)

    await db.sim_inbox_emails.update_one({"email_id": email_id}, {"$set": {"reported": True}})
    return StandardResponse(success=True, data={"message": "Email reported to security team"})


def _hash_email(email: str) -> str:
    import hashlib
    return hashlib.sha256(email.encode()).hexdigest()
