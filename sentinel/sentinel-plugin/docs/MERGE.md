# Sentinel Plugin — Merge Guide

This doc covers everything that must be changed when merging the Sentinel plugin from standalone testing mode into the main WealthVault platform.

---

## What Was Stripped for Testing

To allow standalone testing without the full WealthVault auth stack, two things were disabled:

1. **Auth guards removed** from `backend/app/simulation/routes/admin.py` — every endpoint is currently open
2. **Mock login fallback** in `sentinel/frontend/src/pages/admin/AdminLogin.tsx` — logs in with a fake token when the API fails

Both must be restored before shipping.

---

## Step 1 — Re-enable Auth on Admin Routes

File: `backend/app/simulation/routes/admin.py`

### Change the imports (top of file)

**Before (testing mode):**
```python
from fastapi import APIRouter, HTTPException, Query
```

**After (production):**
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.security import require_role
```

Also remove the `_STUB_ADMIN` line.

### Add auth dependency back to each route

Apply this pattern to every route function:

| Route | Dependency to add |
|---|---|
| `GET /stats/overview` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `GET /employees` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `GET /employees/{hash}` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `POST /campaigns/single` | `Depends(require_role("superadmin"))` |
| `POST /campaigns/random` | `Depends(require_role("superadmin"))` |
| `POST /campaigns/bulk` | `Depends(require_role("superadmin"))` |
| `GET /campaigns` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `GET /campaigns/{id}` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `GET /threats` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `POST /threats/{id}/approve` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `POST /threats/{id}/reject` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `POST /scraper/run` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `GET /reports/leaderboard` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `GET /reports/flagged` | `Depends(require_role("superadmin", "compliance_officer"))` |
| `GET /reports/posture` | `Depends(require_role("superadmin", "compliance_officer"))` |

**Example — before:**
```python
@router.post("/campaigns/random", response_model=StandardResponse)
async def trigger_random():
```

**After:**
```python
@router.post("/campaigns/random", response_model=StandardResponse)
async def trigger_random(admin=Depends(require_role("superadmin"))):
```

For routes that use `"admin"` as a hardcoded string (triggered_by, reviewed_by), replace with `admin.get("employee_id_hash", "admin")` or `admin.get("email")` as appropriate.

---

## Step 2 — Wire Up the Admin Login

The `/api/v1/auth/admin/login` endpoint was added to `backend/app/routes/auth.py` (at the bottom of the file). It is already production-ready — it validates credentials, checks role, verifies PIN, and returns a real JWT.

The only thing to confirm: the `AdminLoginRequest` model and the `@router.post("/admin/login")` handler are present in `auth.py`. They were added during development and are self-contained.

**Verify it's registered:**
```bash
curl http://localhost:8000/docs | grep admin/login
# Should show POST /api/v1/auth/admin/login
```

---

## Step 3 — Remove Mock Fallback from Frontend

File: `sentinel/frontend/src/pages/admin/AdminLogin.tsx`

The mock fallback (lines ~38–47) lets login succeed even when the API is down. Remove it in production:

**Before:**
```tsx
} catch (err: any) {
  // Mock fallback for demos
  if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
    setAuth({ id: 'admin-001', email: DEMO_ADMIN.email, full_name: 'Security Admin', role: 'superadmin' }, 'mock-admin-jwt')
    navigate('/admin/overview')
    return
  }
  if (email === DEMO_COMPLIANCE.email && password === DEMO_COMPLIANCE.password) {
    setAuth({ id: 'compliance-001', email: DEMO_COMPLIANCE.email, full_name: 'Ananya Patel', role: 'compliance_officer' }, 'mock-compliance-jwt')
    navigate('/admin/overview')
    return
  }
  setError(err.response?.data?.detail || 'Authentication failed. Check credentials and PIN.')
  setStep('credentials')
}
```

**After:**
```tsx
} catch (err: any) {
  setError(err.response?.data?.detail || 'Authentication failed. Check credentials and PIN.')
  setStep('credentials')
}
```

Also remove the `DEMO_ADMIN` and `DEMO_COMPLIANCE` constants at the top, and the demo accounts card in the JSX if you don't want it visible in production.

---

## Step 4 — Create Production Admin User

The simulation seed creates `admin@psb-sentinel.in / Admin@Sentinel2025` for testing. For production, create a real superadmin via the main platform's user management, or update the seed with secure credentials.

The sentinel admin routes require `role: "superadmin"` or `role: "compliance_officer"` — these roles must exist on the user document in MongoDB.

---

## Step 5 — Verify CORS

The main `app.py` already has `FRONTEND_URL` in CORS origins for both 5173 and 5174. Once merged into a single frontend, ensure the deployed domain is in `CORS_ORIGINS` in `.env`.

---

## Step 6 — Environment Variables for Production

Add these to the main platform's `.env`:

```
SENTINEL_BASE_URL=https://your-production-domain.com
GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
SENTINEL_SENDER_EMAIL=security-ops@yourdomain.com
SENTINEL_REPORT_SENDER_EMAIL=security-team@yourdomain.com
SENTINEL_ASSIGNMENT_DUE_HOURS=168
```

---

## Merge Checklist

- [ ] Re-add `Depends(require_role(...))` to all 15 admin sim routes
- [ ] Confirm `POST /api/v1/auth/admin/login` is present in `auth.py`
- [ ] Remove mock fallback from `AdminLogin.tsx`
- [ ] Remove demo account card from `AdminLogin.tsx` (optional)
- [ ] Set `SENTINEL_BASE_URL` to production domain
- [ ] Configure Gmail service account credentials
- [ ] Run simulation seed on production DB (or create admin user manually)
- [ ] Smoke test: login → overview loads → random wave creates campaign → landing pages accessible
