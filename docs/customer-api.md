# WealthVault Customer API

Customer-facing API reference. All endpoints are mounted under `/api/v1`. This document covers only the endpoints accessible to users with the `customer` role.

**Base URL:** `http://localhost:8000/api/v1`

**Authentication:** httpOnly cookie `access_token` (JWT HS256, 30-min TTL). Set automatically on login. The `Authorization: Bearer <token>` header is also accepted.

**KYC Note:** Endpoints marked `[KYC Required]` return `HTTP 403` with body `{"detail": {"code": "KYC_REQUIRED", ...}}` if the user's `kyc_status` is not `"verified"`.

---

## Registration

### Step 1 — Verify Email

```
POST /auth/register/send-email-otp?email=priya%40example.com
```

Sends a 6-digit OTP to the given email (valid 10 minutes).

**Success:**
```json
{ "message": "OTP sent to email" }
```

---

```
POST /auth/register/verify-email-otp?email=priya%40example.com&otp=482910
```

**Success:**
```json
{ "message": "Email verified" }
```

**Failure (expired or wrong OTP):**
```json
{ "detail": "Invalid or expired OTP" }
```

---

### Step 2 — Verify Phone

```
POST /auth/register/send-phone-otp?phone=%2B919876543210
```

Sends OTP via SMS (Twilio). Phone must be in E.164 format.

---

### Step 3 — Complete Registration

```
POST /auth/register/complete
Content-Type: application/json

{
  "email": "priya@example.com",
  "password": "SecurePass123!",
  "full_name": "Priya Sharma",
  "phone": "+919876543210",
  "email_otp": "482910",
  "phone_otp": "719034",
  "captcha_token": "<cloudflare_turnstile_token>"
}
```

Sets `access_token` and `refresh_token` httpOnly cookies on success.

**Success (201):**
```json
{
  "message": "Registration successful",
  "user": {
    "id": "6836a1...",
    "email": "priya@example.com",
    "full_name": "Priya Sharma",
    "role": "customer",
    "kyc_status": "not_initiated",
    "language": "en"
  }
}
```

---

## Login

```
POST /auth/login
Content-Type: application/json

{
  "email": "priya@example.com",
  "password": "SecurePass123!",
  "captcha_token": "<cloudflare_turnstile_token>"
}
```

Sets `access_token` (30 min) and `refresh_token` (7 days) httpOnly cookies.

**Success (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "6836a1...",
    "email": "priya@example.com",
    "full_name": "Priya Sharma",
    "phone": "+919876543210",
    "role": "customer",
    "kyc_status": "verified",
    "language": "hi",
    "theme_mode": "midnight",
    "accessibility": { "reducedMotion": false, "largeText": false },
    "is_first_time_investor": false,
    "is_new_user": false
  }
}
```

**Failure (401):**
```json
{ "detail": "Invalid email or password" }
```

---

## Token Refresh

```
POST /auth/refresh
```

Uses the `refresh_token` cookie. Issues a new `access_token` cookie.

**Success:**
```json
{ "message": "Token refreshed" }
```

**Failure (401):** Session revoked or refresh token expired → user must log in again.

---

## Logout

```
POST /auth/logout
```

Revokes the current session. Clears both cookies.

**Success:**
```json
{ "message": "Logged out successfully" }
```

---

## User Profile

### Get My Profile

```
GET /auth/me
```

**Response:**
```json
{
  "id": "6836a1...",
  "email": "priya@example.com",
  "full_name": "Priya Sharma",
  "phone": "+919876543210",
  "role": "customer",
  "kyc_status": "verified",
  "is_active": true,
  "language": "en",
  "theme_mode": "linen",
  "accessibility": {},
  "is_first_time_investor": false
}
```

---

### Update Profile

```
PUT /auth/profile
Content-Type: application/json

{
  "language": "hi",
  "theme_mode": "midnight",
  "accessibility": { "reducedMotion": true, "largeText": true },
  "is_new_user": false
}
```

All fields optional. Changes are persisted and loaded on next login / session rehydration.

---

## Password Reset

### Request Reset

```
POST /auth/request-password-reset
Content-Type: application/json

