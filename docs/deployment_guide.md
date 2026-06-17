# WealthVault — Deployment Guide

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Docker | 24.x+ | With Docker Compose v2 |
| Docker Compose | 2.x+ | Included with Docker Desktop |
| Python | 3.11+ | For local development without Docker |
| Node.js | 18.x+ | For local frontend development |
| Git | Any | |

**External service accounts required:**

- MongoDB Atlas or self-hosted MongoDB 6.x
- Redis (or use the bundled redis-stack Docker image)
- Groq API key (`groq.com`)
- Twilio account with a phone number
- Cloudflare Turnstile site key and secret key
- Gmail account with App Password (for email delivery)

**Optional:**
- Deepgram API key (compliance voice STT)
- Sarvam AI key (Hindi/Punjabi STT alternative)

---

## 2. Repository Structure

```
PSB/
├── backend/
│   ├── app/                    # FastAPI application
│   ├── Dockerfile.app          # Main backend image
│   ├── Dockerfile.compliance_app  # Compliance sidecar image
│   ├── requirements.txt        # Python dependencies
│   ├── pyproject.toml
│   └── .env                    # Backend environment variables (create this)
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .env                    # Frontend environment variables (create this)
└── docker-compose.yml
```

---

## 3. Environment Variables

### 3.1 Backend — `backend/.env`

Create `backend/.env` with the following variables:

```bash
# Application
APP_NAME=WealthVault
DEBUG=false

# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=wealthvault

# Encryption (AES-256-GCM) — MUST be a 32-byte base64-encoded key
# Generate: python -c "from app.services.encryption import EncryptionHelper; print(EncryptionHelper.generate_base64_key())"
DATA_ENCRYPTION_KEY=<base64_32_byte_key>
ENCRYPTION_KEY=<base64_32_byte_key>

# JWT
JWT_SECRET_KEY=<random_256_bit_hex_string>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis
REDIS_URL=redis://localhost:6379

# Email (Gmail)
NO_REPLY_EMAIL=noreply@yourdomain.com
MAIL_PASSWORD=<gmail_app_password_16_chars>
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=465
MAIL_STARTTLS=false
MAIL_SSL_TLS=true

# Groq LLM
GROQ_API_KEY=gsk_...


# Twilio (SMS)
ACCOUNT_SID=AC...
AUTH_TOKEN=<twilio_auth_token>
TWILIO_PHONE_NUMBER=+1...

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=<secret_key>
ENABLE_TURNSTILE=true

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# OTP
OTP_EXPIRE_SECONDS=600

# Compliance RAG
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDING_MODEL=all-MiniLM-L6-v2
FAISS_INDEX_PATH=./data/faiss_index
CHUNK_SIZE=700
CHUNK_OVERLAP=100
TOP_K=5

# Voice (Compliance sidecar)
DEEPGRAM_API_KEY=<optional>
SARVAM_API_KEY=<optional>
STT_CONFIDENCE_THRESHOLD=0.65

# Rate limiting
RATE_LIMIT_QUERY=30/minute
RATE_LIMIT_VOICE=10/minute

# ML model storage
MODEL_DIR=./models
DATA_DIR=./data

# CORS / Frontend URL
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 3.2 Frontend — `frontend/.env`

```bash
# Cloudflare Turnstile site key (public)
VITE_TURNSTILE_SITE_KEY=<site_key>
```

---

## 4. Generating Encryption Keys

The `DATA_ENCRYPTION_KEY` must be a base64-encoded 32-byte (256-bit) AES key. Generate one with:

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
key = AESGCM.generate_key(bit_length=256)
print(base64.b64encode(key).decode())
```

Or use the built-in helper:

```python
from app.services.encryption import EncryptionHelper
print(EncryptionHelper.generate_base64_key())
```

Set the same value for both `DATA_ENCRYPTION_KEY` and `ENCRYPTION_KEY`. These keys must never change after data has been written — rotating requires re-encrypting all existing documents.

Generate the JWT secret key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 5. ML Model Files

The application requires pre-trained model files in `backend/app/ml_model/saved/`. These are not included in the repository and must be placed manually before the first run.

Expected files:

```
backend/app/ml_model/saved/
├── behavior_model.pkl          # M1 Isolation Forest
├── transaction_classifier/     # M2 BERT (directory with model files)
├── stress_detector/            # M3 BERT (directory with model files)
├── risk_mlp.pth                # M4 RiskMLP weights
├── ml_classifier.pkl           # M5 RandomForest
├── vectorizer.pkl              # M5 TF-IDF vectorizer
├── lstm_model.pth              # M6 LSTM weights
├── graphsage_model.pth         # M7 GraphSAGE weights
└── scaler.pkl                  # StandardScaler
```

**Auto-retrain for M1:** If `behavior_model.pkl` is missing or has the wrong feature count (not 12 features), `MLService._ensure_behavior_model()` automatically trains and saves a new Isolation Forest on startup using 1200 synthetic samples. This will work out of the box.

