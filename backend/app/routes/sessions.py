"""Session management routes."""
import json
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Response
from bson import ObjectId
from app.core.database import get_database
from app.core.redis_client import get_redis
from app.core.security import get_current_user
from app.models.session import SessionResponse
from app.routes.auth import clear_auth_cookies
from logifyx import Logifyx

log = Logifyx(name="wealthvault", color=True)
router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("", response_model=List[SessionResponse])
@router.get("/", response_model=List[SessionResponse])
async def get_active_sessions(current_user: dict = Depends(get_current_user)):
    """Get all active sessions for the current user."""
    user_id = current_user["id"]
    current_session_id = current_user.get("session_id")
    log.info(f"Fetching active sessions for user={user_id}")
    
    redis = get_redis()
    db = get_database()
    sessions = []
    
    if redis:
        # Get all session keys for this user from Redis
        # Use Redis SET to store user sessions for O(1) lookup
        user_sessions_key = f"user_sessions:{user_id}"
        session_ids = await redis.smembers(user_sessions_key)
        
        for session_id in session_ids:
            session_data = await redis.get(f"session:{session_id}")
            if session_data:
                session = json.loads(session_data)
                if session.get("is_active"):
                    session["is_current"] = session.get("session_id") == current_session_id
                    sessions.append(session)
    else:
        # Get from MongoDB
        cursor = db.sessions.find({"user_id": user_id, "is_active": True})
        async for session in cursor:
            session["session_id"] = session.get("session_id")
            session["is_current"] = session.get("session_id") == current_session_id
            sessions.append(session)
    
    log.info(f"Found {len(sessions)} active sessions for user={user_id}")
    
    # Convert to response format
    response_sessions = []
    for session in sessions:
        response_sessions.append(SessionResponse(
            session_id=session["session_id"],
            device_info=session.get("device_info", {"browser": "Unknown", "os": "Unknown", "device_type": "Unknown"}),
            ip_address=session.get("ip_address", "Unknown"),
            created_at=str(session.get("created_at", "")),
            last_active=str(session.get("last_active", "")),
            is_active=session.get("is_active", True),
            is_current=session.get("is_current", False)
        ))
    
    return response_sessions


@router.delete("/{session_id}")
async def revoke_session(session_id: str, response: Response, current_user: dict = Depends(get_current_user)):
    """Revoke a specific session."""
    user_id = current_user["id"]
    current_session_id = current_user.get("session_id")
    
    log.info(f"Revoking session: session_id={session_id}, user={user_id}")
    
    redis = get_redis()
    db = get_database()
    
    is_current = (session_id == current_session_id)
    
    if redis:
        # Get session from Redis
        session_data = await redis.get(f"session:{session_id}")
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = json.loads(session_data)
        
        # Verify session belongs to current user
        if session.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Cannot revoke another user's session")
        
        # Delete from Redis and remove from user sessions set
        await redis.delete(f"session:{session_id}")
        await redis.srem(f"user_sessions:{user_id}", session_id)
        log.info(f"Session revoked from Redis: session_id={session_id}")
    else:
        # Get from MongoDB
        session = await db.sessions.find_one({"session_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify session belongs to current user
        if session.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Cannot revoke another user's session")
        
        # Mark as revoked in MongoDB
        await db.sessions.update_one(
            {"session_id": session_id},
            {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
        )
        log.info(f"Session revoked in MongoDB: session_id={session_id}")
    
    # If the revoked session is the current one, log them out immediately
    if is_current:
        clear_auth_cookies(response)
        log.info(f"Current session revoked, user {user_id} logged out")
        return {"message": "Current session revoked and you have been logged out", "session_id": session_id, "logged_out": True}
    
    return {"message": "Session revoked successfully", "session_id": session_id}


@router.delete("")
@router.delete("/")
async def revoke_all_sessions(current_user: dict = Depends(get_current_user)):
    """Revoke all sessions except the current one."""
    user_id = current_user["id"]
    current_session_id = current_user.get("session_id")
    
    log.info(f"Revoking all sessions except current for user={user_id}")
    
    redis = get_redis()
    db = get_database()
    revoked_count = 0
    
    if redis:
        # Scan and revoke all user sessions except current
        user_sessions_key = f"user_sessions:{user_id}"
        session_ids = await redis.smembers(user_sessions_key)
        
        for session_id in session_ids:
            if session_id != current_session_id:
                session_data = await redis.get(f"session:{session_id}")
                if session_data:
                    session = json.loads(session_data)
                    if session.get("is_active"):
                        await redis.delete(f"session:{session_id}")
                        await redis.srem(user_sessions_key, session_id)
                        revoked_count += 1
        
        log.info(f"Revoked {revoked_count} sessions from Redis for user={user_id}")
    else:
        # Revoke all in MongoDB except current
        result = await db.sessions.update_many(
            {
                "user_id": user_id,
                "session_id": {"$ne": current_session_id},
                "is_active": True
            },
            {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
        )
        revoked_count = result.modified_count
        log.info(f"Revoked {revoked_count} sessions from MongoDB for user={user_id}")
    
    return {
        "message": f"Revoked {revoked_count} session(s) successfully",
        "revoked_count": revoked_count
    }
