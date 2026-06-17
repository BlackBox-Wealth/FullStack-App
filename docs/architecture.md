# WealthVault Architecture

## System Overview

WealthVault is a full-stack fintech platform covering personal banking, UPI payments, investment portfolio management, fraud detection, tax planning, family finance, and AI-driven wealth advisory. The system is built around a FastAPI backend, a React/Vite frontend, MongoDB as the primary data store, Redis for caching and session management, and Kafka for event-driven messaging.

**Tech Stack Summary**

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts, Lucide |
| Backend API | Python 3.11+, FastAPI, Uvicorn (port 8000) |
| Compliance Sidecar | Separate FastAPI process (port 8002), RAG pipeline |
| ML Runtime | PyTorch, scikit-learn, HuggingFace Transformers |
| ML Transport | gRPC (grpcio 1.81, protobuf 6.33) — all model inference over `localhost:50051` |
| ML Server | Standalone Python process (`ml_models_server/`) — 8 RPCs, 13 model files |
| Primary Database | MongoDB (Motor async driver) |
| Cache / Session | Redis (redis-stack image with RedisInsight on port 8001) |
| Message Bus | Apache Kafka + Zookeeper (Kafdrop UI on port 9000) |
| Email | SMTP via aiosmtplib (Gmail App Password) |
| SMS | Twilio REST API |
| KYC OCR | Google Cloud Vision API (TEXT_DETECTION), Tesseract fallback |
| LLM | Groq API — llama-3.3-70b-versatile |
| Stock Data | Yahoo Finance v7 quote API (crumb handshake) |
| Market News | Economic Times RSS feed |
| CAPTCHA | Cloudflare Turnstile |
| Containerisation | Docker Compose (5 services + named volume) |

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser / Mobile Client                     │
│             React SPA (Vite + TypeScript + Tailwind CSS)             │
│         Zustand (auth/UI state) │ Axios (httpOnly cookie auth)       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS  (withCredentials: true)
              ┌────────────────▼──────────────────────────┐
              │            Nginx / Reverse Proxy            │
              │  /api/v1            → backend_app :8000     │
              │  /compliance-api/   → compliance_app :8002  │
              └────────────┬─────────────────┬─────────────┘
                           │                 │
          ┌────────────────▼──┐   ┌──────────▼────────────────────┐
          │   FastAPI App      │   │   Compliance FastAPI App       │
          │   (port 8000)      │   │   (port 8002)                 │
          │   21 route modules │   │   RAG Pipeline (FAISS+BM25)   │
          │   grpc_client      │   │   Groq LLM                    │
          │   (MLClient)       │   │   Twilio voice endpoint       │
          └──┬──────────┬──────┘   └───────────────────────────────┘
             │          │
             │   gRPC (port 50051)
             │          │
             │   ┌──────▼──────────────────────────────────────┐
             │   │   ML gRPC Server (ml_models_server/)         │
             │   │   8 RPCs · 13 model files                   │
             │   │   M1 RF · M2 BERT · M3 stress · M4 RiskMLP │
             │   │   IsoForest · LSTM · RF forecast · GraphSAGE│
             │   └─────────────────────────────────────────────┘
             │
   ┌─────────▼─┐  ┌────────────┐  ┌──────────────┐  ┌────────────────┐
   │  MongoDB  │  │   Redis    │  │    Kafka     │  │ External APIs  │
   │  primary  │  │ sessions   │  │  event bus   │  │ Groq, Yahoo,   │
   │  store    │  │ OTPs       │  │  5 topics    │  │ Twilio, Google │
   │  14 colls │  │ rate limit │  │  consumers   │  │ Turnstile      │
   └───────────┘  └────────────┘  └──────────────┘  └────────────────┘
