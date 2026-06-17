# WealthVault Sentinel — How It Works & Testing Guide

## What Is Sentinel?

Sentinel is a self-contained security awareness simulation plugin for the WealthVault banking platform. It runs covert phishing, social engineering, and incident drill simulations against bank employees **without their prior knowledge**, then scores every response and feeds a trust signal back into the core platform's privileged access controls.

Employees never see an "admin simulation panel." All interaction happens through emails that look like real bank communications and landing pages that impersonate trusted portals (RBI, internal IT, NPCI UPI, HR).

---

## System Architecture

```
Admin Panel (React, port 5174)
     │
     │  REST (authenticated)
     ▼
FastAPI Backend (port 8000)
     │
     ├── /api/v1/admin/sim/*   ← admin control routes (require superadmin JWT)
     ├── /api/v1/portal/*      ← employee-facing portal routes
     └── /api/sim/*            ← unauthenticated tracking routes (accessed from email links)
          │
          ▼
     MongoDB (collections below)
     Redis  (session cache)
```

**MongoDB collections used by Sentinel:**

| Collection | Purpose |
|---|---|
| `simulation_templates` | Phishing / social eng / incident drill templates |
| `simulation_campaigns` | Campaign records (who triggered, which module, when) |
| `simulation_assignments` | Per-employee assignment within a campaign |
| `simulation_attempts` | Live attempt state (actions log, current node, score) |
| `employee_simulation_profiles` | Persistent per-employee stats, PAM trust score, flag state |
| `scraped_threats` | RBI/CERT-In threat intel scraped for template generation |

---

## The Three Simulation Modules

### 1. Phishing

**Goal:** Did the employee click the link and/or submit credentials?

**Flow:**
1. Admin triggers a campaign → backend creates an `assignment` and calls `deliver_phishing_email`
2. Employee receives an HTML email impersonating RBI / internal IT / NPCI / HR (controlled by `harvest_page_type` in the template)
3. Email contains a tracking link: `GET /api/sim/phishing/click/{token}`
4. Backend logs `clicked_link` action and **redirects** to the React harvest page:
   `{SENTINEL_BASE_URL}/sentinel/landing/harvest/{type}?token={token}`
5. Employee sees a convincing login form. If they submit it:
   - `POST /api/sim/phishing/credentials/{token}` is called
   - Backend logs `submitted_credentials`, scores the attempt (score = 0, failed)
   - Browser redirects to an error page — the employee thinks the site broke
6. If employee does NOT click and instead reports it, admin manually logs `reported_phishing` → score 100

**Scoring (`scoring.py`):**
- `submitted_credentials` → 0 points, failed
- `reported_phishing` (without clicking) → 100 points, passed
- `reported_phishing` (after clicking) → 50 points, passed
- No action → 20 points, failed
- Time bonus: +10 if flagged within 5 min, +5 within 30 min

**Harvest page variants (hardcoded, zero PSB design system):**
| `type` value | Impersonates | Theme color |
|---|---|---|
| `rbi_portal` | Reserve Bank of India | Navy `#1a3558` |
| `internal_it` | PSB Internal IT Help | Blue `#003d7a` |
| `upi_verification` | NPCI UPI Verification | Green `#00a651` |
| `hr_portal` | HR Self-Service Portal | Neutral `#4a5568` |

---

### 2. Social Engineering

**Goal:** Did the employee make the right decisions in a multi-step scenario?

**Flow:**
1. Employee receives an email with a link to an "internal audit portal"
2. Link hits `GET /api/sim/social/{token}` → returns the first scenario node (situation + options)
3. React page renders a Jira-like institutional portal with the situation card
4. Employee picks an option → `POST /api/sim/social/respond/{token}`
5. Backend logs the choice, advances to the next node (or terminates if `next` starts with `terminal`)
6. On terminal node: scores all choices cumulatively, marks attempt complete

**Decision tree structure (in template `content.nodes`):**
```json
{
  "1": {
    "situation": "A caller says they are from IT and need your VPN credentials urgently.",
    "options": [
      { "text": "Give them credentials", "score": 0, "feedback": "Never share credentials over phone.", "next": "terminal_fail" },
      { "text": "Ask for their employee ID and call back on the official number", "score": 100, "feedback": "Correct — always verify caller identity.", "next": "terminal_pass" }
    ]
  }
}
```

**Scoring:**
- Each node has a `score` per option (0–100)
- Final score = `(sum of chosen scores / sum of max possible scores) * 100`
- Pass threshold: ≥ 70

