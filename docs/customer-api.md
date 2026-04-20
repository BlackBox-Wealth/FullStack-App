# WealthVault Customer API

Customer-facing API reference for the backend in `backend/app/routes`. All endpoints are mounted under `/api/v1`.

## Authentication

Most customer endpoints require the `access_token` cookie set by the auth routes. The backend also uses a `refresh_token` cookie for token refresh.

Standard headers:

- `Content-Type: application/json`
- Include cookies from a successful login or registration response.

## Base URL

`http://localhost:8000/api/v1`

## Auth Endpoints

### `POST /auth/register`
Legacy registration without OTP verification.

Request body:

```json
{
  "email": "customer@example.com",
  "password": "password123",
  "full_name": "Aarav Sharma",
  "phone": "9876543210",
  "role": "customer"
}
```

Response `201`:

```json
{
  "user": {
    "id": "65f1f1...",
    "email": "customer@example.com",
    "full_name": "Aarav Sharma",
    "phone": "9876543210",
    "role": "customer",
    "kyc_status": "pending",
    "is_active": true,
    "created_at": "2026-04-20 10:15:00",
    "avatar_url": null
  },
  "message": "Registration successful"
}
```

### `POST /auth/send-phone-otp`
Send an OTP for SIM binding verification.

Request body:

```json
{
  "phone": "9876543210"
}
```

Response:

```json
{
  "message": "OTP sent to +919876543210",
  "otp_debug": "123456"
}
```

`otp_debug` is only returned in debug mode.

### `POST /auth/verify-phone`
Verify the phone number with OTP.

Request body:

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

Response:

```json
{
  "message": "Phone verified successfully",
  "phone": "+919876543210",
  "verified": true
}
```

### `POST /auth/register/send-email-otp`
Send an email OTP for registration.

Request query parameters:

- `email` (string)

Example:

`POST /api/v1/auth/register/send-email-otp?email=customer@example.com`

Response:

```json
{
  "message": "OTP sent to customer@example.com",
  "otp_debug": "123456"
}
```

### `POST /auth/register/send-phone-otp`
Send a phone OTP for registration.

Request query parameters:

- `phone` (string)

Example:

`POST /api/v1/auth/register/send-phone-otp?phone=9876543210`

Response:

```json
{
  "message": "OTP sent to +919876543210",
  "otp_debug": "123456"
}
```

### `POST /auth/register/complete`
Complete secure registration after verifying both OTPs.

Request body:

```json
{
  "email": "customer@example.com",
  "password": "password123",
  "full_name": "Aarav Sharma",
  "phone": "9876543210",
  "email_otp": "111111",
  "phone_otp": "222222"
}
```

Response `201`:

```json
{
  "user": {
    "id": "65f1f1...",
    "email": "customer@example.com",
    "full_name": "Aarav Sharma",
    "phone": "9876543210",
    "role": "customer",
    "kyc_status": "pending",
    "is_active": true,
    "created_at": "2026-04-20 10:15:00",
    "avatar_url": null
  },
  "message": "Registration successful. Email and phone verified."
}
```

### `POST /auth/login`
Login with email and password. Returns user data and sets auth cookies.

Request body:

```json
{
  "email": "customer@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "user": {
    "id": "65f1f1...",
    "email": "customer@example.com",
    "full_name": "Aarav Sharma",
    "phone": "9876543210",
    "role": "customer",
    "kyc_status": "pending",
    "is_active": true,
    "created_at": "2026-04-20 10:15:00",
    "avatar_url": null
  },
  "message": "Login successful"
}
```

### `POST /auth/refresh`
Refresh the access token using the `refresh_token` cookie.

Optional fallback body:

```json
{
  "refresh_token": "<token>"
}
```

Response:

```json
{
  "user": {
    "id": "65f1f1...",
    "email": "customer@example.com",
    "full_name": "Aarav Sharma",
    "phone": "9876543210",
    "role": "customer",
    "kyc_status": "pending",
    "is_active": true,
    "created_at": "2026-04-20 10:15:00",
    "avatar_url": null
  },
  "message": "Token refreshed"
}
```

### `POST /auth/logout`
Clears the auth cookies.

Response:

```json
{
  "message": "Logged out successfully"
}
```

### `GET /auth/me`
Returns the currently authenticated user.

Response:

