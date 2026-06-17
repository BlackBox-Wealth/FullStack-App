import grpc
from app.shared.proto import ml_pb2, ml_pb2_grpc
from app.core.config import settings


class _AuthCallDetails(grpc.ClientCallDetails):
    def __init__(self, base, token: str):
        self.method = base.method
        self.timeout = base.timeout
        self.credentials = base.credentials
        self.wait_for_ready = base.wait_for_ready
        self.compression = base.compression
        self.metadata = list(base.metadata or []) + [("authorization", f"Bearer {token}")]


class _BearerTokenInterceptor(grpc.UnaryUnaryClientInterceptor):
    def __init__(self, token: str):
        self._token = token

    def intercept_unary_unary(self, continuation, client_call_details, request):
        return continuation(_AuthCallDetails(client_call_details, self._token), request)


class MLClient:

    def __init__(self):
        host = settings.ML_GRPC_HOST
        if host.startswith("https://"):
            # ngrok or any TLS-terminated proxy — strip scheme, default to port 443
            target = host[len("https://"):]
            if ":" not in target:
                target = f"{target}:443"
            channel = grpc.secure_channel(target, grpc.ssl_channel_credentials())
        elif host.startswith("http://"):
            target = host[len("http://"):]
            channel = grpc.insecure_channel(target)
        else:
            # plain host:port (e.g. localhost:50051)
            channel = grpc.insecure_channel(host)

        if settings.ML_API_TOKEN:
            channel = grpc.intercept_channel(channel, _BearerTokenInterceptor(settings.ML_API_TOKEN))

        self.channel = channel
        self.stub = ml_pb2_grpc.MLServiceStub(self.channel)

    # ---- M1: RF + TF-IDF category classifier ----
    def predict_category(self, merchant: str, channel: str) -> str:
        response = self.stub.PredictTransactionCategory(
            ml_pb2.PredictCategoryRequest(merchant=merchant, channel=channel)
        )
        return response.category

    # ---- M2: BERT multilingual transaction classifier ----
    def classify_transaction(self, text: str) -> dict:
        response = self.stub.ClassifyTransactionMultilingual(
            ml_pb2.ClassifyRequest(text=text)
        )
        return {"category": response.category, "confidence": response.confidence}

    # ---- M3: BERT coercion/stress detector ----
    def detect_stress(self, text: str) -> dict:
        response = self.stub.DetectChatStress(ml_pb2.StressRequest(text=text))
        return {"chat_stress_language": response.stress_level, "risk_pts": response.risk_points}

    # ---- RF cashflow forecast (arima_<account>.pkl = RandomForestRegressor) ----
    def forecast(self, account_id: str, days: int) -> dict:
        response = self.stub.ForecastCashflow(
            ml_pb2.ForecastRequest(account_id=account_id, days=days)
        )
        return {
            "items": [{"date": item.date, "predicted_net_amount": item.amount} for item in response.forecast],
            "trend_direction": response.trend_direction,
        }

    # ---- Isolation Forest + per-user SVM behavior anomaly ----
    def detect_behavior_anomaly(self, account_id: str, behavior_data: dict) -> dict:
        response = self.stub.DetectBehaviorAnomaly(
            ml_pb2.BehaviorAnomalyRequest(account_id=account_id, behavior_data=behavior_data)
        )
        return {
            "is_anomaly": response.is_anomaly,
            "confidence": response.confidence,
            "risk_level": response.risk_level,
            "score": response.score,
            "signal_5_score": response.signal_5_score,
        }

    # ---- M4: dual-head RiskMLP risk scorer ----
    def calculate_risk_score(self, features: list) -> dict:
        response = self.stub.CalculateRiskScore(
            ml_pb2.RiskScoreRequest(features=features)
        )
        return {"risk_score": response.risk_score, "decision": response.decision}

    # ---- LSTM autoencoder sequence anomaly ----
    def detect_sequence_anomaly(self, user_id: str, steps: list) -> dict:
        """
        steps: list of dicts with keys:
            amount (float), unix_timestamp (int), category (str), is_debit (bool)
        """
        proto_steps = [
            ml_pb2.TxnStep(
                amount=s.get("amount", 0.0),
                unix_timestamp=int(s.get("unix_timestamp", 0)),
                category=s.get("category", "Other"),
                is_debit=bool(s.get("is_debit", True)),
            )
            for s in steps
        ]
        response = self.stub.DetectSequenceAnomaly(
            ml_pb2.SequenceAnomalyRequest(user_id=user_id, steps=proto_steps)
        )
        return {
            "is_anomaly": response.is_anomaly,
            "score": response.score,
            "reconstruction_error": response.reconstruction_error,
        }

    # ---- GraphSAGE insider threat detector ----
    def detect_insider_threat(
        self, user_id: str, merchant_id: str, amount: float, txn_count_with_merchant: int
    ) -> dict:
        response = self.stub.DetectInsiderThreat(
            ml_pb2.InsiderThreatRequest(
                user_id=user_id,
                merchant_id=merchant_id,
                amount=float(amount),
                txn_count_with_merchant=int(txn_count_with_merchant),
            )
        )
        return {
            "threat_score": response.threat_score,
            "is_insider_threat": response.is_insider_threat,
        }


ml_client = MLClient()
