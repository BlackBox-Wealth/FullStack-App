"""
Wealth Teacher Agent - Financial Literacy Teacher
Generates daily micro-lessons on wealth, credit, fraud awareness, and economics.
"""
import os
import json
from typing import Dict, Any, List

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

from app.helper.encryption_utils import anonymize_pii

class WealthTeacherAgent:
    """
    Agent 2: Wealth Intelligence & Security Teacher
    Uses Groq with Llama 3.3 70b versatile to generate 20 daily micro-lessons.
    Focuses on: Wealth Intelligence, CIBIL awareness, Loan awareness, 
    Fraud & Cyber awareness, and Basic Economic awareness.
    """
    def __init__(self):
        if not GROQ_AVAILABLE:
            raise ImportError("Groq library not installed. Install with: pip install groq")
        
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        self.model = "llama-3.3-70b-versatile"

    def generate_daily_lessons(self, user_activity: dict, language: str = "en") -> Dict[str, Any]:
        """
        Generates exactly 20 short, punchy lessons tailored to the user's behavior.
        """
        # Ensure no PII is sent to the LLM
        safe_activity = anonymize_pii(user_activity)

        sys_prompt = f"""You are an expert Financial Literacy and Cyber Security Teacher for SecureWealth Guardian.
Your job is to generate EXACTLY 20 micro-lessons for the user today based on their activity and general financial awareness needs.

The lessons must cover these 5 pillars evenly (4 lessons each):
1. Wealth Intelligence (Saving, Investing, Budgeting)
2. CIBIL & Credit Score Awareness
3. Loan Awareness (Interest rates, hidden fees, good vs bad debt)
4. Fraud & Cyber Security Awareness (Phishing, OTP scams, UPI frauds)
5. Basic Economic Awareness (Inflation, GDP, Repo rates and how they affect the user)

IMPORTANT: You MUST provide the content of each lesson in the following language: {language}.
If the language is 'hi', respond in Hindi. If 'pb', respond in Punjabi. If 'en', respond in English.
Keep the topics in English for consistency, but the 'content' MUST be in the target language.

CRITICAL INSTRUCTIONS:
- Each lesson must be exactly 1-2 sentences. Short, punchy, and highly actionable.
- Tailor the tone to the user's activity profile (e.g., if they do many online transactions, focus cyber awareness on e-commerce scams).
- Output the response as a valid JSON array of objects, where each object has a "topic" and "content".
- You can use basic Markdown in the 'content' (like bolding key terms).
Example output format:
[
  {{"topic": "Wealth Intelligence", "content": "The 50/30/20 rule helps you save..."}},
  {{"topic": "Fraud Awareness", "content": "Never share your 6-digit UPI PIN to receive money..."}}
]
"""

        user_prompt = f"""Here is the anonymized user activity data:
{json.dumps(safe_activity, indent=2)}

Generate the 20 lessons now in the exact JSON format requested."""

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=self.model,
                temperature=0.4,
                response_format={"type": "json_object"},
            )
            
            response_text = chat_completion.choices[0].message.content
            
            try:
                parsed_json = json.loads(response_text)
                # Handle cases where LLM wraps the array in a key like "lessons"
                if isinstance(parsed_json, dict) and "lessons" in parsed_json:
                    lessons = parsed_json["lessons"]
                elif isinstance(parsed_json, list):
                    lessons = parsed_json
                else:
                    # Fallback extraction
                    lessons = list(parsed_json.values())[0] 
            except json.JSONDecodeError:
                lessons = [{"topic": "Error", "content": "Failed to parse lessons from AI."}]

            return {
                "status": "success",
                "lessons": lessons
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
