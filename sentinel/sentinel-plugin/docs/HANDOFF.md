# Sentinel Plugin — Session Handoff

This document captures the current state of the Sentinel plugin as of 2026-05-27, including what has been built, what was changed in recent sessions, and what is still pending.

---

## What Sentinel Is

**Sentinel** is a phishing simulation and security awareness lab built as a plugin to the WealthVault platform. It lets admins run realistic phishing/social-engineering drills against bank employees and tracks who falls for them.

It lives in a separate directory (`sentinel/`) within the repo and has its own:
- React frontend (port 5174) — separate from the main WealthVault frontend (port 5173)
- Shared backend — same FastAPI process (`backend/`) but under the `/admin/sim/` and `/portal/` route namespaces
- Own MongoDB collections: `employee_simulation_profiles`, `sim_campaigns`, `sim_inbox_emails`, `sim_results`, `scraped_threats`, `threat_templates`

---

## Directory Layout (Sentinel-relevant paths)

```
PSB-Hackathon/
├── backend/
│   └── app/
│       ├── routes/
│       │   └── auth.py                  # Shared auth — admin login endpoint is here
│       ├── core/
│       │   └── security.py              # get_current_user, require_role, JWT logic
│       └── simulation/
│           ├── seed.py                  # Seeds demo employees into MongoDB
│           ├── routes/
│           │   ├── admin.py             # All /admin/sim/* endpoints
│           │   ├── portal.py            # All /portal/* endpoints (employee-facing)
│           │   └── sim_tracking.py      # Webhook-style click/submit tracking
│           ├── services/
│           │   ├── campaign_service.py  # Campaign creation logic
│           │   ├── email_service.py     # Gmail SMTP dispatch
│           │   ├── scraper.py           # Live RBI + CERT-In threat scraper
│           │   ├── scoring.py           # PAM trust score calculation
│           │   └── token_service.py     # Per-sim JWT token generation
│           └── models/
│               └── simulation.py        # Pydantic models for all sim entities
└── sentinel/
    └── frontend/
        └── src/
            ├── pages/
            │   ├── admin/
            │   │   ├── AdminLogin.tsx       # Admin login page
            │   │   ├── Overview.tsx         # Stats overview
            │   │   ├── Simulations.tsx      # Campaign management
            │   │   ├── Employees.tsx        # Employee profiles
            │   │   ├── Reports.tsx          # Leaderboard + flagged + CSV export
            │   │   └── ThreatIntelligence.tsx  # Scraped threats review
            │   ├── portal/
            │   │   ├── Login.tsx            # Employee portal login
            │   │   ├── Dashboard.tsx        # Employee dashboard
            │   │   ├── Inbox.tsx            # Simulated email inbox
            │   │   ├── InboxDetail.tsx      # Individual email view
            │   │   └── ScenarioPage.tsx     # Active simulation scenario
            │   └── sentinel/
            │       ├── PhishingHarvestPage.tsx   # Landing page for phishing link clicks
            │       ├── SocialEngPage.tsx          # Social engineering scenario
            │       └── IncidentDrillPage.tsx      # Incident response drill
            ├── store/
            │   └── useAuthStore.ts          # Zustand auth store (persisted to localStorage)
            └── api/
                ├── client.ts               # Axios instance with Bearer token + 401 handler
                ├── admin.ts                # Admin API helpers
                └── portal.ts               # Portal API helpers
```

---

## How It Works (End to End)

1. **Admin logs in** via `/admin/login` → `POST /api/v1/auth/admin/login` → gets JWT with `superadmin` or `compliance_officer` role
2. **Admin creates a campaign** (single employee / random N / bulk by department) → backend generates a unique sim token per employee, builds a phishing email, sends via Gmail
3. **Employee receives email** with a link like `https://psb-sentinel.in/go/<sim_token>`
4. **Employee clicks** → `sim_tracking.py` records the click, redirects to the phishing landing page (`PhishingHarvestPage.tsx`)
5. **If employee submits credentials** → tracked as a failure; PAM trust score drops
6. **Employee portal** at `/portal/login` shows a fake internal banking dashboard — the inbox contains the phishing email alongside realistic decoy emails
7. **If employee reports the email** via the portal → recorded as a pass; score goes up
8. **Admin sees results** in Overview / Employees / Reports dashboard

