# WealthVault Backend Documentation

## Project Structure

```
backend/
├── app/
│   ├── app.py                  # FastAPI application, middleware, router registration
│   ├── core/
│   │   ├── config.py           # Settings via pydantic-settings (env vars)
│   │   ├── database.py         # MongoDB Motor async connection
│   │   ├── redis_client.py     # Redis aioredis connection + cache_response decorator
│   │   ├── kafka_service.py    # AIOKafka producer + in-memory consumer
│   │   ├── security.py         # JWT, Argon2, get_current_user, require_role, require_kyc
│   │   └── bloom_filter.py     # CountingBloomFilter implementation
│   ├── routes/                 # One file per domain (21 modules)
│   │   ├── auth.py
│   │   ├── accounts.py
│   │   ├── transactions.py
│   │   ├── payments.py
│   │   ├── investments.py
│   │   ├── loans.py
│   │   ├── ml.py
│   │   ├── admin.py
│   │   ├── kyc.py
│   │   ├── notifications.py
│   │   ├── sessions.py
│   │   ├── assets.py
│   │   ├── budgets.py
│   │   ├── family.py
│   │   ├── aa.py
│   │   ├── agents.py
│   │   ├── credit.py
│   │   ├── tax.py
│   │   ├── risk.py
│   │   ├── compliance.py
│   │   └── employee_notifications.py
│   ├── simulation/             # Sentinel simulation lab (admin, portal, tracking, seed, scoring)
│   ├── services/               # Reusable service layer
│   │   ├── grpc_client.py      # MLClient — gRPC stub for all ML inference (port 50051)
│   │   ├── ml_service.py       # Legacy MLService (kept; no longer used for inference)
│   │   ├── budget_service.py
│   │   ├── kyc_service.py
│   │   ├── email_service.py
│   │   ├── sms_service.py
│   │   ├── device_service.py
│   │   ├── encryption.py
│   │   ├── deterministic_hash.py
│   │   ├── rag_client.py
│   │   ├── aa_service.py
│   │   ├── turnstile_service.py
│   │   └── event_consumers.py
│   ├── models/                 # Pydantic request/response models
│   ├── helper/                 # Utility functions (encrypt/decrypt helpers, agents)
│   └── shared/
│       └── proto/              # Shared protobuf definitions (compiled for backend)
│           ├── ml.proto        # 8 RPC definitions
│           ├── ml_pb2.py       # Generated protobuf message classes
│           └── ml_pb2_grpc.py  # Generated gRPC stub + servicer base

ml_models_server/               # Standalone ML gRPC server (copy to any machine)
├── proto/
│   ├── ml.proto                # Same proto as backend/app/shared/proto/
│   ├── ml_pb2.py               # Generated (version-resilient)
│   └── ml_pb2_grpc.py          # Generated gRPC classes
├── ml_inference.py             # All 13 model files loaded and served
├── server.py                   # MLServiceServicer + grpc.server entry point
├── config.py                   # ML_MODEL_DIR, ML_DATA_DIR, ML_M2_DIR, ML_M3_DIR, GRPC_PORT
└── requirements.txt            # grpcio, torch, transformers, sklearn, pandas, joblib

backend/app/ml_model/
├── saved/                      # 13 model weight files (all used)
│   ├── rf_classifier.pkl       # M1 RF classifier
│   ├── tfidf_vectorizer.pkl    # M1 TF-IDF vectorizer
│   ├── bert_classifier.pt      # M2 BERTTxnClassifier weights
│   ├── model_m3.pt             # M3 stress BERT weights
│   ├── model_full.pt           # M4 RiskMLP weights
│   ├── scaler.pkl              # M4 StandardScaler
│   ├── isolation_forest.pkl    # Global IsolationForest (12 features)
│   ├── svm_ACC001.pkl          # Per-account IsolationForest
│   ├── svm_scaler_ACC001.pkl   # Per-account StandardScaler
│   ├── lstm_model.pt           # LSTM autoencoder (input=15, hidden=64)
│   ├── arima_ACC001.pkl        # RF cashflow regressor (3 features)
│   ├── graphsage_model.pt      # GraphSAGE (SAGEConv 2→64→32, FC→2)
│   └── graphsage_node_index.pkl # Node ID → index mapping (12 nodes)
├── data/                       # transactions.csv (statistical forecasting fallback)
├── m2/                         # M2 BERT tokenizer files
└── m3/                         # M3 mBERT tokenizer files
```

---

## FastAPI Application Setup

**Entry point**: `app/app.py`

### Lifespan (startup / shutdown)

On startup:
1. `connect_to_mongo()` — opens Motor connection to MongoDB
2. `connect_to_redis()` — opens aioredis connection
3. `register_all_consumers()` — binds Kafka topic handlers
4. `kafka_service.connect()` — starts AIOKafka producer

On shutdown: closes all three connections and flushes logifyx log buffers.

### Middleware

**CORS**: `CORSMiddleware` with origins from `settings.cors_origins_list` (comma-split from `FRONTEND_URL`). `allow_credentials=True`, all methods and headers allowed.

**Request Logging**: A custom HTTP middleware (`log_requests`) assigns an 8-character UUID request ID, logs `{method} {path} from {client}`, measures response time, logs result with colour-coded level (error/warning/info), then publishes a `system.performance` Kafka event containing method, path, status, latency_ms, request_id, user_id (extracted from cookie token).

### Routers

All routers are mounted under `/api/v1`:

| Prefix | Tags | Module |
|---|---|---|
| `/api/v1/auth` | Authentication | routes/auth.py |
| `/api/v1/sessions` | Sessions | routes/sessions.py |
| `/api/v1/accounts` | Accounts | routes/accounts.py |
| `/api/v1/transactions` | Transactions | routes/transactions.py |
| `/api/v1/payments` | Payments | routes/payments.py |
| `/api/v1/investments` | Investments | routes/investments.py |
| `/api/v1/loans` | Loans | routes/loans.py |
| `/api/v1/ml` | ML / AI | routes/ml.py |
| `/api/v1/admin` | Admin | routes/admin.py |
| `/api/v1/notifications` | Notifications | routes/notifications.py |
| `/api/v1/kyc` | KYC | routes/kyc.py |
| `/api/v1/aa` | Account Aggregator | routes/aa.py |
| `/api/v1/assets` | Assets | routes/assets.py |
| `/api/v1/budgets` | Budgets | routes/budgets.py |
| `/api/v1/family` | Family | routes/family.py |
| `/api/v1/credit` | Credit | routes/credit.py |
| `/api/v1/tax` | Tax | routes/tax.py |
| `/api/v1/employee` | Employee Notifications | routes/employee_notifications.py |
| `/api/v1/risk` | Risk Management | routes/risk.py |
| `/api/v1/agents` | agents | routes/agents.py |
| `/api/v1/compliance` | Compliance AI | routes/compliance.py (port 8002) |

Health endpoints: `GET /` and `GET /health` (no auth required).

---

## Router Modules

### auth.py — Authentication

Prefix: `/auth`

Handles the full authentication lifecycle: registration (multi-step with dual OTP), login, JWT token refresh, logout, OTP send/verify, password reset, and profile/recovery info updates.

**Key logic**:
- Email and phone are stored only as SHA-256 hashes in MongoDB (`hashed_email`, `hashed_phone`) for lookup. The plaintext values are AES-256-GCM encrypted.
- A `CountingBloomFilter` with capacity 100,000 and 1% error rate guards against duplicate registrations before hitting MongoDB.
- Registration is a 3-step flow: initiate → verify email OTP → verify phone OTP → complete (creates user + auto-login).
- Tokens are set as httpOnly cookies. Token bodies are also returned for mobile app compatibility.
- Session documents are stored in Redis (`session:{session_id}` with 7-day TTL) and user sessions tracked in `user_sessions:{user_id}` Redis SET.
- Device fingerprinting (SHA-256 of UA + OS) and IP geolocation run on every login. New device/location triggers a security alert email (fire-and-forget).
- Password reset: 3 requests per email per hour (Redis rate limit), 5 OTP attempts before lockout.

**Cookie settings**:
- `access_token`: httpOnly, `max_age = ACCESS_TOKEN_EXPIRE_MINUTES * 60`
- `refresh_token`: httpOnly, `max_age = REFRESH_TOKEN_EXPIRE_DAYS * 86400`
- `secure=True` in production (`not settings.DEBUG`), `samesite="lax"`

### accounts.py — Account Management

Prefix: `/accounts`

Creates and manages bank accounts. New accounts get a 12-digit random account number, stored encrypted + with a deterministic hash for lookup.

- `POST /` — requires `require_kyc` (KYC must be verified)
- `PUT /{id}/freeze` — requires `super_admin` or `relationship_manager`
- `PUT /{id}/unfreeze` — requires `super_admin`
- `DELETE /{id}` — account owner or `super_admin`
- `POST /link-external` — link an external bank account (IFSC + account number)

### transactions.py — Transactions

Prefix: `/transactions`

Creates transactions and runs the ML fraud scoring pipeline inline via gRPC.

**Transaction creation logic**:
1. Verify account ownership and active status.
2. Check balance for debits/transfers.
3. Check family spending limit (if user is a family member).
4. Run gRPC ML pipeline:
   - `ml_client.classify_transaction(description)` — M2 BERT category prediction
   - `ml_client.detect_sequence_anomaly(user_id, txn_steps)` — LSTM reconstruction error
   - `ml_client.detect_insider_threat(user_id, merchant_id, amount, count)` — GraphSAGE threat score
   - `ml_client.calculate_risk_score(features[13])` — M4 final risk + decision
5. Check budget breach (`budget_service.check_budget_breach`).
6. Insert transaction doc (status: completed/flagged/blocked from M4 decision).
7. Update account balances (MongoDB `$inc` for credit/debit).
8. Publish `transactions.created` Kafka event.
9. Send transaction alert email (fire-and-forget) and SMS (Twilio).
10. If `risk_score >= 0.7`: insert `fraud_logs` doc, publish `fraud.alerts` Kafka event.

**`GET /spending-analysis`**: aggregates debit transactions by category for N months (in-memory decryption + aggregation, max 1000 transactions).

### payments.py — Payments

Prefix: `/payments`

Two-phase OTP-secured payment commit supporting UPI VPA and account number destinations.

**Initiation** (`POST /initiate`): validates source account, balance, family limits. Resolves destination via UPI (email prefix lookup) or account number hash. Creates `pending_otp` payment record. Sends OTP via SMS or email based on `otp_channel` param. Returns `payment_id`.

**Verification** (`POST /verify`): checks OTP lock, verifies OTP (max 5 attempts; 1h lock on breach), decrypts balances, validates sufficient funds, re-encrypts updated balances, inserts paired transaction records, runs post-commit risk scoring (amount + account age + SIM binding risk). Sends fraud alert email if `risk_score > 0.6`.

**OTP resend** (`POST /{id}/resend`): max 3 resends tracked in Redis.

**QR generation** (`GET /qr/generate`): generates `upi://pay?pa={username}@wealthvault&...` string.

### investments.py — Investments

Prefix: `/investments`

Manages investment records, SIPs, financial goals, and market data.

- Stock prices: fetches from Yahoo Finance v7 using crumb handshake (cookie → crumb → quote). Falls back to static mock data with random noise.
- News: scrapes Economic Times markets RSS feed directly, returns top 15 items.
- Smart goal insights: computes avg monthly savings from budget data, projects goal timelines, optionally queries Groq for natural language insight (llama-3.3-70b-versatile).
- First-time investor tips: Groq LLM prompt including recent market news headlines, respects user language preference.

Interest rate simulation: current prices are calculated as `buy_price * (1 + random.uniform(-0.15, 0.25))` for portfolio display — for demo purposes only.

### loans.py — Loans

Prefix: `/loans`

