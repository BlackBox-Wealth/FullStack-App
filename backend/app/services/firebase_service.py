"""Firebase Cloud Messaging — sends push notifications to the Flutter app."""
import firebase_admin
from firebase_admin import credentials, messaging
from app.core.config import settings
from logifyx import Logifyx

log = Logifyx(name="wealthvault", color=True)

_firebase_app = None

def _init_firebase() -> object:
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    if not settings.FIREBASE_CREDENTIALS_PATH:
        log.warning("FIREBASE_CREDENTIALS_PATH not set — push notifications to Flutter disabled")
        return None
    try:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        _firebase_app = firebase_admin.initialize_app(cred)
        log.info("❤️‍🔥Firebase Admin SDK initialized")
    except Exception as e:
        log.error(f"Firebase init failed: {e}")
    return _firebase_app


async def send_payment_approval_notification(fcm_token: str, payment_id: str, amount: float) -> bool:
    """
    Send a push notification to the Flutter app asking the user to approve a large payment.
    The Flutter app shows YES / NO — and calls POST /payments/{payment_id}/respond accordingly.
    """
    app = _init_firebase()
    if not app:
        log.warning(f"Firebase not ready — skipping approval push for payment={payment_id}")
        return False
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title="Large Payment Approval Required",
                body=f"A payment of ₹{amount:,.0f} is awaiting your approval.",
            ),
            data={
                "payment_id": payment_id,
                "amount": str(amount),
                "type": "payment_approval",
            },
            token=fcm_token,
        )
        response = messaging.send(message)
        log.info(f"FCM push sent to Flutter: payment={payment_id}, response={response}")
        return True
    except Exception as e:
        log.error(f"FCM send failed: payment={payment_id}, error={e}")
        return False