---

### 3. Incident Drill

**Goal:** Did the employee fill the incident report correctly and on time?

**Flow:**
1. Employee receives an email describing a security incident and a link to the IMS form
2. Link hits `GET /api/sim/incident/form/{token}` → returns scenario, required fields, time limit
3. React page shows a PSB Incident Management System form with a countdown timer
4. Employee fills in the fields; timer auto-submits on expiry
5. `POST /api/sim/incident/submit/{token}` → backend scores and completes the attempt

**Scoring (4 components, 100 pts total):**
| Component | Points | Condition |
|---|---|---|
| Completeness | 40 | Each required field filled with >10 chars |
| Correct escalation path | 30 | `escalation_path` field matches template's `correct_escalation_path` |
| Time bonus | 20 | <50% of time used → 20 pts; <80% → 10 pts |
| Detail quality | 10 | Average field length >50 chars |

Pass threshold: ≥ 70

---

## Token System

Every email link contains a **JWT tracking token**. The token encodes:
- `attempt_id` — identifies which simulation attempt this interaction belongs to
- `assignment_id`
- `module` (phishing / social_eng / incident_drill)
- Expiry timestamp

Tokens are signed with `SECRET_KEY` from `.env`. No session cookies needed — the token is the only credential. All `/api/sim/` endpoints validate the token before processing any action.

---

## Scoring Engine → PAM Trust Signal

After every completed attempt, the backend updates `employee_simulation_profiles`:

1. Recalculates `average_score` across all attempts
2. Sets `certification_status`:
   - ≥ 90 → `certified`
   - ≥ 75 → `trained`
   - ≥ 50 → `aware`
   - < 50 → `needs_training`
3. Sets `flagged = True` if the employee ever submitted credentials in a phishing sim
4. Recomputes `pam_trust_score` (float 0–1):
   - Flagged employees: capped at 0.3
   - No history: defaults to 0.6
   - Otherwise: `avg_score / 100` over last 10 attempts

**PAM integration rule (in transaction approval handler):**
```python
if trust < 0.5:
    required_approvers = 2   # dual approval required
else:
    required_approvers = 1
```

---

## Admin Panel (5 sections)

| Section | Route | What it does |
|---|---|---|
| **Overview** | `/admin/overview` | Stats tiles, 30-day chart, recent campaigns, "Launch Random Wave" + "Configure Campaign" |
| **Employee Intelligence** | `/admin/employees` | Table of all simulation profiles, slide panel with attempt history, manual trigger |
| **Campaigns** | `/admin/simulations` | Filterable campaign table, click row to expand per-employee assignments |
| **Threat Intelligence** | `/admin/threats` | RBI/CERT-In scraped items in pending/approved tabs, manual scraper run |
| **Reports** | `/admin/reports` | Department leaderboard, flagged employees list, PAM trust gauge |

**Campaign trigger types:**
- **Random Wave** — picks 10–20% of all employees at random, random module, one click
- **Single** — target one specific employee, choose module and template
- **Bulk** — target all employees in a department or a random percentage

---

## Running Locally

### Prerequisites

- Python 3.10+, Node 18+
- MongoDB running (local or Atlas URI in `.env`)
- Docker for Redis

### Step 1 — Redis

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### Step 2 — Environment variables

```bash
cd PSB-Hackathon/backend
cp app/.env.sample app/.env
```

Minimum required values in `app/.env`:
```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=wealthvault
SECRET_KEY=any-random-32-char-string
SENTINEL_BASE_URL=http://localhost:5174
```

