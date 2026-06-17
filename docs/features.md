# WealthVault — Feature Documentation

---

## 1. Authentication

### Multi-Step Registration

New users go through a 3-phase registration before their account is created.

**Phase 1 — Email verification**
- `POST /api/v1/auth/register/send-email-otp?email=` — generates a 6-digit OTP (10-minute TTL), stores in Redis, sends via SMTP.
- `POST /api/v1/auth/register/verify-email-otp?email=&otp=` — verifies OTP, marks email as pre-verified in Redis. Checks CountingBloomFilter for duplicate email before proceeding.

**Phase 2 — Phone verification**
- `POST /api/v1/auth/register/send-phone-otp?phone=` — sends OTP via Twilio SMS to the phone number.

**Phase 3 — Complete registration**
- `POST /api/v1/auth/register/complete` — accepts `email`, `password`, `full_name`, `phone`, `email_otp`, `phone_otp`, `captcha_token`. Validates Cloudflare Turnstile, verifies both OTPs, hashes password with Argon2, stores user with AES-256-GCM encrypted PII fields. Issues JWT access + refresh token cookies.

### Login

`POST /api/v1/auth/login` — accepts `email`, `password`, `captcha_token`.
1. Validates Turnstile CAPTCHA.
2. Looks up user by SHA-256 deterministic hash of email.
3. Verifies Argon2 password hash.
4. Creates a session in Redis (`user_sessions:{user_id}`) with device fingerprint, IP, user-agent, and geolocation.
5. Returns httpOnly SameSite=lax cookies: `access_token` (30-min JWT HS256) and `refresh_token` (7-day JWT HS256), both bound to `session_id`.

The frontend (`Login.tsx`) collects 12 behavioural biometric signals via `useBiometrics` hook and sends them to `POST /api/v1/ml/behavior-anomaly` at login time. A risk score above threshold triggers an alert.

### Token Refresh

`POST /api/v1/auth/refresh` — reads the `refresh_token` cookie, validates it, issues new `access_token` cookie. Called automatically by the Axios 401 interceptor in `api.ts`.

### Logout

`POST /api/v1/auth/logout` — revokes the current session from Redis, clears both cookies.

### Password Reset

1. `POST /api/v1/auth/request-password-reset` — accepts email. Rate-limited to 3 requests per hour. Sends OTP to registered email address.
2. `POST /api/v1/auth/reset-password` — accepts `email`, `otp`, `new_password`. Maximum 5 OTP attempts.

### Recovery Information

- `PUT /api/v1/auth/recovery-info` — set recovery email / phone.
- `POST /api/v1/auth/recovery-info/send-otp` — send OTPs to new recovery channels.
- `POST /api/v1/auth/recovery-info/verify-and-update` — verify OTPs and commit the update.

### Profile Update

`PUT /api/v1/auth/profile` — update `language`, `avatar_url`, `is_new_user`, `theme_mode`, `accessibility`. Settings are persisted and loaded back on session rehydration.

---

## 2. Account Management

### Internal Accounts

**Create:** `POST /api/v1/accounts/` — `account_type` (savings / current / fixed_deposit), `bank_name`, `initial_deposit`. Generates an account number, stores with AES-256-GCM encryption and SHA-256 deterministic hash for lookup. Requires KYC verification (`require_kyc` dependency).

**List:** `GET /api/v1/accounts/` — returns all accounts owned by the authenticated user. PII decrypted on the way out.

**Detail:** `GET /api/v1/accounts/{id}`

**Delete:** `DELETE /api/v1/accounts/{id}` — removes account. Restricted to account owner.

### External Account Linking

`POST /api/v1/accounts/link-external` — accepts `bank_name`, `account_number`, `ifsc_code`, `account_holder_name`. Stored with `is_external: true`. Used as source or destination for payments.

### Freeze / Unfreeze