```json
{
  "id": "65f1f1...",
  "email": "customer@example.com",
  "full_name": "Aarav Sharma",
  "phone": "9876543210",
  "role": "customer",
  "kyc_status": "pending",
  "is_active": true,
  "created_at": "2026-04-20 10:15:00",
  "avatar_url": null
}
```

### `POST /auth/send-otp`
Send a login/verification OTP to the authenticated customer.

No request body.

Response:

```json
{
  "message": "OTP sent successfully",
  "otp_debug": "123456"
}
```

### `POST /auth/verify-otp`
Verify the OTP for the authenticated customer.

Request query parameters:

- `otp` (string)

Example:

`POST /api/v1/auth/verify-otp?otp=123456`

Response:

```json
{
  "message": "OTP verified successfully",
  "verified": true
}
```

## Accounts

### `POST /accounts/`
Create a customer account.

Request body:

```json
{
  "account_type": "savings",
  "bank_name": "WealthVault Bank",
  "currency": "INR",
  "initial_deposit": 5000
}
```

Response `201`:

```json
{
  "id": "65f1f1...",
  "user_id": "65f1f0...",
  "account_number": "123456789012",
  "account_type": "savings",
  "bank_name": "WealthVault Bank",
  "balance": 5000,
  "currency": "INR",
  "status": "active",
  "is_external": false,
  "created_at": "2026-04-20 10:15:00"
}
```

### `GET /accounts/`
List the authenticated customer’s accounts.

Response:

```json
[
  {
    "id": "65f1f1...",
    "user_id": "65f1f0...",
    "account_number": "123456789012",
    "account_type": "savings",
    "bank_name": "WealthVault Bank",
    "balance": 5000,
    "currency": "INR",
    "status": "active",
    "is_external": false,
    "created_at": "2026-04-20 10:15:00"
  }
]
```

### `GET /accounts/{account_id}`
Fetch one account by id.

Response:

```json
{
  "id": "65f1f1...",
  "user_id": "65f1f0...",
  "account_number": "123456789012",
  "account_type": "savings",
  "bank_name": "WealthVault Bank",
  "balance": 5000,
  "currency": "INR",
  "status": "active",
  "is_external": false,
  "created_at": "2026-04-20 10:15:00"
}
```

### `POST /accounts/link-external`
Link an external bank account.

Request body:

```json
{
  "bank_name": "State Bank of India",
  "account_number": "123456789012",
  "ifsc_code": "SBIN0001234",
  "account_holder_name": "Aarav Sharma"
}
```

Response `201`:

```json
{
  "id": "65f1f1...",
  "user_id": "65f1f0...",
  "account_number": "123456789012",
  "account_type": "external",
  "bank_name": "State Bank of India",
  "balance": 0,
  "currency": "INR",
  "status": "active",
  "is_external": true,
  "created_at": "2026-04-20 10:15:00"
}
```

## Transactions

### `POST /transactions/`
Create a transaction for one of the customer’s accounts.

Request body:

```json
{
  "account_id": "65f1f1...",
  "amount": 2500,
  "transaction_type": "debit",
  "category": "shopping",
  "description": "Online purchase",
  "to_account_id": null
}
```

Response `201`:

```json
{
  "id": "65f1f2...",
  "account_id": "65f1f1...",
  "user_id": "65f1f0...",
  "amount": 2500,
  "transaction_type": "debit",
  "category": "shopping",
  "description": "Online purchase",
  "status": "completed",
  "risk_score": 0.123,
  "created_at": "2026-04-20 10:20:00"
}
```

### `GET /transactions/`
List transactions for the authenticated customer.

Query parameters:

- `account_id` optional string
- `category` optional string
- `limit` optional integer, default `50`, min `1`, max `200`
- `skip` optional integer, default `0`, min `0`

Response:

```json
[
  {
    "id": "65f1f2...",
    "account_id": "65f1f1...",
    "user_id": "65f1f0...",
    "amount": 2500,
    "transaction_type": "debit",
    "category": "shopping",
    "description": "Online purchase",
    "status": "completed",
    "risk_score": 0.123,
    "created_at": "2026-04-20 10:20:00"
  }
]
```

### `GET /transactions/spending-analysis`
Category-wise spending summary.

Query parameters:

- `months` optional integer, default `3`, min `1`, max `12`

Response:

```json
{
  "period_months": 3,
  "total_spent": 42000,
  "categories": [
    {
      "category": "shopping",
      "total": 15000,
      "count": 4,
      "average": 3750,
      "percentage": 35.7
    }
  ]
}
```

