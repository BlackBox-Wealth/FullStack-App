# WealthVault — AI & Datasets Guide

This document explains every AI model, agent, and dataset used in the WealthVault platform in plain language. No ML background required.

---

## How to Read This Document

The platform has **three kinds of AI**:

1. **Trained Models** — small, fast algorithms trained on our own data (runs locally on a server)
2. **LLM (Large Language Model)** — a powerful pre-built AI (Groq / Llama 3.3 70B) that we call over the internet to generate advice, explanations, and chat replies
3. **Rule-based Compliance Engine** — not really "AI", but automated rule-checking for banking regulations

These three work together to protect users and give them financial advice.

---

## Part 1 — The Trained ML Models

All 8 locally-trained models live in a separate mini-server called `ml_models_server/` running on port 50051. The main backend talks to it using a fast protocol called gRPC. This keeps the AI separate and fast.

---

### Model M1 — Behavioral DNA (Isolation Forest)

**What it does:** Checks whether the person using the app right now is actually the real account owner — not by password, but by *how* they physically use their phone.

**How it works:**
- The app silently tracks 12 physical signals while you tap, scroll, and type:
  - Tap pressure, tap duration, finger contact area
  - Scroll speed and acceleration
  - How fast you type and how often you backspace
  - How long you spend on each screen
  - Whether you copy-pasted anything or switched browser tabs
- These 12 numbers are fed into an **Isolation Forest** — a type of anomaly detector that learns what "normal" looks like for each user, then raises an alarm when behavior looks unusual.

**When it runs:** At login. The frontend sends these signals to `/api/v1/ml/behavior-anomaly`.

**Result:** Returns `is_anomaly: true/false` and a risk score. If anomalous, a security alert is created and the admin is notified.

**Why Isolation Forest instead of something else:** It produces very few false alarms compared to other anomaly detectors, which matters because flagging normal users constantly would be annoying.

**Accuracy:** 96.51% accuracy, 99.49% specificity (almost never flags a real user as suspicious).

---

### Model M2 — BERT Transaction Classifier

**What it does:** Reads a transaction description (like "SWIGGY ORDER PAYMENT") and automatically figures out what category it belongs to.

**Categories:**
- Food, Transport, EMIs, Entertainment, Utilities, Investments, Other

**How it works:**
- Uses a **BERT** model — a type of deep learning model that understands language, fine-tuned to understand bank transaction text
- Supports **English, Hindi (Devanagari), and Punjabi (Gurmukhi)**
- Base model: `bert-base-multilingual-cased` with a classification layer on top

**When it runs:** Every time a transaction is created (`POST /transactions/`). Also available standalone at `/api/v1/ml/classify-transaction`.

**Why it matters:** If the category the user picked doesn't match what M2 predicts, that mismatch is a weak fraud signal passed into the final risk model (M4).

**Examples:**
```
"HDFC BANK PERSONAL LOAN EMI"  → EMIs (97% confidence)
"OLA RIDE PAYMENT"             → Transport (95% confidence)
"बिजली बिल भुगतान"            → Utilities (91% confidence)
```

**Accuracy:** Hosted on HuggingFace at `NanG01/bert-txn-classifier`.

---

### Model M3 — NLP Coercion Detector

**What it does:** Reads what a user types in the chat and detects whether they sound like they are being threatened, rushed, or pressured into making a transaction. This catches social engineering attacks where a scammer calls a victim and tells them to transfer money urgently.

**How it works:**
- Fine-tuned **MuRIL BERT** (multilingual) — 2 output classes: `0 = normal`, `1 = stressed/coerced`
- Runs on every chat message sent to the AI chatbot

**When it runs:** Called every time a user sends a message to `/api/v1/ml/chatbot`. The result (called `chat_stress`) is cached for 15 minutes and then used by M4 when the same user attempts a transaction.

**Example signals it catches:**
```
"They said I must transfer 50000 rupees urgent right now" → COERCION (risk_pts: 20)
"Jaldi karo, do minute vich transfer karna hai"           → COERCION (risk_pts: 20)
"How can I increase my monthly SIP?"                      → Normal (risk_pts: 0)
```

**Why it matters:** This is the coercion-specific layer. Even if the user's password and biometrics are fine, M3 catches the scenario where a scammer is talking them through a fraudulent transfer.

---

### Model M4 — RiskMLP (The Final Fraud Judge)

**What it does:** Takes signals from all the other models plus contextual facts about the transaction and produces one final score: how risky is this transaction right now? (0 = safe, 1 = definitely block it)

**How it works:**
- A **3-layer neural network** (MLP = Multi-Layer Perceptron) with 13 inputs
- Input features (in order):