- `PUT /api/v1/accounts/{id}/freeze` — sets `is_frozen: true`. Restricted to employee / admin roles.
- `PUT /api/v1/accounts/{id}/unfreeze` — sets `is_frozen: false`. Same restriction.

Frozen accounts cannot be used as a payment source; the payments route checks this before OTP dispatch.

---

## 3. Transactions

### Create Transaction

`POST /api/v1/transactions/` — accepts `account_id`, `amount`, `transaction_type` (debit/credit), `category`, `description`.

**Fraud detection pipeline (inline):**
1. **M2 BERT classifier** — auto-classifies category if not provided. 7 categories: food, shopping, utilities, healthcare, travel, entertainment, other.
2. **M6 LSTM sequence anomaly** — scores the transaction in context of recent history.
3. **M4 RiskMLP** — 13-feature vector (amount normalised, time-of-day, day-of-week, account age, balance after, category encoded, ML anomaly score, is_international, is_new_payee, velocity_count, large_txn flag, high_risk_category flag, M2 confidence) → outputs risk score (0–1) and decision: `approve` / `review` / `block`.

If `block` → `HTTP 403 Transaction blocked by fraud detection`.
If high-risk → inserts into `fraud_logs` collection, creates security alert notification.
Family spending limit check: if user is a family member, their total monthly spend is compared to the limit set by the family head.
Budget breach check: if the transaction would exceed a budget for the category (or "General"), a pipe-delimited alert string is stored in the notification.
Kafka event published to `user.activity`. Email and SMS alerts sent.

### List Transactions

`GET /api/v1/transactions/` — optional query params: `account_id`, `category`, `limit` (default 50).

### Spending Analysis

`GET /api/v1/transactions/spending-analysis?months=N` — aggregates debit amounts by category over the last N months. Returns category breakdowns used in dashboard spending charts.

---

## 4. Payments

### Initiate Payment

`POST /api/v1/payments/initiate` — accepts:
- `from_account_id` — source account (must belong to current user, must not be frozen, must have sufficient balance)
- `to_account_number` or `to_vpa` — destination
- `amount`, `description`
- `otp_channel` — `email` or `sms`

**VPA resolution:** if `to_vpa` is provided, the email prefix (before `@`) is looked up by deterministic hash to find the payee's account. If `to_account_number` is provided, it is resolved by its SHA-256 hash.

Creates a pending payment record. Generates a 6-digit OTP, stores in Redis with 10-minute TTL. Sends OTP via selected channel. Returns `payment_id`.

### Verify Payment

`POST /api/v1/payments/verify` — accepts `payment_id`, `otp`.
- Maximum 5 attempts (tracked in Redis). After 5 failures, payment is locked for 1 hour.
- On success: deducts from source account, credits destination account, creates transaction records, publishes Kafka events, sends SMS alert.
- Post-commit risk scoring based on amount size, account age, and SIM binding; raises flag if high risk.

### Resend OTP

`POST /api/v1/payments/{id}/resend?otp_channel=` — maximum 3 resends per payment.

### Payment History

`GET /api/v1/payments/` — returns all payments (any status) for the authenticated user.

### QR Code

`GET /api/v1/payments/qr/generate?amount=&description=` — returns a UPI-format QR string `upi://pay?pa={vpa}&am={amount}&tn={description}`.

---

## 5. Investments

### Portfolio

`GET /api/v1/investments/portfolio` — aggregates all holdings by type (equity, mutual_fund, gold, crypto, fd, bonds). Returns total portfolio value and allocation breakdown.

### Live Stock Quotes

`GET /api/v1/investments/stocks` — fetches real-time NSE stock prices via Yahoo Finance v7 API with crumb authentication. Returns up to 20 popular NSE-listed stocks with current price, change, and change %.

### Investment CRUD

- `POST /api/v1/investments/` — buy: `investment_type`, `symbol`, `amount`, `quantity`. Stores with user_id.
- `GET /api/v1/investments/` — list all holdings.
- `DELETE /api/v1/investments/{id}` — sell / remove position.