- Requires `require_kyc` for loan application.
- Interest rates hard-coded per type: personal 12.5%, home 8.5%, vehicle 9.5%, education 7.5%, business 14%.
- EMI calculated with standard reducing-balance formula.
- Applications start with `status: "pending"`, approved/rejected by admin.

### ml.py — ML / AI

Prefix: `/ml`

All model inference is dispatched over gRPC (`ml_client`). Groq LLM endpoints remain direct HTTP calls.

**gRPC-backed endpoints** (all ML model inference via `localhost:50051`):

| Endpoint | gRPC RPC(s) used | Models |
|---|---|---|
| `POST /fraud-check` | PredictTransactionCategory, DetectSequenceAnomaly, DetectInsiderThreat, CalculateRiskScore | M1, LSTM, GraphSAGE, M4 |
| `POST /behavior-anomaly` | DetectBehaviorAnomaly | Global IsoForest + per-user IsoForest+Scaler |
| `POST /forecast-cashflow` | ForecastCashflow | RF regressor (arima_<acc>.pkl) |
| `POST /chatbot` | DetectChatStress | M3 mBERT; result cached in `_chat_stress_cache` (15 min) |
| `POST /classify-transaction` | ClassifyTransactionMultilingual | M2 BERT |
| `POST /m2/predict` | ClassifyTransactionMultilingual | M2 BERT |

**Groq LLM-only endpoints** (no gRPC; call Groq API directly):

- `GET /recommendations` — portfolio recommendations + LLM explanation. Redis-cached 300s.
- `GET /spending-insights` — category aggregation + LLM nudge.
- `GET /account-insights`, `/sip-insights`, `/asset-insights`, `/loan-insights` — domain-specific LLM nudges.
- `POST /whatif-scenario` — scenario simulation (aa_sweep, loan_arbitrage, market_stress, custom).
- `POST /chatbot` — LLM financial advisor (also calls M3 gRPC for stress detection).
- `POST /voice-agent` — short TTS-optimised responses (persona: "Vaulty").

All monetary amounts passed to Groq are encoded as `HE_CT_{int(val * 8191)}` via `MockHomomorphicEncryption`. A post-processing step (`decode_llm_response`) replaces returned tokens with `₹{amount:,.0f}` for display.

**MockHomomorphicEncryption**: encodes float values as `HE_CT_{int(val * 8191)}` tokens before passing to LLM. A post-processing step `decode_llm_response()` regex-replaces any returned `HE_CT_` tokens with `₹{decrypted_val:,.0f}`. This simulates privacy-preserving LLM context passing.

### admin.py — Admin

Prefix: `/admin`

RBAC-protected admin operations.

- **User management**: list users, change role (super_admin only), deactivate/activate accounts. All mutations write to `audit_logs`.
- **KYC**: list pending/escalated documents, perform actions (accept/reject/request_reupload/escalate). Role hierarchy: employees can escalate; managers/admins can accept/reject. Action triggers `notifications.send` Kafka event.
- **Loans**: list all loans (filterable by status), approve (super_admin/RM), reject.
- **Fraud alerts**: list `fraud_logs` collection, resolve as `confirmed` or `false_positive`.
- **Insider threat check**: calls `ml_client.detect_insider_threat()` (gRPC GraphSAGE) for 3 known employee-account pairs; returns `threats_detected` count + alert list with `threat_score` per pair (super_admin only).
- **Analytics**: aggregate counts and monthly transaction trends from MongoDB.
- **Audit logs**: last 200 entries from `audit_logs` collection (super_admin only).
- **Performance metrics**: paginated query of `system_performance_zset` Redis sorted set.

### kyc.py — KYC

Prefix: `/kyc`

- `POST /upload` — accepts base64-encoded Aadhaar front, Aadhaar back, and PAN card images. Calls `kyc_service.process_kyc_documents()`. Upserts `kyc_documents` collection. Sets user `kyc_status = "pending"`.
- `GET /status` — returns current KYC status + extracted summary (name match score, masked IDs).

### notifications.py — Notifications

Prefix: `/notifications`

- Standard notifications from `notifications` collection (read/unread management).
- Security alerts from `alerts` collection (high-risk payments, spending limit breaches).
- `GET /unified` — aggregated view combining high-risk transactions, fraud logs, family alerts, and pending family invitations from the last 30 days.

### sessions.py — Sessions

Prefix: `/sessions`

- `GET /` — lists all active sessions for current user from Redis SET `user_sessions:{user_id}`.
- `DELETE /{session_id}` — revokes a specific session. If the current session, clears auth cookies immediately.
- `DELETE /` — revokes all sessions except the current one.

### assets.py — Assets

Prefix: `/assets`

Physical and digital asset tracking. Asset types: property, gold, vehicle, jewellery, other.

`GET /net-worth-summary` aggregates liquid cash (account balances), investment value (investments + SIPs), and physical asset valuations into a total net worth with distribution breakdown.

### budgets.py — Budgets

Prefix: `/budgets`

Budget limits set per spending category. `BudgetService.get_spent_amount()` sums debit transactions for the current calendar month. Status thresholds: `exceeded` if spent > limit, `warning` if spent > 80% of limit, `healthy` otherwise.

### family.py — Family

Prefix: `/family`

- Head user creates a family group (auto-created on first invite).
- Invitations use `secrets.token_urlsafe(32)` codes, expire in 7 days.
- Head can set per-member spending limits; violations trigger alerts for the head.
- Head can remove members (not head themselves).

### aa.py — Account Aggregator

Prefix: `/aa`

Mock Account Aggregator integration. Consent stored in-memory dict. After mock approval, `aa_service.generate_external_accounts()` returns simulated multi-bank accounts. Transaction history is also mocked.

### agents.py — AI Agents

Prefix: `/agents`

- `POST /advisor` — `WealthAdvisorAgent.generate_advice()` with real user financial profile (balances, income, expenses, savings rate, investment types, credit score).
- `POST /teacher` — `WealthTeacherAgent.generate_daily_lessons()` with real user activity metrics (transaction counts, categories, high-value count).

