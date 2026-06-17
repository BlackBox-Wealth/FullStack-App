"""HTTP client for the ML FastAPI server.

Exposes the identical interface as MLClient in grpc_client.py so that
ml_http.py (the HTTP-transport router) can patch it in as a drop-in.
"""

import httpx
from app.core.config import settings


class HTTPMLClient:

    def __init__(self):
        base = settings.ML_HTTP_HOST.rstrip("/")
        headers = {"Authorization": f"Bearer {settings.ML_API_TOKEN}"} if settings.ML_API_TOKEN else {}
        self._client = httpx.Client(base_url=base, timeout=30.0, headers=headers)

    def _post(self, path: str, payload: dict) -> dict:
        r = self._client.post(path, json=payload)
        r.raise_for_status()
        return r.json()

    # ---- M1: RF + TF-IDF category classifier ----
    def predict_category(self, merchant: str, channel: str) -> str:
        data = self._post("/ml/predict/category", {"merchant": merchant, "channel": channel})
        return data["category"]

    # ---- M2: BERT multilingual transaction classifier ----
    def classify_transaction(self, text: str) -> dict:
        data = self._post("/ml/classify/multilingual", {"text": text})
        return {"category": data["category"], "confidence": data["confidence"]}

    # ---- M3: BERT coercion/stress detector ----
    def detect_stress(self, text: str) -> dict:
        # ML server returns: {stress_level, risk_points}
        # ml.py expects:     {chat_stress_language, risk_pts}
        data = self._post("/ml/detect/chat-stress", {"text": text})
        return {"chat_stress_language": data["stress_level"], "risk_pts": data["risk_points"]}

    # ---- RF cashflow forecast ----
    def forecast(self, account_id: str, days: int) -> dict:
        # ML server returns: {forecast: [{date, amount}], trend_direction}
        # ml.py expects:     {items: [{date, predicted_net_amount}], trend_direction}
        data = self._post("/ml/forecast/cashflow", {"account_id": account_id, "days": days})
        items = [{"date": it["date"], "predicted_net_amount": it["amount"]} for it in data["forecast"]]
        return {"items": items, "trend_direction": data["trend_direction"]}

    # ---- Isolation Forest + per-user SVM behavior anomaly ----
    def detect_behavior_anomaly(self, account_id: str, behavior_data: dict) -> dict:
        data = self._post("/ml/detect/behavior-anomaly", {
            "account_id": account_id,
            "behavior_data": behavior_data,
        })
        return {
            "is_anomaly": data["is_anomaly"],
            "confidence": data["confidence"],
            "risk_level": data["risk_level"],
            "score": data["score"],
            "signal_5_score": data["signal_5_score"],
        }

    # ---- M4: dual-head RiskMLP risk scorer ----
    def calculate_risk_score(self, features: list) -> dict:
        data = self._post("/ml/score/risk", {"features": features})
        return {"risk_score": data["risk_score"], "decision": data["decision"]}

    # ---- LSTM autoencoder sequence anomaly ----
    def detect_sequence_anomaly(self, user_id: str, steps: list) -> dict:
        """steps: list of dicts with keys: amount, unix_timestamp, category, is_debit"""
        data = self._post("/ml/detect/sequence-anomaly", {"user_id": user_id, "steps": steps})
        return {
            "is_anomaly": data["is_anomaly"],
            "score": data["score"],
            "reconstruction_error": data["reconstruction_error"],
        }

    # ---- GraphSAGE insider threat detector ----
    def detect_insider_threat(
        self, user_id: str, merchant_id: str, amount: float, txn_count_with_merchant: int
    ) -> dict:
        data = self._post("/ml/detect/insider-threat", {
            "user_id": user_id,
            "merchant_id": merchant_id,
            "amount": float(amount),
            "txn_count_with_merchant": int(txn_count_with_merchant),
        })
        return {"threat_score": data["threat_score"], "is_insider_threat": data["is_insider_threat"]}


ml_client = HTTPMLClient()
