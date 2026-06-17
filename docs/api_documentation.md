# WealthVault — API Documentation

Base URL: `http://localhost:8000/api/v1`

Auth is cookie-based. All protected endpoints require the `access_token` httpOnly cookie set at login. The `Authorization: Bearer <token>` header is accepted as a fallback.

---

## Authentication

### POST /auth/register/send-email-otp

Initiate registration — Step 1: send email OTP.

**Query params:** `email` (string, required)

**Response 200:**
```json
{ "message": "OTP sent to email" }
```

---

### POST /auth/register/verify-email-otp

Verify email OTP — Step 2.

**Query params:** `email`, `otp`

**Response 200:**
```json
{ "message": "Email verified" }
```

**Errors:** `400` — OTP invalid or expired, `400` — Email already registered (Bloom filter hit).

---

### POST /auth/register/send-phone-otp

Send phone OTP for registration — Step 3.

**Query params:** `phone`

**Response 200:**
```json
{ "message": "OTP sent to phone" }
```

---

### POST /auth/register/complete

Complete registration — Final step.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "Priya Sharma",
  "phone": "+919876543210",
  "email_otp": "123456",
  "phone_otp": "654321",
  "captcha_token": "turnstile_token"
}
```

**Response 201:** Sets `access_token` and `refresh_token` httpOnly cookies.
```json
{
  "message": "Registration successful",
  "user": { "id": "...", "email": "...", "role": "customer", "kyc_status": "not_initiated" }
}
```

---

### POST /auth/login

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "captcha_token": "turnstile_token"
}
```

**Response 200:** Sets `access_token` (30 min) and `refresh_token` (7 day) httpOnly cookies.
```json
{
  "message": "Login successful",
  "user": {
    "id": "...", "email": "...", "full_name": "...", "role": "customer",
    "kyc_status": "not_initiated", "language": "en", "theme_mode": "linen"
  }
}
```

**Errors:** `401` — Invalid credentials, `400` — CAPTCHA failed.

---

### POST /auth/logout

Revokes current session. Clears both cookies.

**Response 200:**
```json
{ "message": "Logged out successfully" }
```

---

### POST /auth/refresh

Uses `refresh_token` cookie to issue a new `access_token` cookie.

**Response 200:**
```json
{ "message": "Token refreshed" }
```

**Errors:** `401` — Refresh token invalid or session revoked.

---

### GET /auth/me

Returns the currently authenticated user's profile.

**Response 200:**
```json
{
  "id": "...", "email": "...", "full_name": "...", "phone": "...",
  "role": "customer", "kyc_status": "verified", "is_active": true,
  "language": "en", "theme_mode": "midnight", "accessibility": {},
  "is_first_time_investor": false, "is_new_user": false
}
```

---

### PUT /auth/profile

Update user preferences.

**Body:**
```json
{
  "language": "hi",
  "theme_mode": "midnight",
  "is_new_user": false,
  "accessibility": { "reducedMotion": true, "largeText": true }
}
```

**Response 200:**
```json
{ "message": "Profile updated" }
```

---

### POST /auth/request-password-reset

Rate-limited: 3 requests per hour per email.

**Body:**
```json
{ "email": "user@example.com" }
```

**Response 200:**
```json
{ "message": "OTP sent to your registered email" }
```

---

### POST /auth/reset-password

**Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "new_password": "NewSecure123!"
}
```

**Response 200:**
```json
{ "message": "Password reset successful" }
```

**Errors:** `400` — OTP invalid (max 5 attempts), `400` — OTP expired.

---

### POST /auth/send-otp

Send email OTP for the currently authenticated user (e.g., for email verification after login).

**Response 200:**
```json
{ "message": "OTP sent" }
```

---

### POST /auth/verify-otp

**Query params:** `otp`

**Response 200:**
```json
{ "message": "OTP verified" }
```

---

### POST /auth/send-phone-otp

**Body:**
```json
{ "phone": "+919876543210" }
```

---

### POST /auth/verify-phone

**Body:**
```json
{ "phone": "+919876543210", "otp": "123456" }
```

---

### POST /auth/recovery-info/send-otp

Send OTPs to new recovery channels before updating them.

**Body:**
```json
{ "recovery_email": "backup@example.com", "recovery_phone": "+919876543210" }
```

---

### POST /auth/recovery-info/verify-and-update

**Query params:** `recovery_email`, `recovery_phone`, `email_otp`, `phone_otp`

**Response 200:**
```json
{ "message": "Recovery info updated" }
```

---

### GET /auth/devices

List known devices for the current user.

**Response 200:**
```json
[
  {
    "fingerprint": "abc123...",
    "ip_address": "203.0.113.5",
    "city": "Mumbai",
    "country": "India",
    "last_seen": "2025-05-24T10:00:00Z"
  }
]
```

---

### POST /auth/security/report

Report an unauthorized login attempt.

**Response 200:**
```json
{ "message": "Security alert reported" }
```

---

## Accounts

### GET /accounts/

List all accounts for the authenticated user.

**Response 200:**
```json
[
  {
    "id": "...",
    "account_type": "savings",
    "bank_name": "WealthVault Bank",
    "account_number": "WVLT0001234567",
    "balance": 125000.00,
    "is_frozen": false,
    "is_external": false,
    "created_at": "2025-01-15T09:00:00Z"
  }
]
```

---

### POST /accounts/

Create a new internal account. Requires `kyc_status == verified`.

**Body:**
```json
{
  "account_type": "savings",
  "bank_name": "WealthVault Bank",
  "initial_deposit": 10000
}
```

**Response 201:**
```json
{ "id": "...", "account_number": "WVLT0001234567", "balance": 10000, ... }
```

---

### GET /accounts/{id}

Get single account details.

---

### DELETE /accounts/{id}

Delete an account.

**Response 200:**
```json
{ "message": "Account deleted" }
```

---

### POST /accounts/link-external

Link an external bank account.

**Body:**
```json
{
  "bank_name": "HDFC Bank",
  "account_number": "123456789012",
  "ifsc_code": "HDFC0001234",
  "account_holder_name": "Priya Sharma"
}
```

---

### PUT /accounts/{id}/freeze

Freeze an account. Requires `employee` / `relationship_manager` / `super_admin` role.

**Response 200:**
```json
{ "message": "Account frozen" }
```

---

### PUT /accounts/{id}/unfreeze

Unfreeze an account. Same role restriction.

---

## Transactions

### GET /transactions/

**Query params:** `account_id` (optional), `category` (optional), `limit` (optional, default 50)

**Response 200:**
```json
[
  {
    "id": "...",
    "account_id": "...",
    "amount": 2500.00,
    "transaction_type": "debit",
    "category": "food",
    "description": "Swiggy order",
    "risk_score": 0.12,
    "risk_decision": "approve",
    "created_at": "2025-05-24T12:30:00Z"
  }
]
```

---

### POST /transactions/

Create a transaction. Runs full ML fraud pipeline.

**Body:**
```json
{
  "account_id": "...",
  "amount": 2500.00,
  "transaction_type": "debit",
  "category": "food",
  "description": "Swiggy order"
}
```

**Response 201:**
```json
{
  "id": "...",
  "risk_score": 0.12,
  "risk_decision": "approve",
  ...
}
```

**Errors:** `403` — `{ "detail": "Transaction blocked by fraud detection" }` (M4 decision = block), `403` — Account frozen, `400` — Insufficient balance.

---

### GET /transactions/{id}

Get single transaction detail.

---

### GET /transactions/spending-analysis

**Query params:** `months` (int, optional, default 3)

**Response 200:**
```json
{
  "period_months": 3,
  "category_breakdown": {
    "food": 15000.00,
    "shopping": 8000.00,
    "utilities": 3500.00
  },
  "total_spent": 26500.00
}
```

---

## Payments

### POST /payments/initiate

Requires `kyc_status == verified`.

**Body:**
```json
{
  "from_account_id": "...",
  "to_account_number": "WVLT0009876543",
  "amount": 5000.00,
  "description": "Rent payment",
  "otp_channel": "sms"
}
```

Or using UPI VPA:
```json
{
  "from_account_id": "...",
  "to_vpa": "priya@wealthvault",
  "amount": 5000.00,
  "description": "Transfer",
  "otp_channel": "email"
}
```

**Response 201:**
```json
{
  "payment_id": "...",
  "status": "pending_otp",
  "message": "OTP sent via sms"
}
```

**Errors:** `400` — Insufficient balance, `403` — Account frozen, `404` — Payee not found.

---

### POST /payments/verify

**Body:**
```json
{
  "payment_id": "...",
  "otp": "123456"
}
```

**Response 200:**
```json
{
  "message": "Payment successful",
  "payment_id": "...",
  "amount": 5000.00,
  "to": "WVLT0009876543"
}
```

**Errors:** `400` — Invalid OTP (includes `attempts_remaining`), `400` — OTP expired, `423` — Payment locked (too many failed attempts).

---

### POST /payments/{payment_id}/resend

**Query params:** `otp_channel` (email / sms)

**Response 200:**
```json
{ "message": "OTP resent via sms" }
```

**Errors:** `429` — Maximum resends exceeded.

---

### GET /payments/

List all payments for the authenticated user.

**Response 200:**
```json
[
  {
    "id": "...",
    "from_account_id": "...",
    "to_account_number": "...",
    "amount": 5000.00,
    "status": "completed",
    "description": "Rent payment",
    "created_at": "..."
  }
]
```

---

### GET /payments/qr/generate

**Query params:** `amount` (float), `description` (optional string)

**Response 200:**
```json
{
  "qr_string": "upi://pay?pa=user@wealthvault&am=500.00&tn=Payment"
}
```

---

## Investments

### GET /investments/

List all investment holdings.

**Response 200:**
```json
[
  {
    "id": "...",
    "investment_type": "equity",
    "symbol": "RELIANCE.NS",
    "amount": 50000.00,
    "quantity": 20,
    "created_at": "..."
  }
]
```

---

### POST /investments/

Add a new investment position.

**Body:**
```json
{
  "investment_type": "equity",
  "symbol": "RELIANCE.NS",
  "amount": 50000.00,
  "quantity": 20
}
```

---

### DELETE /investments/{id}

Remove an investment position.

---

### GET /investments/portfolio

**Response 200:**
```json
{
  "total_value": 250000.00,
  "allocation": {
    "equity": 150000.00,
    "mutual_fund": 80000.00,
    "gold": 20000.00
  }
}
```

---

### GET /investments/stocks

Live NSE stock quotes from Yahoo Finance.

**Response 200:**
```json
[
  {
    "symbol": "RELIANCE.NS",
    "name": "Reliance Industries",
    "price": 2850.50,
    "change": 12.30,
    "change_pct": 0.43
  }
]
```

---

### GET /investments/news

Market news from Economic Times RSS.

**Response 200:**
```json
[
  {
    "title": "Sensex gains 300 points",
    "link": "https://...",
    "published": "Sat, 24 May 2025 10:00:00 +0000"
  }
]
```

---

### GET /investments/goals

List financial goals.

---

### POST /investments/goals

**Body:**
```json
{
  "name": "Emergency Fund",
  "target_amount": 300000.00,
  "current_amount": 50000.00,
  "deadline": "2026-12-31"
}
```

---

### DELETE /investments/goals/{id}

---

### GET /investments/goals/smart-insights

Groq-powered achievability analysis for all goals.

**Response 200:**
```json
{
  "insights": "Based on your current savings rate of ₹15,000/month and ₹2,50,000 remaining, your Emergency Fund goal is achievable by June 2026..."
}
```

---

### GET /investments/sips

List all SIPs.

---

### POST /investments/sips

**Body:**
```json
{
  "name": "Wealth Builder SIP",
  "fund_name": "Parag Parikh Flexi Cap Fund",
  "fund_category": "Flexi Cap",
  "amount": 5000,
  "frequency": "monthly",
  "start_date": "2025-06-01",
  "account_id": "...",
  "step_up_pct": 10,
  "goal_id": "..."
}
```

---

### PATCH /investments/sips/{id}

**Body (partial update):**
```json
{ "status": "paused" }
```

---

### GET /investments/first-time-tips

Groq-generated tips for first-time investors. Only returns content if `user.is_first_time_investor == true`.

---

### POST /investments/mark-invested

Sets `is_first_time_investor: false`.

---

## Loans

### POST /loans/apply

Requires `kyc_status == verified`.

**Body:**
```json
{
  "loan_type": "personal",
  "amount": 200000,
  "tenure_months": 24,
  "purpose": "Home renovation"
}
```

**Response 201:**
```json
{
  "id": "...",
  "loan_type": "personal",
  "amount": 200000,
  "tenure_months": 24,
  "interest_rate": 12.5,
  "emi": 9450.32,
  "status": "pending"
}
```

**Interest rates:** personal 12.5%, home 8.5%, vehicle 9.5%, education 7.5%, business 14.0%.

---

### GET /loans/

List all loans for the user.

---

### GET /loans/{loan_id}

Get loan details. Customers can only view their own loans.

---

## Budgets

### GET /budgets/

**Response 200:**
```json
[
  {
    "id": "...",
    "category": "food",
    "amount_limit": 10000,
    "spent_amount": 7500,
    "period": "monthly",
    "status": "warning"
  }
]
```

---

### POST /budgets/

**Body:**
```json
{ "category": "food", "amount_limit": 10000, "period": "monthly" }
```

---

### DELETE /budgets/{id}

---

## Assets

### GET /assets/

---

### POST /assets/

**Body:**
```json
{
  "name": "2BHK Apartment Pune",
  "asset_type": "property",
  "purchase_price": 5000000,
  "current_valuation": 6200000,
  "purchase_date": "2020-03-15",
  "description": "Residential flat"
}
```

---

### DELETE /assets/{id}

---

### GET /assets/net-worth-summary

**Response 200:**
```json
{
  "liquid_cash": 125000,
  "investments": 250000,
  "physical_assets": 6200000,
  "total_net_worth": 6575000
}
```

---

## Family

### POST /family/invite

**Body:**
```json
{ "invitee_email": "spouse@example.com" }
```

---

### POST /family/respond

**Body:**
```json
{ "invitation_id": "...", "action": "accept" }
```

---

### POST /family/set-limit

Family head only.

**Body:**
```json
{ "member_user_id": "...", "spending_limit": 20000 }
```

---

### GET /family/my-family

---

### GET /family/invitations

---

### DELETE /family/member/{id}

Family head only.

---

## Credit

### GET /credit/score

**Response 200:**
```json
{
  "score": 780,
  "rating": "Good",
  "factors": ["No active loans", "Healthy income flow", "Strong savings balance"]
}
```

---

## Tax

### GET /tax/summary

**Response 200:**
```json
{
  "section_80c_limit": 150000,
  "total_invested": 85000,
  "remaining_limit": 65000,
  "utilization_pct": 56.7,
  "tax_saving_investments": [
    { "symbol": "AXIS_ELSS", "type": "ELSS Mutual Funds", "amount": 60000, "invested_on": "..." },
    { "symbol": "PPF_2024", "type": "PPF", "amount": 25000, "invested_on": "..." }
  ],
  "potential_tax_saved": 25500,
  "max_possible_savings": 45000,
  "additional_savings_possible": 19500,
  "suggestions": ["Invest the remaining ₹65,000 in PPF or Tax Saver FD for guaranteed returns."]
}
```

---

## ML / AI

### GET /ml/recommendations

Response cached 300 seconds in Redis per user. Returns Groq-generated financial recommendations.

**Response 200:**
```json
{ "recommendations": "Based on your spending patterns and investment profile, consider..." }
```

---

### GET /ml/spending-insights

**Response 200:**
```json
{
  "category_breakdown": { "food": 12000, "shopping": 8000 },
  "top_category": "food",
  "average_transaction": 1500,
  "insight": "Your food spending is 45% of total expenses..."
}
```

---

### GET /ml/account-insights

---

### GET /ml/sip-insights

---

### GET /ml/asset-insights

---

### GET /ml/loan-insights

---

### POST /ml/whatif-scenario

**Body:**
```json
{ "scenario_type": "save_more", "custom_query": "What if I save ₹5,000 more per month?" }
```

**Response 200:**
```json
{ "projection": "Saving an additional ₹5,000/month would add ₹60,000 annually..." }
```

---

### POST /ml/chatbot

**Body:**
```json
{ "message": "What is my current account balance?" }
```

**Response 200:**
```json
{ "reply": "Your total balance across 2 accounts is ₹1,25,000." }
```

---

### POST /ml/voice-agent

**Body:**
```json
{ "message": "Transfer 500 rupees to Raj" }
```

**Response 200:**
```json
{
  "action": "transfer",
  "amount": 500,
  "recipient": "Raj",
  "message": "Understood. To transfer ₹500 to Raj, please confirm the account number."
}
```

---

### POST /ml/classify-transaction

**Body:**
```json
{ "text": "Ordered biryani from Swiggy" }
```

**Response 200:**
```json
{ "category": "food", "confidence": 0.97 }
```

---

### POST /ml/behavior-anomaly

**Body:**
```json
{
  "behavior_data": {
    "tap_pressure": 0.5, "tap_duration_ms": 120, "finger_area_px": 22,
    "scroll_velocity_px_s": 350, "scroll_acceleration": 12, "keystroke_interval_ms": 180,
    "error_rate": 0.05, "nav_time_per_screen_s": 45, "session_entropy": 0.32,
    "hesitation_events": 1, "copy_paste_detected": 0, "tab_switch_count": 0
  },
  "email": "user@example.com"
}
```

**Response 200:**
```json
{ "is_anomaly": false, "anomaly_score": 0.08 }
```

---

### POST /ml/forecast-cashflow

**Body:**
```json
{ "days": 30 }
```

**Response 200:**
```json
{
  "forecast": [
    { "date": "2025-05-25", "projected_balance": 130000, "inflow": 8000, "outflow": 3000 },
    ...
  ]
}
```

---

### POST /ml/fraud-check

**Body:** Arbitrary transaction data object.

**Response 200:**
```json
{ "risk_score": 0.15, "is_fraud": false }
```

---

## Agents

### POST /agents/advisor

**Body:**
```json
{ "user_query": "Should I take a home loan now or wait?" }
```

**Response 200:**
```json
{
  "advice": "Given your current EMI-to-income ratio of 32% and savings rate of ₹15,000/month..."
}
```

---

### POST /agents/teacher

**Body:**
```json
{}
```

**Response 200:**
```json
{
  "lesson": "Today's Topic: Understanding SIP Step-Up\n\nBased on your recent activity, you've been..."
}
```

---

## KYC

### POST /kyc/upload

**Body:**
```json
{
  "aadhaar_front": "<base64_image>",
  "aadhaar_back": "<base64_image>",
  "pan": "<base64_image>",
  "aadhaar_number": "1234 5678 9012",
  "pan_number": "ABCDE1234F"
}
```

**Response 200:**
```json
{ "message": "KYC submitted for review", "kyc_status": "pending" }
```

**Errors:** `422` — Aadhaar checksum invalid, `422` — PAN format invalid, `422` — Name mismatch (< 80% fuzzy similarity).

---

### GET /kyc/status

**Response 200:**
```json
{
  "kyc_status": "pending",
  "aadhaar_masked": "XXXX XXXX 9012",
  "pan_masked": "ABCDE****F",
  "name": "Priya Sharma"
}
```

---

## Notifications

### GET /notifications/

---

### PUT /notifications/{id}/read

---

### PUT /notifications/read-all

---

### GET /notifications/alerts

**Query params:** `is_read` (bool, optional)

---

### PUT /notifications/alerts/{id}/read

---

### GET /notifications/alerts/unread-count

**Response 200:**
```json
{ "unread_count": 3 }
```

---

## Sessions

### GET /sessions

**Response 200:**
```json
[
  {
    "session_id": "...",
    "device_fingerprint": "...",
    "ip_address": "203.0.113.5",
    "city": "Mumbai",
    "country": "India",
    "created_at": "2025-05-20T08:00:00Z",
    "last_seen": "2025-05-24T10:00:00Z",
    "is_current": true
  }
]
```

---

### DELETE /sessions/{id}

Revoke a specific session.

---

### DELETE /sessions

Revoke all sessions except the current one.

---

## Account Aggregator

### POST /aa/consent/request

**Response 200:**
```json
{ "consent_id": "aa_consent_abc123", "status": "pending" }
```

---

### GET /aa/consent/{consent_id}

First call auto-approves. **Response 200:**
```json
{ "consent_id": "...", "status": "approved" }
```

---

### GET /aa/accounts

**Response 200:**
```json
[
  {
    "bank": "HDFC Bank",
    "account_number": "HDFC0012345",
    "account_type": "savings",
    "balance": 45000.00
  }
]
```

---

### GET /aa/transactions/{account_id}

---

## Admin

All admin endpoints require appropriate role (see RBAC section in `security_system.md`).

### GET /admin/users

**Query params:** `role` (optional), `skip` (default 0), `limit` (default 50, max 200)

**Response 200:**
```json
{ "users": [...], "total": 150, "skip": 0, "limit": 50 }
```

---

### PUT /admin/users/{user_id}/role

**Query params:** `role` (one of: customer, employee, relationship_manager, super_admin). super_admin only.

---

### PUT /admin/users/{user_id}/deactivate

super_admin only.

---

### PUT /admin/users/{user_id}/activate

super_admin only.

---

### GET /admin/kyc/pending

---

### GET /admin/kyc/escalated

---

### PUT /admin/kyc/{user_id}/action

**Body:**
```json
{ "action": "accept", "comments": "Documents verified successfully" }
```

**Actions:** `accept`, `reject`, `request_reupload`, `escalate`.

---

### GET /admin/loans

**Query params:** `status` (optional: pending, approved, rejected, disbursed)

---

### PUT /admin/loans/{loan_id}/approve

---

### PUT /admin/loans/{loan_id}/reject

---

### GET /admin/fraud-alerts

---

### PUT /admin/fraud-alerts/{alert_id}/resolve

**Query params:** `resolution` (string)

---

### GET /admin/audit-logs

super_admin only.

---

### GET /admin/analytics

relationship_manager+.

**Response 200:**
```json
{
  "total_users": 1250,
  "total_accounts": 3100,
  "total_transactions": 45000,
  "total_payments": 8200,
  "total_loans": 320,
  "monthly_trends": {
    "users": [120, 140, 165, ...],
    "transactions": [3500, 4200, 5100, ...]
  }
}
```

---

### GET /admin/insider-threat-check

Runs GraphSAGE M7 model. relationship_manager+.

---

### GET /admin/performance

super_admin only.

**Query params:** `limit` (optional), `offset` (optional)

---

## Employee

### GET /employee/notifications/summary

employee+.

**Response 200:**
```json
{
  "kyc_pending": 12,
  "kyc_escalated": 3,
  "loans_pending": 8,
  "fraud_alerts": 5
}
```

---

## Risk

### GET /risk/summary

relationship_manager+.

**Response 200:**
```json
{
  "risk_score": 45,
  "risk_level": "MEDIUM",
  "components": {
    "fraud_alerts_24h": 20,
    "high_value_txns_24h": 10,
    "otp_failures_1h": 8,
    "new_users_7d": 7
  }
}
```

---

## Compliance API (Sidecar — port 8002)

Base URL: `http://localhost:8002/api/v1`

### POST /compliance/query

**Body:**
```json
{ "text": "What are RBI KYC requirements for digital banks?" }
```

**Response 200:**
```json
{
  "answer": "According to RBI Master Direction on KYC (2016, updated 2023)...",
  "sources": ["RBI KYC Master Direction 2016", "Section 16.3"]
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "detail": "Human-readable error message"
}
```

Or for structured errors (e.g., KYC gate):

```json
{
  "detail": {
    "code": "KYC_REQUIRED",
    "message": "Identity verification required to access this feature.",
    "current_status": "not_initiated"
  }
}
```

**Common HTTP status codes:**

| Code | Meaning |
|---|---|
| 400 | Bad request / validation error |
| 401 | Not authenticated / token invalid / session revoked |
| 403 | Forbidden — role insufficient, KYC required, account frozen, transaction blocked |
| 404 | Resource not found |
| 422 | Unprocessable entity — document validation failed |
| 423 | Locked — payment locked after too many OTP failures |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal server error |