Both agents accept plaintext JSON payloads and return plaintext responses. The `user_query` and `language` parameters control LLM output.

### credit.py — Credit Score

Prefix: `/credit`

Calculates a credit score (300–900) from:
- Active loan burden (total loan amount ranges)
- Recent high-risk transactions (last 30 days, -15 per high-risk txn)
- Income vs spending ratio (credit transactions vs debit)
- Account balance level

Ratings: Good (≥750), Average (≥600), Poor (<600).

### tax.py — Tax Planning

Prefix: `/tax`

Identifies tax-saving investments from the user's investment collection by matching `investment_type` or `symbol` against known 80C instruments (ELSS, PPF, NSC, tax-saver FD, ULIP, NPS). Calculates Section 80C utilisation against the ₹1,50,000 limit and estimates potential tax savings at 30% bracket.

### risk.py — Risk Dashboard

Prefix: `/risk`

System-wide risk score (0–100) for employee/admin dashboards. Four weighted components:
- Fraud alerts pending: up to 40 points
- High-value transactions (>₹1L) in last 24h: up to 20 points
- OTP failure count (Redis `otp_failures:*` keys): up to 20 points
- New users in last 7 days: up to 20 points

Risk levels: HIGH (≥70), MEDIUM (≥40), LOW (<40).

### compliance.py — Compliance AI

Prefix: `/compliance`

- `POST /query` — text query to RAG pipeline (FAISS + BM25 + rule engine + Groq). Returns answer, source citations, compliance status, triggered rules, confidence score.
- `POST /call/inbound` — Twilio voice webhook; greets caller and records question.
- `POST /call/process` — processes Twilio recording URL, runs STT (mock) → RAG → TTS (mock), returns TwiML.
- Language detection supports `en`, `hi`, `pa`. Voice uses Amazon Polly Aditi voice.

### employee_notifications.py — Employee Notifications

Prefix: `/employee`

Single endpoint `GET /notifications/summary` returning counts of:
- `kyc_pending`: KYC docs with `status == "pending_review"`
- `kyc_escalated`: KYC docs with `status == "escalated"`
- `loans_pending`: Loans with `status == "pending"`
- `fraud_alerts`: Fraud logs with `status == "pending_review"`
- `total_alerts`: sum of above

Available to employees, relationship managers, and super admins.

---

## Services

### MLClient (grpc_client.py)

Singleton instance `ml_client`. Opens a gRPC insecure channel to `localhost:50051` on import. All ML inference is dispatched through this client — no model weights in the FastAPI process.

| Method | gRPC RPC | Returns |
|---|---|---|
| `predict_category(merchant, channel)` | `PredictTransactionCategory` | `str` category |
| `classify_transaction(text)` | `ClassifyTransactionMultilingual` | `{category, confidence}` |
| `detect_stress(text)` | `DetectChatStress` | `{chat_stress_language, risk_pts}` |
| `calculate_risk_score(features[13])` | `CalculateRiskScore` | `{risk_score, decision}` |
| `detect_behavior_anomaly(account_id, behavior_data)` | `DetectBehaviorAnomaly` | `{is_anomaly, confidence, risk_level, score, signal_5_score}` |
| `detect_sequence_anomaly(user_id, steps)` | `DetectSequenceAnomaly` | `{is_anomaly, score, reconstruction_error}` |
| `forecast(account_id, days)` | `ForecastCashflow` | `{items: [{date, predicted_net_amount}], trend_direction}` |
| `detect_insider_threat(user_id, merchant_id, amount, txn_count)` | `DetectInsiderThreat` | `{threat_score, is_insider_threat}` |

**ML gRPC Server** — `ml_models_server/server.py`

Run separately: `python ml_models_server/server.py`

Loads all 13 model files from `ML_MODEL_DIR` (default: `../backend/app/ml_model/saved`). Implements `MLServiceServicer` with all 8 RPCs. Models loaded once at startup; per-account models (RF, SVM) loaded lazily and cached.

**ml_service.py** — kept in codebase for backward compatibility and as reference. No longer called from any route handler for ML inference.

### BudgetService (budget_service.py)

`get_spent_amount(user_id, category)` — sums debit transaction amounts since the first of the current month, decrypting each transaction. Max 2000 transactions fetched.

`check_budget_breach(user_id, category, new_amount)` — checks both category-specific and "General" budgets. Returns a pipe-delimited string of alerts or `None`.

### KYCService (kyc_service.py)

`process_kyc_documents(aadhaar_front_b64, aadhaar_back_b64, pan_b64)`:
1. Calls Google Cloud Vision API `TEXT_DETECTION` for each image.
2. Falls back to Tesseract (if `pytesseract` + `cv2` are installed) with Otsu thresholding pre-processing.
3. Extracts Aadhaar fields (number, DOB, name) and PAN fields via regex.
4. Runs fraud detection rules: Verhoeff checksum, PAN format, fuzzy name match (thefuzz), DOB cross-check.
5. Returns confidence score (0–100) and analysis summary string.

### EmailService (email_service.py)

`send_email(to_email, subject, body_html)` — wraps content in branded HTML template and sends via `aiosmtplib`. Retries up to 3 times with 5-second delay. Uses SMTP with TLS (port from `MAIL_PORT`, server from `MAIL_SERVER`).

Specific methods: `send_welcome_email`, `send_verification_email`, `send_transaction_alert`, `send_security_alert`, `send_new_device_alert`, `send_notification`, `send_fraud_alert`.

### SMSService (sms_service.py)

Uses Twilio REST client (`twilio.rest.Client`). Normalises phone to E.164 format before sending.

- `send_otp(phone, otp, context)` — context-aware OTP messages ("login OTP", "verification OTP").
- `send_transaction_sms(phone, account_name, account_num, amount, txn_type, ...)` — bank-style transaction alert SMS format.

### DeviceService (device_service.py)