### `GET /transactions/{transaction_id}`
Fetch a single transaction.

Response:

```json
{
  "id": "65f1f2...",
  "account_id": "65f1f1...",
  "user_id": "65f1f0...",
  "amount": 2500,
  "transaction_type": "debit",
  "category": "shopping",
  "description": "Online purchase",
  "status": "completed",
  "risk_score": 0.123,
  "created_at": "2026-04-20 10:20:00"
}
```

## Payments

### `POST /payments/initiate`
Start a payment transfer and send an OTP.

Request body:

```json
{
  "from_account_id": "65f1f1...",
  "to_account_number": "123456789012",
  "amount": 5000,
  "description": "Rent",
  "otp_channel": "email"
}
```

Response:

```json
{
  "payment_id": "65f1f3...",
  "message": "OTP sent for payment verification",
  "otp_debug": "123456"
}
```

### `POST /payments/verify`
Verify the payment OTP and complete the transfer.

Request body:

```json
{
  "payment_id": "65f1f3...",
  "otp": "123456"
}
```

Response:

```json
{
  "message": "Payment completed successfully",
  "payment_id": "65f1f3..."
}
```

### `GET /payments/`
List payment history for the authenticated customer.

Response:

```json
[
  {
    "id": "65f1f3...",
    "user_id": "65f1f0...",
    "from_account_id": "65f1f1...",
    "to_account_id": "65f1f4...",
    "to_account_number": "123456789012",
    "amount": 5000,
    "description": "Rent",
    "status": "completed",
    "created_at": "2026-04-20 10:25:00"
  }
]
```

### `GET /payments/{payment_id}`
Fetch one payment by id.

Response:

```json
{
  "id": "65f1f3...",
  "user_id": "65f1f0...",
  "from_account_id": "65f1f1...",
  "to_account_id": "65f1f4...",
  "to_account_number": "123456789012",
  "amount": 5000,
  "description": "Rent",
  "status": "completed",
  "created_at": "2026-04-20 10:25:00"
}
```

## Investments

### `POST /investments/`
Create an investment.

Request body:

```json
{
  "investment_type": "stocks",
  "symbol": "RELIANCE",
  "amount": 25000,
  "quantity": 10
}
```

Response `201`:

```json
{
  "id": "65f1f5...",
  "user_id": "65f1f0...",
  "investment_type": "stocks",
  "symbol": "RELIANCE",
  "amount": 25000,
  "quantity": 10,
  "buy_price": 2500,
  "current_price": 2601.44,
  "current_value": 26014.4,
  "profit_loss": 0,
  "profit_loss_pct": 0,
  "created_at": "2026-04-20 10:30:00"
}
```

### `GET /investments/`
List customer investments.

Response:

```json
[
  {
    "id": "65f1f5...",
    "user_id": "65f1f0...",
    "investment_type": "stocks",
    "symbol": "RELIANCE",
    "amount": 25000,
    "quantity": 10,
    "buy_price": 2500,
    "current_price": 2601.44,
    "current_value": 26014.4,
    "profit_loss": 1014.4,
    "profit_loss_pct": 4.06,
    "created_at": "2026-04-20 10:30:00"
  }
]
```

### `GET /investments/portfolio`
Portfolio summary.

Response:

```json
{
  "total_invested": 25000,
  "current_value": 26014.4,
  "total_profit_loss": 1014.4,
  "total_profit_loss_pct": 4.06,
  "risk_profile": "conservative",
  "investments": [
    {
      "id": "65f1f5...",
      "investment_type": "stocks",
      "symbol": "RELIANCE",
      "quantity": 10,
      "buy_price": 2500,
      "current_price": 2601.44,
      "current_value": 26014.4,
      "profit_loss": 1014.4,
      "profit_loss_pct": 4.06
    }
  ]
}
```

### `GET /investments/stocks`
Simulated stock list.

No request body.

Response:

```json
[
  {
    "symbol": "RELIANCE",
    "name": "Reliance Industries",
    "price": 2456.75,
    "change_pct": 1.23,
    "volume": 15690000
  }
]
```

### `POST /investments/goals`
Create a financial goal.

Request body:

```json
{
  "name": "Emergency Fund",
  "target_amount": 500000,
  "current_amount": 50000,
  "deadline": "2026-12-31"
}
```