| # | Feature | Where it comes from |
|---|---------|---------------------|
| 1 | Transaction amount | User input |
| 2 | Number of past transactions | Database |
| 3 | Category mismatch score | M2 output |
| 4 | Sequence anomaly score | M6 (LSTM) output |
| 5 | Behavioral anomaly score | M1 (BehaviorDNA) output |
| 6 | Insider threat score | M7 (GraphSAGE) output |
| 7 | Chat stress score | M3 (Coercion Detector) output |
| 8 | Is payee new? | Database lookup |
| 9 | SIM card changed recently? | Device service |
| 10 | Location risk | IP geolocation |
| 11 | Hour of day | System clock |
| 12 | Day of week | System clock |
| 13 | IP risk | IP lookup |

**Output:** `risk_score` (0.0–1.0) + `decision`:
- `approve` → transaction goes through
- `review` → transaction goes through but gets logged in fraud_logs + admin alert
- `block` → transaction is rejected with HTTP 403

**When it runs:** Step 4 in the transaction fraud pipeline (see Part 3 below for the full flow).

---

### Model M5 — LSTM Sequence Anomaly (Spending Pattern Analyzer)

**What it does:** Looks at your last 30 transactions as a sequence and checks if the current transaction "fits" your normal pattern or is a sudden unexplained change.

**How it works:**
- **LSTM Autoencoder** — a neural network that learns to compress a sequence of transactions and then reconstruct it
- If it can't reconstruct the current transaction well (high error), it means this transaction is unusual in context
- Features per transaction: amount, timestamp, category, is_debit (15 total features per step)

**Example:** If you normally buy coffee → groceries → pay rent, but suddenly it's a ₹1,50,000 wire transfer on a Sunday at 2 AM, the LSTM reconstruction error spikes.

**Accuracy:** 96.36% accuracy, 100% sensitivity (caught every injected fraud sequence in testing).

---

### Model M6 — Random Forest Cashflow Forecaster

**What it does:** Predicts your daily balance for the next N days.

**How it works:**
- **Random Forest Regressor** trained on your historical net daily cash flow (income minus spending)
- Three input features: net flow on a given day, day of week, day of month
- Why Random Forest and not ARIMA (the traditional time-series model)? Because banking data has huge spikes (salary on the 1st, rent on the 5th) that ARIMA handles poorly.

**When it runs:** `/api/v1/ml/forecast-cashflow`

**Output:** Array of `{date, projected_balance, inflow, outflow}` for each future day, used in the cashflow chart on the dashboard.

**Accuracy:** R² of 0.85–0.99 across different users.

---

### Model M7 — GraphSAGE Insider Threat Detector

**What it does:** Looks at the *network of relationships* between bank employees and customer accounts to detect collusion (e.g., an employee helping a friend commit fraud or approving their own transfers).

**How it works:**
- **GraphSAGE** is a Graph Neural Network (GNN). Instead of looking at one employee or one transaction in isolation, it treats the bank as a social graph:
  - Nodes = employees and customer accounts
  - Edges = transactions between them
- It learns what "normal" connections look like, and flags abnormal patterns (e.g., employee who keeps approving large transfers for one specific customer)
- The current graph has 12 nodes (hackathon scope); production would scale to thousands.

**When it runs:** 
- Inline during transactions: scores the user-merchant relationship
- Admin batch scan: `GET /api/v1/admin/insider-threat-check` (super_admin only)

**Accuracy:** 100% on the training graph (small hackathon graph — scales with data).

---

## Part 2 — The LLM (Large Language Model): Groq / Llama 3.3 70B

**What it is:** A very large pre-trained AI model hosted by Groq. We don't train this ourselves — we call it via API and give it context (user's financial data) to generate personalized advice.

**Why Groq specifically?** Groq runs on specialized hardware called LPUs (Language Processing Units) that give extremely low-latency responses — important for a banking app where users expect instant replies.

**Where the LLM is used:**

| Feature | What the LLM does |
|---------|------------------|
| AI Chatbot (`/ml/chatbot`) | Answers questions about your account using live data |
| AI Recommendations (`/ml/recommendations`) | Gives personalized financial recommendations based on your full profile |
| Spending Insights (`/ml/spending-insights`) | Generates a natural language summary of your spending patterns |
| What-If Planner (`/ml/whatif-scenario`) | Simulates "what if I save ₹5000/month more?" type projections |
| Goal Insights (`/investments/goals/smart-insights`) | Tells you whether your goals are achievable |
| First-Time Investor Tips | Generates beginner investment advice for the Indian market |
| WealthAdvisor Agent (`/agents/advisor`) | Acts like a Virtual CA — analyzes your finances and answers your query |
| WealthTeacher Agent (`/agents/teacher`) | Generates 20 personalized daily financial lessons based on your activity |
| Compliance RAG (`/compliance/query`) | Answers banking regulation questions with RBI/SEBI sources |
| Voice Agent (`/ml/voice-agent`) | Understands natural language commands ("What is my balance?") |
| XAI Explanation | Explains in plain language why a transaction was blocked |

