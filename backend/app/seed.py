"""
Seed database with mock data using Faker.
Run: python -m app.seed
"""
import os
import sys

# Support direct execution: `python .\app\seed.py`
# Without this, `app.py` shadows the `app` package and breaks imports.
if __name__ == "__main__" and (__package__ is None or __package__ == ""):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    try:
        sys.path.remove(script_dir)
    except ValueError:
        pass
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

import asyncio
import random
from datetime import datetime, timedelta
from faker import Faker
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.security import get_password_hash
from app.helper.utils import encrypt_user_data
from app.services.deterministic_hash import generate_deterministic_hash
from logifyx import Logifyx
from app.core.config import settings

fake = Faker("en_IN")
log = Logifyx(name="seed", mode="dev", file="seed.log", log_dir="logs", color=True, mask=True)

MONGODB_URL = settings.MONGODB_URL
DB_NAME = settings.MONGODB_DB_NAME

CATEGORIES = ["salary", "food", "shopping", "bills", "entertainment", "travel", "healthcare", "education", "investment", "transfer", "other"]
BANKS = ["WealthVault Bank", "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank"]
LOAN_TYPES = ["personal", "home", "vehicle", "education", "business"]
INVESTMENT_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICI", "WIPRO", "SBIN", "BHARTI", "HCLTECH", "TATAMOTORS"]


