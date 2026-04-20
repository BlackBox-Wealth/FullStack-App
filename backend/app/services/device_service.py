"""
Device & Geolocation Service
Detects new device logins and geolocation changes, saves known devices to MongoDB.
"""
import hashlib
from datetime import datetime
from typing import Optional
import httpx
from logifyx import Logifyx

log = Logifyx(name="device_service")

# Attempt to import user_agents; gracefully degrade if not installed
try:
    import user_agents
    UA_AVAILABLE = True
except ImportError:
    UA_AVAILABLE = False
    log.warning("user-agents library not installed. Device parsing will be basic. Run: pip install user-agents")


def _parse_user_agent(ua_string: str) -> dict:
    """Parse User-Agent string into human-readable device info."""
    if not ua_string:
        return {"browser": "Unknown Browser", "os": "Unknown OS", "device_type": "desktop", "raw": ""}

    if UA_AVAILABLE:
        try:
            ua = user_agents.parse(ua_string)
            browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
            os_info = f"{ua.os.family} {ua.os.version_string}".strip()
            if ua.is_mobile:
                device_type = "mobile"
            elif ua.is_tablet:
                device_type = "tablet"
            else:
                device_type = "desktop"
            return {
                "browser": browser or "Unknown Browser",
                "os": os_info or "Unknown OS",
                "device_type": device_type,
                "raw": ua_string[:200],
            }
        except Exception as e:
            log.warning(f"Failed to parse user agent: {e}")

    # Fallback: basic string parsing
    browser = "Unknown Browser"
    os_info = "Unknown OS"
    ua_lower = ua_string.lower()
    if "chrome" in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower:
        browser = "Safari"
    elif "edge" in ua_lower:
        browser = "Edge"

    if "windows" in ua_lower:
        os_info = "Windows"
    elif "mac os" in ua_lower or "macos" in ua_lower:
        os_info = "macOS"
    elif "linux" in ua_lower:
        os_info = "Linux"
    elif "android" in ua_lower:
        os_info = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        os_info = "iOS"

    device_type = "mobile" if ("android" in ua_lower or "iphone" in ua_lower) else "desktop"
    return {"browser": browser, "os": os_info, "device_type": device_type, "raw": ua_string[:200]}


def _build_device_fingerprint(ua_string: str, os_info: str) -> str:
    """Build a stable SHA-256 fingerprint from UA + OS."""
    raw = f"{ua_string[:300]}|{os_info}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def _get_geolocation(ip: str) -> dict:
    """Get city/country from IP using ip-api.com (free, no key needed)."""
    # Localhost / private IP — skip geo lookup
    if not ip or ip in ("127.0.0.1", "::1", "localhost") or ip.startswith("192.168.") or ip.startswith("10."):
        return {"city": "Local Network", "region": "", "country": "Local", "full_location": "Local Network"}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip}?fields=status,city,regionName,country,query")
            data = resp.json()
            if data.get("status") == "success":
                city = data.get("city", "")
                region = data.get("regionName", "")
                country = data.get("country", "")
                parts = [p for p in [city, region, country] if p]
                full_location = ", ".join(parts) if parts else "Unknown Location"
                return {"city": city, "region": region, "country": country, "full_location": full_location}
    except Exception as e:
        log.warning(f"Geolocation lookup failed for IP {ip}: {e}")

    return {"city": "Unknown", "region": "", "country": "Unknown", "full_location": "Unknown Location"}


async def check_and_save_device(
    db,
    user_id: str,
    ip: str,
    ua_string: str,
) -> dict:
    """
    Check if current device/location is new for this user.
    - Saves new devices to `known_devices` collection.
    - Updates `last_seen_at` and `login_count` for returning devices.
    
    Returns:
        dict with keys:
            is_new_device (bool)
            is_new_location (bool)
            device_info (dict)
            location (dict)
    """
    device_info = _parse_user_agent(ua_string)
    fingerprint = _build_device_fingerprint(ua_string, device_info["os"])
    location = await _get_geolocation(ip)

    # Look up existing known device
    existing_device = await db.known_devices.find_one({
        "user_id": user_id,
        "device_fingerprint": fingerprint,
    })

    is_new_device = existing_device is None

    # Check for location change (only if device is known)
    is_new_location = False
    if not is_new_device and existing_device:
        last_country = existing_device.get("last_seen_location", {}).get("country", "")
        current_country = location.get("country", "")
        # Flag if country changed and neither is "Local" / "Unknown"
        if (
            last_country
            and current_country
            and last_country not in ("Local", "Unknown")
            and current_country not in ("Local", "Unknown")
            and last_country != current_country
        ):
            is_new_location = True

    now = datetime.utcnow()

    if is_new_device:
        # Insert new device document
        await db.known_devices.insert_one({
            "user_id": user_id,
            "device_fingerprint": fingerprint,
            "browser": device_info["browser"],
            "os": device_info["os"],
            "device_type": device_info["device_type"],
            "raw_ua": device_info["raw"],
            "last_seen_ip": ip,
            "last_seen_location": location,
            "first_seen_at": now,
            "last_seen_at": now,
            "login_count": 1,
        })
        log.info(f"[device_service] New device saved for user={user_id}: {device_info['browser']} on {device_info['os']} from {location['full_location']}")
    else:
        # Update last seen info
        await db.known_devices.update_one(
            {"_id": existing_device["_id"]},
            {
                "$set": {
                    "last_seen_ip": ip,
                    "last_seen_location": location,
                    "last_seen_at": now,
                },
                "$inc": {"login_count": 1},
            },
        )
        log.info(f"[device_service] Known device updated for user={user_id}: login_count incremented")

    return {
        "is_new_device": is_new_device,
        "is_new_location": is_new_location,
        "device_info": device_info,
        "location": location,
    }