`check_and_save_device(db, user_id, ip, ua_string)`:
1. Parses User-Agent string (uses `user-agents` library if installed, falls back to regex).
2. Builds SHA-256 device fingerprint from UA + OS.
3. Calls `ip-api.com/json/{ip}` for geolocation (skips private/localhost IPs).
4. Looks up `known_devices` collection by (user_id, fingerprint).
5. Inserts new device or increments login count.
6. Returns `{is_new_device, is_new_location, device_info, location}`.

### EncryptionHelper (encryption.py)

AES-256-GCM with a 96-bit random nonce. Output is `base64(nonce + ciphertext)`. Key loaded from `DATA_ENCRYPTION_KEY` env var (base64-encoded 32-byte key). Wrapped by `encrypt_user_data()` and `decrypt_user_data()` helpers in `app/helper/utils.py`.

### deterministic_hash.py

`generate_deterministic_hash(input_string)` — SHA-256 of normalised (lowercase, stripped) input. Used for email, phone, and account number lookup fields stored as `hashed_*` fields in MongoDB.

### RAGClient (rag_client.py)

In-process bridge to the compliance RAG pipeline. `query_rag_async(text)` runs the synchronous pipeline in a thread pool. Returns `{answer, source, compliance_status, compliance_explanation, triggered_rules, confidence}`.

### TurnstileService (turnstile_service.py)

`verify_token(token, remote_ip)` — posts to `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Returns `{success, challenge_ts, hostname, error_codes}`. Respects `ENABLE_TURNSTILE` flag (default True) and skips if flag is False.

### EventConsumers (event_consumers.py)

Registered Kafka topic handlers:

| Topic | Handler | Action |
|---|---|---|
| `user.activity` | `handle_user_activity` | Updates `last_seen:{user_id}` Redis key (24h TTL) |
| `user.security` | `handle_security_event` | Logs security events for downstream analysis |
| `system.notifications` | `handle_notification_request` | Placeholder for email/SMS delegation |
| `system.performance` | `handle_performance_metric` | Stores metric in `system_performance_zset` Redis sorted set (20-min window) |
| `email.otpVerification` | `handle_otp_verification` | Calls `email_service.send_verification_email()` |

---

## Database Collections

MongoDB database name: `wealthvault` (default)

| Collection | Key Fields | Notes |
|---|---|---|
| `users` | `hashed_email`, `hashed_phone`, `role`, `kyc_status`, `is_active` | PII fields AES-encrypted; hash fields for lookup |
| `accounts` | `user_id`, `hashed_account_number`, `account_type`, `balance`, `status` | Balance AES-encrypted |
| `transactions` | `user_id`, `account_id`, `amount`, `transaction_type`, `category`, `risk_score`, `status`, `created_at` | Amount encrypted; status: completed/flagged/blocked |
| `payments` | `user_id`, `from_account_id`, `to_account_id`, `amount`, `status`, `payment_mode` | status: pending_otp/completed |
| `investments` | `user_id`, `investment_type`, `symbol`, `amount`, `quantity`, `buy_price` | Amount encrypted |
| `financial_goals` | `user_id`, `name`, `target_amount`, `current_amount`, `deadline`, `status` | |
| `sips` | `user_id`, `fund_name`, `fund_category`, `amount`, `frequency`, `status` | |
| `loans` | `user_id`, `loan_type`, `amount`, `tenure_months`, `interest_rate`, `emi`, `status` | |
| `kyc_documents` | `user_id`, `status`, `extracted_data`, `aadhaar_front`, `aadhaar_back`, `pan` | Base64 images stored; statuses: pending_review/verified/rejected/escalated/reupload_requested |
| `notifications` | `user_id`, `read`, `read_at`, `created_at` | |
| `alerts` | `user_id`, `alert_type`, `risk_score`, `reason`, `is_read`, `payment_id` | High-risk payment alerts, spending limit breaches |
| `fraud_logs` | `transaction_id`, `user_id`, `risk_score`, `amount`, `status` | status: pending_review/confirmed/false_positive |
| `audit_logs` | `performed_by`, `action`, `target_user`, `created_at` | Immutable; all admin mutations |
| `sessions` | `session_id`, `user_id`, `device_info`, `ip_address`, `is_active` | Redis-primary, MongoDB fallback |
| `known_devices` | `user_id`, `device_fingerprint`, `browser`, `os`, `last_seen_ip`, `login_count` | |
| `families` | `head_user_id`, `family_name`, `is_active` | |
| `family_members` | `family_id`, `user_id`, `role`, `status`, `spending_limit` | role: head/member; status: active/pending/rejected |
| `family_invitations` | `family_id`, `inviter_user_id`, `invitee_email`, `status`, `expires_at` | Expires in 7 days |
| `budgets` | `user_id`, `category`, `amount_limit`, `period` | |
| `assets` | `user_id`, `asset_type`, `purchase_price`, `current_valuation` | |
| `registration_otps` | `email`/`phone`, `type`, `otp`, `created_at` | MongoDB fallback when Redis unavailable |
| `payment_otps` | `payment_id`, `otp` | MongoDB fallback |
| `otps` | `user_id`, `otp` | MongoDB fallback for general OTPs |

---

## Kafka Topics and Event Flow

| Topic | Producer | Consumer | Payload |
|---|---|---|---|
| `user.activity` | auth, accounts, investments, loans | `handle_user_activity` | `{action, user_id, ...}` |
| `user.security` | auth (login, password reset, unauthorised report) | `handle_security_event` | `{action, user_id, ip, ...}` |
| `transactions.created` | transactions, payments | None registered | `{transaction_id, user_id, amount, risk_score}` |
| `payments.initiated` | payments | None registered | `{payment_id, user_id, amount}` |
| `fraud.alerts` | transactions | None registered | `{transaction_id, user_id, risk_score, amount}` |
| `notifications.send` | payments, loans, admin, family | `handle_notification_request` | `{user_id, type, message}` |
| `system.performance` | app.py middleware | `handle_performance_metric` | `{metric, method, path, status, latency_ms}` |
| `email.otpVerification` | auth (all OTP sends) | `handle_otp_verification` | `{user_email, otp_code}` |

When Kafka is unavailable, `kafka_service` falls back to in-process handler invocation.

---

## Redis Usage Patterns

| Key Pattern | TTL | Content |
|---|---|---|
| `session:{session_id}` | 7 days | JSON session document |
| `user_sessions:{user_id}` | indefinite SET | Set of active session IDs |
| `otp:{user_id}` | `OTP_EXPIRE_SECONDS` (default 300s) | 6-digit OTP string |
| `registration_email_otp:{email}` | 300s | 6-digit OTP |
| `registration_phone_otp:{phone}` | 300s | 6-digit OTP |
| `phone_otp:{phone}` | 300s | 6-digit OTP |
| `recovery_email_otp:{user_id}` | 300s | 6-digit OTP |
| `recovery_phone_otp:{user_id}` | 300s | 6-digit OTP |
| `password_reset_otp:{user_id}` | 300s | 6-digit OTP |
| `password_reset_rate:{hashed_email}` | 3600s | Integer counter (max 3) |
| `password_reset_attempts:{user_id}` | 3600s | Integer counter (max 5) |
| `payment_otp:{payment_id}` | `OTP_EXPIRE_SECONDS` | 6-digit OTP |
| `otp_failures:{payment_id}` | 900s | Integer failure count |
| `otp_locked:{payment_id}` | 3600s | "1" (lock flag) |
| `otp_resend_count:{payment_id}` | 3600s | Integer count (max 3) |
| `last_seen:{user_id}` | 86400s | ISO timestamp |
| `recommendations:{user_id}` | 300s | Cached ML recommendations JSON |
| `system_performance_zset` | 20-min sliding window | Sorted set of performance metrics (score = timestamp) |

---

## Configuration / Environment Variables

All settings loaded via `pydantic-settings` from `.env` file.

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | WealthVault | Application name |
| `APP_VERSION` | 1.0.0 | Version string |
| `DEBUG` | True | Enables OTP debug output; disables cookie `secure` flag |
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB_NAME` | `wealthvault` | Database name |
| `DATA_ENCRYPTION_KEY` | required | Base64-encoded 32-byte AES key for general encryption |
| `ENCRYPTION_KEY` | required | Base64-encoded 32-byte AES key (alternate) |
| `NO_REPLY_EMAIL` | required | SMTP sender address |
| `MAIL_PASSWORD` | required | Gmail App Password (16 chars) |
| `MAIL_SERVER` | required | SMTP host (e.g., `smtp.gmail.com`) |
| `MAIL_PORT` | required | SMTP port (e.g., `465`) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `JWT_SECRET_KEY` | (weak default) | HS256 signing key — **must change in production** |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `OTP_EXPIRE_SECONDS` | `300` | OTP TTL in Redis |
| `GROQ_API_KEY` | `""` | Groq API key for Llama LLM |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker address |
| `ACCOUNT_SID` | `""` | Twilio Account SID |
| `AUTH_TOKEN` | `""` | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | `""` | Twilio sender phone number |
| `TURNSTILE_SECRET_KEY` | `""` | Cloudflare Turnstile secret |
| `ENABLE_TURNSTILE` | `true` | Enable/disable CAPTCHA |
| `FRONTEND_URL` | `http://localhost:5173,...` | Comma-separated CORS origins |
| `GROQ_MODEL` | `llama3-70b-8192` | Default Groq model (overridden inline to `llama-3.3-70b-versatile`) |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence transformer for RAG |
| `FAISS_INDEX_PATH` | `./data/faiss_index` | Path to FAISS vector index |
| `ML_GRPC_HOST` | `localhost:50051` | Address of the ML gRPC server (used by MLClient) |
| `DEEPGRAM_API_KEY` | `""` | Speech-to-text (compliance voice) |
| `SARVAM_API_KEY` | `""` | Indian language TTS |
| `STT_CONFIDENCE_THRESHOLD` | `0.65` | Minimum STT confidence |
| `RATE_LIMIT_QUERY` | `30/minute` | Compliance text query rate |
| `RATE_LIMIT_VOICE` | `10/minute` | Compliance voice query rate |

