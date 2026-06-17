# WealthVault — Integration Documentation

---

## 1. Frontend ↔ Backend Communication

The React frontend communicates with two backend services:

| Service | Base URL | Axios Instance |
|---|---|---|
| Main backend | `/api/v1` (proxied to `http://backend_app:8000`) | `api` |
| Compliance sidecar | `/compliance-api/api/v1` (proxied to `http://backend_compliance_app:8002`) | `complianceApi` |

Both instances use `withCredentials: true` to send httpOnly cookies automatically. A 401 interceptor on the `api` instance attempts silent token refresh before redirecting to `/login`.

In Docker Compose, nginx (or Vite proxy in development) forwards:
- `/api/` → backend port 8000
- `/compliance-api/` → backend_compliance_app port 8002

---

## 2. MongoDB

**Library:** Motor (async MongoDB driver for Python)

**Connection:** `MONGODB_URL` env var (default: `mongodb://localhost:27017`). Database name: `wealthvault` from `MONGODB_DB_NAME`.

Connection is established in `app/core/database.py` on application startup via `connect_to_mongo()` in the FastAPI lifespan handler.

All PII fields stored in MongoDB are encrypted with AES-256-GCM before write and decrypted on read. SHA-256 deterministic hashes are stored alongside encrypted lookup fields (email, phone, account number) to enable indexed queries without exposing plaintext.

**Collections used:**

| Collection | Purpose |
|---|---|
| `users` | User accounts with encrypted PII |
| `accounts` | Bank accounts (internal and external) |
| `transactions` | All debit/credit transaction records |
| `payments` | Payment records (pending through completed) |
| `investments` | Investment holdings |
| `goals` | Financial goals |
| `sips` | SIP configurations |
| `loans` | Loan applications and status |
| `budgets` | Budget limits per category |
| `assets` | Physical asset records |
| `family_groups` | Family group memberships and limits |
| `family_invitations` | Pending family invitations |
| `notifications` | User notifications |
| `security_alerts` | Security-level alerts |
| `fraud_logs` | Fraud/high-risk transaction records |
| `kyc_documents` | KYC submission data |
| `known_devices` | Device fingerprints and geolocation |
| `sessions` | Session fallback storage (when Redis unavailable) |
| `audit_logs` | Admin action audit trail |

---

## 3. Redis

**Library:** `redis-py` async client

**Docker image:** `redis/redis-stack` (includes RedisSearch, RedisJSON, RedisBloom modules, RedisInsight UI on port 8001)

**Connection:** `REDIS_URL` env var (default: `redis://localhost:6379`). Connected via `connect_to_redis()` in lifespan.

Redis is used for:

| Key Pattern | Purpose | TTL |
|---|---|---|
| `session:{session_id}` | Session data (user_id, device, IP, geolocation) | Until logout |
| `user_sessions:{user_id}` | SET of active session IDs for a user | Until all sessions expire |
| `otp:{type}:{identifier}` | OTP codes for verification | `OTP_EXPIRE_SECONDS` (default 600s) |
| `otp_attempts:{payment_id}` | Payment OTP failure counter | Payment TTL |
| `ml:recommendations:{user_id}` | Cached AI recommendations | 300 seconds |
| `ml:stress:{user_id}` | Cached chat stress score | 900 seconds (15 min) |
| `rate_limit:pwd_reset:{email}` | Password reset rate limit counter | 3600 seconds (1 hour) |
| `performance:requests` | Sorted set of request latencies (20-min window) | 1200 seconds |
| `last_seen:{user_id}` | User last activity timestamp | No TTL |

If Redis is unavailable, sessions fall back to MongoDB (`sessions` collection), OTPs fall back to in-memory dict, and caching is disabled.

---

## 4. Apache Kafka

**Library:** AIOKafka (async Python client)

**Connection:** `KAFKA_BOOTSTRAP_SERVERS` env var (default: `localhost:9092`). In Docker, broker listens on `INTERNAL://kafka:29092` and `EXTERNAL://localhost:9092`.

**Fallback:** If Kafka is unavailable at startup, all events are stored in an in-memory dict (`event_store`) capped at 1000 events per topic, and handlers are triggered immediately (synchronous fallback).

### Kafka Topics