### Market News

`GET /api/v1/investments/news` — parses Economic Times RSS feed (`economictimes.indiatimes.com/markets/rss.cms`). Returns up to 10 articles with title, link, published date.

### Financial Goals

- `GET /api/v1/investments/goals` — list goals.
- `POST /api/v1/investments/goals` — create: `name`, `target_amount`, `current_amount`, `deadline`.
- `DELETE /api/v1/investments/goals/{id}` — delete.
- `GET /api/v1/investments/goals/smart-insights` — Groq LLM analysis of all goals. Fetches current account balances and budget data, projects monthly savings, and assesses whether each goal is achievable by its deadline. Returns structured text advice per goal.

### SIP Management

- `GET /api/v1/investments/sips` — list active SIPs.
- `POST /api/v1/investments/sips` — create: `name`, `fund_name`, `fund_category`, `amount`, `frequency` (monthly/weekly/quarterly), `start_date`, `account_id`, `step_up_pct` (optional annual step-up percentage), `goal_id` (optional goal linkage).
- `PATCH /api/v1/investments/sips/{id}` — update `amount`, `frequency`, `status` (active/paused/stopped), `step_up_pct`.

### First-Time Investor Tips

`GET /api/v1/investments/first-time-tips` — if the user's `is_first_time_investor` flag is true, calls Groq to generate beginner investment advice tailored to the Indian market. Returns a list of tips.

### Mark Invested

`POST /api/v1/investments/mark-invested` — sets `is_first_time_investor: false` on the user record.

---

## 6. Loans

### Apply for Loan

`POST /api/v1/loans/apply` — requires KYC verification. Accepts `loan_type`, `amount`, `tenure_months`, `purpose`.

**Interest rates (per annum):**

| Loan Type | Rate |
|---|---|
| Personal | 12.5% |
| Home | 8.5% |
| Vehicle | 9.5% |
| Education | 7.5% |
| Business | 14.0% |

**EMI formula (reducing balance):**

```
EMI = P × r × (1+r)^n / ((1+r)^n - 1)
where r = monthly_rate = annual_rate / 12 / 100
      n = tenure_months
```

Loan is created with `status: pending`. An admin must approve or reject it. Kafka event published. User receives in-app notification with EMI amount.

### List Loans

`GET /api/v1/loans/` — returns all loans (pending, approved, rejected, disbursed) for the user.

### Admin Loan Management

- `GET /api/v1/admin/loans?status=` — filter by status.
- `PUT /api/v1/admin/loans/{id}/approve` — sets `status: approved`.
- `PUT /api/v1/admin/loans/{id}/reject` — sets `status: rejected`.

---

## 7. Budgets

### Create Budget

`POST /api/v1/budgets/` — `category` (matches transaction categories), `amount_limit`, `period` (monthly by default).

### List Budgets

`GET /api/v1/budgets/` — returns all budgets for the user. Each budget includes `spent_amount` (calculated dynamically as sum of debits in the current month for that category) and `status`:
- `healthy` — spent < 80% of limit
- `warning` — spent 80–100% of limit
- `exceeded` — spent > limit

### Delete Budget

`DELETE /api/v1/budgets/{id}`

---

## 8. Asset Vault

### Add Asset

`POST /api/v1/assets/` — `name`, `asset_type` (property / gold / vehicle / jewellery / other), `purchase_price`, `current_valuation`, `purchase_date`, `description`.

### List Assets

`GET /api/v1/assets/` — returns all physical assets owned by the user.

### Delete Asset

`DELETE /api/v1/assets/{id}`

### Net Worth Summary

`GET /api/v1/assets/net-worth-summary` — computes:
- **Liquid cash** — sum of all internal account balances.
- **Investments** — sum of all investment amounts.
- **Physical assets** — sum of all asset current valuations.
- **Total net worth** — sum of all three components.

---

## 9. Family Banking

### Create Family Group / Invite Member

