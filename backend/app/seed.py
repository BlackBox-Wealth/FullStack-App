"""
Seed database with mock data using Faker.
Run: python -m app.seed
"""
import os
import sys

# Support direct execution: `python .\app\seed.py`
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
log = Logifyx(name="seed", file="seed.log", log_dir="logs", color=True, mask=True)

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
    collections_to_clear = [
        "users", "accounts", "transactions", "loans", "fraud_logs", 
        "notifications", "investments", "portfolios", "financial_goals", 
        "audit_logs", "kyc_documents", "families", "family_members", 
        "budgets", "sips", "alerts"
    ]
    for collection in collections_to_clear:
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
    await db.users.insert_one(encrypt_user_data(admin_user))
    log.info(f"✅ Admin: admin@wealthvault.com")

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
        }
        rm["hashed_email"] = generate_deterministic_hash(rm["email"])
        rm["hashed_phone"] = generate_deterministic_hash(rm["phone"])
        result = await db.users.insert_one(encrypt_user_data(rm))
        rm_ids.append(str(result.inserted_id))
    log.info(f"✅ Created {len(rm_ids)} RMs")

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
        }
        emp["hashed_email"] = generate_deterministic_hash(emp["email"])
        emp["hashed_phone"] = generate_deterministic_hash(emp["phone"])
        result = await db.users.insert_one(encrypt_user_data(emp))
        emp_ids.append(str(result.inserted_id))
    log.info(f"✅ Created {len(emp_ids)} Employees")

    # Customers
    customer_ids = []
    customer_emails = []
    for i in range(20):
        email = f"customer{i+1}@wealthvault.com" if i < 5 else fake.email()
        customer = {
            "email": email,
            "password_hash": password_hash,
            "full_name": fake.name(),
            "phone": fake.numerify("9#########"),
            "role": "customer",
            "kyc_status": random.choice(["verified", "verified", "verified", "not_initiated", "pending", "rejected"]),
            "is_active": True,
            "assigned_employee": random.choice(emp_ids),
            "assigned_rm": random.choice(rm_ids),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(10, 300)),
            "updated_at": datetime.utcnow(),
            "language": "en",
        }
        customer["hashed_email"] = generate_deterministic_hash(customer["email"])
        customer["hashed_phone"] = generate_deterministic_hash(customer["phone"])
        result = await db.users.insert_one(encrypt_user_data(customer))
        cid = str(result.inserted_id)
        customer_ids.append(cid)
        customer_emails.append(email)
    log.info(f"✅ Created {len(customer_ids)} Customers")

    # ─── Create Families ────────────────────────
    family_ids = []
    for i in range(3):
        head_id = customer_ids[i]
        family = {
            "family_name": f"{fake.last_name()} Family",
            "head_user_id": head_id,
            "created_at": datetime.utcnow() - timedelta(days=random.randint(30, 100)),
        }
        result = await db.families.insert_one(encrypt_user_data(family))
        fid = str(result.inserted_id)
        family_ids.append(fid)
        
        # Add members
        for j in range(1, 3):
            member_id = customer_ids[i + (j * 3)]
            member = {
                "family_id": fid,
                "user_id": member_id,
                "role": random.choice(["spouse", "child", "parent"]),
                "status": "active",
                "joined_at": datetime.utcnow() - timedelta(days=random.randint(5, 30)),
                "spending_limit": random.choice([5000, 10000, 25000, 50000]),
            }
            await db.family_members.insert_one(encrypt_user_data(member))
    log.info(f"✅ Created {len(family_ids)} Families")

    # ─── Create Accounts ────────────────────────
    account_map = {}
    all_account_ids = []

    for cid in customer_ids:
        num_accounts = random.randint(1, 3)
        for j in range(num_accounts):
            acc = {
                "user_id": cid,
                "account_number": fake.numerify("############"),
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

    # ─── Create Budgets ────────────────────────
    for cid in customer_ids[:10]:
        for cat in random.sample(CATEGORIES, 3):
            budget = {
                "user_id": cid,
                "category": cat,
                "amount_limit": round(random.uniform(5000, 30000), 2),
                "current_spent": round(random.uniform(0, 15000), 2),
                "period": "monthly",
                "status": random.choice(["healthy", "warning", "exceeded"]),
                "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            }
            budget["remaining"] = max(0, budget["amount_limit"] - budget["current_spent"])
            await db.budgets.insert_one(encrypt_user_data(budget))
    log.info("✅ Created Budgets")

    # ─── Create Transactions ────────────────────────
    txn_count = 0
    for cid in customer_ids:
        if cid not in account_map:
            continue
        for _ in range(random.randint(10, 40)):
            acc_id = random.choice(account_map[cid])
            txn_type = random.choice(["credit", "debit", "debit", "transfer"])
            amount = round(random.uniform(100, 50000), 2)
            risk_score = round(random.uniform(0, 0.4), 3)

            cat = random.choice(CATEGORIES)
            cat_descriptions = {
                "salary": ["Monthly Salary", "Bonus", "Payroll"],
                "food": ["Swiggy", "Zomato", "Starbucks", "Restaurant"],
                "shopping": ["Amazon", "Flipkart", "Myntra", "Retail"],
                "bills": ["Electricity", "Water", "Broadband", "Mobile"],
                "entertainment": ["Netflix", "Movie", "Spotify", "Gaming"],
                "travel": ["Uber", "Ola", "Flight", "Train"],
                "healthcare": ["Pharmacy", "Doctor", "Hospital"],
                "education": ["Course", "Fee", "Books"],
                "investment": ["SIP", "Mutual Fund", "Stocks"],
                "transfer": ["UPI Transfer", "Rent", "IMPS"],
                "other": ["Misc", "ATM", "Service Charge"]
            }
            desc = random.choice(cat_descriptions[cat])

            txn = {
                "account_id": acc_id,
                "user_id": cid,
                "amount": amount,
                "transaction_type": txn_type,
                "category": cat,
                "description": desc,
                "status": "completed",
                "risk_score": risk_score,
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 180)),
            }
            await db.transactions.insert_one(encrypt_user_data(txn))
            txn_count += 1
    log.info(f"✅ Created {txn_count} Transactions")

    # ─── Create Loans ────────────────────────
    for cid in customer_ids[:8]:
        loan_type = random.choice(LOAN_TYPES)
        amount = round(random.uniform(100000, 2000000), 2)
        tenure = random.choice([12, 36, 60])
        interest = 10.5
        loan = {
            "user_id": cid,
            "loan_type": loan_type,
            "amount": amount,
            "tenure_months": tenure,
            "interest_rate": interest,
            "emi": round(amount * (interest/100/12), 2), # Simple EMI mock
            "status": "approved",
            "purpose": fake.sentence(),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(10, 50)),
        }
        await db.loans.insert_one(encrypt_user_data(loan))
    log.info("✅ Created Loans")

    # ─── Create Investments & SIPs ────────────────────────
    for cid in customer_ids[:10]:
        # Direct Investments
        for _ in range(random.randint(1, 4)):
            inv = {
                "user_id": cid,
                "investment_type": random.choice(["stocks", "mutual_funds"]),
                "symbol": random.choice(INVESTMENT_SYMBOLS),
                "amount": round(random.uniform(1000, 50000), 2),
                "quantity": round(random.uniform(1, 100), 2),
                "buy_price": round(random.uniform(100, 2000), 2),
                "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 100)),
            }
            await db.investments.insert_one(encrypt_user_data(inv))
            
        # SIPs
        sip = {
            "user_id": cid,
            "account_id": random.choice(account_map[cid]),
            "name": "Wealth Builder SIP",
            "fund_name": "Nifty 50 Index Fund",
            "fund_category": "equity",
            "amount": 5000.0,
            "frequency": "monthly",
            "status": "active",
            "start_date": (datetime.utcnow() - timedelta(days=60)).strftime("%Y-%m-%d"),
            "next_installment": (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%d"),
            "total_invested": 10000.0,
            "created_at": datetime.utcnow() - timedelta(days=65),
        }
        await db.sips.insert_one(encrypt_user_data(sip))
    log.info("✅ Created Investments & SIPs")

    # ─── Create Notifications & Alerts ────────────────────────
    for cid in customer_ids:
        # Notifications
        for _ in range(random.randint(2, 5)):
            notif = {
                "user_id": cid,
                "type": random.choice(["transaction", "payment", "system"]),
                "title": "Account Update",
                "message": fake.sentence(),
                "read": random.random() > 0.5,
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 15)),
            }
            await db.notifications.insert_one(encrypt_user_data(notif))
            
        # Alerts (High risk)
        if random.random() > 0.8:
            alert = {
                "user_id": cid,
                "alert_type": "high_risk_payment",
                "risk_score": 0.85,
                "reason": "Unusual transaction amount for this user",
                "status": "pending",
                "created_at": datetime.utcnow(),
            }
            await db.alerts.insert_one(encrypt_user_data(alert))
    log.info("✅ Created Notifications & Alerts")

    # ─── Indexes ────────────────────────
    # Drop existing indexes to avoid specification conflicts (e.g. partialFilterExpression)
    try:
        await db.users.drop_indexes()
        await db.accounts.drop_indexes()
        await db.transactions.drop_indexes()
        await db.investments.drop_indexes()
        await db.sips.drop_indexes()
    except Exception as e:
        log.warning(f"Error dropping indexes: {e}")

    await db.users.create_index("hashed_email", unique=True)
    await db.users.create_index("hashed_phone", unique=True)
    await db.accounts.create_index("hashed_account_number", unique=True)
    await db.accounts.create_index("user_id")
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.investments.create_index("user_id")
    await db.sips.create_index("user_id")

    log.info("\n🎉 Database seeded successfully!")
    log.info(f"📋 Login: customer1@wealthvault.com / password123")

    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