| Topic | Published By | Consumed By |
|---|---|---|
| `transactions.created` | `transactions.py` route | In-process event consumer |
| `payments.initiated` | `payments.py` route | In-process event consumer |
| `fraud.alerts` | `transactions.py` ML pipeline | In-process event consumer |
| `user.activity` | auth, accounts, transactions, loans routes | `event_consumers.py` → Redis `last_seen` update |
| `ml.recommendations` | `ml.py` route | In-process event consumer |
| `notifications.send` | Multiple routes | In-process event consumer |
| `email.otpVerification` | auth routes | `event_consumers.py` → `email_service.send_email` |
| `system.performance` | HTTP middleware | `event_consumers.py` → Redis `performance:requests` sorted set |

### Event Consumer Handlers (`app/services/event_consumers.py`)

| Topic | Handler | Effect |
|---|---|---|
| `user.activity` | `handle_user_activity` | Updates `last_seen:{user_id}` in Redis |
| `user.security` | `handle_user_security` | Logs security event |
| `system.notifications` | `handle_system_notifications` | Placeholder (no-op) |
| `system.performance` | `handle_performance` | Adds `(latency, timestamp)` to Redis sorted set; prunes entries older than 20 minutes |
| `email.otpVerification` | `handle_otp_email` | Calls `email_service.send_verification_email` |

Kafdrop UI is available at `http://localhost:9000` in Docker Compose for topic monitoring.

---

## 5. Groq API

**Purpose:** LLM inference for all AI features.

**Model:** `llama-3.3-70b-versatile`

**Library:** `groq` Python SDK

**Authentication:** `GROQ_API_KEY` env var.

Used in:

| Feature | Endpoint | Context sent to Groq |
|---|---|---|
| AI Recommendations | `GET /ml/recommendations` | Account balances, 30-day transactions, loans, investments |
| Chatbot | `POST /ml/chatbot` | Account balances, recent 10 transactions, active loans |
| What-If Scenario | `POST /ml/whatif-scenario` | Full financial profile + scenario type |
| Spending Insights | `GET /ml/spending-insights` | Category spending breakdown |
| Account/SIP/Asset/Loan Insights | Various | Domain-specific data |
| Smart Goal Insights | `GET /investments/goals/smart-insights` | Goals + monthly budget data |
| First-Time Investor Tips | `GET /investments/first-time-tips` | User profile flag only |
| Voice Agent | `POST /ml/voice-agent` | User message + account context |
| WealthAdvisor Agent | `POST /agents/advisor` | Full financial profile (balances, income, expenses, savings rate) |
| WealthTeacher Agent | `POST /agents/teacher` | Activity profile (transaction counts, categories used) |
| Compliance RAG | `POST /compliance/query` | Top-K regulatory document chunks |

**MockHomomorphicEncryption:** Before sending numeric financial values to Groq, they are encoded as `HE_CT_{int(value * 8191)}` tokens. After the response, the regex `HE_CT_(\d+)` is found in the response and reversed (`int(match) / 8191`). This obfuscates exact figures in the API payload.

---

## 6. Google Cloud Vision API

**Purpose:** OCR for KYC document verification.

**API:** `Vision API v1` — `annotateImage` with `TEXT_DETECTION` feature type.


**Request format:**

```python
{
  "requests": [{
    "image": { "content": base64_image_string },
    "features": [{ "type": "TEXT_DETECTION" }]
  }]
}
```


**Tesseract OCR:** Tesseract is used as a local OCR engine. It is called via `pytesseract` on the server side. The Tesseract executable must be installed and in the system PATH.

---

## 7. Twilio

**Purpose:** SMS OTP delivery and transaction alerts.

**Library:** `twilio` Python SDK

**Authentication:** `ACCOUNT_SID` and `AUTH_TOKEN` env vars. Sending number: `TWILIO_PHONE_NUMBER`.

**Phone normalisation:** 10-digit Indian numbers are automatically prefixed with `+91`. 12-digit numbers starting with `91` are prefixed with `+`.

### SMS Message Types

| Type | Trigger | Message Format |
|---|---|---|
| OTP | Registration, payment, recovery info | `"Your WealthVault OTP is {otp}. Valid for 10 minutes."` |
| Transaction alert | Debit transaction completed | `"{account_name} {account_number} debited for ₹{amount} on {date} - ..."` |

**Twilio Voice (Compliance sidecar):** Twilio Programmable Voice webhook endpoints at `/compliance/voice/inbound`, `/compliance/voice/process`, `/compliance/voice/continue`. TwiML responses route calls through speech recognition → RAG query → Amazon Polly TTS.

---

## 8. Yahoo Finance

**Purpose:** Real-time NSE stock price data.

**Library:** Direct HTTP calls via `aiohttp` / `httpx`.

**API version:** Yahoo Finance v7 (`query1.finance.yahoo.com/v7/finance/quote`)

**Authentication:** Crumb-based (stateless session token):