`POST /api/v1/family/invite` — `invitee_email`. If the inviter has no family group, one is created with them as head. Sends an invitation with 7-day expiry.

### Accept / Reject Invitation

`POST /api/v1/family/respond` — `invitation_id`, `action` (accept / reject).

### Set Spending Limit

`POST /api/v1/family/set-limit` — family head only. `member_user_id`, `spending_limit`. Sets monthly spending cap enforced at transaction time.

### View Family

`GET /api/v1/family/my-family` — returns group members with their spending limits and monthly spend to date.

### Pending Invitations

`GET /api/v1/family/invitations` — returns open invitations for the current user.

### Remove Member

`DELETE /api/v1/family/member/{id}` — family head only.

---

## 10. Credit Score

`GET /api/v1/credit/score` — calculates a score in the range 300–900 from real account data:

| Factor | Effect |
|---|---|
| Active loans > ₹10,00,000 | -50 |
| Active loans ₹5,00,000–₹10,00,000 | -20 |
| Active loans (manageable) | +10 |
| High-risk transactions (risk_score > 0.7) last 30 days | -15 per transaction |
| Credits > debits × 1.2 (healthy income flow) | +20 |
| Debits > credits | -15 |
| Account balance > ₹1,00,000 | +30 |
| Account balance < ₹10,000 | -20 |

Rating: **Good** (≥ 750), **Average** (600–749), **Poor** (< 600).

---

## 11. Tax Helper

`GET /api/v1/tax/summary` — scans all investments and identifies Section 80C eligible instruments:

| Instrument | Detection Method |
|---|---|
| ELSS Mutual Funds | `investment_type == "elss"` or symbol contains "elss" / "tax" |
| PPF | `investment_type == "ppf"` or symbol contains "ppf" |
| NSC | `investment_type == "nsc"` |
| Tax Saver FD | `investment_type == "tax_saver_fd"` |
| ULIP | `investment_type == "ulip"` |
| NPS | `investment_type == "nps"` or symbol contains "nps" |

Returns:
- `section_80c_limit` — ₹1,50,000 (FY 2024-25)
- `total_invested` — sum of eligible investments
- `remaining_limit` — limit minus invested
- `utilization_pct` — % of limit used
- `potential_tax_saved` — invested × 30% (highest bracket)
- `max_possible_savings` — ₹45,000 (₹1,50,000 × 30%)
- `additional_savings_possible` — remaining × 30%
- `suggestions` — dynamic text recommendations based on utilization

---

## 12. AI / ML Features

### AI Recommendations

`GET /api/v1/ml/recommendations` — response cached 300 seconds in Redis per user. Fetches live financial context (accounts, transactions, loans, investments) and sends to Groq (`llama-3.3-70b-versatile`) for personalised recommendations. Numbers encoded with MockHomomorphicEncryption before the LLM call.

### Spending Insights

`GET /api/v1/ml/spending-insights` — returns category breakdown of recent spending, top spending category, average transaction size, and an LLM-generated natural language summary.

### Account Insights

`GET /api/v1/ml/account-insights` — account health analysis: balance trends, deposit frequency, utilization ratios.

### SIP Insights

`GET /api/v1/ml/sip-insights` — analysis of existing SIPs: projected corpus at maturity, step-up impact, diversification assessment.

### Asset Insights

`GET /api/v1/ml/asset-insights` — physical asset portfolio analysis: valuation trends, allocation recommendations.

### Loan Insights

`GET /api/v1/ml/loan-insights` — debt analysis: EMI-to-income ratio, prepayment recommendations, consolidation options.

### What-If Scenario Planner

`POST /api/v1/ml/whatif-scenario` — `scenario_type` (e.g., "save_more", "invest_equity", "repay_loan") and optional `custom_query`. Groq generates a structured projection with numerical estimates, encoded through MockHomomorphicEncryption.

### AI Chatbot

`POST /api/v1/ml/chatbot` — `message`. Fetches live user financial data (account balances, recent transactions, active loans) to provide context-aware responses. Implemented with Groq.

