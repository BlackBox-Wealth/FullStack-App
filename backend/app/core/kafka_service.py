"""
Kafka Event Service - Handles async event publishing and consuming.
Falls back to in-memory queue when Kafka is unavailable.
"""
import json
import asyncio
from typing import Dict, List, Callable
from datetime import datetime
from app.core.config import settings
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
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
    "email.otpVerification": [],
    "simulation.email.deliver": [],
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
        self.consumer_task = None
        self.running = False

    async def connect(self):
        """Try to connect to Kafka. Falls back to in-memory if unavailable."""
        log.info(f"Attempting Kafka connection to {settings.KAFKA_BOOTSTRAP_SERVERS}")
        try:
            # Producer setup
            self.producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            )
            await self.producer.start()
            
            # Consumer setup
            topics = list(event_store.keys()) + ["system.performance"]
            self.consumer = AIOKafkaConsumer(
                *topics,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id="wealthvault_main_group",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
                auto_offset_reset="latest"
            )
            await self.consumer.start()
            
            self.kafka_available = True
            self.running = True
            self.consumer_task = asyncio.create_task(self._consume_loop())
            
            log.info(f"✅ Kafka connected (Producer + Consumer) on topics: {topics}")
        except Exception as e:
            log.warning(f"⚠️ Kafka not available: {e}")
            log.warning("Using in-memory event queue as fallback")
            self.kafka_available = False

    async def disconnect(self):
        self.running = False
        if self.consumer_task:
            self.consumer_task.cancel()
        if self.producer:
            await self.producer.stop()
        if self.consumer:
            await self.consumer.stop()
        log.info("❌ Kafka services disconnected")

    async def _consume_loop(self):
        """Background loop to process Kafka messages."""
        log.info("Kafka consumer loop started")
        try:
            async for msg in self.consumer:
                if not self.running:
                    break
                topic = msg.topic
                event = msg.value
                log.debug(f"Received Kafka event on '{topic}'")
                await self._trigger_handlers(topic, event)
        except asyncio.CancelledError:
            log.info("Kafka consumer loop cancelled")
        except Exception as e:
            log.error(f"Kafka consumer loop error: {e}")

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
                log.debug(f"Event published to Kafka topic '{topic}'")
            except Exception as e:
                log.error(f"Kafka publish error on topic '{topic}': {e}")
                self._store_in_memory(topic, event)
        else:
            self._store_in_memory(topic, event)
            # In local/fallback mode, trigger handlers immediately
            await self._trigger_handlers(topic, event)

    def _store_in_memory(self, topic: str, event: dict):
        if topic not in event_store:
            event_store[topic] = []
        event_store[topic].append(event)
        if len(event_store[topic]) > 1000:
            event_store[topic] = event_store[topic][-1000:]

    def register_handler(self, topic: str, handler: Callable):
        if topic not in event_handlers:
            event_handlers[topic] = []
        event_handlers[topic].append(handler)

    async def _trigger_handlers(self, topic: str, event: dict):
        handlers = event_handlers.get(topic, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                log.error(f"Event handler error for topic '{topic}': {e}")

    def get_events(self, topic: str, limit: int = 50) -> List[dict]:
        events = event_store.get(topic, [])
        return events[-limit:]


kafka_service = KafkaService()