{ "email": "priya@example.com" }
```

Rate-limited to 3 requests per hour. Sends OTP to registered email.

**Success:**
```json
{ "message": "OTP sent to your registered email" }
```

---

### Submit New Password

```
POST /auth/reset-password
Content-Type: application/json

{
  "email": "priya@example.com",
  "otp": "381920",
  "new_password": "NewSecure456!"
}
```

Maximum 5 OTP attempts.

**Success:**
```json
{ "message": "Password reset successful" }
```

---

## Accounts

### List My Accounts

```
GET /accounts/
```

**Response:**
```json
[
  {
    "id": "68a0c1...",
    "account_type": "savings",
    "bank_name": "WealthVault Bank",
    "account_number": "WVLT0001234567",
    "balance": 125000.00,
    "is_frozen": false,
    "is_external": false,
    "created_at": "2025-01-15T09:00:00Z"
  },
  {
    "id": "68a0d2...",
    "account_type": "savings",
    "bank_name": "HDFC Bank",
    "account_number": "HDFC0012345678",
    "balance": 0,
    "is_frozen": false,
    "is_external": true,
    "created_at": "2025-03-10T11:30:00Z"
  }
]
```

---

### Create Account `[KYC Required]`

```
POST /accounts/
Content-Type: application/json

{
  "account_type": "savings",
  "bank_name": "WealthVault Bank",
  "initial_deposit": 5000
}
```

`account_type` options: `savings`, `current`, `fixed_deposit`.

**Response (201):**
```json
{
  "id": "...",
  "account_number": "WVLT0001234567",
  "account_type": "savings",
  "balance": 5000.00
}
```

---

### Link External Account

```
POST /accounts/link-external
Content-Type: application/json

{
  "bank_name": "ICICI Bank",
  "account_number": "012345678901",
  "ifsc_code": "ICIC0001234",
  "account_holder_name": "Priya Sharma"
}
```

---

### Delete Account

```
DELETE /accounts/{id}
```

---

## Transactions

### List Transactions

```
GET /transactions/?account_id=68a0c1...&limit=20
```

**Query params:**
- `account_id` — filter by account (optional)
- `category` — filter by category (optional): `food`, `shopping`, `utilities`, `healthcare`, `travel`, `entertainment`, `other`
- `limit` — number of results (optional, default 50)

**Response:**
```json
[
  {
    "id": "...",
    "account_id": "68a0c1...",
    "amount": 450.00,
    "transaction_type": "debit",
    "category": "food",
    "description": "Zomato order — Butter Chicken",
    "risk_score": 0.08,
    "risk_decision": "approve",
    "created_at": "2025-05-24T13:45:00Z"
  }
]
```

---

### Create Transaction

```
POST /transactions/
Content-Type: application/json

{
  "account_id": "68a0c1...",
  "amount": 450.00,
  "transaction_type": "debit",
  "category": "food",
  "description": "Zomato order — Butter Chicken"
}
```

The ML fraud pipeline runs inline. `category` is auto-classified by M2 BERT if omitted.

**Response (201):**
```json
{
  "id": "...",
  "amount": 450.00,
  "transaction_type": "debit",
  "category": "food",
  "risk_score": 0.08,
  "risk_decision": "approve",
  "created_at": "..."
}
```

**Blocked transaction (403):**
```json
{ "detail": "Transaction blocked by fraud detection" }
```

---

### Spending Analysis

```
GET /transactions/spending-analysis?months=3
```

**Response:**
```json
{
  "period_months": 3,
  "category_breakdown": {
    "food": 15000.00,
    "shopping": 8500.00,
    "utilities": 3200.00,
    "entertainment": 2100.00
  },
  "total_spent": 28800.00
}
```

---

## Payments

### Initiate Payment `[KYC Required]`

Send money to another WealthVault account by account number:

```
POST /payments/initiate
Content-Type: application/json

{
  "from_account_id": "68a0c1...",
  "to_account_number": "WVLT0009876543",
  "amount": 10000.00,
  "description": "Monthly rent",
  "otp_channel": "sms"
}
```

Or by UPI Virtual Payment Address:

```
POST /payments/initiate
Content-Type: application/json