### Voice Agent

`POST /api/v1/ml/voice-agent` — `message`. Natural-language banking commands (e.g., "What is my balance?"). Returns structured JSON with action type and extracted parameters.

### Transaction Classifier

`POST /api/v1/ml/classify-transaction` — `text`. Uses M2 BERT multilingual model to assign one of 7 categories: food, shopping, utilities, healthcare, travel, entertainment, other. Used inline in transaction creation and available as a standalone demo endpoint.

### Behavioral Anomaly Detection

`POST /api/v1/ml/behavior-anomaly` — `behavior_data` (12 biometric features), optional `email`. Uses M1 Isolation Forest model. Returns `is_anomaly` (bool) and `anomaly_score` (float, higher = more anomalous). Called by the frontend during login with `_skipAuthRefresh: true` to avoid auth redirect loops on 401.

### Cashflow Forecast

`POST /api/v1/ml/forecast-cashflow` — `days` (default 30). Projects daily inflows and outflows based on historical patterns. Returns an array of `{date, projected_balance, inflow, outflow}` objects for the cashflow chart.

### WealthAdvisor Agent

`POST /api/v1/agents/advisor` — `user_query`. Builds a real financial profile (account balances, monthly income, expenses, savings rate) from live data, then calls Groq with full context to answer the user's query. Returns plaintext advice.

### WealthTeacher Agent

`POST /api/v1/agents/teacher` — `payload`. Builds a real activity profile (transaction counts, categories used) and generates personalised financial literacy lessons via Groq. Returns lesson content.

---

## 13. KYC Verification

### Upload

`POST /api/v1/kyc/upload` — accepts base64-encoded images: `aadhaar_front`, `aadhaar_back`, `pan`, plus optional `aadhaar_number` and `pan_number` for pre-validation.

**Validation pipeline:**
1. Google Cloud Vision API (`TEXT_DETECTION`) extracts text from all three images. Tesseract (with OpenCV Otsu threshold) used as fallback.
2. **Aadhaar validation:** extracts 12-digit number using regex, validates Verhoeff checksum.
3. **PAN validation:** validates format `[A-Z]{5}[0-9]{4}[A-Z]` via regex.
4. **Name match:** fuzzy match (thefuzz `partial_ratio`) between Aadhaar name and PAN name. Threshold ≥ 80%.
5. Sets `kyc_status` to `pending` (awaiting admin review).

### Status

`GET /api/v1/kyc/status` — returns current `kyc_status` and extracted summary (masked Aadhaar, PAN, name).

### Admin KYC Actions

`PUT /api/v1/admin/kyc/{user_id}/action` — `action` (accept / reject / request_reupload / escalate), optional `comments`. Role hierarchy enforced: employees can accept/reject/request_reupload; managers can also escalate.

---

## 14. Account Aggregator (AA)

Mock implementation of RBI Account Aggregator framework.

- `POST /api/v1/aa/consent/request` — creates a consent record (in-memory), returns `consent_id`.
- `GET /api/v1/aa/consent/{id}` — first call auto-approves consent; subsequent calls return status.
- `GET /api/v1/aa/accounts` — returns fake multi-bank accounts from PNB, SBI, HDFC, ICICI with random balances.
- `GET /api/v1/aa/transactions/{account_id}` — returns random synthetic transactions for the linked account.

---

## 15. Notifications

### Standard Notifications

- `GET /api/v1/notifications/` — all notifications for the user.
- `PUT /api/v1/notifications/{id}/read` — mark single notification as read.
- `PUT /api/v1/notifications/read-all` — mark all read.

### Security Alerts

- `GET /api/v1/notifications/alerts` — security-level alerts (high-risk transactions, fraud flags, family alerts, pending invitations). Filterable by `is_read`.
- `PUT /api/v1/notifications/alerts/{id}/read`
- `GET /api/v1/notifications/alerts/unread-count` — badge count for the notification bell.

