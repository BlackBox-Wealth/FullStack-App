# WealthVault - Banking & Wealth Management Platform

## 🏦 Overview

WealthVault is a production-grade, full-stack banking and wealth management platform featuring:

- **Multi-role access** (Customer, Employee, Relationship Manager, Super Admin)
- **AI-powered recommendations** using Groq LLM
- **Fraud detection** with risk scoring
- **OTP-secured payments**
- **Investment portfolio tracking**
- **Real-time analytics dashboard**

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.11+) |
| Frontend | React + TypeScript + Vite |
| Database | MongoDB |
| Cache | Redis |
| Queue | Kafka (with in-memory fallback) |
| AI/LLM | Groq API |
| Auth | JWT + bcrypt |
| Charts | Recharts |
| State | Zustand |

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB (running on localhost:27017)
- Redis (optional, running on localhost:6379)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Seed database with mock data
python -m app.seed

# Start server
uvicorn app.app:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Open in Browser

- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://localhost:8000/docs
- **Backend ReDoc**: http://localhost:8000/redoc

## 🐳 Docker Setup

```bash
docker-compose up -d
```

## 📋 Demo Login Credentials

Password for all accounts: `password123`

| Role | Email |
|---|---|
| 👑 Super Admin | admin@wealthvault.com |
| 👨‍💼 Relationship Manager | rm1@wealthvault.com |
| 👨‍💼 Employee | employee1@wealthvault.com |
| 🧑 Customer | customer1@wealthvault.com |

## 📁 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── core/          # Config, DB, Redis, Kafka, Security
│   │   ├── models/        # Pydantic schemas
│   │   ├── routes/        # API endpoints
│   │   ├── main.py        # FastAPI app
│   │   └── seed.py        # Database seeder
│   ├── .env
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/    # Sidebar, Header, Chatbot
│   │   ├── pages/         # All page components
│   │   ├── api.ts         # API client
│   │   ├── store.ts       # Zustand stores
│   │   ├── App.tsx        # Main app with routing
│   │   └── index.css      # Design system
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## 🔑 API Endpoints

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`

### Accounts
- `GET/POST /api/v1/accounts/`
- `POST /api/v1/accounts/link-external`
- `PUT /api/v1/accounts/{id}/freeze`
- `PUT /api/v1/accounts/{id}/unfreeze`

### Transactions
- `GET/POST /api/v1/transactions/`
- `GET /api/v1/transactions/spending-analysis`

### Payments (OTP-secured)
- `POST /api/v1/payments/initiate`
- `POST /api/v1/payments/verify`

### Investments
- `GET/POST /api/v1/investments/`
- `GET /api/v1/investments/portfolio`
- `GET /api/v1/investments/stocks`
- `GET/POST /api/v1/investments/goals`

### Loans
- `POST /api/v1/loans/apply`
- `GET /api/v1/loans/`

### AI/ML
- `GET /api/v1/ml/recommendations`
- `POST /api/v1/ml/fraud-check`
- `GET /api/v1/ml/spending-insights`
- `POST /api/v1/ml/chatbot`

### Admin
- `GET /api/v1/admin/users`
- `PUT /api/v1/admin/users/{id}/role`
- `GET /api/v1/admin/kyc/pending`
- `PUT /api/v1/admin/kyc/{id}/verify`
- `GET /api/v1/admin/loans`
- `PUT /api/v1/admin/loans/{id}/approve`
- `GET /api/v1/admin/fraud-alerts`
- `GET /api/v1/admin/analytics`
- `GET /api/v1/admin/audit-logs`

## 🤖 ML Models (Mock)

The ML models are mocked and ready for replacement:

1. **Recommendation Engine** - Returns investment suggestions based on risk profile
2. **Fraud Detection** - Calculates risk scores based on transaction patterns
3. **Spending Analysis** - Categorizes and analyzes spending patterns
4. **LLM Chatbot** - Uses Groq API (with fallback mock responses)

To add real models, replace the functions in `backend/app/routes/ml.py`.

## 🔐 Security Features

- JWT access + refresh tokens
- bcrypt password hashing
- Role-based access control (RBAC)
- OTP verification for payments
- Request rate limiting ready
- CORS configured
- Middleware request logging
