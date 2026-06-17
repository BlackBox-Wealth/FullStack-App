"""Super Admin simulation control panel routes."""
import uuid
import random
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Depends
from app.core.database import get_database
from app.core.security import require_role
from app.simulation.models.simulation import (
    StandardResponse, TriggerSingleRequest, TriggerBulkRequest, ThreatApprovalRequest
)
from app.simulation.services.campaign_service import (
    create_assignment, pick_template_for_employee,
)
from app.simulation.services.scraper import run_scraper_and_save
from app.core.kafka_service import kafka_service

_SENTINEL_ADMIN_ROLES = ("super_admin",)

router = APIRouter(prefix="/admin/sim", tags=["admin-sim"])


def _ok(data):
    return StandardResponse(success=True, data=data)


def _err(msg, code=400):
    raise HTTPException(status_code=code, detail=msg)


# ---- Overview ----

@router.get("/stats/overview", response_model=StandardResponse)
async def overview_stats(_admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    total_employees = await db.users.count_documents({"role": {"$in": ["employee", "teller", "loan_officer", "IT_admin"]}})
    now = datetime.utcnow()
    week_ago = (now.replace(hour=0, minute=0, second=0) - __import__("datetime").timedelta(days=7)).isoformat()
    active_this_week = await db.simulation_campaigns.count_documents({"created_at": {"$gte": week_ago}})
    total_attempts = await db.simulation_attempts.count_documents({"completed_at": {"$ne": None}})
    passed = await db.simulation_attempts.count_documents({"passed": True})
    pass_rate = round((passed / total_attempts) * 100, 1) if total_attempts else 0
    flagged_count = await db.employee_simulation_profiles.count_documents({"flagged": True})

    recent_campaigns_cursor = db.simulation_campaigns.find().sort("created_at", -1).limit(10)
    recent_campaigns = []
    async for c in recent_campaigns_cursor:
        c["_id"] = str(c["_id"])
        recent_campaigns.append(c)

    return _ok({
        "total_employees": total_employees,
        "active_simulations_this_week": active_this_week,
        "overall_pass_rate": pass_rate,
        "flagged_employees": flagged_count,
        "recent_campaigns": recent_campaigns,
    })


# ---- Employees ----

@router.get("/employees", response_model=StandardResponse)
async def list_employees(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    department: str = Query(None),
    flagged: bool = Query(None),
    certification: str = Query(None),
    _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES)),
):
    db = get_database()
    query = {}
    if department:
        query["department"] = department
    if flagged is not None:
        query["flagged"] = flagged
    if certification:
        query["certification_status"] = certification

    skip = (page - 1) * limit
    total = await db.employee_simulation_profiles.count_documents(query)
    profiles_cursor = db.employee_simulation_profiles.find(query).skip(skip).limit(limit)
    profiles = []
    async for p in profiles_cursor:
        p["_id"] = str(p["_id"])
        p.pop("history", None)
        profiles.append(p)

    hashes = [p["employee_id_hash"] for p in profiles]
    user_map: dict = {}
    async for u in db.users.find({"employee_id_hash": {"$in": hashes}}, {"employee_id_hash": 1, "full_name": 1, "name": 1, "email": 1}):
        user_map[u["employee_id_hash"]] = {
            "name": u.get("full_name") or u.get("name") or "",
            "email": u.get("email", ""),
        }
    for p in profiles:
        info = user_map.get(p["employee_id_hash"], {})
        p["name"] = info.get("name", "")
        p["email"] = info.get("email", "")

    return _ok({"profiles": profiles, "total": total, "page": page, "limit": limit})


