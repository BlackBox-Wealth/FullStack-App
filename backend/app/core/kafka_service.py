"""
Kafka Event Service - Handles async event publishing and consuming.
Falls back to in-memory queue when Kafka is unavailable.
"""
import json
import asyncio
from typing import Dict, List, Callable
from datetime import datetime
from app.core.config import settings
from logifyx import Logifyx

log = Logifyx(
    name="wealthvault",
    color=True,  # Ensure colored output for console logs
) 

# In-memory event store (fallback when Kafka is not available)
event_store: Dict[str, List[dict]] = {
    "transactions.created": [],
    "payments.initiated": [],
    "fraud.alerts": [],
    "user.activity": [],
    "ml.recommendations": [],
    "notifications.send": [],
}

event_handlers: Dict[str, List[Callable]] = {}


class KafkaService:
    """
    Event service that uses Kafka when available, falls back to in-memory.
    """

    def __init__(self):
        self.kafka_available = False
        self.producer = None
        self.consumer = None

    async def connect(self):
        """Try to connect to Kafka. Falls back to in-memory if unavailable."""
        log.info(f"Attempting Kafka connection to {settings.KAFKA_BOOTSTRAP_SERVERS}")
        try:
            from aiokafka import AIOKafkaProducer
            self.producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            )
            await self.producer.start()
            self.kafka_available = True
            log.info("✅ Kafka producer connected and ready")
        except Exception as e:
            log.warning(f"⚠️ Kafka not available: {e}")
            log.warning("Using in-memory event queue as fallback")
            self.kafka_available = False

    async def disconnect(self):
        if self.producer and self.kafka_available:
            await self.producer.stop()
            log.info("❌ Kafka producer disconnected")

    async def publish(self, topic: str, message: dict):
        """Publish an event to a topic."""
        event = {
            **message,
            "timestamp": datetime.utcnow().isoformat(),
            "topic": topic,
        }

        if self.kafka_available and self.producer:
            try:
                await self.producer.send_and_wait(topic, event)
                log.debug(f"Event published to Kafka topic '{topic}': {list(message.keys())}")
            except Exception as e:
                log.error(f"Kafka publish error on topic '{topic}': {e}")
                self._store_in_memory(topic, event)
        else:
            self._store_in_memory(topic, event)

        # Trigger registered handlers
        await self._trigger_handlers(topic, event)

    def _store_in_memory(self, topic: str, event: dict):
        if topic not in event_store:
            event_store[topic] = []
        event_store[topic].append(event)
        # Keep only last 1000 events per topic
        if len(event_store[topic]) > 1000:
            event_store[topic] = event_store[topic][-1000:]
        log.debug(f"Event stored in-memory for topic '{topic}' (queue size: {len(event_store[topic])})")

    def register_handler(self, topic: str, handler: Callable):
        if topic not in event_handlers:
            event_handlers[topic] = []
        event_handlers[topic].append(handler)
        log.info(f"Registered event handler for topic '{topic}'")

    async def _trigger_handlers(self, topic: str, event: dict):
        handlers = event_handlers.get(topic, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
                log.debug(f"Handler executed for topic '{topic}'")
            except Exception as e:
                log.error(f"Event handler error for topic '{topic}': {e}", exc_info=True)

    def get_events(self, topic: str, limit: int = 50) -> List[dict]:
        events = event_store.get(topic, [])
        log.debug(f"Retrieved {min(len(events), limit)} events from topic '{topic}'")
        return events[-limit:]


kafka_service = KafkaService()