Notifications are created automatically by: transaction creation (debit alerts, fraud flags), payment verification, loan application, family invitation, KYC status change.

---

## 16. Session Management

- `GET /api/v1/sessions` — lists active sessions for the current user from Redis. Each session includes device fingerprint (SHA-256 of UA + OS), IP address, geolocation (city, country via ip-api.com), and creation time.
- `DELETE /api/v1/sessions/{id}` — revoke a specific session.
- `DELETE /api/v1/sessions` — revoke all sessions except the current one.

---

## 17. Admin Features

### User Management (relationship_manager+)

- List all users with optional role filter.
- Update user role.
- Deactivate / activate user account.

### Fraud Alert Management (employee+)

- List all fraud alerts (created by the transaction ML pipeline).
- Resolve a fraud alert with a resolution note.
- Admin also runs GraphSAGE insider threat scan: `GET /api/v1/admin/insider-threat-check` — analyses transaction graph for internal employee-linked anomalies.

### Analytics (relationship_manager+)

`GET /api/v1/admin/analytics` — returns aggregate counts (total users, accounts, transactions, payments, loans) and monthly trend data (new users per month, transaction volumes).

### Risk Dashboard (relationship_manager+)

`GET /api/v1/risk/summary` — system risk score 0–100:
- Fraud alerts last 24 hours → up to 40 points
- High-value transactions last 24 hours → up to 20 points
- OTP failures last hour → up to 20 points
- New user registrations last 7 days → up to 20 points

Risk level: HIGH (≥ 60), MEDIUM (30–59), LOW (< 30).

### Audit Logs (super_admin)

`GET /api/v1/admin/audit-logs` — full audit trail from the `audit_logs` collection. Every admin action and security event is recorded with timestamp, actor, action, and target.

### System Performance (super_admin)

`GET /api/v1/admin/performance` — reads from Redis sorted set `performance:requests` (20-minute sliding window). Returns request latency percentiles, endpoint hit counts, and error rates.

### Employee Notification Summary (employee+)

`GET /api/v1/employee/notifications/summary` — returns pending counts: `kyc_pending`, `kyc_escalated`, `loans_pending`, `fraud_alerts`.

---

## 18. Compliance AI (Sidecar Service)

Runs on port 8002 (path prefix `/compliance-api/api/v1`).

`POST /api/v1/compliance/query` — `text`. Runs through the RAG pipeline:
1. BM25 lexical search on regulatory document chunks.
2. FAISS semantic vector search (embedding model from `EMBEDDING_MODEL` env var).
3. Rule engine for hard-coded compliance checks.
4. Top-K chunks sent to Groq for a grounded answer.

Returns answer text with source citations from RBI/SEBI/DPDP regulatory documents.

**Voice endpoints** (Twilio integration):
- `POST /compliance/voice/inbound` — Twilio webhook for incoming calls.
- `POST /compliance/voice/process` — transcribes speech (Deepgram / Sarvam), runs RAG query.
- `POST /compliance/voice/continue` — streams Amazon Polly Aditi TTS response.

Languages: `en`, `hi`, `pa` (auto-detected from query text).

---

## 19. Security and Privacy

For full security implementation details, see [`security_system.md`](security_system.md).

Key user-facing security features:

- **Two-factor payment OTP** — every payment requires OTP verification. Max 5 attempts, 1-hour lock.
- **Behavioral biometrics** — 12 signals collected at login; M1 Isolation Forest flags anomalous sessions.
- **Device tracking** — known devices recorded with SHA-256 fingerprint and geolocation. `GET /api/v1/auth/devices` returns the list.
- **Security alert reporting** — `POST /api/v1/auth/security/report` lets users flag unauthorized login attempts.
- **Data Privacy page** — static DPDP compliance statement available at `/data-privacy`.
- **Turnstile CAPTCHA** — required on both login and registration (configurable via `ENABLE_TURNSTILE` env var).