async def seed():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]

    # Clear existing data
    for collection in ["users", "accounts", "transactions", "loans", "fraud_logs", "notifications", "investments", "portfolios", "financial_goals", "audit_logs", "kyc_documents"]:
        await db[collection].delete_many({})

    log.info("🗑️ Cleared existing data")

    # ─── Create Users ────────────────────────
    password_hash = get_password_hash("password123")

    # Super Admin
    admin_user = {
        "email": "admin@wealthvault.com",
        "password_hash": password_hash,
        "full_name": "Rajesh Kumar",
        "phone": "9000000001",
        "role": "super_admin",
        "kyc_status": "verified",
        "is_active": True,
        "created_at": datetime.utcnow() - timedelta(days=365),
        "updated_at": datetime.utcnow(),
        "avatar_url": None,
    }
    admin_user["hashed_email"] = generate_deterministic_hash(admin_user["email"])
    admin_user["hashed_phone"] = generate_deterministic_hash(admin_user["phone"])
    admin_result = await db.users.insert_one(encrypt_user_data(admin_user))
    log.info(f"✅ Admin: admin@wealthvault.com / password123")

    # Relationship Managers
    rm_ids = []
    for i in range(3):
        rm = {
            "email": f"rm{i+1}@wealthvault.com",
            "password_hash": password_hash,
            "full_name": fake.name(),
            "phone": f"900000010{i}",
            "role": "relationship_manager",
            "kyc_status": "verified",
            "is_active": True,
            "created_at": datetime.utcnow() - timedelta(days=300),
            "updated_at": datetime.utcnow(),
            "avatar_url": None,
        }
        rm["hashed_email"] = generate_deterministic_hash(rm["email"])
        rm["hashed_phone"] = generate_deterministic_hash(rm["phone"])
        result = await db.users.insert_one(encrypt_user_data(rm))
        rm_ids.append(str(result.inserted_id))
    log.info(f"✅ Created {len(rm_ids)} Relationship Managers (rm1@wealthvault.com)")

    # Employees
    emp_ids = []
    for i in range(5):
        emp = {
            "email": f"employee{i+1}@wealthvault.com",
            "password_hash": password_hash,
            "full_name": fake.name(),
            "phone": f"900000020{i}",
            "role": "employee",
            "kyc_status": "verified",
            "is_active": True,
            "assigned_rm": random.choice(rm_ids),
            "created_at": datetime.utcnow() - timedelta(days=200),
            "updated_at": datetime.utcnow(),
            "avatar_url": None,
        }
        emp["hashed_email"] = generate_deterministic_hash(emp["email"])
        emp["hashed_phone"] = generate_deterministic_hash(emp["phone"])
        result = await db.users.insert_one(encrypt_user_data(emp))
        emp_ids.append(str(result.inserted_id))
    log.info(f"✅ Created {len(emp_ids)} Employees (employee1@wealthvault.com)")

    # Customers
    customer_ids = []
    for i in range(20):
        customer = {
            "email": f"customer{i+1}@wealthvault.com" if i < 5 else fake.email(),
            "password_hash": password_hash,
            "full_name": fake.name(),
            "phone": fake.numerify("9#########"),
            "role": "customer",
            "kyc_status": random.choice(["verified", "verified", "verified", "pending", "rejected"]),
            "is_active": True,
            "assigned_employee": random.choice(emp_ids),
            "assigned_rm": random.choice(rm_ids),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(10, 300)),
            "updated_at": datetime.utcnow(),
            "avatar_url": None,
        }
        customer["hashed_email"] = generate_deterministic_hash(customer["email"])
        customer["hashed_phone"] = generate_deterministic_hash(customer["phone"])
        result = await db.users.insert_one(encrypt_user_data(customer))
        customer_ids.append(str(result.inserted_id))
    log.info(f"✅ Created {len(customer_ids)} Customers (customer1@wealthvault.com)")

    # ─── Create Accounts ────────────────────────
    account_map = {}
    all_account_ids = []

    for cid in customer_ids:
        num_accounts = random.randint(1, 3)
        for j in range(num_accounts):
            acc = {
                "user_id": cid,
                "account_number": "WV" + fake.numerify("############"),
                "account_type": random.choice(["savings", "current", "savings"]),
                "bank_name": random.choice(BANKS),
                "balance": round(random.uniform(5000, 500000), 2),
                "currency": "INR",
                "status": "active",
                "is_external": j > 0 and random.random() > 0.5,
                "created_at": datetime.utcnow() - timedelta(days=random.randint(5, 250)),
                "updated_at": datetime.utcnow(),
            }
            acc["hashed_account_number"] = generate_deterministic_hash(acc["account_number"])
            result = await db.accounts.insert_one(encrypt_user_data(acc))
            aid = str(result.inserted_id)
            all_account_ids.append(aid)
            if cid not in account_map:
                account_map[cid] = []
            account_map[cid].append(aid)

    log.info(f"✅ Created {len(all_account_ids)} Accounts")

    # ─── Create Transactions ────────────────────────
    txn_count = 0
    for cid in customer_ids:
        if cid not in account_map:
            continue
        for _ in range(random.randint(10, 50)):
            acc_id = random.choice(account_map[cid])
            txn_type = random.choice(["credit", "debit", "debit", "transfer"])
            amount = round(random.uniform(100, 50000), 2)
            risk_score = round(random.uniform(0, 0.6), 3)

            txn = {
                "account_id": acc_id,
                "user_id": cid,
                "amount": amount,
                "transaction_type": txn_type,
                "category": random.choice(CATEGORIES),
                "description": fake.sentence(nb_words=5),
                "status": "completed",
                "risk_score": risk_score,
                "created_at": datetime.utcnow() - timedelta(
                    days=random.randint(0, 180),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59),
                ),
            }
            await db.transactions.insert_one(encrypt_user_data(txn))
            txn_count += 1

    log.info(f"✅ Created {txn_count} Transactions")

    # ─── Create Loans ────────────────────────
    loan_count = 0
    for cid in customer_ids[:10]:
        for _ in range(random.randint(0, 2)):
            loan_type = random.choice(LOAN_TYPES)
            amount = round(random.uniform(50000, 5000000), 2)
            tenure = random.choice([12, 24, 36, 60, 120, 180, 240])
            interest = {"personal": 12.5, "home": 8.5, "vehicle": 9.5, "education": 7.5, "business": 14.0}[loan_type]
            monthly_rate = interest / 12 / 100
            emi = round(amount * monthly_rate * (1 + monthly_rate) ** tenure / ((1 + monthly_rate) ** tenure - 1), 2)

            loan = {
                "user_id": cid,
                "loan_type": loan_type,
                "amount": amount,
                "tenure_months": tenure,
                "interest_rate": interest,
                "emi": emi,
                "status": random.choice(["pending", "approved", "approved", "approved", "rejected"]),
                "purpose": fake.sentence(nb_words=6),
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 100)),
            }
            await db.loans.insert_one(encrypt_user_data(loan))
            loan_count += 1

    log.info(f"✅ Created {loan_count} Loans")

    # ─── Create Fraud Logs ────────────────────────
    fraud_count = 0
    fraud_logs = [
        {
            "fraud_type": "suspicious_login",
            "severity": "medium",
            "message": "Multiple failed login attempts detected",
            "status": "resolved",
            "detected_at": "2026-04-01T10:00:00Z",
            "resolved_at": "2026-04-01T10:30:00Z"
        },
        {
            "fraud_type": "unusual_transaction",
            "severity": "high",
            "message": "Transfer to new beneficiary exceeded threshold",
            "status": "investigating",
            "detected_at": "2026-04-02T14:15:00Z"
        }
    ]
    for fraud in fraud_logs:
        await db.fraud_logs.insert_one(fraud)
        fraud_count += 1

    log.info(f"✅ Created {fraud_count} Fraud Logs")

    # ─── Create Investments ────────────────────────
    inv_count = 0
    for cid in customer_ids[:12]:
        for _ in range(random.randint(1, 5)):
            symbol = random.choice(INVESTMENT_SYMBOLS)
            quantity = round(random.uniform(1, 100), 2)
            buy_price = round(random.uniform(200, 3000), 2)
            amount = round(quantity * buy_price, 2)

            inv = {
                "user_id": cid,
                "investment_type": random.choice(["stocks", "mutual_funds", "bonds"]),
                "symbol": symbol,
                "amount": amount,
                "quantity": quantity,
                "buy_price": buy_price,
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 200)),
            }
            await db.investments.insert_one(encrypt_user_data(inv))
            inv_count += 1

    log.info(f"✅ Created {inv_count} Investments")

    # ─── Create Notifications ────────────────────────
    notif_count = 0
    for cid in customer_ids:
        for _ in range(random.randint(2, 8)):
            notif = {
                "user_id": cid,
                "type": random.choice(["transaction", "payment", "fraud_alert", "loan_update", "system"]),
                "title": random.choice([
                    "Transaction completed",
                    "Payment received",
                    "Fraud alert detected",
                    "Loan status updated",
                    "System maintenance scheduled",
                    "New investment recommendation",
                    "KYC verification required",
                ]),
                "message": fake.sentence(nb_words=10),
                "read": random.random() > 0.4,
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
            }
            await db.notifications.insert_one(encrypt_user_data(notif))
            notif_count += 1

    log.info(f"✅ Created {notif_count} Notifications")

    # ─── Create Financial Goals ────────────────────────
    goal_count = 0
    goal_names = ["Emergency Fund", "Home Down Payment", "Vacation", "Car Purchase", "Education Fund", "Retirement", "Wedding", "New Laptop"]
    for cid in customer_ids[:10]:
        for _ in range(random.randint(1, 3)):
            target = round(random.uniform(50000, 2000000), 2)
            current = round(random.uniform(0, target * 0.8), 2)
            goal = {
                "user_id": cid,
                "name": random.choice(goal_names),
                "target_amount": target,
                "current_amount": current,
                "deadline": (datetime.utcnow() + timedelta(days=random.randint(90, 730))).strftime("%Y-%m-%d"),
                "status": "active",
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 100)),
            }
            await db.financial_goals.insert_one(encrypt_user_data(goal))
            goal_count += 1

    log.info(f"✅ Created {goal_count} Financial Goals")

    # Create indexes (match app startup index specs)
    user_indexes = await db.users.index_information()
    if "hashed_email_1" in user_indexes:
        await db.users.drop_index("hashed_email_1")
    if "hashed_phone_1" in user_indexes:
        await db.users.drop_index("hashed_phone_1")

    account_indexes = await db.accounts.index_information()
    if "hashed_account_number_1" in account_indexes:
        await db.accounts.drop_index("hashed_account_number_1")

    await db.users.create_index(
        "hashed_email",
        name="hashed_email_1",
        unique=True,
        partialFilterExpression={"hashed_email": {"$type": "string"}},
    )
    await db.users.create_index(
        "hashed_phone",
        name="hashed_phone_1",
        unique=True,
        partialFilterExpression={"hashed_phone": {"$type": "string"}},
    )
    await db.accounts.create_index("user_id")
    await db.accounts.create_index(
        "hashed_account_number",
        name="hashed_account_number_1",
        unique=True,
        partialFilterExpression={"hashed_account_number": {"$type": "string"}},
    )
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.loans.create_index("user_id")
    await db.fraud_logs.create_index("user_id")
    await db.investments.create_index("user_id")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])

    log.info("\n🎉 Database seeded successfully!")
    log.info("\n📋 Login Credentials (password: password123 for all):")
    log.info("  👑 Super Admin:  admin@wealthvault.com")
    log.info("  👨‍💼 RM:           rm1@wealthvault.com")
    log.info("  👨‍💼 Employee:     employee1@wealthvault.com")
    log.info("  🧑 Customer:     customer1@wealthvault.com")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