Response `201`:

```json
{
  "user_id": "65f1f0...",
  "name": "Emergency Fund",
  "target_amount": 500000,
  "current_amount": 50000,
  "deadline": "2026-12-31",
  "status": "active",
  "progress_pct": 10,
  "created_at": "2026-04-20 10:35:00",
  "id": "65f1f6..."
}
```

### `GET /investments/goals`
List financial goals.

Response:

```json
[
  {
    "id": "65f1f6...",
    "user_id": "65f1f0...",
    "name": "Emergency Fund",
    "target_amount": 500000,
    "current_amount": 50000,
    "deadline": "2026-12-31",
    "status": "active",
    "progress_pct": 10,
    "created_at": "2026-04-20 10:35:00"
  }
]
```

### `POST /investments/sips`
Create a SIP plan.

Request body:

```json
{
  "name": "Monthly Equity SIP",
  "fund_name": "WealthVault Equity Fund",
  "fund_category": "equity",
  "amount": 5000,
  "frequency": "monthly",
  "start_date": "2026-05-01",
  "account_id": "65f1f1...",
  "step_up_pct": 10,
  "goal_id": "65f1f6..."
}
```

Response `201`:

```json
{
  "id": "65f1f7...",
  "user_id": "65f1f0...",
  "account_id": "65f1f1...",
  "name": "Monthly Equity SIP",
  "fund_name": "WealthVault Equity Fund",
  "fund_category": "equity",
  "amount": 5000,
  "frequency": "monthly",
  "status": "active",
  "start_date": "2026-05-01",
  "next_installment": "2026-05-20",
  "total_invested": 5000,
  "current_value": 5000,
  "profit_loss": 0,
  "profit_loss_pct": 0,
  "installments_count": 1,
  "step_up_pct": 10,
  "goal_id": "65f1f6...",
  "risk_level": "aggressive",
  "created_at": "2026-04-20 10:40:00"
}
```

### `GET /investments/sips`
List SIP plans.

Response:

```json
[
  {
    "id": "65f1f7...",
    "user_id": "65f1f0...",
    "account_id": "65f1f1...",
    "name": "Monthly Equity SIP",
    "fund_name": "WealthVault Equity Fund",
    "fund_category": "equity",
    "amount": 5000,
    "frequency": "monthly",
    "status": "active",
    "start_date": "2026-05-01",
    "next_installment": "2026-05-20",
    "total_invested": 5000,
    "current_value": 5120,
    "profit_loss": 120,
    "profit_loss_pct": 2.4,
    "installments_count": 1,
    "step_up_pct": 10,
    "goal_id": "65f1f6...",
    "risk_level": "aggressive",
    "created_at": "2026-04-20 10:40:00"
  }
]
```

### `PATCH /investments/sips/{sip_id}`
Update a SIP plan.

Request body can include any of these fields:

```json
{
  "amount": 7500,
  "frequency": "monthly",
  "status": "paused",
  "step_up_pct": 12
}
```

Response:

```json
{
  "id": "65f1f7...",
  "user_id": "65f1f0...",
  "account_id": "65f1f1...",
  "name": "Monthly Equity SIP",
  "fund_name": "WealthVault Equity Fund",
  "fund_category": "equity",
  "amount": 7500,
  "frequency": "monthly",
  "status": "paused",
  "start_date": "2026-05-01",
  "next_installment": "2026-05-20",
  "total_invested": 5000,
  "current_value": 5120,
  "profit_loss": 120,
  "profit_loss_pct": 2.4,
  "installments_count": 1,
  "step_up_pct": 12,
  "goal_id": "65f1f6...",
  "risk_level": "aggressive",
  "created_at": "2026-04-20 10:40:00"
}
```

## Loans

### `POST /loans/apply`
Apply for a loan.

Request body:

```json
{
  "loan_type": "personal",
  "amount": 250000,
  "tenure_months": 24,
  "purpose": "Home renovation"
}
```

Response `201`:

```json
{
  "user_id": "65f1f0...",
  "loan_type": "personal",
  "amount": 250000,
  "tenure_months": 24,
  "interest_rate": 12.5,
  "emi": 11762.65,
  "status": "pending",
  "purpose": "Home renovation",
  "created_at": "2026-04-20 10:45:00",
  "id": "65f1f8..."
}
```

### `GET /loans/`
List the customer’s loans.