**Missing model fallback:** If other model files are missing, the corresponding ML endpoint returns an error. The rest of the application continues to function.

---

## 6. Docker Compose Deployment (Recommended)

### 6.1 Quick Start

```bash
# 1. Clone the repository
git clone <repo_url>
cd PSB

# 2. Create and populate environment files
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# 3. Place ML model files
mkdir -p backend/app/ml_model/saved
# Copy model files to this directory

# 4. Build and start all services
docker compose up --build

# Or run in detached mode
docker compose up --build -d
```

### 6.2 Service Startup Order

Docker Compose starts services in this order (enforced by `depends_on` and healthchecks):

1. **kafka** + **redis** — start first, no dependencies.
2. **kafdrop** — waits for kafka.
3. **backend_app** (port 8000) — waits for redis and kafka. Healthcheck: `curl http://localhost:8000/docs` every 10 seconds, 5 retries.
4. **backend_compliance_app** (port 8002) — same dependencies and healthcheck.
5. **frontend** (port 5173) — waits for both backends to be `service_healthy`.

### 6.3 Service URLs

| Service | URL | Purpose |
|---|---|---|
| Frontend | `http://localhost:5173` | React application |
| Main API | `http://localhost:8000` | FastAPI backend |
| API Docs | `http://localhost:8000/docs` | Swagger UI |
| Compliance API | `http://localhost:8002` | Compliance RAG sidecar |
| Kafdrop | `http://localhost:9000` | Kafka topic monitoring |
| RedisInsight | `http://localhost:8001` | Redis management UI |

### 6.4 Stopping Services

```bash
# Stop all containers
docker compose down

# Stop and remove volumes (WARNING: destroys model_data volume and Redis data)
docker compose down -v
```

### 6.5 Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend_app
docker compose logs -f frontend
```

---

## 7. Local Development (Without Docker)

### 7.1 Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start MongoDB (must be running locally or via MongoDB Atlas URI in .env)
# Start Redis (must be running locally)

# Run the main backend
uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload

# Run the compliance sidecar (in a separate terminal)
uvicorn compliance_app.main:app --host 0.0.0.0 --port 8002 --reload
```

For the compliance sidecar, ensure `FAISS_INDEX_PATH` points to an existing FAISS index or build one from your regulatory documents first.

### 7.2 Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The Vite dev server starts at `http://localhost:5173`. API requests to `/api/` and `/compliance-api/` are proxied to `localhost:8000` and `localhost:8002` respectively (configured in `vite.config.ts`).

### 7.3 Running MongoDB Locally

```bash
# Using Docker (easiest)
docker run -d -p 27017:27017 --name mongodb mongo:6

# Set in .env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=wealthvault
```

MongoDB does not require any schema setup — collections are created automatically on first write.

### 7.4 Running Redis Locally

```bash
# Using Docker (includes RedisInsight)
docker run -d -p 6379:6379 -p 8001:8001 --name redis redis/redis-stack:latest

# Set in .env
REDIS_URL=redis://localhost:6379
```

---

## 8. Database Initialisation

No migration scripts are required. MongoDB is schema-less; collections are created on first write.

**Recommended indexes** (run once, improves query performance):

```javascript
// Connect to MongoDB and run:
db.users.createIndex({ "email_hash": 1 }, { unique: true })
db.users.createIndex({ "phone_hash": 1 })
db.accounts.createIndex({ "account_number_hash": 1 }, { unique: true })
db.accounts.createIndex({ "user_id": 1 })
db.transactions.createIndex({ "user_id": 1, "created_at": -1 })
db.transactions.createIndex({ "account_id": 1 })
db.audit_logs.createIndex({ "created_at": -1 })
db.sessions.createIndex({ "session_id": 1 }, { unique: true })
db.sessions.createIndex({ "user_id": 1 })
```

**Creating the first super_admin user:**

Register a user normally through the app. Then update their role directly in MongoDB:

```javascript
db.users.updateOne(
  { email_hash: "<sha256 of email>" },
  { $set: { role: "super_admin" } }
)
```

Or use the admin API endpoint (requires an existing super_admin):
```
PUT /api/v1/admin/users/{user_id}/role?role=super_admin
```

---

## 9. Kafka Setup

Kafka is included in `docker-compose.yml`. No manual topic creation is required — AIOKafka creates topics automatically on first publish.

**Topics created automatically:**

- `transactions.created`
- `payments.initiated`
- `fraud.alerts`
- `user.activity`
- `ml.recommendations`
- `notifications.send`
- `email.otpVerification`
- `system.performance`

**Fallback mode:** If Kafka is not running, the application falls back to an in-memory event queue. All functionality works without Kafka — events are processed synchronously in the same process.

---

## 10. Compliance RAG Setup

The compliance sidecar requires a FAISS index built from regulatory documents.

```bash
cd backend

# Place regulatory PDFs in data/documents/
mkdir -p data/documents

# Build FAISS index (run once)
python -c "
from compliance_app.rag_pipeline import build_index
build_index(
    docs_path='./data/documents',
    index_path='./data/faiss_index',
    chunk_size=700,
    chunk_overlap=100
)
print('Index built successfully')
"
```

