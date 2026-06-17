import json
import asyncio
from datetime import datetime
from app.core.redis_client import get_redis
from app.services.email_service import email_service
from logifyx import Logifyx

log = Logifyx(name="event_consumers")

async def handle_user_activity(event: dict):
    """Update cache or logs based on user activity."""
    action = event.get("action")
    user_id = event.get("user_id")
    log.info(f"Processing activity: {action} for user {user_id}")
    
    # Example: Update a "last seen" cache in Redis
    redis = get_redis()
    if redis:
        await redis.setex(f"last_seen:{user_id}", 86400, datetime.utcnow().isoformat())

async def handle_security_event(event: dict):
    """Handle security-related events like password resets or new device logins."""
    action = event.get("action")
    user_id = event.get("user_id")
    log.warning(f"SECURITY EVENT: {action} for user {user_id}")
    
    # We could trigger additional fraud analysis here
    await asyncio.sleep(0.1) 

async def handle_notification_request(event: dict):
    """Delegated task: Sending emails/SMS (simulated)."""
    recipient = event.get("recipient")
    content = event.get("content")
    notif_type = event.get("type", "email")
    
    log.info(f"Delegated Task: Sending {notif_type} to {recipient}")
    # In a real app, we'd call the email_service here
    await asyncio.sleep(0.5)
    log.info(f"Task Complete: {notif_type} sent successfully")

async def handle_performance_metric(event: dict):
    """Store performance metrics in Redis with a 20-minute sliding window."""
    redis = get_redis()
    if not redis:
        return
        
    now = datetime.utcnow().timestamp()
    metric_data = {
        **event,
        "recorded_at": datetime.utcnow().isoformat()
    }
    
    # Store in a Redis Sorted Set (score is timestamp)
    key = "system_performance_zset"
    await redis.zadd(key, {json.dumps(metric_data): now})
    
    # Remove metrics older than 20 minutes (1200 seconds)
    expiry_time = now - 1200
    await redis.zremrangebyscore(key, "-inf", expiry_time)
    
    log.debug(f"Performance metric indexed in Redis: {event.get('path')}")

async def handle_otp_verification(event: dict):
    """Handle OTP verification events."""
    user_email = event.get("user_email")
    otp_code = event.get("otp_code")
    log.info(f"Handling OTP verification for user {user_email}")

    await email_service.send_verification_email(user_email, otp_code)
    log.info(f"OTP verification completed for user {user_email}")


async def handle_simulation_email(event: dict):
    """Deliver a simulation email for any module type."""
    assignment_id = event.get("assignment_id")
    if not assignment_id:
        return

    from app.core.database import get_database
    from app.simulation.services.campaign_service import (
        deliver_phishing_email,
        deliver_social_eng_email,
        deliver_incident_drill_email,
    )

    db = get_database()
    assignment = await db.simulation_assignments.find_one({"assignment_id": assignment_id})
    if not assignment:
        log.warning(f"Sim email: assignment not found {assignment_id}")
        return

    module = assignment.get("module", "")
    template = await db.simulation_templates.find_one({"template_id": assignment.get("template_id")})
    if not template:
        log.warning(f"Sim email: template not found for assignment {assignment_id}")
        return

    user = await db.users.find_one({"employee_id_hash": assignment["employee_id_hash"]})
    if not user:
        log.warning(f"Sim email: user not found for assignment {assignment_id}")
        return

    email = user.get("email", "")
    name = user.get("full_name") or user.get("name", "Employee")
    dept = user.get("department", "Operations")

    if module == "phishing":
        await deliver_phishing_email(db, assignment, template, email, name, dept)
    elif module == "social_eng":
        await deliver_social_eng_email(db, assignment, template, email, name, dept)
    elif module == "incident_drill":
        await deliver_incident_drill_email(db, assignment, template, email, name, dept)
    else:
        log.warning(f"Sim email: unknown module '{module}' for assignment {assignment_id}")
        return

    log.info(f"Sim email dispatched — module={module}, assignment={assignment_id}")


def register_all_consumers():
    """Register all handlers with the KafkaService."""
    from app.core.kafka_service import kafka_service

    kafka_service.register_handler("user.activity", handle_user_activity)
    kafka_service.register_handler("user.security", handle_security_event)
    kafka_service.register_handler("system.notifications", handle_notification_request)
    kafka_service.register_handler("system.performance", handle_performance_metric)
    kafka_service.register_handler("email.otpVerification", handle_otp_verification)
    kafka_service.register_handler("simulation.email.deliver", handle_simulation_email)
    log.info("All Kafka event consumers registered")
