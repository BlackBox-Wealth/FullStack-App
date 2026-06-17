"""
Wealth Advisor Agent - Personal Finance Advisor
Acts as a Virtual CA and Wealth Manager using Groq's Llama 3.3 model.
"""
import os
import json
from typing import Dict, Any, Optional

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

from app.helper.encryption_utils import anonymize_pii

class WealthAdvisorAgent:
    """
    Agent 1: Personal Finance Advisor
    Acts as a Virtual CA and Wealth Manager.
    Uses Groq with Llama 3.3 70b versatile to provide comprehensive, predictive,
    and personalized financial advice.
    """
    def __init__(self):
        if not GROQ_AVAILABLE:
            raise ImportError("Groq library not installed. Install with: pip install groq")
        
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        self.model = "llama-3.3-70b-versatile"

    def generate_advice(
        self, 
        user_profile: dict, 
        market_context: Optional[dict] = None, 
        user_query: Optional[str] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Generates personalized wealth advice, predictions, and tax saving strategies.
        """
        # Ensure no PII is sent to the LLM
        safe_profile = anonymize_pii(user_profile)
        
        # Simulated "Web Scraped" Data for the hackathon context
        if market_context is None:
            market_context = {
                "latest_news": "Gold prices expected to rise by 8% in next 3 months due to global inflation. Indian Real estate in tier-1 cities showing 12% YoY growth. Mutual Funds (SIPs) remaining strong.",
                "tax_laws": "New tax regime updates in India offer standard deduction of 50,000 INR. Section 80C still valid under old regime up to 1.5 Lakhs.",
                "market_trends": "NIFTY 50 is bullish. High interest in renewable energy stocks."
            }

        sys_prompt = f"""You are an elite, highly intelligent Personal Finance Advisor, Virtual Chartered Accountant (CA), and Wealth Manager for SecureWealth Guardian.
You have real-time access to financial data and must use advanced reasoning.
Your goal: Analyze the user's data, balance, spending patterns, and provide the best personalized advice in wealth management, stock market, property, gold/silver, SIPs, and mutual funds.

IMPORTANT: You MUST provide the final advice and all analysis in the following language: {language}.
If the language is 'hi', respond in Hindi. If 'pb', respond in Punjabi. If 'en', respond in English.

CRITICAL INSTRUCTIONS:
1. Provide predictive insights: Up to 3 months for stocks/gold, and 1 year for property.
2. Formulate "What-if" scenarios (e.g., "If you invest X in Y, you could get Z profit in N months").
3. Act as a Virtual CA: Give exact Tax Saving methods adhering strictly to Indian Laws (80C, 80D, Old vs New regime).
4. Be personalized: E.g., if user is a student with low balance, suggest micro-SIPs. If user is an active trader, give deep stock/gold analysis.
5. Base everything on precision, realism, and world economics.
6. Use Markdown formatting for the output (bolding, lists, headers).

Real-time Market Context:
{json.dumps(market_context, indent=2)}
"""

        user_prompt = f"""Here is the anonymized user profile and prediction data:
{json.dumps(safe_profile, indent=2)}

"""
        if user_query:
            user_prompt += f"\nUser Query: {user_query}\nAnswer this query specifically while keeping the overall financial advice in mind."
        else:
            user_prompt += "\nPlease generate a comprehensive wealth advice report, including predictions, what-if scenarios, and tax-saving tips based on this user."

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=self.model,
                temperature=0.3,
                max_tokens=2500,
            )
            
            response_text = chat_completion.choices[0].message.content
            
            return {
                "status": "success",
                "advisor_response": response_text
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