{
  "from_account_id": "68a0c1...",
  "to_vpa": "rahul@wealthvault",
  "amount": 500.00,
  "description": "Split bill",
  "otp_channel": "email"
}
```

`otp_channel`: `"sms"` or `"email"`.

**Response (201):**
```json
{
  "payment_id": "pay_7f8e1a...",
  "status": "pending_otp",
  "message": "OTP sent via sms"
}
```

---

### Verify Payment with OTP

```
POST /payments/verify
Content-Type: application/json

{
  "payment_id": "pay_7f8e1a...",
  "otp": "284715"
}
```

**Success (200):**
```json
{
  "message": "Payment successful",
  "payment_id": "pay_7f8e1a...",
  "amount": 10000.00,
  "to": "WVLT0009876543"
}
```

**Wrong OTP (400):**
```json
{ "detail": "Invalid OTP. 3 attempts remaining." }
```

**Too many failures (423):**
```json
{ "detail": "Payment locked. Try again after 1 hour." }
```

---

### Resend Payment OTP

```
POST /payments/pay_7f8e1a.../resend?otp_channel=email
```

Maximum 3 resends.

---

### Payment History

```
GET /payments/
```

---

### Generate QR Code

```
GET /payments/qr/generate?amount=500&description=Chai+stall
```

**Response:**
```json
{
  "qr_string": "upi://pay?pa=priya@wealthvault&am=500.00&tn=Chai+stall"
}
```

---

## Investments

### My Portfolio

```
GET /investments/portfolio
```

**Response:**
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

### Live NSE Stock Prices

```
GET /investments/stocks
```

**Response:**
```json
[
  { "symbol": "RELIANCE.NS", "name": "Reliance Industries", "price": 2853.40, "change": 15.20, "change_pct": 0.54 },
  { "symbol": "TCS.NS", "name": "Tata Consultancy Services", "price": 3421.00, "change": -12.50, "change_pct": -0.36 }
]
```

---

### Market News

```
GET /investments/news
```

**Response:**
```json
[
  {
    "title": "Nifty 50 hits all-time high on FII inflows",
    "link": "https://economictimes.indiatimes.com/markets/...",
    "published": "Sat, 24 May 2025 10:00:00 +0000"
  }
]
```

---

### Add Investment

```
POST /investments/
Content-Type: application/json

{
  "investment_type": "equity",
  "symbol": "RELIANCE.NS",
  "amount": 28534.00,
  "quantity": 10
}
```

`investment_type` options: `equity`, `mutual_fund`, `gold`, `crypto`, `fd`, `bonds`, `elss`, `ppf`, `nsc`, `tax_saver_fd`, `ulip`, `nps`.

---

### Remove Investment

```
DELETE /investments/{id}
```

---

## Financial Goals

### List Goals

```
GET /investments/goals
```

**Response:**
```json
[
  {
    "id": "...",
    "name": "Emergency Fund",
    "target_amount": 300000,
    "current_amount": 125000,
    "deadline": "2026-12-31",
    "progress_pct": 41.7
  }
]
```

---

### Create Goal

```
POST /investments/goals
Content-Type: application/json

{
  "name": "Emergency Fund",
  "target_amount": 300000,
  "current_amount": 125000,
  "deadline": "2026-12-31"
}
```

---

### Delete Goal

```
DELETE /investments/goals/{id}
```

---

### AI Goal Insights

```
GET /investments/goals/smart-insights
```

Returns Groq-generated analysis of whether each goal is achievable given current savings rate.

**Response:**
```json
{
  "insights": "Your Emergency Fund goal requires ₹1,75,000 more. At your current savings rate of ₹18,000/month, you can reach it by July 2026 — before your December 2026 deadline. Consider automating a SIP of ₹15,000/month into a liquid fund."
}
```

---

## SIPs

### List SIPs

```
GET /investments/sips
```

**Response:**
```json
[
  {
    "id": "...",
    "name": "Wealth Builder",
    "fund_name": "Parag Parikh Flexi Cap Fund",
    "fund_category": "Flexi Cap",
    "amount": 5000,
    "frequency": "monthly",
    "status": "active",
    "start_date": "2025-06-01",
    "step_up_pct": 10
  }
]
```

---

### Create SIP

```
POST /investments/sips
Content-Type: application/json

