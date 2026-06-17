# Sentinel Plugin — Integration Guide

## Plugin Registration

Two lines to add to the existing platform.

**`backend/app/app.py`** — add after the existing route imports:
```python
from app.simulation.routes import portal as sim_portal, sim_tracking, admin as sim_admin

app.include_router(sim_portal.router, prefix="/api/v1")
app.include_router(sim_tracking.router, prefix="/api")   # mounts at /api/sim/*
app.include_router(sim_admin.router, prefix="/api/v1")
```

**`sentinel/frontend/src/App.tsx`** — add sentinel landing routes inside `<Routes>`:
```tsx
import PhishingHarvestPage from './pages/sentinel/PhishingHarvestPage'
import SocialEngPage from './pages/sentinel/SocialEngPage'
import IncidentDrillPage from './pages/sentinel/IncidentDrillPage'

// Inside <Routes> — no auth wrapper, accessed from email links:
<Route path="/sentinel/landing/harvest/:type" element={<PhishingHarvestPage />} />
<Route path="/sentinel/landing/social/:token" element={<SocialEngPage />} />
<Route path="/sentinel/landing/incident/:token" element={<IncidentDrillPage />} />
```

---

## Sidebar Extension

Add to `AdminLayout.tsx` NAV array:

```tsx
const NAV = [
  { to: 'overview',    label: 'Overview',              icon: LayoutDashboard },
  { to: 'employees',   label: 'Employee Intelligence', icon: Users },
  { to: 'simulations', label: 'Campaigns',             icon: Zap },
  { to: 'threats',     label: 'Threat Intelligence',   icon: Shield },
  { to: 'reports',     label: 'Reports',               icon: FileBarChart },
]
```

All five items live under the existing `/admin/` layout — no new layout component required.

---

## PAM Trust Signal

`pam_trust_score` is a float (0–1) on `employee_simulation_profiles`, keyed by `employee_id_hash`.

**MongoDB query to read for a specific employee:**
```python
profile = await db.employee_simulation_profiles.find_one(
    {"employee_id_hash": employee_id_hash},
    {"pam_trust_score": 1, "_id": 0}
)
trust = profile["pam_trust_score"] if profile else 1.0
```

**Integration rule:** If `pam_trust_score < 0.5`, increase maker-checker threshold for that employee's privileged actions.

```python
# Example in a transaction approval handler:
if trust < 0.5:
    required_approvers = 2   # dual approval required
else:
    required_approvers = 1
```

The score is recalculated after every simulation attempt and reflects the employee's real-time security awareness level. A score of 0 means the employee has never completed a simulation or has consistently failed.

---

## Gmail Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project or select your Workspace project.
2. Enable the **Gmail API** under APIs & Services → Library.
3. Create a **Service Account** under IAM & Admin → Service Accounts. Download the credentials JSON file.
4. In **Google Workspace Admin Console** → Security → API Controls → Domain-wide delegation, add the service account client ID with scope `https://www.googleapis.com/auth/gmail.send`.
5. Set the environment variable:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account-key.json
   SENTINEL_SENDER_EMAIL=security-ops@yourdomain.com
   SENTINEL_REPORT_SENDER_EMAIL=security-team@yourdomain.com
   ```
6. The service account impersonates `SENTINEL_SENDER_EMAIL`. This address must belong to your Google Workspace domain. SPF/DKIM pass automatically because the sending domain is legitimate.

---

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Absolute path to the Google service account credentials JSON file |
| `GOOGLE_WORKSPACE_DOMAIN` | Your Google Workspace domain, e.g. `psb-internal.in` |
| `SENTINEL_SENDER_EMAIL` | The delegated sender address for simulation emails |
| `SENTINEL_REPORT_SENDER_EMAIL` | The sender address for post-simulation analysis reports |
| `SENTINEL_ASSIGNMENT_DUE_HOURS` | Default hours before an assignment expires (default: `168`) |
| `SCRAPER_RBI_URL` | RBI press releases URL (default: `https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx`) |
| `SCRAPER_CERTIN_URL` | CERT-In advisories URL (default: `https://cert-in.org.in`) |
| `SENTINEL_BASE_URL` | Public base URL for tracking links in emails — **must be internet-accessible**. Use an ngrok URL in development. Example: `https://abc123.ngrok.io` |

---

## Running Locally

```bash
# 1. Install backend dependencies
cd PSB-Hackathon/backend
pip install -r requirements.txt
# Optional ML features:
pip install torch transformers huggingface_hub

# 2. Set environment variables
cp app/.env.sample app/.env
# Edit app/.env with your values

# 3. Seed the database (creates 20 test employees + templates)
python -m app.simulation.seed

# 4. Start FastAPI backend
uvicorn app.app:app --reload --port 8000

# 5. In a separate terminal, start the frontend
cd PSB-Hackathon/sentinel/frontend
npm install
npm run dev
# Vite dev server runs on http://localhost:5174
```

**ngrok for tracking links** (required for Gmail email links to work in development):
```bash
ngrok http 5174
# Copy the https URL, e.g. https://abc123.ngrok.io
# Set SENTINEL_BASE_URL=https://abc123.ngrok.io in app/.env
```

Without a publicly accessible `SENTINEL_BASE_URL`, simulation emails will contain links pointing to `localhost`, which only work if the email recipient opens them on the same machine.

---

## Adding Templates

Templates live in the `sentinel_templates` MongoDB collection. The `active` field must be `true` for a template to appear in the assignment pool.

**Phishing template structure:**
```json
{
  "template_id": "uuid",
  "module": "phishing",
  "difficulty": "medium",
  "role_relevance": ["teller", "loan_officer"],
  "source": "manual",
  "active": true,
  "content": {
    "sender_display_name": "RBI Security Helpdesk",
    "sender_email": "security-noreply@psb-internal.in",
    "reply_to": "rbi.helpdesk@rbi-alerts.in",
    "subject": "Urgent: Verify your {{department}} portal access",
    "body_html": "...",
    "harvest_page_type": "rbi_portal",
    "red_flags": ["display name spoofing", "urgency language"],
    "correct_action": "click_report_link",
    "impersonation_target": "RBI"
  }
}
```

**Social engineering template** — requires a `nodes` object with decision tree. See `backend/app/simulation/seed.py` for complete examples.

**Incident drill template** — requires `required_fields` array and `correct_escalation_path` string.

The `harvest_page_type` field on phishing templates controls which impersonation variant is shown (`rbi_portal`, `internal_it`, `upi_verification`, `hr_portal`). Set it to match the impersonation scenario.
