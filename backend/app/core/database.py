from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.helper.utils import decrypt_user_data
from app.services.deterministic_hash import generate_deterministic_hash
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
)

client: AsyncIOMotorClient = None
db = None


async def _backfill_hash_fields():
    """Backfill deterministic hash fields for legacy plaintext/encrypted records."""
    users_updated = 0
    accounts_updated = 0

    user_cursor = db.users.find(
        {
            "$or": [
                {"hashed_email": {"$exists": False}},
                {"hashed_email": None},
                {"hashed_email": ""},
                {"hashed_phone": {"$exists": False}},
                {"hashed_phone": None},
                {"hashed_phone": ""},
            ]
        },
        {"email": 1, "phone": 1, "hashed_email": 1, "hashed_phone": 1},
    )

    async for user in user_cursor:
        try:
            decrypted_user = decrypt_user_data(user)
            set_fields = {}

            if not decrypted_user.get("hashed_email") and decrypted_user.get("email"):
                set_fields["hashed_email"] = generate_deterministic_hash(decrypted_user["email"])

            if not decrypted_user.get("hashed_phone") and decrypted_user.get("phone"):
                set_fields["hashed_phone"] = generate_deterministic_hash(decrypted_user["phone"])

            if set_fields:
                await db.users.update_one({"_id": user["_id"]}, {"$set": set_fields})
                users_updated += 1
        except Exception as exc:
            log.warning(f"Failed to backfill user hash fields for user_id={user.get('_id')}: {exc}")

    account_cursor = db.accounts.find(
        {
            "$or": [
                {"hashed_account_number": {"$exists": False}},
                {"hashed_account_number": None},
                {"hashed_account_number": ""},
            ]
        },
        {"account_number": 1, "hashed_account_number": 1},
    )

    async for account in account_cursor:
        try:
            decrypted_account = decrypt_user_data(account)
            if decrypted_account.get("hashed_account_number"):
                continue

            if decrypted_account.get("account_number"):
                hashed_account_number = generate_deterministic_hash(decrypted_account["account_number"])
                await db.accounts.update_one(
                    {"_id": account["_id"]},
                    {"$set": {"hashed_account_number": hashed_account_number}},
                )
                accounts_updated += 1
        except Exception as exc:
            log.warning(f"Failed to backfill account hash fields for account_id={account.get('_id')}: {exc}")

    # Remove explicit null hash fields so partial unique indexes can be created safely.
    await db.users.update_many({"hashed_email": None}, {"$unset": {"hashed_email": ""}})
    await db.users.update_many({"hashed_phone": None}, {"$unset": {"hashed_phone": ""}})
    await db.accounts.update_many({"hashed_account_number": None}, {"$unset": {"hashed_account_number": ""}})

    log.info(f"Backfill complete: users_updated={users_updated}, accounts_updated={accounts_updated}")


async def _drop_index_if_present(collection, index_name: str):
    existing = await collection.index_information()
    if index_name in existing:
        await collection.drop_index(index_name)
        log.info(f"Dropped existing index: {collection.name}.{index_name}")


async def _create_hash_indexes():
    await _drop_index_if_present(db.users, "hashed_email_1")
    await _drop_index_if_present(db.users, "hashed_phone_1")
    await _drop_index_if_present(db.accounts, "hashed_account_number_1")

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
    await db.accounts.create_index(
        "hashed_account_number",
        name="hashed_account_number_1",
        unique=True,
        partialFilterExpression={"hashed_account_number": {"$type": "string"}},
    )


async def connect_to_mongo():
    global client, db
    log.info(f"Connecting to MongoDB at {settings.MONGODB_URL}")
    log.info(f"Database name: {settings.MONGODB_DB_NAME}")

    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.MONGODB_DB_NAME]

        # Create indexes
        log.info("Creating database indexes...")
        await _backfill_hash_fields()
        await _create_hash_indexes()
        await db.accounts.create_index("user_id")
        await db.transactions.create_index("account_id")
        await db.transactions.create_index("created_at")
        await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
        await db.loans.create_index("user_id")
        await db.fraud_logs.create_index("transaction_id")
        await db.fraud_logs.create_index("user_id")
        await db.notifications.create_index([("user_id", 1), ("read", 1)])
        await db.audit_logs.create_index("user_id")
        await db.investments.create_index("user_id")
        await db.portfolios.create_index("user_id", unique=True)
        await db.kyc_documents.create_index("user_id")
        await db.known_devices.create_index([("user_id", 1), ("device_fingerprint", 1)], unique=True)
        log.info("All database indexes created successfully")

        log.info("✅ MongoDB connected and ready")
    except Exception as e:
        log.error(f"❌ MongoDB connection failed: {e}", exc_info=True)
        raise


async def close_mongo_connection():
    global client
    if client:
        client.close()
        log.info("❌ MongoDB connection closed")


def get_database():
    return db