```

---

## Component Relationships

### Request Lifecycle

1. Browser sends request with `access_token` httpOnly cookie automatically attached.
2. Nginx reverse-proxies to the appropriate backend container.
3. FastAPI `log_requests` middleware assigns a short UUID request ID, logs method/path/client IP, and publishes a `system.performance` Kafka event.
4. Route handler invokes dependency injection. `get_current_user` decodes the JWT, validates the session against Redis (or MongoDB fallback), fetches the user document, and decrypts PII fields with AES-256-GCM.
5. Business logic executes: may query MongoDB, call `MLService`, call external APIs, write Kafka events.
6. Kafka consumers (`event_consumers.py`) process events: send emails, store notifications, update Redis caches.
7. Response is serialised. Auth cookies are set or cleared on the `Response` object.

### Service Dependency Map

```
FastAPI Route Handlers
    ├── app.core.database           — Motor async MongoDB client
    ├── app.core.redis_client       — aioredis connection
    ├── app.core.kafka_service      — AIOKafka producer + in-memory consumer
    ├── app.core.security           — JWT encode/decode, Argon2 hashing, role guards
    ├── app.core.bloom_filter       — CountingBloomFilter (duplicate email/phone check)
    ├── app.services.grpc_client    — MLClient singleton (gRPC stub, port 50051)
    │       ├── predict_category()          → gRPC PredictTransactionCategory (M1)
    │       ├── classify_transaction()      → gRPC ClassifyTransactionMultilingual (M2)
    │       ├── detect_stress()             → gRPC DetectChatStress (M3)
    │       ├── calculate_risk_score()      → gRPC CalculateRiskScore (M4)
    │       ├── detect_behavior_anomaly()   → gRPC DetectBehaviorAnomaly (IsoForest+SVM)
    │       ├── detect_sequence_anomaly()   → gRPC DetectSequenceAnomaly (LSTM)
    │       ├── forecast()                  → gRPC ForecastCashflow (RF)
    │       └── detect_insider_threat()     → gRPC DetectInsiderThreat (GraphSAGE)
    ├── app.services.email_service  — aiosmtplib SMTP sender
    ├── app.services.sms_service    — Twilio REST client
    ├── app.services.kyc_service    — Google Vision API + Tesseract OCR
    ├── app.services.encryption     — AES-256-GCM EncryptionHelper
    ├── app.services.deterministic_hash — SHA-256 normalised lookup hash
    ├── app.services.device_service — UA parser + ip-api.com geolocation
    ├── app.services.budget_service — Monthly spend aggregation
    ├── app.services.aa_service     — Mock Account Aggregator
    ├── app.services.turnstile_service — Cloudflare CAPTCHA verifier
    └── app.services.rag_client     — In-process RAG pipeline bridge

ML gRPC Server (ml_models_server/) — separate process, port 50051
    ├── proto/ml.proto              — 8 RPC definitions (protobuf 6.33)
    ├── ml_inference.py             — all 13 model files loaded + inference logic
    ├── server.py                   — MLServiceServicer, ThreadPoolExecutor
    └── config.py                   — ML_MODEL_DIR, ML_DATA_DIR, GRPC_PORT env vars
```

---

## ML Pipeline Architecture

All ML inference is served by a standalone gRPC process (`ml_models_server/`, port 50051). The FastAPI backend communicates with it exclusively through the `MLClient` gRPC stub (`backend/app/services/grpc_client.py`). No ML model weights are loaded in the FastAPI process.

### gRPC Service Definition (`ml.proto`)

8 RPCs — all unary (request → response):

| RPC | Input | Output | Model(s) |
|---|---|---|---|
| `PredictTransactionCategory` | merchant, channel | category | M1: RF + TF-IDF |
| `ClassifyTransactionMultilingual` | text | category, confidence | M2: BERTTxnClassifier |
| `DetectChatStress` | text | stress_level, risk_pts | M3: mBERT 2-class |
| `CalculateRiskScore` | features[13] | risk_score, decision | M4: RiskMLP |
| `DetectBehaviorAnomaly` | account_id, behavior_data{12} | is_anomaly, confidence, risk_level, signal_5_score | Global IsoForest + per-user IsoForest+Scaler |
| `DetectSequenceAnomaly` | user_id, TxnStep[≤30] | is_anomaly, score, reconstruction_error | LSTM autoencoder |
| `ForecastCashflow` | account_id, days | ForecastItem[], trend_direction | RF regressor (arima_<acc>.pkl) |
| `DetectInsiderThreat` | user_id, merchant_id, amount, txn_count | threat_score, is_insider_threat | GraphSAGE (12-node graph) |

### All 13 Model Files — All Used

| File(s) | What It Is | RPC |
|---|---|---|
| `rf_classifier.pkl` + `tfidf_vectorizer.pkl` | RF + TF-IDF category classifier | `PredictTransactionCategory` |
| `bert_classifier.pt` | BERTTxnClassifier (BERT base + Dropout + Linear 768→7) | `ClassifyTransactionMultilingual` |
| `model_m3.pt` | mBERT AutoModelForSequenceClassification (2-class) | `DetectChatStress` |
| `model_full.pt` + `scaler.pkl` | RiskMLP (13→64→32→16, dual-head) + StandardScaler | `CalculateRiskScore` |
| `isolation_forest.pkl` | Global IsolationForest (12 behavioral features) | `DetectBehaviorAnomaly` (global) |
| `svm_ACC001.pkl` + `svm_scaler_ACC001.pkl` | Per-account IsolationForest + StandardScaler | `DetectBehaviorAnomaly` (per-user combined) |
| `lstm_model.pt` | LSTM(15→64) + FC(64→15) autoencoder; MSE = anomaly score | `DetectSequenceAnomaly` |
| `arima_ACC001.pkl` | RandomForestRegressor (3 features: net_flow, day_of_week, day_of_month) | `ForecastCashflow` |
| `graphsage_model.pt` + `graphsage_node_index.pkl` | SAGEConv(2→64→32) + FC(32→2); 12-node employee-account graph | `DetectInsiderThreat` |

### Transaction Fraud Scoring Chain

Every `POST /transactions/` call runs this sequential gRPC ML pipeline:

```
Step 1 (gRPC): M2 — BERT Multilingual Classifier
  Input:  transaction description (free text)
  Output: predicted_category + confidence
  Effect: category_mismatch = 0.2 if user-provided ≠ predicted