**Privacy protection — MockHomomorphicEncryption:** Before sending any financial numbers to Groq, the system encodes them as `HE_CT_{value × 8191}` so raw amounts don't appear in the API call. The LLM response is decoded back on return. This is labeled "mock" because it's obfuscation, not true cryptographic homomorphic encryption, but it prevents exact account balances from appearing in Groq's logs.

---

## Part 3 — How All Models Work Together (Transaction Fraud Pipeline)

Every time a user makes a transaction, this is the exact sequence:

```
User submits transaction
        │
        ▼
Step 1: M2 BERT Classifier
  → Reads the transaction description
  → Predicts the category
  → Flags if user's chosen category doesn't match (mismatch score)
        │
        ▼
Step 2: M5 LSTM Sequence Analyzer
  → Looks at last 30 transactions
  → Checks if this transaction fits the user's pattern
  → Outputs a reconstruction error (higher = more anomalous)
        │
        ▼
Step 3: M7 GraphSAGE Insider Threat
  → Checks the employee-customer relationship graph
  → Outputs a threat score (0.0–1.0)
        │
        ▼
Step 4: M4 RiskMLP — THE FINAL DECISION
  → Takes all signals from Steps 1-3 plus:
     - Behavioral biometrics from M1 (set at login)
     - Chat stress from M3 (cached from chatbot)
     - Device/location/time contextual signals
  → Outputs: risk_score + decision
        │
        ├── "approve"  → ✅ Transaction goes through
        ├── "review"   → ⚠️ Transaction goes through + logged + admin alert
        └── "block"    → ❌ Transaction blocked (HTTP 403)
```

**Additionally, if risk_score ≥ 0.7 after commit:**
- Fraud log is created in the database
- Fraud alert published to Kafka topic
- Admin receives a security notification

---

## Part 4 — Compliance AI (RAG System)

The **Compliance Sidecar** (runs separately on port 8002) answers questions about banking regulations using a technique called **RAG (Retrieval-Augmented Generation)**.

**What is RAG?** Instead of relying on the LLM's training knowledge (which might be outdated), RAG:
1. Searches a local database of real regulatory documents
2. Finds the most relevant sections
3. Sends those sections to the LLM as context
4. The LLM answers based only on those documents

**How the search works (Hybrid Retrieval):**
- **FAISS semantic search** — finds documents that mean the same thing (even if worded differently)
- **BM25 keyword search** — finds documents with exact matching words
- Both results are combined and re-ranked

**Regulatory documents indexed:**
- RBI KYC Master Direction 2016 (updated 2021)
- Punjab & Sind Bank KYC/AML Policy 2024
- PMLA 2002 (Prevention of Money Laundering Act)
- RBI/SEBI circulars (scraped from official websites)

**Rule Engine (no LLM needed):** Some rules are hard-coded and checked directly without LLM:

| Rule | What it checks |
|------|---------------|
| KYC update frequency | High-risk customers must be re-KYC'd every 2 years |
| Cash transaction reporting | Transactions ≥ ₹10 lakh must be reported to FIU-IND |
| STR reporting | Suspicious transactions must be reported within 7 days |
| Account opening | KYC must be done before opening any account |
| Record retention | Records must be kept for at least 5 years |

**Voice support:** The compliance system also works over phone call (via Twilio). It transcribes speech using Deepgram/Sarvam, runs the RAG query, and reads the answer back using Amazon Polly. Supports English, Hindi, and Punjabi.

---

## Part 5 — AI Agents

Two specialized agents built on top of the LLM:

### WealthAdvisor Agent
- Fetches your live financial data (balances, income, expenses, savings rate) from the database
- Builds a complete financial profile
- Sends it to Groq with your question
- Returns personalized advice as plain text
- Endpoint: `POST /api/v1/agents/advisor`

### WealthTeacher Agent
- Analyzes your transaction behavior (what categories, loan status, credit score)
- Generates **20 personalized daily lessons** covering:
  - Wealth Intelligence (investing, SIPs, portfolio)
  - CIBIL/credit score management
  - Loan awareness
  - Fraud awareness
  - Basic Economics
- Endpoint: `POST /api/v1/agents/teacher`

### Chatbot Router (in Agents_for_BlackBox)
- Detects the intent of a message: ADVICE, EDUCATION, or GENERAL
- Routes to WealthAdvisor or WealthTeacher automatically
- Wraps the response in a friendly conversational format
- All data is encrypted before sending to the LLM (Fernet AES-128/256 symmetric encryption — no raw PII ever reaches the API)

---

## Part 6 — The Datasets

### Synthetic Datasets (Generated for Training)

All training data was generated programmatically using Python scripts in `AI_FOR_BLACKBOX/data/`. No real customer data was used.