{
  "name": "Wealth Builder",
  "fund_name": "Parag Parikh Flexi Cap Fund",
  "fund_category": "Flexi Cap",
  "amount": 5000,
  "frequency": "monthly",
  "start_date": "2025-06-01",
  "account_id": "68a0c1...",
  "step_up_pct": 10,
  "goal_id": "..."
}
```

`frequency` options: `monthly`, `weekly`, `quarterly`.

---

### Update SIP

```
PATCH /investments/sips/{id}
Content-Type: application/json

{ "status": "paused" }
```

`status` options: `active`, `paused`, `stopped`.

---

## Loans

### Apply for Loan `[KYC Required]`

```
POST /loans/apply
Content-Type: application/json

{
  "loan_type": "personal",
  "amount": 200000,
  "tenure_months": 24,
  "purpose": "Home renovation"
}
```

| Loan Type | Interest Rate (p.a.) | Example EMI (₹2L, 24 months) |
|---|---|---|
| personal | 12.5% | ₹9,450/month |
| home | 8.5% | ₹9,139/month |
| vehicle | 9.5% | ₹9,222/month |
| education | 7.5% | ₹8,986/month |
| business | 14.0% | ₹9,607/month |

**Response (201):**
```json
{
  "id": "...",
  "loan_type": "personal",
  "amount": 200000,
  "tenure_months": 24,
  "interest_rate": 12.5,
  "emi": 9450.32,
  "status": "pending",
  "purpose": "Home renovation"
}
```

---

### My Loans

```
GET /loans/
```

---

## Budgets

### List Budgets

```
GET /budgets/
```

**Response:**
```json
[
  {
    "id": "...",
    "category": "food",
    "amount_limit": 10000,
    "spent_amount": 8200,
    "period": "monthly",
    "status": "warning"
  }
]
```

`status` values: `healthy` (< 80%), `warning` (80–100%), `exceeded` (> 100%).

---

### Create Budget

```
POST /budgets/
Content-Type: application/json

{ "category": "shopping", "amount_limit": 5000, "period": "monthly" }
```

Category options match transaction categories: `food`, `shopping`, `utilities`, `healthcare`, `travel`, `entertainment`, `other`.

---

### Delete Budget

```
DELETE /budgets/{id}
```

---

## Asset Vault

### List Assets

```
GET /assets/
```

**Response:**
```json
[
  {
    "id": "...",
    "name": "2BHK Pune Flat",
    "asset_type": "property",
    "purchase_price": 5000000,
    "current_valuation": 6200000,
    "purchase_date": "2020-03-15"
  }
]
```

---

### Add Asset

```
POST /assets/
Content-Type: application/json

{
  "name": "Gold Jewellery",
  "asset_type": "gold",
  "purchase_price": 150000,
  "current_valuation": 185000,
  "purchase_date": "2022-11-10",
  "description": "22K gold necklace set"
}
```

`asset_type` options: `property`, `gold`, `vehicle`, `jewellery`, `other`.

---

### Delete Asset

```
DELETE /assets/{id}
```

---

### Net Worth Summary

```
GET /assets/net-worth-summary
```

**Response:**
```json
{
  "liquid_cash": 125000,
  "investments": 250000,
  "physical_assets": 6385000,
  "total_net_worth": 6760000
}
```

---

## Family Banking

### Invite Family Member

```
POST /family/invite
Content-Type: application/json

{ "invitee_email": "spouse@example.com" }
```

Creates a family group if one does not exist. Invitation expires after 7 days.

---

### Respond to Invitation

```
POST /family/respond
Content-Type: application/json

{ "invitation_id": "...", "action": "accept" }
```

`action`: `"accept"` or `"reject"`.

---

### My Family

```
GET /family/my-family
```

**Response:**
```json
{
  "family_id": "...",
  "head_user_id": "...",
  "members": [
    {
      "user_id": "...",
      "full_name": "Rahul Sharma",
      "spending_limit": 20000,
      "spent_this_month": 12500
    }
  ]
}
```

---

### My Pending Invitations

```
GET /family/invitations
```

---

### Set Member Spending Limit (Head Only)

```
POST /family/set-limit
Content-Type: application/json