Step 2 (gRPC): LSTM — Sequence Anomaly Autoencoder
  Input:  last 30 transactions as TxnStep[amount, timestamp, category, is_debit]
          + current transaction appended
  Model:  builds 15-feature vectors, LSTM encodes/decodes, MSE = reconstruction_error
  Output: is_anomaly, reconstruction_error (continuous signal)
  Effect: seq_anomaly = reconstruction_error (float, not binary)

Step 3 (gRPC): GraphSAGE — Insider Threat
  Input:  user_id, merchant_id (if present), amount, txn_count_with_merchant
  Model:  2-feature node graph (is_employee, amount_norm); SAGEConv × 2; FC → 2-class
  Output: threat_score (0.0–1.0), is_insider_threat (bool)
  Effect: insider_threat_score fed into M4 as real signal

Step 4 (gRPC): M4 — RiskMLP (13-feature input)
  Features (in order):
    [0]  amount
    [1]  history_count       (total past transactions)
    [2]  cat_mismatch        (0.0 or 0.2 from Step 1)
    [3]  seq_anomaly         (reconstruction_error from Step 2)
    [4]  biometric_anomaly   (0.0 — provided by /behavior-anomaly separately)
    [5]  insider_threat      (threat_score from Step 3)
    [6]  chat_stress         (from in-process cache, set by /chatbot M3 call)
    [7]  is_new_ben          (new beneficiary flag)
    [8]  sim_changed         (SIM binding mismatch)
    [9]  location_risk
    [10] hour (0–23)
    [11] day  (0–6, weekday)
    [12] ip_risk
  Output: risk_score (0.0–1.0), decision (approve/review/block)

Step 5: Status Assignment
  decision == "block"              → txn_status = "blocked"
  decision == "review" OR score > 0.7 → txn_status = "flagged"
  decision == "approve"            → txn_status = "completed"

Step 6: Post-Commit (if risk_score ≥ 0.7)
  → Insert fraud_logs document
  → Publish fraud.alerts Kafka topic
```

### /ml/fraud-check Pipeline (manual check, separate from transaction creation)

```
Step 1 (gRPC): M1 — predict category from merchant + channel
Step 2 (DB):   fetch last 30 transactions for LSTM
Step 3 (gRPC): LSTM — detect sequence anomaly (reconstruction_error)
Step 4 (gRPC): GraphSAGE — insider threat score
Step 5 (gRPC): M4 — final risk_score + decision
Response: risk_score, is_fraudulent, risk_level, m4_decision,
          predicted_category, lstm_sequence_anomaly, insider_threat