@router.get("/employees/{employee_id_hash}", response_model=StandardResponse)
async def get_employee_detail(employee_id_hash: str, _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    profile = await db.employee_simulation_profiles.find_one({"employee_id_hash": employee_id_hash})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile["_id"] = str(profile["_id"])

    user = await db.users.find_one({"employee_id_hash": employee_id_hash}, {"full_name": 1, "name": 1, "email": 1})
    if user:
        profile["name"] = user.get("full_name") or user.get("name") or ""
        profile["email"] = user.get("email", "")

    attempts_cursor = db.simulation_attempts.find({"employee_id_hash": employee_id_hash}).sort("started_at", -1).limit(20)
    history = []
    async for a in attempts_cursor:
        a["_id"] = str(a["_id"])
        history.append(a)

    return _ok({"profile": profile, "attempt_history": history})


# ---- Campaigns ----

@router.post("/campaigns/single", response_model=StandardResponse)
async def trigger_single(body: TriggerSingleRequest, _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    profile = await db.employee_simulation_profiles.find_one({"employee_id_hash": body.employee_id_hash})
    role = profile.get("role", "all") if profile else "all"

    template = await pick_template_for_employee(db, body.module.value, role, body.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="No active template available for this module/role")

    existing = await db.simulation_assignments.find_one({
        "employee_id_hash": body.employee_id_hash,
        "status": {"$in": ["pending", "in_progress"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="Employee already has an active simulation assignment")

    campaign_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    campaign = {
        "campaign_id": campaign_id,
        "name": f"Manual Single — {body.module.value}",
        "trigger_type": "manual_single",
        "triggered_by": "admin",
        "triggered_at": now,
        "target_employee_hashes": [body.employee_id_hash],
        "target_department": None,
        "module": body.module.value,
        "template_id": template["template_id"],
        "assignments": [],
        "status": "active",
        "created_at": now,
    }
    await db.simulation_campaigns.insert_one(campaign)

    assignment = await create_assignment(
        db, campaign_id, body.employee_id_hash, template, body.due_in_hours, "admin"
    )

    await kafka_service.publish("simulation.email.deliver", {"assignment_id": assignment["assignment_id"]})

    await db.simulation_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$push": {"assignments": assignment["assignment_id"]}},
    )

    return _ok({"campaign_id": campaign_id, "assignment_id": assignment["assignment_id"]})


@router.post("/campaigns/random", response_model=StandardResponse)
async def trigger_random(_admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    all_profiles = await db.employee_simulation_profiles.find({}).to_list(length=1000)
    if not all_profiles:
        raise HTTPException(status_code=404, detail="No employee profiles found")

    pct = random.uniform(0.10, 0.20)
    count = max(1, int(len(all_profiles) * pct))
    targets = random.sample(all_profiles, min(count, len(all_profiles)))

    modules = ["phishing", "social_eng", "incident_drill"]
    chosen_module = random.choice(modules)
    now = datetime.utcnow().isoformat()
    campaign_id = str(uuid.uuid4())

    campaign = {
        "campaign_id": campaign_id,
        "name": f"Auto Random Wave — {chosen_module}",
        "trigger_type": "automatic_random",
        "triggered_by": "admin",
        "triggered_at": now,
        "target_employee_hashes": [p["employee_id_hash"] for p in targets],
        "target_department": None,
        "module": chosen_module,
        "template_id": None,
        "assignments": [],
        "status": "active",
        "created_at": now,
    }
    await db.simulation_campaigns.insert_one(campaign)

    assignment_ids = []
    for profile in targets:
        role = profile.get("role", "all")
        template = await pick_template_for_employee(db, chosen_module, role)
        if not template:
            continue
        assignment = await create_assignment(db, campaign_id, profile["employee_id_hash"], template, 168, "admin")
        assignment_ids.append(assignment["assignment_id"])
        await kafka_service.publish("simulation.email.deliver", {"assignment_id": assignment["assignment_id"]})

    await db.simulation_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"assignments": assignment_ids}},
    )

    return _ok({"campaign_id": campaign_id, "targets": len(targets), "assignments_created": len(assignment_ids), "module": chosen_module})


@router.post("/campaigns/bulk", response_model=StandardResponse)
async def trigger_bulk(body: TriggerBulkRequest, _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    query = {}
    if body.target.startswith("department:"):
        dept = body.target.split(":", 1)[1]
        query["department"] = dept
    elif body.target.startswith("random:"):
        pass

    all_profiles = await db.employee_simulation_profiles.find(query).to_list(length=1000)
    if body.target.startswith("random:"):
        try:
            pct = float(body.target.split(":", 1)[1]) / 100
        except Exception:
            pct = 0.2
        all_profiles = random.sample(all_profiles, max(1, int(len(all_profiles) * pct)))

    now = datetime.utcnow().isoformat()
    campaign_id = str(uuid.uuid4())
    campaign = {
        "campaign_id": campaign_id,
        "name": body.name,
        "trigger_type": "manual_bulk",
        "triggered_by": "admin",
        "triggered_at": now,
        "target_employee_hashes": [p["employee_id_hash"] for p in all_profiles],
        "target_department": body.target if body.target.startswith("department:") else None,
        "module": body.module.value,
        "template_id": body.template_id,
        "assignments": [],
        "status": "active",
        "created_at": now,
    }
    await db.simulation_campaigns.insert_one(campaign)

    assignment_ids = []
    for profile in all_profiles:
        template = await pick_template_for_employee(db, body.module.value, profile.get("role", "all"), body.template_id)
        if not template:
            continue
        assignment = await create_assignment(db, campaign_id, profile["employee_id_hash"], template, body.due_in_hours, "admin")
        assignment_ids.append(assignment["assignment_id"])
        await kafka_service.publish("simulation.email.deliver", {"assignment_id": assignment["assignment_id"]})

    await db.simulation_campaigns.update_one({"campaign_id": campaign_id}, {"$set": {"assignments": assignment_ids}})
    return _ok({"campaign_id": campaign_id, "assignments_created": len(assignment_ids)})


@router.get("/campaigns", response_model=StandardResponse)
async def list_campaigns(
    page: int = Query(1, ge=1),
    limit: int = Query(20),
    status: str = Query(None),
    module: str = Query(None),
    _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES)),
):
    db = get_database()
    query = {}
    status_filter = (status or "").strip().lower()
    module_filter = (module or "").strip().lower()

    if status_filter and status_filter != "all":
        query["status"] = status_filter
    if module_filter and module_filter != "all":
        query["module"] = module_filter

    skip = (page - 1) * limit
    total = await db.simulation_campaigns.count_documents(query)
    cursor = db.simulation_campaigns.find(query).sort("created_at", -1).skip(skip).limit(limit)
    campaigns = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        assignment_ids = c.get("assignments", [])
        assignments_count = len(assignment_ids)
        passed_count = await db.simulation_attempts.count_documents({
            "assignment_id": {"$in": assignment_ids},
            "passed": True,
        })
        c["target_count"] = assignments_count
        pass_rate = round((passed_count / assignments_count) * 100, 1) if assignments_count else 0
        c["pass_rate"] = pass_rate

        # Lazy-complete: if campaign is still "active" but all assignments are done, fix it now
        if c.get("status") == "active" and assignment_ids:
            still_open = await db.simulation_assignments.count_documents({
                "assignment_id": {"$in": assignment_ids},
                "status": {"$nin": ["completed", "cancelled", "expired"]},
            })
            if still_open == 0:
                now_iso = datetime.utcnow().isoformat()
                await db.simulation_campaigns.update_one(
                    {"campaign_id": c["campaign_id"]},
                    {"$set": {"status": "completed", "completed_at": now_iso, "pass_rate": pass_rate}},
                )
                c["status"] = "completed"
                c["completed_at"] = now_iso

        campaigns.append(c)

    return _ok({"campaigns": campaigns, "total": total, "page": page})


@router.get("/campaigns/{campaign_id}", response_model=StandardResponse)
async def get_campaign(campaign_id: str, _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    campaign = await db.simulation_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign["_id"] = str(campaign["_id"])

    assignment_ids = campaign.get("assignments", [])
    assignments_cursor = db.simulation_assignments.find({"assignment_id": {"$in": assignment_ids}})
    assignments = []
    async for a in assignments_cursor:
        a["_id"] = str(a["_id"])
        if a.get("attempt_id"):
            attempt = await db.simulation_attempts.find_one({"attempt_id": a["attempt_id"]}, {"actions": 0})
            if attempt:
                attempt["_id"] = str(attempt["_id"])
                a["attempt"] = attempt
        assignments.append(a)

    return _ok({"campaign": campaign, "assignments": assignments})


@router.post("/campaigns/{campaign_id}/cancel", response_model=StandardResponse)
async def cancel_campaign(campaign_id: str, _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    campaign = await db.simulation_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.get("status") != "active":
        raise HTTPException(status_code=409, detail="Only active campaigns can be cancelled")

    now = datetime.utcnow().isoformat()
    await db.simulation_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"status": "cancelled", "cancelled_at": now}},
    )
    await db.simulation_assignments.update_many(
        {"campaign_id": campaign_id, "status": {"$in": ["pending", "in_progress"]}},
        {"$set": {"status": "cancelled"}},
    )
    return _ok({"campaign_id": campaign_id, "status": "cancelled"})