---

## Error Handling Patterns

- All routes return `HTTPException` with appropriate status codes (400, 401, 403, 404, 429, 500).
- User enumeration is prevented on password reset: same response regardless of whether email exists.
- External service failures (Kafka, email, SMS, Groq) are caught and logged; they do not abort the main request flow. OTPs are saved to MongoDB as fallback when Redis is unavailable.
- ML model failures return safe defaults (e.g., `risk_score: 0.5, decision: "manual_review"` for M4; `is_anomaly: False` for M1/M6).
- Device detection failures are non-blocking (wrapped in try/except with warning log).

---

## Simulation Lab

The simulation subsystem lives under `backend/app/simulation/` and is mounted in two places:

- `app.include_router(sim_admin.router, prefix="/api/v1")` exposes the admin control plane.
- `app.include_router(sim_portal.router, prefix="/api/v1")` exposes the employee-facing portal.
- `app.include_router(sim_tracking.router, prefix="/api")` exposes token-based tracking and landing pages.

The simulation seed is run manually, not during backend startup. It is idempotent and populates:

- phishing templates
- social engineering templates
- incident drill templates
- employee simulation profiles
- supporting collections used by the lab

### Purpose

The simulation lab is a phishing and security-awareness training system for bank employees. Admins can launch campaigns, employees receive simulated emails in an inbox-like portal, and every action is scored and written back to MongoDB.

### Shared Response Model

Most simulation admin endpoints return:

```json
{
	"success": true,
	"data": {},
	"error": null,
	"timestamp": "2026-05-28T12:34:56.000000"
}
```

The only major exception is `POST /api/v1/portal/login`, which returns a plain object with `data.access_token` and `data.user`.

### Simulation Enums and Payloads

`app/simulation/models/simulation.py` defines the request enums and bodies used across the lab:

- `ModuleEnum`: `phishing`, `social_eng`, `incident_drill`
- `DifficultyEnum`: `low`, `medium`, `high`
- `RoleEnum`: `teller`, `loan_officer`, `IT_admin`, `all`
- `CertificationEnum`: `needs_training`, `aware`, `trained`, `certified`
- `CampaignTriggerEnum`: `manual_single`, `manual_bulk`, `automatic_random`
- `CampaignStatusEnum`: `draft`, `active`, `completed`
- `DeliveryStatusEnum`: `pending`, `delivered`, `failed`
- `AssignmentStatusEnum`: `pending`, `in_progress`, `completed`, `expired`
- `ThreatReviewEnum`: `pending`, `approved`, `rejected`

Request bodies:

| Model | Fields |
|---|---|
| `TriggerSingleRequest` | `employee_id_hash`, `module`, `template_id?`, `due_in_hours=168` |
| `TriggerBulkRequest` | `name`, `target`, `module`, `template_id?`, `due_in_hours=168`, `scheduled_at?` |
| `ScenarioResponseRequest` | `option_index` |
| `IncidentSubmitRequest` | `incident_type`, `affected_system`, `time_detected`, `description`, `immediate_action_taken`, `escalation_path` |
| `ThreatApprovalRequest` | `reviewed_by` |

### API Reference

#### Admin Simulation API

Base path: `/api/v1/admin/sim`

All endpoints require `super_admin` via `require_role("super_admin")`.

| Method | Path | Request body | Response |
|---|---|---|---|
| `GET` | `/stats/overview` | none | `total_employees`, `active_simulations_this_week`, `overall_pass_rate`, `flagged_employees`, `recent_campaigns` |
| `GET` | `/employees` | query params: `page`, `limit`, `department?`, `flagged?`, `certification?` | `profiles`, `total`, `page`, `limit` |
| `GET` | `/employees/{employee_id_hash}` | none | `profile`, `attempt_history` |
| `POST` | `/campaigns/single` | `TriggerSingleRequest` | `campaign_id`, `assignment_id` |
| `POST` | `/campaigns/random` | none | `campaign_id`, `targets`, `assignments_created`, `module` |
| `POST` | `/campaigns/bulk` | `TriggerBulkRequest` | `campaign_id`, `assignments_created` |
| `GET` | `/campaigns` | query params: `page`, `limit`, `status?`, `module?` | `campaigns`, `total`, `page` |
| `GET` | `/campaigns/{campaign_id}` | none | `campaign`, `assignments` |
| `POST` | `/campaigns/{campaign_id}/cancel` | none | `campaign_id`, `status` |
| `GET` | `/threats` | query params: `status=all`, `page`, `limit` | `threats`, `total`, `page` |
| `POST` | `/threats/{threat_id}/approve` | none | `message` |
| `POST` | `/threats/{threat_id}/reject` | none | `message` |
| `POST` | `/scraper/run` | none | `new_threats_saved` |
| `GET` | `/reports/leaderboard` | none | `departments` |
| `GET` | `/reports/flagged` | none | `flagged` |
| `GET` | `/reports/posture` | none | `pam_trust_score`, `status` |

Example `TriggerSingleRequest`:

```json
{
	"employee_id_hash": "a8b7...",
	"module": "phishing",
	"template_id": "phish-001",
	"due_in_hours": 72
}
```

Example `TriggerBulkRequest`:

```json
{
	"name": "Q2 Awareness Sweep",
	"target": "department:Operations",
	"module": "social_eng",
	"template_id": "random",
	"due_in_hours": 168,
	"scheduled_at": null
}
```

Typical `campaigns/single` response:

```json
{
	"success": true,
	"data": {
		"campaign_id": "f3b9...",
		"assignment_id": "a44e..."
	},
	"error": null,
	"timestamp": "2026-05-28T12:34:56.000000"
}
```

#### Employee Portal API

Base path: `/api/v1/portal`

These endpoints are the employee-facing inbox and training portal. `GET /dashboard`, `GET /inbox`, `GET /inbox/{email_id}`, and `POST /inbox/{email_id}/report` require the current user from `get_current_user`.

| Method | Path | Request body | Response |
|---|---|---|---|
| `POST` | `/login` | `email`, `password` | `data.access_token`, `data.user` |
| `GET` | `/dashboard` | none | `employee`, `pending_approvals`, `activity_feed`, `quick_links`, `unread_mail_count` |
| `GET` | `/inbox` | none | `emails`, `unread_count` |
| `GET` | `/inbox/{email_id}` | none | full email document or static fake email |
| `POST` | `/inbox/{email_id}/report` | none | `message` |

`POST /login` response shape:

```json
{
	"data": {
		"access_token": "eyJhbGciOi...",
		"user": {
			"id": "66c1...",
			"email": "employee@psb.in",
			"full_name": "Employee Name",
			"name": "Employee Name",
			"role": "employee",
			"department": "Operations",
			"employee_id": "EMP-1001",
			"kyc_status": "verified"
		}
	}
}
```

The inbox merges two sources:

- static benign emails defined in `portal.py`
- simulation emails stored in `sim_inbox_emails`

#### Token Tracking API

Base path: `/api/sim`

These endpoints do not use normal auth cookies. They validate a signed JWT tracking token generated per assignment.

| Method | Path | Request body | Response |
|---|---|---|---|
| `GET` | `/phishing/click/{token}` | none | redirect to frontend landing page |
| `POST` | `/phishing/credentials/{token}` | `{"submitted": true}` from the HTML form, but the backend only uses the token | JSON redirect target |
| `GET` | `/phishing/error` | none | HTML error page |
| `GET` | `/social/{token}` | none | current scenario node JSON |
| `POST` | `/social/respond/{token}` | `ScenarioResponseRequest` | feedback, next node or terminal score |
| `GET` | `/incident/form/{token}` | none | incident form metadata |
| `POST` | `/incident/submit/{token}` | `IncidentSubmitRequest` | `score`, `passed`, `ticket_number` |

Example `ScenarioResponseRequest`:

```json
{
	"option_index": 1
}
```

Example `IncidentSubmitRequest`:

```json
{
	"incident_type": "phishing",
	"affected_system": "core-banking",
	"time_detected": "2026-05-28T12:00:00Z",
	"description": "Suspicious login link reported by employee",
	"immediate_action_taken": "Blocked sender and notified SOC",
	"escalation_path": "IT Security -> SOC -> Branch Manager"
}
```

Example `GET /api/sim/social/{token}` response:

```json
{
	"success": true,
	"data": {
		"node_id": "1",
		"situation": "...",
		"options": [
			{"text": "...", "index": 0}
		],
		"scenario_title": "Scenario",
		"landing_page_title": "PSB Internal Audit Portal",
		"landing_page_subtitle": "Compliance Response System",
		"completed": false
	}
}
```

Example `POST /api/sim/social/respond/{token}` terminal response:

```json
{
	"success": true,
	"data": {
		"feedback": "Perfect. This is exactly the right response.",
		"next_node_id": "terminal_pass",
		"completed": true,
		"score": 100,
		"passed": true
	}
}
```

Example `POST /api/sim/incident/submit/{token}` response:

```json
{
	"success": true,
	"data": {
		"score": 88,
		"passed": true,
		"ticket_number": "INC-1A2B3C4D"
	}
}
```

### Simulation Request Flow

1. The admin creates a campaign by selecting a module and one or more employee targets.
2. `create_assignment()` writes both a `simulation_assignments` record and a matching `simulation_attempts` record.
3. A signed JWT tracking token is generated with a 72-hour expiry.
4. The campaign publishes `simulation.email.deliver` to Kafka.
5. `handle_simulation_email()` reads the assignment, chooses the correct delivery function, and inserts a message into `sim_inbox_emails` after sending the email.
6. The employee opens the fake inbox in the portal and interacts with the email or scenario.
7. Clicks, reports, credential submissions, or scenario decisions are logged as actions on the attempt.
8. When the attempt ends, the scoring function runs, the attempt is finalized, a report is inserted into `analysis_reports`, and a report email may be delivered to the employee.

### Module-Specific Behavior

#### Phishing

- The email contains a trap link that points to `/api/sim/phishing/click/{token}`.
- Clicking the link records `clicked_link` and redirects to a hosted harvest page on the frontend.
- Submitting credentials records `submitted_credentials`, immediately completes the attempt, and forces a fail score.
- Reporting the email records `reported_phishing`; if the employee reported after clicking, the score is lower than a clean report.

Scoring rules:

- `submitted_credentials` -> `score = 0`, `passed = false`
- `reported_phishing` without click -> `score = 100`
- `reported_phishing` after click -> `score = 50`
- time bonus: `+10` if under 5 minutes, `+5` if under 30 minutes
- pass threshold: `score >= 70`

#### Social Engineering

- The token loads the current scenario node for the attempt.
- Each option in the scenario response is scored and may branch to the next node or a terminal outcome.
- The attempt stores `chosen_options` so the scorer can evaluate the full decision tree.

Scoring rules:

- each node contributes its highest possible option score to the denominator
- the selected option score is accumulated in the numerator
- final score is normalized to 0-100
- pass threshold: `score >= 70`

#### Incident Drill

- The token returns the trigger scenario, required fields, and the time limit.
- The submit endpoint evaluates completeness, escalation accuracy, elapsed time, and detail quality.
- The result includes a generated internal ticket number derived from the attempt ID.

Scoring rules:

- completeness: up to 40 points
- correct escalation path: 30 points
- time bonus: up to 20 points
- detail quality: up to 10 points
- pass threshold: `score >= 70`

### Data Model and Collections

Simulation data is stored in MongoDB and linked through `employee_id_hash`, `campaign_id`, `assignment_id`, and `attempt_id`.

| Collection | Purpose | Key fields |
|---|---|---|
| `simulation_templates` | reusable phishing/social/incident content | `template_id`, `module`, `difficulty`, `role_relevance`, `active`, `content` |
| `employee_simulation_profiles` | per-employee scoring and posture | `employee_id_hash`, `department`, `role`, `flagged`, `certification_status`, `average_score`, `pam_trust_score` |
| `simulation_campaigns` | campaign header and progress | `campaign_id`, `name`, `module`, `status`, `target_employee_hashes`, `assignments` |
| `simulation_assignments` | one delivery per target employee | `assignment_id`, `campaign_id`, `employee_id_hash`, `template_id`, `attempt_id`, `tracking_token`, `status` |
| `simulation_attempts` | behavioral scoring and audit trail | `attempt_id`, `assignment_id`, `actions`, `score`, `passed`, `completed_at` |
| `sim_inbox_emails` | simulated inbox messages | `email_id`, `employee_id_hash`, `assignment_id`, `attempt_id`, `is_simulation`, `reported` |
| `analysis_reports` | post-attempt analysis output | generated by `generate_report()` |
| `scraped_threats` | admin threat intelligence queue | `review_status`, `scraped_at` |

### Kafka and Delivery

Simulation email delivery uses one dedicated Kafka topic:

| Topic | Producer | Consumer | Payload |
|---|---|---|---|
| `simulation.email.deliver` | `simulation/routes/admin.py` | `handle_simulation_email` | `{"assignment_id": "..."}` |

The consumer picks the delivery function based on `module`:

- `phishing` -> `deliver_phishing_email()`
- `social_eng` -> `deliver_social_eng_email()`
- `incident_drill` -> `deliver_incident_drill_email()`

### Important Implementation Details

- Tracking tokens are signed JWTs with a 72-hour expiry and `type = "sim_tracking"`.
- The phishing click flow uses the frontend landing page from `SENTINEL_BASE_URL`.
- The backend uses `BACKEND_BASE_URL` when generating in-email links so the email points to the current deployment.
- Static benign inbox emails are always merged into the portal inbox to make the experience feel like a real employee mailbox.
- `portal/inbox/{email_id}` logs `email_opened` only for simulation emails that belong to an attempt.
- `portal/inbox/{email_id}/report` finalizes the attempt when the employee reports a simulation email.
- `simulation.seed.seed()` runs at startup, so a fresh environment already has templates and baseline profiles before manual admin actions.