| Dataset File | What It Contains | Used to Train |
|-------------|-----------------|---------------|
| `transactions.csv` | Synthetic bank transactions with merchant names, amounts, categories, timestamps | M1 TF-IDF classifier, M5 LSTM |
| `behavior_sessions.csv` | Simulated behavioral biometric readings (tap pressure, scroll speed, etc.) across normal users and anomalous sessions | M1 Isolation Forest (BehaviorDNA) |
| `financial_profiles.csv` | Synthetic user financial profiles (balance, income, spending habits) | M6 cashflow forecaster |
| `session_context.csv` | Device + location context per session | M4 RiskMLP contextual features |
| `employee_graph.csv` | Graph of employee-account relationships with fraud labels | M7 GraphSAGE insider threat |

**Generation scripts** in `AI_FOR_BLACKBOX/training/`:
- `generate_transactions.py` — creates realistic transaction sequences with seasonal patterns
- `generate_behavior_sessions.py` — simulates both normal and compromised login sessions
- `generate_financial_profiles.py` — creates diverse user financial profiles
- `generate_employee_graph.py` — builds the employee-customer graph with planted fraud edges

### M2 BERT Training Dataset

~1,300 transaction descriptions across 3 languages:
- ~500 English transactions
- ~400 Hindi transactions
- ~400 Punjabi transactions

File: `SecureWealthTwin_DL_Datasets_v2.xlsx` (private, not in repo).
Hosted model: `NanG01/bert-txn-classifier` on HuggingFace.

### M3 Coercion Detector Training Data

Fine-tuned on labeled examples of coercive vs. normal banking language in English and Hindi. Training via `AI_Models_2/M3_NLP_Coercion_Detector_Colab.ipynb`.

### Compliance RAG Document Index

Documents embedded into FAISS semantic index via `rag_plus_voice_agent/rag/embedding.py`:
- Live-scraped from RBI website (`rbi.org.in`) and CERT-In
- PDF documents dropped into `data/raw/`
- Hardcoded seed text in `rag/seed_data.py` as a fallback when live scraping fails

**Important:** Seed data is static and must be manually updated when RBI releases new circulars. See `SEED_DATA_NOTES.md` for instructions.

---

## Part 7 — Model Performance Summary

| Model | Algorithm | Accuracy | Key Metric |
|-------|-----------|----------|------------|
| M1 BehaviorDNA | Isolation Forest | 96.51% | 99.49% specificity (almost no false alarms) |
| M2 BERT Classifier | Fine-tuned mBERT | — | 98%+ confidence on common transactions |
| M3 Coercion Detector | Fine-tuned MuRIL BERT | — | Catches multi-language coercion language |
| M4 RiskMLP | 3-layer MLP (13→64→32→16) | — | Combines all signals into one decision |
| M5 LSTM Sequence | LSTM Autoencoder | 96.36% | 100% sensitivity (catches all fraud sequences) |
| M6 Cashflow Forecast | Random Forest Regressor | — | R² score 0.85–0.99 |
| M7 GraphSAGE | Graph Neural Network | 100% | Detects employee-customer collusion |
| TF-IDF Classifier | TF-IDF + Random Forest | 99.78% | Fast, rule-friendly merchant categorization |

---

## Part 8 — How Privacy Is Protected

The AI layer has multiple privacy protections:

1. **No raw PII to external LLM** — Numbers are encoded with MockHomomorphicEncryption before being sent to Groq. Names are anonymized and account numbers are masked by `utils/encryption_utils.py` in the Agents microservice.

2. **Fernet encryption on agent calls** — The Agents microservice requires the caller to encrypt the entire payload. The agent decrypts it in memory, anonymizes it, processes it, then re-encrypts the response.

3. **All ML models run locally** — The 8 gRPC models (M1–M7) never leave the local server. No user behavior data is ever sent to a third party.

4. **AES-256-GCM for stored data** — All PII in MongoDB (names, emails, account numbers, balances) is encrypted at field level. The AI models work with hashed or anonymized identifiers.

---

## Quick Reference — Which AI Runs Where

| User Action | AI Involved |
|-------------|------------|
| Logging in | M1 (BehaviorDNA) — checks if it's really you |
| Making a transaction | M2 → M5 → M7 → M4 (full fraud pipeline) |
| Sending a chat message | M3 (coercion detection) + LLM (reply generation) |
| Checking spending insights | LLM (natural language summary) |
| Asking for investment advice | WealthAdvisor Agent (LLM with live financial context) |
| Getting financial lessons | WealthTeacher Agent (LLM generates 20 lessons) |
| Asking a compliance question | RAG (FAISS + BM25 + Rule Engine + LLM) |
| Admin checking for insider fraud | M7 GraphSAGE (employee-account graph scan) |
| Viewing cashflow forecast | M6 Random Forest (daily balance prediction) |