1. Fetch `https://fc.yahoo.com` to obtain the crumb cookie.
2. Call `https://query1.finance.yahoo.com/v1/test/getcrumb` with the cookie to get the crumb string.
3. Append `&crumb={crumb}` to all subsequent quote requests.

**Symbols:** NSE stocks are queried with `.NS` suffix (e.g., `RELIANCE.NS`, `TCS.NS`, `INFY.NS`).

**Used by:** `GET /investments/stocks`

---

## 9. Economic Times RSS

**Purpose:** Market news feed.

**URL:** `https://economictimes.indiatimes.com/markets/rss.cms`

**Library:** `feedparser` Python library.

Parses RSS 2.0 feed. Returns up to 10 articles with `title`, `link`, `published` fields.

**Used by:** `GET /investments/news`

---

## 10. Cloudflare Turnstile

**Purpose:** CAPTCHA verification on login and registration.

**Library:** Direct HTTP call to Cloudflare API.

**Frontend widget:** `@marsidev/react-turnstile` React component. Renders the challenge; returns a token on completion.

**Backend verification (`TurnstileService`):**

```
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
Content-Type: application/x-www-form-urlencoded

secret={TURNSTILE_SECRET_KEY}&response={token}
```

**Config:** `TURNSTILE_SECRET_KEY` env var. `ENABLE_TURNSTILE=false` disables verification (useful for local dev — accepts any token including empty string).

---

## 11. ip-api.com Geolocation

**Purpose:** Resolve client IP address to city and country for device fingerprinting.

**URL:** `http://ip-api.com/json/{ip}?fields=country,city`

**Library:** Direct HTTP call.

**Behaviour:**
- Private/loopback IP ranges (`10.x`, `192.168.x`, `172.16-31.x`, `127.x`, `::1`) are detected and skipped (returns `{"city": "Local", "country": "Network"}`).
- Public IPs: returns `city` and `country` fields.

**Used by:** `DeviceService` on every login to enrich the session record.

---

## 12. aiosmtplib (Email)

**Purpose:** Transactional email delivery.

**Library:** `aiosmtplib` (async SMTP client).

**Configuration env vars:**

| Variable | Description |
|---|---|
| `MAIL_SERVER` | SMTP server hostname (e.g., `smtp.gmail.com`) |
| `MAIL_PORT` | SMTP port (e.g., `465` for TLS) |
| `NO_REPLY_EMAIL` | Sender address |
| `MAIL_PASSWORD` | App password (Gmail 2FA app password recommended) |

**Connection:** `use_tls=True`, `timeout=30`.

**Retry logic:** 3 attempts with 5-second delay between attempts.

### Email Types (`EmailService`)

| Method | Trigger | Subject |
|---|---|---|
| `send_welcome_email` | Registration complete | `"Welcome to WealthVault, {name}!"` |
| `send_verification_email` | OTP generation | `"Action Required: Verify Your Identity"` |
| `send_transaction_alert` | Transaction created | `"Transaction Alert: {type} on Account ...{last4}"` |
| `send_security_alert` | Suspicious login | `"Security Alert: New Device Login"` |
| `send_new_device_alert` | New device/location login | `"New Device Login Detected - WealthVault"` |
| `send_notification` | Generic notification | `"Notification: {title}"` |
| `send_fraud_alert` | High-risk transaction | `"High-Risk Payment Alert - WealthVault"` |

All emails use a shared HTML template with WealthVault branding: dark blue gradient header, white content card, blue CTA button, light grey footer.

---

## 13. Compliance RAG Pipeline (Sidecar Service)

The compliance service runs as a separate FastAPI app on port 8002 (`backend/compliance_app/`).

**Components:**

| Component | Library | Purpose |
|---|---|---|
| Vector store | FAISS | Semantic search over embedded regulatory document chunks |
| Lexical search | BM25 | Keyword-based retrieval as complement to semantic search |
| Embeddings | Model from `EMBEDDING_MODEL` env var | Converts query and chunks to dense vectors |
| LLM | Groq `llama-3.3-70b-versatile` | Generates grounded answer from retrieved chunks |
| Rule engine | Custom Python | Hard-coded compliance rule checks |

**Config env vars:**

| Variable | Description |
|---|---|
| `GROQ_MODEL` | LLM model name |
| `EMBEDDING_MODEL` | HuggingFace embedding model name |
| `FAISS_INDEX_PATH` | Path to pre-built FAISS index |
| `CHUNK_SIZE` | Document chunk size (tokens) |
| `CHUNK_OVERLAP` | Overlap between chunks |
| `TOP_K` | Number of chunks to retrieve |

