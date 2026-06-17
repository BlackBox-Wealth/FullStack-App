# WealthVault — Security & Fraud System

---

## 1. Authentication System

### 1.1 JWT Token Architecture

Algorithm: **HS256** (HMAC SHA-256), secret from `JWT_SECRET_KEY` env var.

| Token | Lifetime | Cookie | Claims |
|---|---|---|---|
| `access_token` | 30 minutes | httpOnly, SameSite=lax | `sub` (user_id), `exp`, `type: "access"`, `session_id` |
| `refresh_token` | 7 days | httpOnly, SameSite=lax | `sub` (user_id), `exp`, `type: "refresh"`, `session_id` |

Both cookies use `SameSite=lax` to block CSRF on cross-origin requests while allowing normal navigation. `httpOnly` prevents JavaScript access.

`get_current_user` dependency reads the token from:
1. `Authorization: Bearer <token>` header (preferred; used by API clients).
2. `access_token` httpOnly cookie (fallback; used by the web frontend).

After signature verification and expiry check, the `session_id` claim is validated against Redis (`session:{session_id}` key). If the key does not exist (session revoked), a `401 Session has been revoked` error is returned. Tokens issued before session binding was added (no `session_id` claim) are still accepted but log a warning.

### 1.2 Token Refresh

`POST /api/v1/auth/refresh` — reads the `refresh_token` cookie, decodes it, validates `type: "refresh"`, checks the session is still active, issues a new `access_token` cookie with a fresh 30-minute expiry. The refresh token itself is not rotated (same 7-day token remains valid until logout or session revocation).

The Axios interceptor in `frontend/src/api.ts` automatically calls this endpoint when any non-auth request returns `401`, then retries the original request. Routes excluded from auto-retry: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/me`, `/auth/behavior-anomaly`.

---

## 2. Password Security

### 2.1 Argon2id Hashing

Library: `argon2-cffi`. Configuration:

| Parameter | Value |
|---|---|
| `time_cost` | 3 iterations |
| `memory_cost` | 65536 KB (64 MB) |
| `parallelism` | 2 |
| `hash_len` | 32 bytes |
| `salt_len` | 16 bytes |

`verify_password(plain, hashed)` uses `PasswordHasher.verify()` and returns `False` on `VerifyMismatchError` or `VerificationError` without leaking timing information.

### 2.2 Password Reset

1. `POST /auth/request-password-reset` — rate-limited to **3 requests per hour** per email (checked against Redis counter). Generates OTP, stores in Redis with TTL.
2. `POST /auth/reset-password` — validates `email`, `otp`, `new_password`. Maximum **5 OTP attempts** tracked in Redis.

---

## 3. Field-Level Encryption

### 3.1 AES-256-GCM

All PII stored in MongoDB is encrypted using `EncryptionHelper` (key from `DATA_ENCRYPTION_KEY` env var, base64-decoded to 32 bytes).

**Encryption:**
```
nonce = os.urandom(12)   # 96-bit random nonce per field
ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
stored_value = base64(nonce + ciphertext)
```

**Decryption:**
```
data = base64.decode(stored_value)
nonce = data[:12]
ciphertext = data[12:]
plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
```

The GCM authentication tag is embedded in the ciphertext by the `cryptography` library. Any tampering with the ciphertext or nonce raises `InvalidTag` on decryption.

Encrypted fields include: `full_name`, `email`, `phone`, `account_number`, `balance`, `amount`, `description`, and other user/transaction PII fields (applied via `encrypt_user_data` / `decrypt_user_data` helper functions in `app/helper/utils.py`).

### 3.2 Deterministic Hash for Lookup

Lookups by email or account number cannot use AES-GCM (non-deterministic nonce). A separate deterministic SHA-256 hash is stored alongside the encrypted field:

```python
def generate_deterministic_hash(input_string: str) -> str:
    normalized = str(input_string).strip().lower()
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
```

Fields indexed by hash: `email_hash`, `phone_hash`, `account_number_hash`. MongoDB queries use the hash; the human-readable value is stored encrypted separately.

---

## 4. Bloom Filter — Duplicate Registration Prevention

A **CountingBloomFilter** (`capacity=100_000`, `error_rate=0.01`) is loaded at application startup and checked before inserting a new user:

```python
if email_hash in bloom_filter:
    raise HTTPException(400, "Email already registered")