```

### Behavioral Biometrics — `/ml/behavior-anomaly`

```
Step 1 (gRPC): Global IsolationForest on 12 behavioral features
               (tap_pressure, tap_duration_ms, finger_area_px,
                scroll_velocity_px_s, scroll_acceleration, keystroke_interval_ms,
                error_rate, nav_time_per_screen_s, session_entropy,
                hesitation_events, copy_paste_detected, tab_switch_count)

Step 2 (gRPC): Per-user IsolationForest (svm_<account>.pkl + StandardScaler)
               — loaded lazily per account_id, combined with global score

Output: is_anomaly, confidence, risk_level, score, signal_5_score
        signal_5_score = combined risk probability × 100 (feeds M4 biometric slot)
```

If the global model has a wrong feature count (legacy file), `_retrain_iso_forest()` automatically retrains with 1200 synthetic samples on the ML server.

### M3 Chat Stress Caching

When `/ml/chatbot` is called, M3 (gRPC `DetectChatStress`) classifies the message (0 = normal, 1 = stressed/urgent). The result is cached in a module-level dict `_chat_stress_cache[user_id]` in `ml.py` with a 15-minute TTL. Subsequent M4 feature vector builds (in `/ml/fraud-check` and `POST /transactions/`) read from this cache as the `chat_stress` signal.

### Admin Insider Threat Scan — `/admin/insider-threat-check`

Scans 3 known employee-account pairs via `DetectInsiderThreat` gRPC. Returns `threats_detected` count and alert list with `threat_score` per pair. Requires `super_admin` role.

---

## Security Layers Diagram

```
Layer 1:  Cloudflare Turnstile CAPTCHA       — at /auth/register and /auth/login
Layer 2:  Behavioral Biometrics (M1)         — at /ml/behavior-anomaly (login page)
Layer 3:  TLS / HTTPS                        — transport encryption
Layer 4:  httpOnly SameSite=lax cookies      — prevents JS token theft (XSS)
Layer 5:  JWT validation + session check     — every authenticated route
Layer 6:  Role guards (require_role)         — admin/employee routes only
Layer 7:  KYC gate (require_kyc)             — payments, account creation, loans
Layer 8:  OTP verification                   — payment commit, recovery update
Layer 9:  AES-256-GCM field encryption      — PII in MongoDB (email, phone, balances)
Layer 10: SHA-256 deterministic hash         — lookup without plaintext in DB
Layer 11: CountingBloomFilter                — O(1) duplicate detection at registration
Layer 12: ML Fraud Pipeline (M2+M6+M4)      — every debit/transfer transaction
Layer 13: Post-payment risk scoring          — amount + account age + SIM binding
Layer 14: Audit log                          — immutable record of all admin actions
Layer 15: Insider threat scan (M7)           — GraphSAGE employee-customer collusion
```

---

## Frontend Architecture

### State Management

The primary Zustand store `useAuthStore` holds:
- `user` — full user object (id, email, full_name, role, kyc_status, language, theme_mode, accessibility)
- `isAuthenticated` — boolean derived from user presence
- `login(user)`, `logout()`, `updateUser(partial)` — mutators

### API Layer (api.ts)

Two Axios instances with `withCredentials: true`:

- **`api`** — base URL `/api/v1` — main backend
- **`complianceApi`** — base URL `/compliance-api/api/v1` — compliance sidecar

Response interceptor on `api`: on `401`, attempts `POST /auth/refresh` once, retries original request. If retry fails, redirects to `/login` (skipped if already on `/login`).

Named export groups: `authAPI`, `accountsAPI`, `transactionsAPI`, `paymentsAPI`, `investmentsAPI`, `loansAPI`, `mlAPI`, `complianceAPI`, `kycAPI`, `adminAPI`, `notificationsAPI`, `securityAPI`, `sessionsAPI`, `aaAPI`, `assetsAPI`, `budgetsAPI`, `familyAPI`, `creditAPI`, `agentsAPI`.

### Routing

React Router v6. Role-based route protection via `RoleProtectedRoute` component. Customer routes are separate from admin/employee routes.

### Localisation

`frontend/src/lib/translations.ts` exports a `translations` object keyed by language code. Languages supported: `en`, `hi`, `pa` (visible from compliance response messages and translation keys). The `useTranslation()` hook reads `user.language` from Zustand and returns a `t(key)` function. LLM endpoints also receive `language` in the prompt so AI responses match the user's preferred language.

### Theming

Users can set `theme_mode` (stored in the user document). Accessibility flags (`reducedMotion`, `highContrast`, `largeText`, `compactDensity`, `voiceNavigation`, `screenReader`) are persisted on the user document and applied via CSS variables and conditional class names.

---

## Data Flow Diagrams

### Login Flow

```
Browser                        FastAPI                     Redis / MongoDB
   │                              │                              │
   │  POST /auth/login             │                              │
   │  {email, password,            │                              │
   │   captcha_token}              │                              │
   │─────────────────────────────►│                              │
   │                              ├─ Turnstile.verify_token()    │
   │                              ├─ SHA-256(email) → hash       │
   │                              ├─ db.users.find_one(hash) ───►│
   │                              │◄──────────────── user doc ───┤
   │                              ├─ decrypt_user_data(user)     │
   │                              ├─ Argon2 verify password      │
   │                              ├─ check_and_save_device()     │
   │                              │   (UA parse + geo lookup)    │
   │                              ├─ create session UUID         │
   │                              ├─ SETEX session:{id} 7d ─────►│
   │                              ├─ SADD user_sessions:{uid} ──►│
   │                              ├─ create_access_token (JWT)   │
   │                              ├─ create_refresh_token (JWT)  │
   │                              ├─ Kafka: user.activity        │
   │◄─── Set-Cookie ─────────────┤                              │
   │     access_token (30min)     │                              │
   │     refresh_token (7d)       │                              │
   │◄─── {user, tokens, message} ┤                              │
