"""Employee Notification Center - Aggregated alerts for employees."""
from fastapi import APIRouter, Depends
from app.core.database import get_database
from app.core.security import require_role
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,
)

router = APIRouter(prefix="/employee", tags=["Employee Notifications"])


@router.get("/notifications/summary")
async def get_notification_summary(
    current_user: dict = Depends(require_role("employee", "relationship_manager", "super_admin"))
):
    """
    Aggregated notification summary for employees.
    Returns counts of pending KYC, escalated KYC, pending loans, and fraud alerts.
    """
    log.info(f"Employee notification summary requested: by={current_user['email']} (role={current_user['role']})")
    db = get_database()

    # KYC: Count pending and escalated
    kyc_pending = await db.kyc_documents.count_documents({"status": "pending_review"})
    kyc_escalated = await db.kyc_documents.count_documents({"status": "escalated"})

    # Loans: Count pending
    loans_pending = await db.loans.count_documents({"status": "pending"})

    # Fraud: Count pending review
    fraud_alerts = await db.fraud_logs.count_documents({"status": "pending_review"})

    # Calculate total
    total_alerts = kyc_pending + kyc_escalated + loans_pending + fraud_alerts

    log.info(
        f"Notification summary: kyc_pending={kyc_pending}, kyc_escalated={kyc_escalated}, "
        f"loans_pending={loans_pending}, fraud_alerts={fraud_alerts}, total={total_alerts}"
    )

    return {
        "kyc_pending": kyc_pending,
        "kyc_escalated": kyc_escalated,
        "loans_pending": loans_pending,
        "fraud_alerts": fraud_alerts,
        "total_alerts": total_alerts,
    }