---

## Authentication Model

### Admin side
- `POST /api/v1/auth/admin/login` in `backend/app/routes/auth.py`
- Validates email + password against `users` collection, checks `role` is `superadmin` or `compliance_officer`, verifies PIN
- Returns a real JWT; frontend stores in Zustand (`useAuthStore`)
- All `/admin/sim/*` routes require `Depends(require_role("superadmin", "compliance_officer"))` — **currently these guards are REMOVED for standalone testing** (see MERGE.md)

### Employee portal side
- `POST /api/v1/auth/login` (main WealthVault login)
- All `/portal/*` routes require `Depends(get_current_user)`
- `get_current_user` in `security.py` checks JWT validity, then checks Redis session — BUT only if the JWT has a `session_id` claim. Tokens issued **without** `session_id` skip the Redis check (just logs a warning) and look up the user in MongoDB directly
- This is the hook used for demo/testing login (see pending work below)

---

## Threat Intelligence

The "Threat Intelligence" tab is not hardcoded data — it's a real scraper:

- `backend/app/simulation/services/scraper.py` uses `httpx` + `BeautifulSoup`
- Scrapes live pages from RBI (`rbi.org.in`) and CERT-In (`cert-in.org.in`)
- Filters anchor text by fraud/security keywords, classifies attack type
- Saves results to `scraped_threats` collection with `review_status: "pending"`
- Admin reviews threats in the UI → can Approve (adds to template library) or Reject
- Approved threats become available as campaign templates

The mock data shown in the frontend is just the API-fail fallback — the actual data comes from the scraper.

---

## Seeded Demo Accounts

Run `backend/app/simulation/seed.py` to populate MongoDB with test employees.

| Name | Email | Department | Role |
|---|---|---|---|
| Arjun Mehta | arjun.mehta@psb-test.in | Retail Banking | teller |
| Priya Sharma | priya.sharma@psb-test.in | Loans | loan_officer |
| Kiran Rao | kiran.rao@psb-test.in | Operations | teller |
| Ananya Patel | ananya.patel@psb-test.in | Compliance | loan_officer |

Password for all: `SimTest@2025`

Admin account (seeded separately): `admin@psb-sentinel.in` / `Admin@Sentinel2025`

---

## Recent Changes (This Session)

### 1. Employee names in admin dashboard

**Problem:** Admin pages showed raw `employee_id_hash` strings instead of names.

**Fix — Backend (`backend/app/simulation/routes/admin.py`):**
- `GET /employees` — after fetching `employee_simulation_profiles`, does a batch lookup in `users` collection using `{"employee_id_hash": {"$in": hashes}}` and attaches `name` to each profile
- `GET /employees/{hash}` — same but single-document lookup, also attaches `email`
- `GET /reports/flagged` — same batch-lookup pattern

**Fix — Frontend (`sentinel/frontend/src/pages/admin/Employees.tsx`):**
- `Profile` interface now has `name?: string` and `email?: string`
- Table shows name as primary text, truncated hash as monospace secondary line
- Detail panel shows name as heading above the hash
- Mock data updated with real names as fallback

**Fix — Frontend (`sentinel/frontend/src/pages/admin/Reports.tsx`):**
- Flagged employees table: name primary, hash secondary (same pattern)
- Mock flagged data updated with names

### 2. CSV Download on Reports tab

**Added to `sentinel/frontend/src/pages/admin/Reports.tsx`:**
- "Download Report" button in the page header (top-right)
- Client-side only — no backend call needed, data is already in React state
- CSV has three sections: Platform Security Posture, Department Leaderboard, Flagged Employees
- Filename: `sentinel-report-YYYY-MM-DD.csv`
- Proper CSV quoting (escapes internal double-quotes)

---

## Pending Work

### Employee Portal Testing

**Problem:** The portal `Login.tsx` has a mock fallback that sets `token = 'mock-jwt-token'`. This isn't a valid JWT, so `get_current_user` throws on decode and every portal API call returns 401. The UI still renders from mock data fallbacks, so the pages appear to work — but none of the real data loads.