**RAG client (`app/services/rag_client.py`):** Uses lazy singleton `_pipeline`. The synchronous RAG call is wrapped in `asyncio.get_event_loop().run_in_executor()` to avoid blocking the async event loop.

**Supported documents:** RBI KYC Master Direction, SEBI guidelines, DPDP Act 2023, and other Indian financial regulatory documents.

**Voice:** Twilio Programmable Voice + Deepgram (or Sarvam AI) STT + Amazon Polly Aditi voice (Indian English / Hindi TTS). Language auto-detected for en / hi / pa.

---

## 14. ML Model Files

Models are loaded from `backend/app/ml_model/saved/` at startup by `MLService` singleton.

| Model File | Purpose | Framework |
|---|---|---|
| `behavior_model.pkl` | M1 Isolation Forest (behavioral biometrics) | scikit-learn |
| `transaction_classifier/` | M2 BERT multilingual (transaction category) | HuggingFace Transformers |
| `stress_detector/` | M3 BERT (chat stress detection) | HuggingFace Transformers |
| `risk_mlp.pth` | M4 RiskMLP (fraud risk scoring) | PyTorch |
| `ml_classifier.pkl` + `vectorizer.pkl` | M5 RandomForest + TF-IDF (backup classifier) | scikit-learn |
| `lstm_model.pth` | M6 LSTM (sequence anomaly) | PyTorch |
| `graphsage_model.pth` | M7 GraphSAGE (insider threat) | PyTorch Geometric |
| `scaler.pkl` | StandardScaler for feature normalisation | scikit-learn |

**Volume mount:** The `model_data` named Docker volume mounts at `/app/ml_model/saved` in the `backend_app` container. This allows model files to be updated without rebuilding the image.

**Auto-retrain:** If `behavior_model.pkl` has a different feature count than the current 12-feature `BEHAVIOR_FEATURES` list, `MLService._ensure_behavior_model()` trains a new Isolation Forest on 1200 synthetic samples (normal data: standard normal, anomalies: shifted by +3σ) and saves the new model file.

---

## 15. Account Aggregator (Mock)

Implements the RBI Account Aggregator (AA) framework as a mock.

**MockAAService** (`app/services/aa_service.py`):
- Maintains an in-memory dict of consent records.
- Generates fake accounts for 4 banks: PNB, SBI, HDFC, ICICI. Random account numbers and balances.
- Generates random synthetic transactions for each account.
- Auto-approves consent on the first status check (simulates user granting consent in AA app).

In a production deployment, this would be replaced with a real AA gateway integration conforming to the ReBIT AA API specification.

---

## 16. Verhoeff Checksum (Aadhaar Validation)

**Library:** Custom implementation (or `verhoeff` PyPI package).

**Purpose:** Validates the 12-digit Aadhaar number mathematically. The last digit is a check digit computed using the Verhoeff algorithm (multiplication table + permutation table + inverse table).

Called in `KYCService` after regex extraction of the Aadhaar number from OCR output.

---

## 17. thefuzz (Fuzzy Name Matching)

**Library:** `thefuzz` (formerly `fuzzywuzzy`)

**Purpose:** Cross-document name verification in KYC. Compares name extracted from Aadhaar OCR with name extracted from PAN OCR.

**Method:** `partial_ratio(aadhaar_name, pan_name)` — returns 0–100. Threshold: **80**. Values below 80 reject the KYC submission with `"Name mismatch between Aadhaar and PAN documents"`.

---

## 18. Docker Compose Service Topology

```
┌─────────────────────────────────────────────────────────────────┐
│  docker-compose.yml                                             │
│                                                                 │
│  kafdrop (9000) ──────────────────────────── monitors          │
│                                                │                │
│  kafka (9092/29092) ◄──────────────────────── produces/consumes│
│         ▲                                      │                │
│  zookeeper (2181) ─────────────────────────────┘                │
│                                                                 │
│  redis-stack (6379/8001)                                        │
│         ▲                                                       │
│  backend_app (8000) ◄────── healthcheck /docs                  │
│         │                                                       │
│  backend_compliance_app (8002) ◄─── healthcheck                │
│         │                                                       │
│  frontend (5173) ─────────── waits for both backends healthy   │
│                                                                 │
│  [named volume] model_data → /app/ml_model/saved               │
└─────────────────────────────────────────────────────────────────┘
```

The `frontend` service's `depends_on` condition is `service_healthy` for both backend services, ensuring the backends are fully ready before the Vite dev server starts.