bloom_filter.add(email_hash)
```

The counting variant (rather than a simple Bloom filter) allows future deletion support. Provides a ~1% false-positive rate, meaning at most 1 in 100 legitimate new registrations could be incorrectly blocked — the system has a secondary check against MongoDB.

---

## 5. Multi-Factor Authentication

### 5.1 Email OTP

Generated as a 6-digit random number. Stored in Redis with key `otp:{type}:{identifier}` and configurable TTL (default 600 seconds from `OTP_EXPIRE_SECONDS`). Delivered via `aiosmtplib` with 3-retry logic.

OTP use cases:
- Registration email verification
- Payment verification (primary channel)
- Password reset
- Recovery info update

### 5.2 SMS OTP

Generated identically. Delivered via Twilio SDK to E.164-normalised phone number. Use cases: registration phone verification, payment verification (alternative channel), transaction alerts.

### 5.3 Payment OTP Locking

Payment attempts track OTP failures in Redis:
- `otp_attempts:{payment_id}` — integer counter, expires with payment TTL.
- After **5 failed attempts**, the payment record is locked for **1 hour**.
- Maximum **3 OTP resends** per payment.

### 5.4 Behavioral Biometrics (M1)

The frontend `useBiometrics` hook collects 12 signals during the login session:

| Feature | Description |
|---|---|
| `tap_pressure` | Pointer pressure (EWMA) |
| `tap_duration_ms` | Touch/click hold duration (EWMA) |
| `finger_area_px` | Pointer contact area (EWMA) |
| `scroll_velocity_px_s` | Scroll speed (running average) |
| `scroll_acceleration` | Velocity change rate |
| `keystroke_interval_ms` | Inter-key timing (EWMA 80/20) |
| `error_rate` | Backspace count / total keystrokes |
| `nav_time_per_screen_s` | Time spent on current screen |
| `session_entropy` | Cumulative interaction count (capped at 1.0) |
| `hesitation_events` | Keystrokes with > 2-second gap |
| `copy_paste_detected` | Binary flag: any copy/paste event |
| `tab_switch_count` | Browser tab hidden events |

These are sent to `POST /api/v1/ml/behavior-anomaly`. The backend M1 Isolation Forest model scores the vector; if `is_anomaly: true`, a security alert notification is created and the admin is informed.

---

## 6. CAPTCHA

**Cloudflare Turnstile** is integrated on login and registration endpoints. Controlled by `ENABLE_TURNSTILE` env var.

`TurnstileService.verify(token)` sends a POST request to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the `TURNSTILE_SECRET_KEY`. Returns `success: bool`. If verification fails, a `400 CAPTCHA verification failed` error is returned.

The frontend `TurnstileWidget` component (`@marsidev/react-turnstile`) renders the challenge widget on `Login.tsx` and `Register.tsx`.

---

## 7. Session Management

### 7.1 Session Creation

On successful login, a session document is created in Redis with key `session:{session_id}` (UUID4):

```json
{
  "user_id": "...",
  "device_fingerprint": "sha256(user_agent + os)",
  "ip_address": "...",
  "city": "...",
  "country": "...",
  "created_at": "ISO datetime",
  "last_seen": "ISO datetime"
}
```

The `session_id` is embedded in both the access token and refresh token JWT claims.

`user_sessions:{user_id}` is a Redis SET tracking all active session IDs for the user.

### 7.2 Session Validation

Every authenticated request verifies `session:{session_id}` exists in Redis. Falls back to MongoDB `sessions` collection if Redis is unavailable.

### 7.3 Session Revocation

- `DELETE /api/v1/sessions/{id}` — removes `session:{id}` from Redis and from the `user_sessions:{user_id}` SET.
- `DELETE /api/v1/sessions` — removes all sessions except the current `session_id`. Forces all other browser tabs / devices to re-authenticate.
- `POST /api/v1/auth/logout` — removes the current session and clears both cookies.

### 7.4 Device Tracking

`DeviceService` records known devices in the `known_devices` MongoDB collection:

- **Fingerprint:** SHA-256 of `user_agent + os_string`.
- **Geolocation:** `ip-api.com` reverse lookup (skips private/loopback IPs). Returns city, country.
- Upsert by `{user_id, fingerprint}` — updates `last_seen` on each login.

`GET /api/v1/auth/devices` — returns the list of known devices for the current user. Lets users identify unfamiliar devices.

---

## 8. Role-Based Access Control (RBAC)

### 8.1 Role Hierarchy

| Role | Access Level |
|---|---|
| `customer` | Own resources only |
| `employee` | KYC review, fraud alerts, loan review, notification summary |
| `relationship_manager` | Everything employee can do + user management, analytics, risk dashboard |
| `super_admin` | Full access including audit logs, performance metrics, role changes |

### 8.2 Implementation

`require_role(*roles)` FastAPI dependency factory:

```python
def require_role(*roles):
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(403, "Access denied")
        return current_user
    return role_checker
