import logging
from twilio.rest import Client
from app.core.config import settings
from datetime import datetime

class SMSService:
    def __init__(self):
        # Initialize Twilio
        self.twilio_client = None
        if settings.ACCOUNT_SID and settings.AUTH_TOKEN:
            try:
                self.twilio_client = Client(settings.ACCOUNT_SID, settings.AUTH_TOKEN)
            except Exception as e:
                logging.error(f"Failed to initialize Twilio client: {e}")

    def _normalize_phone(self, phone_number: str) -> str:
        """Ensure phone number is in E.164 format (+91...)"""
        if not phone_number:
            return ""
        # Remove all non-numeric characters except +
        phone = "".join(filter(lambda x: x.isdigit() or x == "+", str(phone_number)))
        
        if not phone.startswith("+"):
            # Default to India (+91) if it's a 10-digit number
            if len(phone) == 10:
                return f"+91{phone}"
            # If 12 digits starting with 91, it's already Indian but needs +
            elif len(phone) == 12 and phone.startswith("91"):
                return f"+{phone}"
        return phone

    async def send_otp(self, phone_number: str, otp: str, context: str = "verification"):
        """Send OTP via Twilio."""
        if not self.twilio_client:
            logging.warning("Twilio client not initialized. Skipping SMS OTP.")
            return False

        to_phone = self._normalize_phone(phone_number)
        message_body = f"Your WealthVault OTP is {otp}. Valid for 10 minutes. Ref: {datetime.now().strftime('%H:%M')}"
        if context == "login":
            message_body = f"Your WealthVault login OTP is {otp}. Valid for 10 minutes."

        print(f"\n[SMS DEBUG] Initiating Twilio OTP Send...")
        print(f"[SMS DEBUG] Target Number: {to_phone}")
        print(f"[SMS DEBUG] From Number:   {settings.TWILIO_PHONE_NUMBER}")

        try:
            message = self.twilio_client.messages.create(
                body=message_body,
                from_=settings.TWILIO_PHONE_NUMBER.strip(),
                to=to_phone
            )
            print(f"[SMS DEBUG] SUCCESS! Message SID: {message.sid}")
            logging.info(f"SMS OTP sent successfully to {to_phone}. SID: {message.sid}")
            return True
        except Exception as e:
            print(f"[SMS DEBUG] FAILED: {str(e)}")
            logging.error(f"Error sending Twilio SMS OTP to {to_phone}: {e}")
            return False

    async def send_transaction_sms(self, phone_number: str, account_name: str, account_num: str, amount: float, txn_type: str, sender_receiver: str, recipient_name: str = "Recipient"):
        """
        Send transaction alert SMS.
        Format: acc name number dbited/credited for amount on - date - sender - acc name credited, call 109925 for dispute sms block to number
        """
        if not self.twilio_client:
            logging.warning("Twilio client not initialized. Skipping Transaction SMS.")
            return False

        to_phone = self._normalize_phone(phone_number)
        date_str = datetime.now().strftime("%d-%m-%Y")
        action = "debited" if txn_type.lower() == "debit" else "credited"
        
        body = (
            f"{account_name} {account_num} {action} for ₹{amount:,.2f} on - {date_str} - {sender_receiver} - "
            f"{recipient_name} credited, call 109925 for dispute sms block to {to_phone}"
        )

        print(f"\n[SMS DEBUG] Initiating Transaction Alert Send...")
        print(f"[SMS DEBUG] Target Number: {to_phone}")

        try:
            message = self.twilio_client.messages.create(
                body=body,
                from_=settings.TWILIO_PHONE_NUMBER.strip(),
                to=to_phone
            )
            print(f"[SMS DEBUG] SUCCESS! Message SID: {message.sid}")
            logging.info(f"Transaction SMS alert sent to {to_phone}. SID: {message.sid}")
            return True
        except Exception as e:
            print(f"[SMS DEBUG] FAILED: {str(e)}")
            logging.error(f"Error sending transaction SMS to {to_phone}: {e}")
            return False

sms_service = SMSService()