```

### Payment Flow

```
POST /payments/initiate
  1. JWT auth + KYC check (require_kyc dependency)
  2. Verify source account ownership + active status
  3. Check balance ≥ amount
  4. Check family spending limit (if member of family)
  5. Resolve destination:
     - UPI VPA (username@wealthvault) → find user by email prefix → find primary account
     - Account number → SHA-256 hash lookup in accounts collection
  6. Insert payment doc (status: "pending_otp")
  7. Generate 6-digit OTP, SETEX payment_otp:{id} in Redis (OTP_EXPIRE_SECONDS)
  8. Send OTP via SMS (Twilio) or email (Kafka email.otpVerification)
  9. Return {payment_id}

POST /payments/verify
  1. Check otp_locked:{payment_id} in Redis → 429 if locked
  2. GET payment_otp:{payment_id} from Redis
  3. Compare OTP (track failures in otp_failures:{id}; lock after 5 failures for 1h)
  4. Decrypt both account balances
  5. Verify source balance still sufficient
  6. Re-encrypt updated balances, set on both accounts
  7. Insert debit + credit transaction records
  8. Update payment status → "completed"
  9. Post-commit risk scoring (amount + account age + SIM binding)
  10. If risk > 0.6: insert alerts doc + send fraud alert email
  11. Kafka: transactions.created, notifications.send
  12. Return {message, payment_id, budget_alert}
```

### KYC Flow

```
User: POST /kyc/upload (Aadhaar front+back, PAN as base64 strings)
  ↓
kyc_service.process_kyc_documents()
  ├── Google Vision API TEXT_DETECTION (each image)
  │   └── fallback: Tesseract OCR (if pytesseract installed)
  ├── _extract_aadhaar_fields()
  │   ├── regex: 12-digit number (XXXX XXXX XXXX)
  │   ├── regex: DOB (DD/MM/YYYY or DD-MM-YYYY)
  │   └── heuristic: name from top lines
  ├── _extract_pan_fields()
  │   ├── regex: PAN format ([A-Z]{5}[0-9]{4}[A-Z])
  │   └── heuristic: name after "Income Tax Department" line
  ├── _run_fraud_detection()
  │   ├── Verhoeff checksum on Aadhaar number
  │   ├── PAN 4th character must be 'P' (individual)
  │   ├── fuzzy name match Aadhaar vs PAN (token_sort_ratio ≥ 80)
  │   └── DOB cross-match
  └── _calculate_confidence() → score 0–100
  ↓
upsert kyc_documents (status: "pending_review")
update users.kyc_status = "pending"

Admin: PUT /admin/kyc/{user_id}/action
  action values: accept → "verified"
                 reject → "rejected"
                 request_reupload → "reupload_requested"
                 escalate → "escalated" (employee only)
  ↓
update kyc_documents + users.kyc_status
insert audit_logs
Kafka: notifications.send → user receives status notification
```
