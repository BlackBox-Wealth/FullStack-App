"""Mock Account Aggregator Service."""
import random
import uuid
from datetime import datetime, timedelta

class MockAAService:
    @staticmethod
    def generate_external_accounts():
        banks = ["Punjab National Bank", "State Bank of India", "HDFC Bank", "ICICI Bank"]
        accounts = []
        for i, bank in enumerate(banks):
            accounts.append({
                "id": str(uuid.uuid4()),
                "bank_name": bank,
                "account_number": str(random.randint(100000000000, 999999999999)),
                "account_type": random.choice(["savings", "current"]),
                "balance": random.uniform(5000, 500000),
                "currency": "INR",
                "holder_name": "Demo User"
            })
        return accounts

    @staticmethod
    def generate_external_transactions(account_id: str):
        categories = ["Shopping", "Dining", "Bills", "Transfer", "Salary", "Healthcare"]
        transactions = []
        for i in range(10):
            transactions.append({
                "id": str(uuid.uuid4()),
                "account_id": account_id,
                "amount": random.uniform(100, 5000),
                "type": random.choice(["debit", "credit"]),
                "category": random.choice(categories),
                "description": f"External Txn {i+1}",
                "date": (datetime.now() - timedelta(days=random.randint(0, 30))).isoformat()
            })
        return transactions

aa_service = MockAAService()