```

Applied at router level: e.g., `Depends(require_role("super_admin"))`, `Depends(require_role("super_admin", "relationship_manager"))`.

Frontend enforcement via `RoleProtectedRoute` component using the same role lists. Role mismatches redirect to `/dashboard`.

### 8.3 KYC Gate

`require_kyc` dependency checks `current_user["kyc_status"] == "verified"`. Applied to:
- `POST /accounts/` (create account)
- `POST /loans/apply`
- `POST /payments/initiate`

Non-verified users receive a structured `403 KYC_REQUIRED` response with their current status. Staff roles (`employee`, `relationship_manager`, `super_admin`) bypass the KYC gate.

---

## 9. Fraud Detection Pipeline

### 9.1 Transaction-Time Pipeline

Every new transaction runs through a 3-stage pipeline:

**Stage 1 — M2: BERT Category Classifier**
- Model: BERT multilingual fine-tuned.
- Input: transaction description text.
- Output: category label (food / shopping / utilities / healthcare / travel / entertainment / other) + confidence score.

**Stage 2 — M6: LSTM Sequence Anomaly**
- Model: LSTM trained on temporal transaction sequences.
- Input: recent transaction history for the account (amounts, categories, timestamps).
- Output: anomaly score (0–1) for the current transaction in context.

**Stage 3 — M4: RiskMLP**
- Model: 3-layer MLP (13 → 64 → 32 → 16 → {1 risk score, 3 decision logits}).
- 13 input features (exact order):

| # | Feature |
|---|---|
| 1 | amount_normalized |
| 2 | time_of_day (hour / 24) |
| 3 | day_of_week (0–6 / 6) |
| 4 | account_age_days |
| 5 | balance_after_normalized |
| 6 | category_encoded (0–6 int) |
| 7 | ml_anomaly_score (from M6) |
| 8 | is_international (binary) |
| 9 | is_new_payee (binary) |
| 10 | velocity_count (txns last 24h) |
| 11 | large_transaction_flag (amount > ₹50,000) |
| 12 | high_risk_category (binary) |
| 13 | m2_confidence (category confidence) |

- Output: `risk_score` (float 0–1), `decision` (approve / review / block).

**Decision actions:**

| Decision | Action |
|---|---|
| `approve` | Transaction committed normally |
| `review` | Transaction committed; inserted into `fraud_logs`; security alert created |
| `block` | `HTTP 403 Transaction blocked by fraud detection`; fraud log inserted |

### 9.2 Fraud Alert Management

`fraud_logs` collection stores: `user_id`, `transaction_id`, `risk_score`, `risk_factors`, `created_at`.

Admin endpoints:
- `GET /api/v1/admin/fraud-alerts` — returns all unresolved alerts.
- `PUT /api/v1/admin/fraud-alerts/{id}/resolve?resolution=` — marks resolved with resolution note. Audit logged.

### 9.3 Insider Threat Detection (M7 GraphSAGE)

`GET /api/v1/admin/insider-threat-check` — runs the M7 GraphSAGE model. Analyses the transaction graph for employee-linked patterns (high-value transactions from accounts managed by specific employees, unusual access patterns). Returns flagged cases with risk scores.

---

## 10. KYC Identity Verification

### 10.1 Document Processing Pipeline

1. **OCR** — Google Cloud Vision API (`TEXT_DETECTION`) on all three images (Aadhaar front, Aadhaar back, PAN). Tesseract with OpenCV Otsu binarisation used as fallback.

2. **Aadhaar validation:**
   - Regex extracts 12-digit number pattern.
   - **Verhoeff checksum** algorithm validates the number mathematically. Fails with 422 if checksum invalid.

3. **PAN validation:**
   - Regex pattern: `[A-Z]{5}[0-9]{4}[A-Z]` — must match exactly.

4. **Name cross-check:**
   - Fuzzy string match (`thefuzz partial_ratio`) between the name extracted from Aadhaar and the name from PAN.
   - Threshold: **≥ 80%** similarity required. Rejects if names are too dissimilar (catches mismatched documents).

5. Sets `kyc_status = "pending"` for admin review.

### 10.2 Admin Review Flow

| Action | Status Set | Who Can Perform |
|---|---|---|
| `accept` | `verified` | employee, relationship_manager, super_admin |
| `reject` | `rejected` | employee, relationship_manager, super_admin |
| `request_reupload` | `reupload_requested` | employee, relationship_manager, super_admin |
| `escalate` | `escalated` | relationship_manager, super_admin |

Role hierarchy is enforced — employees cannot escalate. All actions are audit logged.

---

## 11. Rate Limiting

Rate limits are enforced via Redis counters (`INCR` + `EXPIRE`):

| Endpoint | Limit |
|---|---|
| `POST /auth/request-password-reset` | 3 requests per hour per email |
| OTP verification (password reset) | 5 attempts maximum |
| Payment OTP verification | 5 attempts, then 1-hour lock |
| Payment OTP resend | 3 resends per payment |

No global per-IP rate limiting middleware is present (application-level limits only).

---

## 12. Audit Logging

Every sensitive admin action is written to the `audit_logs` MongoDB collection with:

| Field | Description |
|---|---|
| `performed_by` | Email of admin who performed the action |
| `action` | Action type string (e.g., `role_change`, `user_deactivated`, `kyc_approved`, `fraud_resolved`) |
| `target_user` | User ID affected |
| `details` | Action-specific payload (new role, resolution text, etc.) |
| `created_at` | UTC timestamp |

Actions that generate audit logs: role change, user activation/deactivation, KYC accept/reject/escalate/request_reupload, fraud alert resolution, loan approve/reject.

`GET /api/v1/admin/audit-logs` — super_admin only. Returns full log, sorted by `created_at` descending.

---

## 13. MockHomomorphicEncryption

When user financial data is sent to the Groq LLM, numeric values are encoded to prevent exact financial figures from appearing in plaintext in API calls:

```python
# Encoding (before LLM)
"HE_CT_{int(value * 8191)}"
# e.g., 50000.0 → "HE_CT_409550000"

