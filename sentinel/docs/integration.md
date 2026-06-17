# WealthVault — Employee Fraud Simulation Lab Integration Guide

## Overview

The Simulation Lab (`sentinel/`) is a standalone module that runs alongside the main WealthVault platform. It delivers realistic phishing emails, social engineering scenarios, and incident drills to bank employees — without their knowledge — then generates detailed analysis reports after each simulation concludes.

- **Employee Portal** (`localhost:5174`) — mock internal banking portal. Employees log in and interact with what appears to be a real banking system.
- **Admin Control Panel** (`localhost:5174/admin`) — simulation management interface for superadmin and compliance officers.
- **Backend** — simulation API routes are mounted on the existing FastAPI backend (`localhost:8000`) at `/api/v1/portal/`, `/api/v1/admin/sim/`, and `/api/sim/` (token-based, no auth).

---

## Architecture

```
PSB-Hackathon/
├── backend/                  # Existing FastAPI backend (shared)
│   └── app/
│       └── simulation/       # Simulation module (new)
│           ├── models/       # Pydantic models
│           ├── routes/       # portal.py, admin.py, sim_tracking.py
│           ├── services/     # scoring, reports, email, scraper, tokens
│           └── seed.py       # Seed data script
│
└── sentinel/
    └── frontend/             # Vite + React + Tailwind (port 5174)
        └── src/
            ├── pages/portal/ # Employee portal pages
            └── pages/admin/  # Admin control panel pages
```

---

## PAM Trust Signal

The `employee_simulation_profiles` collection stores a `pam_trust_score` (float 0–1) keyed by `employee_id_hash`.

```js
// MongoDB query to get trust score for an employee
db.employee_simulation_profiles.findOne(
  { employee_id_hash: sha256(employee_id) },
  { pam_trust_score: 1 }
)
```

Scores below `0.5` indicate elevated risk. The main WealthVault platform should increase maker-checker thresholds for privileged actions when `pam_trust_score < 0.5`.

---

## User Sync

The Simulation Lab uses the **same `users` collection** as the main platform. No separate user management is needed. The `role` field controls access:

- `employee`, `teller`, `loan_officer`, `IT_admin` → Employee Portal access
- `compliance_officer` → Employee Portal + read-only admin access  
- `superadmin` → Full admin control panel access

Simulation collections store only `employee_id_hash` (SHA-256 of `employee_id`) — never names or raw emails.

---

## Report Delivery

After every simulation completes, a detailed analysis report is:
1. Stored in the `analysis_reports` collection
2. Sent to the employee's registered email via SMTP
3. Delivered to the employee's Internal Mail inbox (`sim_inbox_emails` collection)

The portal inbox API (`GET /api/v1/portal/inbox`) merges simulation report emails with fake benign emails. The main platform should call this endpoint to render the employee inbox.

---

## API Routes

### Employee Portal (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/portal/dashboard` | Mock dashboard data |
| GET | `/api/v1/portal/inbox` | Merged inbox (benign + simulation) |
| GET | `/api/v1/portal/inbox/{email_id}` | Full email content |
| POST | `/api/v1/portal/inbox/{email_id}/report` | Report phishing |

### Simulation Tracking (token-based, no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sim/phishing/click/{token}` | Log click, show harvest page |
| POST | `/api/sim/phishing/credentials/{token}` | Log credential submission |
| GET | `/api/sim/social/{token}` | Get scenario node |
| POST | `/api/sim/social/respond/{token}` | Submit scenario response |
| GET | `/api/sim/incident/form/{token}` | Get incident form template |
| POST | `/api/sim/incident/submit/{token}` | Submit incident report |

### Admin (superadmin/compliance_officer JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/sim/stats/overview` | Platform stats |
| GET | `/api/v1/admin/sim/employees` | Employee profiles |
| POST | `/api/v1/admin/sim/campaigns/single` | Trigger single employee |
| POST | `/api/v1/admin/sim/campaigns/random` | Launch random wave |
| POST | `/api/v1/admin/sim/campaigns/bulk` | Bulk campaign |
| GET | `/api/v1/admin/sim/threats` | Threat intelligence |
| POST | `/api/v1/admin/sim/scraper/run` | Manual scraper trigger |
| GET | `/api/v1/admin/sim/reports/leaderboard` | Dept leaderboard |
| GET | `/api/v1/admin/sim/reports/posture` | Security posture score |

---

## MongoDB Collections

| Collection | Description |
|-----------|-------------|
| `users` | Shared with main platform. Source of employee names/emails. |
| `simulation_templates` | Phishing, social eng, incident drill templates |
| `simulation_campaigns` | Campaign records (single, bulk, random) |
| `simulation_assignments` | Per-employee assignments with tracking tokens |
| `simulation_attempts` | Attempt records with actions and scores |
| `employee_simulation_profiles` | Aggregated per-employee stats and PAM trust score |
| `sim_inbox_emails` | Simulation emails delivered to Internal Mail |
| `scraped_threats` | RBI/CERT-In threat intelligence items |
| `analysis_reports` | Generated post-simulation analysis reports |

---

## Environment Variables

Add these to `backend/app/.env`:

```env
# Simulation email delivery
SIMULATION_SMTP_HOST=localhost
SIMULATION_SMTP_PORT=1025
SIMULATION_SMTP_FROM=security@rbi-verify.in
REPORT_SMTP_FROM=security@psb-internal.in
SMTP_USERNAME=
SMTP_PASSWORD=

# Simulation config
SIMULATION_ASSIGNMENT_DUE_HOURS=168
SCRAPER_RBI_URL=https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx
SCRAPER_CERTIN_URL=https://www.cert-in.org.in/
BASE_URL=http://localhost:8000
```

---

## Local Development Setup

```bash
# 1. Start MongoDB (Atlas or local)
# Ensure MONGODB_URL is set in backend/app/.env

# 2. Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# 3. Start Kafka (optional)
cd PSB-Hackathon && docker-compose up -d

# 4. Start MailHog (local SMTP for dev email capture)
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
# View emails at http://localhost:8025

# 5. Seed the database
cd PSB-Hackathon/backend
python -m app.simulation.seed

# 6. Start backend
cd PSB-Hackathon/backend
uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload

# 7. Start sentinel frontend
cd PSB-Hackathon/sentinel/frontend
npm install
npm run dev
# Portal: http://localhost:5174
# Admin:  http://localhost:5174/admin

# 8. Start main frontend (unchanged)
cd PSB-Hackathon/frontend
npm run dev   # http://localhost:5173
```

---

## Threat Intelligence Scraper Schedule

The scraper runs daily at 2:00 AM via APScheduler (registered in the existing `simulation/seed.py` scheduler setup). New items require compliance officer or superadmin approval before entering the template pool. Manual trigger: `POST /api/v1/admin/sim/scraper/run`.

---

## Scoring Reference

| Module | Passing Score | Key Factors |
|--------|--------------|-------------|
| Phishing | ≥ 70 | reported_phishing = 100, clicked = −50, credentials = 0 (fail) |
| Social Eng | ≥ 70 | Sum of option scores / max possible × 100 |
| Incident Drill | ≥ 70 | Completeness (40) + Escalation (30) + Time (20) + Quality (10) |

**Certification Tiers:** Needs Training (<50) → Aware (50–74) → Trained (75–89) → Certified (≥90)