# ---- Threat Intelligence ----

@router.get("/threats", response_model=StandardResponse)
async def list_threats(
    status: str = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20),
    _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES)),
):
    db = get_database()
    status_filter = (status or "").strip().lower()
    query = {}

    if status_filter and status_filter != "all":
        if status_filter == "pending":
            # Backward compatibility for older documents created before review_status existed.
            query = {
                "$or": [
                    {"review_status": "pending"},
                    {"review_status": {"$exists": False}},
                    {"review_status": None},
                ]
            }
        else:
            query = {"review_status": status_filter}

    skip = (page - 1) * limit
    total = await db.scraped_threats.count_documents(query)
    cursor = db.scraped_threats.find(query).sort("scraped_at", -1).skip(skip).limit(limit)
    threats = []
    async for t in cursor:
        t["_id"] = str(t["_id"])
        threats.append(t)
    return _ok({"threats": threats, "total": total, "page": page})


@router.post("/threats/{threat_id}/approve", response_model=StandardResponse)
async def approve_threat(threat_id: str, _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    from bson import ObjectId
    await db.scraped_threats.update_one(
        {"_id": ObjectId(threat_id)},
        {"$set": {"review_status": "approved", "reviewed_by": "admin", "reviewed_at": datetime.utcnow().isoformat()}},
    )
    return _ok({"message": "Threat approved"})


@router.post("/threats/{threat_id}/reject", response_model=StandardResponse)
async def reject_threat(threat_id: str, _admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    from bson import ObjectId
    await db.scraped_threats.update_one(
        {"_id": ObjectId(threat_id)},
        {"$set": {"review_status": "rejected", "reviewed_by": "admin", "reviewed_at": datetime.utcnow().isoformat()}},
    )
    return _ok({"message": "Threat rejected"})


@router.post("/scraper/run", response_model=StandardResponse)
async def run_scraper(_admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    saved = await run_scraper_and_save(db)
    return _ok({"new_threats_saved": saved})


# ---- Reports ----

@router.get("/reports/leaderboard", response_model=StandardResponse)
async def leaderboard(_admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    pipeline = [
        {"$group": {
            "_id": "$department",
            "avg_score": {"$avg": "$average_score"},
            "total": {"$sum": 1},
            "flagged_count": {"$sum": {"$cond": ["$flagged", 1, 0]}},
            "certified": {"$sum": {"$cond": [{"$eq": ["$certification_status", "certified"]}, 1, 0]}},
            "trained": {"$sum": {"$cond": [{"$eq": ["$certification_status", "trained"]}, 1, 0]}},
            "aware": {"$sum": {"$cond": [{"$eq": ["$certification_status", "aware"]}, 1, 0]}},
            "needs_training": {"$sum": {"$cond": [{"$eq": ["$certification_status", "needs_training"]}, 1, 0]}},
        }},
        {"$sort": {"avg_score": -1}},
    ]
    departments = []
    async for d in db.employee_simulation_profiles.aggregate(pipeline):
        all_attempts = await db.simulation_attempts.count_documents({"department": d["_id"], "completed_at": {"$ne": None}})
        passed = await db.simulation_attempts.count_documents({"department": d["_id"], "passed": True})
        d["pass_rate"] = round((passed / all_attempts) * 100, 1) if all_attempts else 0
        d["avg_score"] = round(d["avg_score"] or 0, 1)
        departments.append(d)
    return _ok({"departments": departments})


@router.get("/reports/flagged", response_model=StandardResponse)
async def flagged_employees(_admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    cursor = db.employee_simulation_profiles.find({"flagged": True})
    flagged = []
    async for p in cursor:
        p["_id"] = str(p["_id"])
        p.pop("history", None)
        flagged.append(p)

    hashes = [p["employee_id_hash"] for p in flagged]
    name_map: dict = {}
    async for u in db.users.find({"employee_id_hash": {"$in": hashes}}, {"employee_id_hash": 1, "full_name": 1, "name": 1}):
        name_map[u["employee_id_hash"]] = u.get("full_name") or u.get("name") or ""
    for p in flagged:
        p["name"] = name_map.get(p["employee_id_hash"], "")

    return _ok({"flagged": flagged})


@router.get("/reports/posture", response_model=StandardResponse)
async def security_posture(_admin=Depends(require_role(*_SENTINEL_ADMIN_ROLES))):
    db = get_database()
    pipeline = [{"$group": {"_id": None, "avg_pam": {"$avg": "$pam_trust_score"}}}]
    result = await db.employee_simulation_profiles.aggregate(pipeline).to_list(length=1)
    avg = round(result[0]["avg_pam"], 4) if result else 0.0
    status = "danger" if avg < 0.5 else ("warning" if avg < 0.75 else "success")
    return _ok({"pam_trust_score": avg, "status": status})