Response:

```json
[
  {
    "id": "65f1f8...",
    "user_id": "65f1f0...",
    "loan_type": "personal",
    "amount": 250000,
    "tenure_months": 24,
    "interest_rate": 12.5,
    "emi": 11762.65,
    "status": "pending",
    "purpose": "Home renovation",
    "created_at": "2026-04-20 10:45:00"
  }
]
```

### `GET /loans/{loan_id}`
Fetch one loan by id.

Response:

```json
{
  "id": "65f1f8...",
  "user_id": "65f1f0...",
  "loan_type": "personal",
  "amount": 250000,
  "tenure_months": 24,
  "interest_rate": 12.5,
  "emi": 11762.65,
  "status": "pending",
  "purpose": "Home renovation",
  "created_at": "2026-04-20 10:45:00"
}
```

## ML / AI

### `GET /ml/recommendations`
Get AI-style investment recommendations based on the customer profile.

No request body.

Response:

```json
{
  "risk_profile": "conservative",
  "recommendations": [
    {
      "symbol": "RELIANCE",
      "type": "stocks",
      "reason": "Strong Q3 results with 15% revenue growth...",
      "confidence": 0.87,
      "action": "BUY",
      "amount": 42350.12
    }
  ]
}
```

### `POST /ml/fraud-check`
Run a fraud risk check.

Request body:

```json
{
  "amount": 150000,
  "transaction_type": "debit",
  "category": "shopping",
  "account_age_days": 45
}
```

Response:

```json
{
  "risk_score": 0.214,
  "is_fraudulent": false,
  "risk_level": "low",
  "factors": [
    "Transaction amount: ₹150000",
    "Category: shopping",
    "Account age: 45 days"
  ]
}
```

### `GET /ml/spending-insights`
Generate spending insights and suggestions.

No request body.

Response:

```json
{
  "total_spending": 42000,
  "period": "3 months",
  "insights": [
    {
      "category": "shopping",
      "type": "warning",
      "message": "You're spending 35% of your budget on shopping. Consider reducing by 15-20%.",
      "total_spent": 15000,
      "percentage": 35.7,
      "savings_potential": 2250
    }
  ]
}
```

### `POST /ml/chatbot`
Ask the financial chatbot a question.

Request body:

```json
{
  "message": "How should I invest 50000 rupees?"
}
```

Response:

```json
{
  "response": "Based on your balance of ₹125,000, I recommend diversifying...",
  "source": "mock"
}
```

If `GROQ_API_KEY` is set, the `source` can be `groq_llm`.

## Notifications

### `GET /notifications/`
List customer notifications.

Response:

```json
[
  {
    "id": "65f1f9...",
    "user_id": "65f1f0...",
    "type": "payment_completed",
    "message": "Payment of ₹5000 completed successfully",
    "read": false,
    "created_at": "2026-04-20 10:50:00"
  }
]
```

### `PUT /notifications/{notification_id}/read`
Mark one notification as read.

Response:

```json
{
  "message": "Notification marked as read"
}
```

### `PUT /notifications/read-all`
Mark all notifications as read.

Response:

```json
{
  "message": "Marked 5 notifications as read"
}
```

### `GET /notifications/unread-count`
Unread notification count.

Response:

```json
{
  "unread_count": 5
}
```

### `GET /notifications/alerts`
List customer fraud/security alerts.

Query parameters:

- `is_read` optional boolean

Response:

```json
[
  {
    "id": "65f1fa...",
    "alert_type": "high_risk_payment",
    "risk_score": 0.82,
    "reason": "High-risk payment detected...",
    "payment_id": "65f1f3...",
    "amount": 50000,
    "is_read": false,
    "created_at": "2026-04-20 10:55:00",
    "read_at": null
  }
]
```

### `PUT /notifications/alerts/{alert_id}/read`
Mark one alert as read.

Response:

```json
{
  "message": "Alert marked as read"
}
```

### `GET /notifications/alerts/unread-count`
Unread alert count.

Response:

```json
{
  "unread_count": 2
}
```

## Notes

- Customer endpoints are the ones under `auth`, `accounts`, `transactions`, `payments`, `investments`, `loans`, `ml`, and `notifications`.
- Admin routes under `/admin` are intentionally excluded from this document.
- Some handlers return dynamic dictionaries rather than strict response models, so responses above reflect the actual returned shape in the route code.