Set `FAISS_INDEX_PATH=./data/faiss_index` in `.env`.

If no index is present, the compliance query endpoint returns an error. The main backend is unaffected.

---

## 11. Production Considerations

### 11.1 Environment Variables

- Set `DEBUG=false` in production.
- Use secrets management (AWS Secrets Manager, HashiCorp Vault, Docker Secrets) instead of `.env` files.
- Never commit `.env` files to version control.

### 11.2 JWT Security

- Replace the default `JWT_SECRET_KEY` with a cryptographically secure random string (minimum 256 bits).
- Consider using RS256 (asymmetric) instead of HS256 for better key management in multi-service deployments.

### 11.3 Encryption Keys

- `DATA_ENCRYPTION_KEY` must be backed up securely. Loss of this key means all stored data is irrecoverable.
- Key rotation requires a data re-encryption migration script.

### 11.4 CORS

- Set `CORS_ORIGINS` to your production domain only (e.g., `https://app.wealthvault.com`).
- Do not use wildcard `*` with `allow_credentials=True`.

### 11.5 Reverse Proxy (nginx)

In production, place nginx in front of all services:

```nginx
server {
    listen 443 ssl;
    server_name app.wealthvault.com;

    location /api/ {
        proxy_pass http://backend_app:8000/api/;
    }

    location /compliance-api/ {
        proxy_pass http://backend_compliance_app:8002/api/;
    }

    location / {
        proxy_pass http://frontend:5173/;
    }
}
```

Add security headers: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`.

### 11.6 MongoDB

- Use MongoDB Atlas or a replica set for production (single-node has no redundancy).
- Enable MongoDB authentication.
- Enable TLS for the connection string: `mongodb+srv://user:pass@cluster.mongodb.net/wealthvault?tls=true`.

### 11.7 Redis

- Set a Redis password: `redis://:<password>@localhost:6379`.
- Enable Redis persistence (`AOF` + `RDB`) for session durability.

---

## 12. Troubleshooting

### Backend fails to start — `DATA_ENCRYPTION_KEY` error

```
pydantic_core.InitErrorDetails: 'DATA_ENCRYPTION_KEY' field required
```

The `.env` file is missing or not in the correct location. Ensure `backend/.env` exists and contains `DATA_ENCRYPTION_KEY`.

---

### ML model not found warning

```
WARNING: behavior_model.pkl not found. Auto-training new model.
```

This is expected on first run. M1 will be auto-trained with synthetic data. For other models (M2, M3, M4, M6, M7), place the model files in `backend/app/ml_model/saved/`.

---

### Kafka connection refused

```
WARNING: Kafka not available: [Errno 111] Connect call failed
Using in-memory event queue as fallback
```

Kafka is not running or `KAFKA_BOOTSTRAP_SERVERS` is misconfigured. The app will continue to work in fallback mode. To use Kafka, ensure the kafka service is up: `docker compose up kafka`.

---

### Email not sent — Gmail authentication error

```
SMTPAuthenticationError: 535 Username and Password not accepted
```

Gmail requires an App Password when 2-Factor Authentication is enabled:
1. Go to Google Account → Security → 2-Step Verification → App Passwords.
2. Generate a 16-character app password.
3. Set `MAIL_PASSWORD=<16_char_app_password>` in `.env`.

---

### Turnstile CAPTCHA blocking local testing

Set `ENABLE_TURNSTILE=false` in `.env` for local development. This accepts any token (including empty string) and skips the Cloudflare verification call.

---

### Frontend shows blank page / 401 on load

The frontend calls `GET /auth/me` on startup. If the backend is not yet healthy, this will fail silently and set `isAuthenticated: false`. Ensure:
1. The backend is running and healthy (`curl http://localhost:8000/docs`).
2. The Vite proxy is configured correctly in `vite.config.ts`.

---

### MongoDB index missing — slow queries

Run the recommended indexes listed in §8. The application works without them but query performance degrades at scale.

---

### `model_data` Docker volume is empty after rebuild

The `model_data` named volume persists across `docker compose up --build`. It is only deleted with `docker compose down -v`. If you need to update model files inside the container:

```bash
# Copy files into the running container
docker cp ./my_model.pkl wealthvault_backend_app:/app/app/ml_model/saved/my_model.pkl
```

---

## 13. Health Checks

| Service | Endpoint | Expected Response |
|---|---|---|
| Main backend | `GET http://localhost:8000/docs` | 200 (Swagger UI HTML) |
| Compliance sidecar | `GET http://localhost:8002/docs` | 200 (Swagger UI HTML) |
| Kafka | Kafdrop at `http://localhost:9000` | Web UI loads |
| Redis | `redis-cli ping` | `PONG` |
| MongoDB | `mongosh --eval "db.adminCommand('ping')"` | `{ ok: 1 }` |