# Decoding (on LLM response, via regex)
# Matches HE_CT_(\d+), reverses: int(match) / 8191
```

This is labelled "MockHomomorphicEncryption" in the codebase — it is not true homomorphic encryption (no computation on ciphertext), but it obfuscates raw financial values in transit to the external API. Applied in: `ml.py` (recommendations, scenario planner, insights endpoints).

---

## 14. Security Headers and CORS

**CORS** — configured in `app.py` via `CORSMiddleware`. Origins loaded from `CORS_ORIGINS` env var (comma-separated). Allows credentials (`allow_credentials=True`) for cookie-based auth.

**Custom HTTP Middleware** — logs all requests (method, path, status, latency) and publishes to Kafka `system.performance` topic for Redis performance tracking. No security headers (HSTS, CSP, X-Frame-Options) are added by the application middleware — these should be handled by the reverse proxy (nginx) in production.

---

## 15. Risk Dashboard

`GET /api/v1/risk/summary` — real-time system risk score computed from:

| Signal | Max Points | Calculation |
|---|---|---|
| Unresolved fraud alerts last 24h | 40 | `min(40, count × 10)` |
| High-value transactions (> ₹1,00,000) last 24h | 20 | `min(20, count × 5)` |
| OTP verification failures last 1h | 20 | `min(20, count × 4)` |
| New user registrations last 7 days | 20 | `min(20, count × 2)` |

**Risk levels:** HIGH (≥ 60), MEDIUM (30–59), LOW (< 30).