{ "member_user_id": "...", "spending_limit": 20000 }
```

---

### Remove Member (Head Only)

```
DELETE /family/member/{member_user_id}
```

---

## Credit Score

```
GET /credit/score
```

**Response:**
```json
{
  "score": 780,
  "rating": "Good",
  "factors": [
    "No active loans",
    "Healthy income flow",
    "Strong savings balance"
  ]
}
```

Score range: 300–900. Ratings: **Good** (≥ 750), **Average** (600–749), **Poor** (< 600).

---

## Tax Helper

```
GET /tax/summary
```

**Response:**
```json
{
  "section_80c_limit": 150000,
  "total_invested": 90000,
  "remaining_limit": 60000,
  "utilization_pct": 60.0,
  "tax_saving_investments": [
    { "symbol": "AXIS_ELSS", "type": "ELSS Mutual Funds", "amount": 60000, "invested_on": "2025-01-15" },
    { "symbol": "PPF_FY25", "type": "PPF", "amount": 30000, "invested_on": "2025-04-01" }
  ],
  "potential_tax_saved": 27000,
  "max_possible_savings": 45000,
  "additional_savings_possible": 18000,
  "suggestions": [
    "You have ₹60,000 remaining in 80C limit. Consider investing in ELSS funds for tax savings and wealth creation.",
    "ELSS funds offer dual benefits: tax deduction under 80C and potential for higher returns."
  ]
}
```

---

## AI / ML Features

### Spending Insights

```
GET /ml/spending-insights
```

---

### AI Recommendations

```
GET /ml/recommendations
```

Cached 5 minutes. Returns personalised Groq-generated financial recommendations.

---

### AI Chatbot

```
POST /ml/chatbot
Content-Type: application/json

{ "message": "How much did I spend on food this month?" }
```

**Response:**
```json
{ "reply": "You spent ₹8,200 on food this month — 82% of your ₹10,000 food budget." }
```

---

### What-If Scenario Planner

```
POST /ml/whatif-scenario
Content-Type: application/json

{
  "scenario_type": "save_more",
  "custom_query": "What if I save ₹5,000 extra per month for 2 years?"
}
```

`scenario_type` presets: `save_more`, `invest_equity`, `repay_loan`, `buy_property`. Use `custom_query` for free-form queries.

---

### Cashflow Forecast

```
POST /ml/forecast-cashflow
Content-Type: application/json

{ "days": 30 }
```

**Response:**
```json
{
  "forecast": [
    { "date": "2025-05-25", "projected_balance": 127000, "inflow": 5000, "outflow": 3000 },
    { "date": "2025-05-26", "projected_balance": 129000, "inflow": 2000, "outflow": 0 }
  ]
}
```

---

### Classify Transaction Text

```
POST /ml/classify-transaction
Content-Type: application/json

{ "text": "Paid electricity bill online" }
```

**Response:**
```json
{ "category": "utilities", "confidence": 0.94 }
```

---

### Behavioral Anomaly Check

```
POST /ml/behavior-anomaly
Content-Type: application/json

{
  "behavior_data": {
    "tap_pressure": 0.5,
    "tap_duration_ms": 120,
    "finger_area_px": 22,
    "scroll_velocity_px_s": 300,
    "scroll_acceleration": 8,
    "keystroke_interval_ms": 175,
    "error_rate": 0.03,
    "nav_time_per_screen_s": 42,
    "session_entropy": 0.28,
    "hesitation_events": 0,
    "copy_paste_detected": 0,
    "tab_switch_count": 0
  },
  "email": "priya@example.com"
}
```

**Response:**
```json
{ "is_anomaly": false, "anomaly_score": 0.07 }
```

---

### AI Advisor Agent

```
POST /agents/advisor
Content-Type: application/json

{ "user_query": "Should I prepay my personal loan or invest in equity?" }
```

**Response:**
```json
{
  "advice": "Given your personal loan at 12.5% interest and your current equity portfolio returning ~14% CAGR, the math slightly favours staying invested in equity. However, consider prepaying if you want to reduce financial stress..."
}
```

---

### AI Teacher Agent

```
POST /agents/teacher
Content-Type: application/json

{}
```

**Response:**
```json
{
  "lesson": "Today's Lesson: Power of Compounding\n\nBased on your recent SIP activity, here's a personalised example. Your ₹5,000/month SIP at 12% CAGR over 10 years will grow to approximately ₹11.6 lakhs..."
}
```

---

## KYC Verification

### Submit KYC Documents

```
POST /kyc/upload
Content-Type: application/json

