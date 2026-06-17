
import time
import logging
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from twilio.twiml.voice_response import VoiceResponse as TwilioVoiceResponse, Gather
import httpx

from app.services.rag_client import query_rag_async
from app.helper.helpers import normalize_query, truncate_for_voice
from app.helper.audit_logger import log_query
from app.helper.language_detection import detect_language

# Mock/Stubs for missing voice services (Browser APIs now handle web voice)
class MockService:
    async def transcribe(self, *args, **kwargs): return {"transcript": "", "confidence": 0.0}
    async def synthesize(self, *args, **kwargs): return ""
    async def to_english(self, text, *args): return text
    async def from_english(self, text, *args): return text

stt_service = tts_service = translation_service = MockService()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/compliance", tags=["Compliance AI"])

STT_CONFIDENCE_THRESHOLD = float(os.getenv("STT_CONFIDENCE_THRESHOLD", "0.65"))

LOW_CONFIDENCE_RESPONSE = {
    "en": "I could not understand clearly. Please repeat your question.",
    "hi": "मैं स्पष्ट रूप से नहीं समझ सका। कृपया अपना प्रश्न दोहराएं।",
    "pa": "ਮੈਂ ਸਪੱਸ਼ਟ ਤੌਰ 'ਤੇ ਸਮਝ ਨਹੀਂ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਸਵਾਲ ਦੁਹਰਾਓ।",
}

# --- Schemas ---

class QueryRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)

class QueryResponse(BaseModel):
    answer: str
    source: str
    compliance_status: str
    compliance_explanation: str
    triggered_rules: list[str]
    confidence: float



# --- Routes ---

@router.post("/query", response_model=QueryResponse)
async def compliance_text_query(body: QueryRequest):
    text = normalize_query(body.text)
    if not text:
        raise HTTPException(status_code=422, detail="Query text is empty after normalization.")

    t0 = time.perf_counter()
    result = await query_rag_async(text)
    latency = (time.perf_counter() - t0) * 1000

    log_query(
        query=text,
        language="en",
        answer=result["answer"],
        source=result["source"],
        compliance_status=result["compliance_status"],
        triggered_rules=result["triggered_rules"],
        confidence=result["confidence"],
        endpoint="/compliance/query",
        latency_ms=latency,
    )

    return QueryResponse(
        answer=result["answer"],
        source=result["source"],
        compliance_status=result["compliance_status"],
        compliance_explanation=result["compliance_explanation"],
        triggered_rules=result["triggered_rules"],
        confidence=result["confidence"],
    )



# --- Twilio Call Endpoints ---

@router.post("/call/inbound", response_class=PlainTextResponse)
async def inbound_call():
    twiml = TwilioVoiceResponse()
    twiml.say(
        "Welcome to Punjab and Sind Bank compliance assistant. "
        "Please ask your question after the beep.",
        voice="Polly.Aditi",
        language="en-IN"
    )
    twiml.record(
        action="/api/v1/compliance/call/process",
        method="POST",
        max_length=30,
        play_beep=True,
        transcribe=False,
    )
    return str(twiml)

@router.post("/call/process", response_class=PlainTextResponse)
async def process_call_recording(
    RecordingUrl: str = Form(...),
):
    t0 = time.perf_counter()
    twiml = TwilioVoiceResponse()
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            audio_resp = await client.get(RecordingUrl)
            audio_resp.raise_for_status()
            audio_bytes = audio_resp.content
        
        language = "en"
        stt_result = await stt_service.transcribe(audio_bytes, language, "audio/wav")
        transcript = stt_result["transcript"]
        confidence = stt_result["confidence"]
        
        if transcript:
            detected = detect_language(transcript)
            if detected != "en":
                language = detected
                if language == "hi":
                    stt_result = await stt_service.transcribe(audio_bytes, language, "audio/wav")
                    transcript = stt_result["transcript"]
                    confidence = stt_result["confidence"]
        
        if confidence < STT_CONFIDENCE_THRESHOLD or not transcript.strip():
            fallback = LOW_CONFIDENCE_RESPONSE.get(language, LOW_CONFIDENCE_RESPONSE["en"])
            twiml.say(fallback, voice="Polly.Aditi", language=f"{language}-IN")
            twiml.pause(length=1)
            twiml.redirect("/api/v1/compliance/call/inbound")
            return str(twiml)
        
        english_query = normalize_query(await translation_service.to_english(transcript, language))
        rag_result = await query_rag_async(english_query)
        english_answer = rag_result["answer"]
        
        voice_answer = truncate_for_voice(english_answer, max_chars=300)
        translated_answer = await translation_service.from_english(voice_answer, language)
        
        if language == "pa":
            twiml.say(f"Answer in English: {voice_answer}", voice="Polly.Aditi", language="en-IN")
        else:
            voice_map = {"en": "Polly.Aditi", "hi": "Polly.Aditi"}
            lang_code = {"en": "en-IN", "hi": "hi-IN"}
            twiml.say(
                translated_answer,
                voice=voice_map.get(language, "Polly.Aditi"),
                language=lang_code.get(language, "en-IN")
            )
        
        twiml.pause(length=1)
        twiml.say("Would you like to ask another question? Press 1 for yes, or hang up.", voice="Polly.Aditi", language="en-IN")
        twiml.append(Gather(num_digits=1, action="/api/v1/compliance/call/continue", method="POST", timeout=5))
        twiml.hangup()
        
    except Exception as e:
        logger.error(f"Call processing error: {e}")
        twiml.say("I encountered an error. Please try again later.", voice="Polly.Aditi", language="en-IN")
        twiml.hangup()
    
    return str(twiml)

@router.post("/call/continue", response_class=PlainTextResponse)
async def continue_call(Digits: Optional[str] = Form(None)):
    twiml = TwilioVoiceResponse()
    if Digits == "1":
        twiml.redirect("/api/v1/compliance/call/inbound")
    else:
        twiml.say("Thank you for calling. Goodbye.", voice="Polly.Aditi", language="en-IN")
        twiml.hangup()
    return str(twiml)