For email delivery (optional in dev — simulations work without it, emails just won't send):
```
GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
SENTINEL_SENDER_EMAIL=security-ops@yourdomain.com
```

### Step 3 — Install backend dependencies

```bash
cd PSB-Hackathon/backend
pip install -r requirements.txt
```

### Step 4 — Seed the database

Creates 20 test employees, simulation profiles, and all templates:

```bash
cd PSB-Hackathon/backend
python -m app.simulation.seed
```

Expected output:
```
Seeded X phishing templates
Seeded X social_eng templates
Seeded X incident_drill templates
Created 20 employees
Done.
```

### Step 5 — Start the backend

```bash
cd PSB-Hackathon/backend
uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload
```

### Step 6 — Start the frontend

```bash
cd PSB-Hackathon/sentinel/frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5174**

---

## Testing Without Gmail

Because email delivery requires a Google Workspace service account, you can test every part of the system without sending real emails by constructing the tracking links manually.

### Test a phishing harvest page

1. Log in to the admin panel at `http://localhost:5174/admin/login`
2. Navigate to **Campaigns** → click any campaign row → note an `assignment_id`
3. In the backend, find the corresponding `simulation_attempts` document in MongoDB and copy its `attempt_id`
4. Generate a token using the token service:
   ```python
   # Run in a Python shell inside backend/
   from app.simulation.services.token_service import create_tracking_token
   token = create_tracking_token("phishing", "<attempt_id>", "<assignment_id>")
   print(token)
   ```
5. Visit: `http://localhost:5174/sentinel/landing/harvest/rbi_portal?token=<token>`

Test all four variants by changing the path segment:
- `/sentinel/landing/harvest/rbi_portal?token=...`
- `/sentinel/landing/harvest/internal_it?token=...`
- `/sentinel/landing/harvest/upi_verification?token=...`
- `/sentinel/landing/harvest/hr_portal?token=...`

### Test a social engineering page

Visit: `http://localhost:5174/sentinel/landing/social/<token>`

The page fetches from `GET /api/sim/social/<token>` on load. With a valid token the scenario loads; with an invalid token it shows a plain error.

### Test an incident drill page

Visit: `http://localhost:5174/sentinel/landing/incident/<token>`

The page fetches form fields from `GET /api/sim/incident/form/<token>`, then starts the countdown timer.

### Test the full phishing click redirect flow

Hit the tracking URL directly (simulates clicking the email link):

```
http://localhost:5174/api/sim/phishing/click/<token>
```

This resolves the `harvest_page_type` from the template and redirects to the correct React harvest page.

---

## Using ngrok for Real Email Links

Email tracking links must be publicly accessible so employees can click them from any device. In development:

```bash
ngrok http 5174
# e.g. https://abc123.ngrok.io
```

Update `.env`:
```
SENTINEL_BASE_URL=https://abc123.ngrok.io
```

Restart the backend. All new campaign tracking links will now use the ngrok URL.

---

## Quick Smoke Test Checklist

| Test | Expected result |
|---|---|
| Seed runs without errors | 20 employees in MongoDB, templates present |
| `GET /api/v1/admin/sim/stats/overview` (with admin JWT) | Returns stats JSON |
| Admin panel loads at `localhost:5174/admin/overview` | Stats cards, chart visible |
| Campaigns page | Table loads with mock data or seeded campaigns |
| Harvest page `rbi_portal` | Navy RBI login form, submitting redirects to 503 error page |
| Harvest page `upi_verification` | Green NPCI form, MPIN field with letter spacing |
| Social eng page (valid token) | Jira-like audit portal, situation + option buttons |
| Social eng page (invalid token) | Shows error, no crash |
| Incident drill page | Form with countdown timer, timer color changes at 2 min |
| Random Wave button in Overview | Creates campaign, shows success with `campaign_id` |

---

## File Map

```
PSB-Hackathon/
├── backend/app/simulation/
│   ├── routes/
│   │   ├── admin.py          ← superadmin campaign/employee/report endpoints
│   │   ├── portal.py         ← employee portal endpoints
│   │   └── sim_tracking.py   ← unauthenticated token-based tracking
│   ├── services/
│   │   ├── campaign_service.py   ← assignment creation, email delivery dispatch
│   │   ├── scoring.py            ← score_phishing, score_social_eng, score_incident_drill, PAM
│   │   ├── token_service.py      ← JWT create/decode for tracking tokens
│   │   ├── email_service.py      ← Gmail API wrapper
│   │   ├── report_generator.py   ← HTML report generation
│   │   └── scraper.py            ← RBI/CERT-In scraper
│   ├── models/simulation.py      ← Pydantic request/response models
│   └── seed.py                   ← database seeding script
│
└── sentinel/frontend/src/
    ├── pages/sentinel/
    │   ├── PhishingHarvestPage.tsx   ← 4-variant impersonation harvest form
    │   ├── SocialEngPage.tsx         ← Jira-like audit portal
    │   └── IncidentDrillPage.tsx     ← IMS form with countdown timer
    └── pages/admin/
        ├── Overview.tsx      ← stats, Random Wave modal, Campaign Builder modal
        ├── Simulations.tsx   ← campaign table with inline expansion
        ├── Employees.tsx     ← employee intelligence table
        ├── Threats.tsx       ← threat intel review
        └── Reports.tsx       ← leaderboard, flagged list, PAM gauge
```