{
  "aadhaar_front": "<base64_jpeg>",
  "aadhaar_back": "<base64_jpeg>",
  "pan": "<base64_jpeg>",
  "aadhaar_number": "1234 5678 9012",
  "pan_number": "ABCDE1234F"
}
```

Images must be base64-encoded JPEG or PNG, max 5 MB each.

**Success (200):**
```json
{ "message": "KYC submitted for review", "kyc_status": "pending" }
```

**Validation errors (422):**
```json
{ "detail": "Aadhaar checksum validation failed" }
{ "detail": "PAN format invalid" }
{ "detail": "Name mismatch between Aadhaar and PAN documents" }
```

---

### Check KYC Status

```
GET /kyc/status
```

**Response:**
```json
{
  "kyc_status": "pending",
  "aadhaar_masked": "XXXX XXXX 9012",
  "pan_masked": "ABCDE****F",
  "name": "Priya Sharma"
}
```

`kyc_status` values: `not_initiated`, `pending`, `verified`, `rejected`, `reupload_requested`, `escalated`.

---

## Sessions

### List Active Sessions

```
GET /sessions
```

**Response:**
```json
[
  {
    "session_id": "sess_abc123...",
    "ip_address": "203.0.113.5",
    "city": "Mumbai",
    "country": "India",
    "device_fingerprint": "a1b2c3...",
    "created_at": "2025-05-20T08:00:00Z",
    "last_seen": "2025-05-24T10:15:00Z",
    "is_current": true
  },
  {
    "session_id": "sess_def456...",
    "ip_address": "103.25.11.8",
    "city": "Delhi",
    "country": "India",
    "device_fingerprint": "d4e5f6...",
    "created_at": "2025-05-18T14:00:00Z",
    "last_seen": "2025-05-22T19:00:00Z",
    "is_current": false
  }
]
```

---

### Revoke a Session

```
DELETE /sessions/sess_def456...
```

---

### Revoke All Other Sessions

```
DELETE /sessions
```

Keeps the current session. Forces all other devices to log in again.

---

## Account Aggregator

### Request Consent

```
POST /aa/consent/request
```

**Response:**
```json
{ "consent_id": "aa_consent_xyz789", "status": "pending" }
```

---

### Check Consent Status

```
GET /aa/consent/aa_consent_xyz789
```

First call auto-approves. **Response:**
```json
{ "consent_id": "aa_consent_xyz789", "status": "approved" }
```

---

### View Linked Accounts

```
GET /aa/accounts
```

**Response:**
```json
[
  { "bank": "HDFC Bank", "account_number": "HDFC0012345", "account_type": "savings", "balance": 42000.00 },
  { "bank": "SBI", "account_number": "SBI0098765", "account_type": "current", "balance": 180000.00 }
]
```

---

### Linked Account Transactions

```
GET /aa/transactions/HDFC0012345
```

---

## Notifications

### All Notifications

```
GET /notifications/
```

---

### Mark as Read

```
PUT /notifications/{id}/read
```

---

### Mark All Read

```
PUT /notifications/read-all
```

---

### Security Alerts

```
GET /notifications/alerts?is_read=false
```

Returns high-risk transaction flags, fraud alerts, family spending breach notifications, and pending family invitations.

---

### Unread Alert Count

```
GET /notifications/alerts/unread-count
```

**Response:**
```json
{ "unread_count": 2 }
```

---

## Security

### List Known Devices

```
GET /auth/devices
```

---

### Report Unauthorized Login

```
POST /auth/security/report
```

Flags the current session as reported. Creates an admin security alert.

**Response:**
```json
{ "message": "Security alert reported. Our team will investigate." }
```

---

## Compliance AI

**Base URL:** `http://localhost:8002/api/v1`

### Query Compliance AI

```
POST /compliance/query
Content-Type: application/json

{ "text": "क्या मुझे KYC के लिए Aadhaar देना जरूरी है?" }
```

Supports queries in English, Hindi, and Punjabi.

**Response:**
```json
{
  "answer": "RBI KYC Master Direction 2016 के अनुसार, Aadhaar based e-KYC एक valid OVD (Officially Valid Document) है...",
  "sources": ["RBI KYC Master Direction 2016", "Section 3.1"]
}
```