**Solution:** Add a `POST /api/v1/auth/sim/demo-login` endpoint to `backend/app/routes/auth.py` (after the existing `admin/login` handler at the bottom of the file). This endpoint:
- Only works for `@psb-test.in` emails (refuses all others)
- Looks up the user in MongoDB by hashed email
- Issues a real JWT **without** `session_id` — this causes `get_current_user` to skip the Redis session check and go straight to MongoDB user lookup
- Returns `access_token` + user object

Then update `sentinel/frontend/src/pages/portal/Login.tsx` catch block to call this endpoint instead of directly setting `mock-jwt-token`.

**Backend code to add** (append after the `admin_login` function in `auth.py`):

```python
class PortalDemoLoginRequest(BaseModel):
    email: str
    class Config:
        extra = "ignore"

@router.post("/sim/demo-login")
async def portal_demo_login(body: PortalDemoLoginRequest):
    if not body.email.endswith("@psb-test.in"):
        raise HTTPException(status_code=403, detail="Demo login only available for test accounts")
    db = get_database()
    hashed_email = generate_deterministic_hash(body.email)
    user = await db.users.find_one({"hashed_email": hashed_email})
    if not user:
        raise HTTPException(status_code=404, detail="Demo account not found. Run the simulation seed first.")
    try:
        user = decrypt_user_data(user)
    except Exception:
        pass
    user_id = str(user["_id"])
    access_token = create_access_token({"sub": user_id, "role": user.get("role", "teller")})
    return {
        "data": {
            "access_token": access_token,
            "user": {
                "id": user_id,
                "name": user.get("full_name") or user.get("name", "Employee"),
                "email": user.get("email", body.email),
                "role": user.get("role", "teller"),
                "department": user.get("department", "Operations"),
                "employee_id": user.get("employee_id", ""),
            },
        }
    }
```

**Frontend catch block to replace** in `sentinel/frontend/src/pages/portal/Login.tsx`:

```tsx
} catch (err: any) {
  const demo = DEMO_ACCOUNTS.find(a => a.email === email)
  if (demo && password === DEMO_PASSWORD) {
    try {
      const res = await axios.post('/api/v1/auth/sim/demo-login', { email })
      const { user: demoUser, access_token } = res.data.data
      setAuth(
        { id: demoUser.id, email: demoUser.email, full_name: demoUser.name, role: demoUser.role, department: demoUser.department },
        access_token
      )
      navigate('/portal/dashboard')
      return
    } catch {
      // Final fallback if backend unavailable — portal will use mock data
      setAuth(
        { id: demo.email, email: demo.email, full_name: demo.name, role: demo.role, department: demo.dept, kyc_status: 'verified' },
        'mock-jwt-token'
      )
      navigate('/portal/dashboard')
      return
    }
  }
  setError(err.response?.data?.detail || 'Invalid credentials.')
}
```

---

## Production Merge Checklist

See `sentinel-plugin/docs/MERGE.md` for the full guide. Summary:

- [ ] Re-add `Depends(require_role(...))` to all 15 admin sim routes in `admin.py`
- [ ] Remove mock fallback from `AdminLogin.tsx`
- [ ] Remove demo account card from `AdminLogin.tsx` (optional)
- [ ] Remove or gate `POST /auth/sim/demo-login` behind an env flag
- [ ] Set `SENTINEL_BASE_URL` to production domain
- [ ] Configure Gmail service account credentials
- [ ] Run simulation seed on production DB (or create admin user manually)
- [ ] Smoke test: login → overview → random wave → landing pages accessible

---

## Running Locally

**Backend** (from `PSB-Hackathon/backend/`):
```bash
uvicorn app.main:app --reload --port 8000
```

**Sentinel frontend** (from `PSB-Hackathon/sentinel/frontend/`):
```bash
npm run dev   # starts on port 5174
```

**Main WealthVault frontend** (from `PSB-Hackathon/frontend/`):
```bash
npm run dev   # starts on port 5173
```

API base: `http://localhost:8000/api/v1`
Admin dashboard: `http://localhost:5174/admin/login`
Employee portal: `http://localhost:5174/portal/login`
