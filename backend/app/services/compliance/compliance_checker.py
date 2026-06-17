"""
compliance_checker.py
Extracts regulatory rules from retrieved chunks and classifies
user statements/queries as Compliant, Risky, or Non-compliant.
"""

import re
from dataclasses import dataclass
from enum import Enum
from logifyx import Logifyx

# Configure logging for the microservice
logger = Logifyx(
    name="compliance_ai_service",
    color=True,  # Ensure colored output for console logs
)


class ComplianceStatus(str, Enum):
    COMPLIANT = "Compliant"
    RISKY = "Risky"
    NON_COMPLIANT = "Non-compliant"
    UNKNOWN = "Unknown"


STATUS_EMOJI = {
    ComplianceStatus.COMPLIANT: "✅",
    ComplianceStatus.RISKY: "⚠️",
    ComplianceStatus.NON_COMPLIANT: "❌",
    ComplianceStatus.UNKNOWN: "❓",
}


@dataclass
class ComplianceResult:
    status: ComplianceStatus
    explanation: str
    triggered_rules: list[str]
    source_refs: list[str]

    @property
    def badge(self) -> str:
        return f"{STATUS_EMOJI[self.status]} {self.status.value}"


# ---------------------------------------------------------------------------
# Rule patterns extracted from RBI KYC Master Directions + PSB policy
# Each rule: (pattern_in_query, required_condition_fn, violation_message, risk_level)
# ---------------------------------------------------------------------------

def _extract_years(text: str) -> list[int]:
    return [int(x) for x in re.findall(r"\b(\d+)\s*year", text, re.IGNORECASE)]

def _extract_months(text: str) -> list[int]:
    return [int(x) for x in re.findall(r"\b(\d+)\s*month", text, re.IGNORECASE)]


COMPLIANCE_RULES = [
    {
        "id": "KYC_PERIODIC_UPDATE_HIGH_RISK",
        "description": "High-risk customers must have KYC updated every 2 years (RBI KYC MD, Para 38)",
        "trigger_keywords": ["kyc", "update", "high risk", "high-risk"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if any(y > 2 for y in _extract_years(q))
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": "RBI mandates KYC re-verification for high-risk customers every 2 years. Intervals exceeding this are non-compliant.",
    },
    {
        "id": "KYC_PERIODIC_UPDATE_MEDIUM_RISK",
        "description": "Medium-risk customers must have KYC updated every 8 years (RBI KYC MD, Para 38)",
        "trigger_keywords": ["kyc", "update", "medium risk", "medium-risk"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if any(y > 8 for y in _extract_years(q))
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": "RBI mandates KYC re-verification for medium-risk customers every 8 years.",
    },
    {
        "id": "KYC_PERIODIC_UPDATE_LOW_RISK",
        "description": "Low-risk customers must have KYC updated every 10 years (RBI KYC MD, Para 38)",
        "trigger_keywords": ["kyc", "update", "low risk", "low-risk"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if any(y > 10 for y in _extract_years(q))
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": "RBI mandates KYC re-verification for low-risk customers every 10 years.",
    },
    {
        "id": "KYC_GENERIC_INTERVAL",
        "description": "Generic KYC update interval check (no risk category specified)",
        "trigger_keywords": ["kyc", "update", "every", "year"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if any(y > 10 for y in _extract_years(q))
            else ComplianceStatus.RISKY
            if any(5 < y <= 10 for y in _extract_years(q))
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": (
            "KYC update intervals must comply with RBI risk-based schedule: "
            "High-risk: 2 yrs | Medium-risk: 8 yrs | Low-risk: 10 yrs. "
            "Without specifying risk category, intervals >5 years are flagged as Risky."
        ),
    },
    {
        "id": "CASH_TRANSACTION_REPORTING",
        "description": "Cash transactions ≥ ₹10 lakh must be reported to FIU-IND (PMLA 2002)",
        "trigger_keywords": ["cash", "transaction", "lakh", "report"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if re.search(r"not\s+report|skip\s+report|avoid\s+report", q, re.IGNORECASE)
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": "Cash transactions ≥ ₹10 lakh must be reported to FIU-IND under PMLA 2002. Non-reporting is a criminal offence.",
    },
    {
        "id": "STR_REPORTING",
        "description": "Suspicious Transaction Reports must be filed within 7 days (RBI KYC MD, Para 51)",
        "trigger_keywords": ["suspicious", "str", "transaction report"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if any(d > 7 for d in [int(x) for x in re.findall(r"\b(\d+)\s*day", q, re.IGNORECASE)])
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": "STRs must be filed with FIU-IND within 7 days of detection. Delays are non-compliant.",
    },
    {
        "id": "CDD_BEFORE_ACCOUNT_OPENING",
        "description": "Customer Due Diligence must be completed before account opening (RBI KYC MD, Para 16)",
        "trigger_keywords": ["account", "open", "cdd", "due diligence", "kyc"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if re.search(r"after\s+open|open.*before.*kyc|skip.*cdd|without.*kyc", q, re.IGNORECASE)
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": "CDD/KYC must be completed BEFORE account opening. Opening accounts without KYC is non-compliant.",
    },
    {
        "id": "RECORD_RETENTION",
        "description": "KYC/transaction records must be retained for 5 years after account closure (PMLA 2002)",
        "trigger_keywords": ["record", "retain", "storage", "document", "year"],
        "check": lambda q: (
            ComplianceStatus.NON_COMPLIANT
            if any(y < 5 for y in _extract_years(q))
            else ComplianceStatus.COMPLIANT
        ),
        "violation_msg": "Records must be retained for minimum 5 years post account closure under PMLA 2002.",
    },
]


def _query_triggers_rule(query: str, rule: dict) -> bool:
    q_lower = query.lower()
    # Specific risk-category rules must not fire when a different category is mentioned
    rule_id = rule["id"]
    if rule_id == "KYC_PERIODIC_UPDATE_HIGH_RISK" and not any(
        kw in q_lower for kw in ("high risk", "high-risk")
    ):
        return False
    if rule_id == "KYC_PERIODIC_UPDATE_MEDIUM_RISK" and not any(
        kw in q_lower for kw in ("medium risk", "medium-risk")
    ):
        return False
    if rule_id == "KYC_PERIODIC_UPDATE_LOW_RISK" and not any(
        kw in q_lower for kw in ("low risk", "low-risk")
    ):
        return False
    # Generic interval rule must not fire when a specific risk category is present
    if rule_id == "KYC_GENERIC_INTERVAL" and any(
        kw in q_lower for kw in ("high risk", "high-risk", "medium risk", "medium-risk", "low risk", "low-risk")
    ):
        return False
    return sum(1 for kw in rule["trigger_keywords"] if kw in q_lower) >= 2


def check_compliance(query: str, retrieved_chunks: list[dict]) -> ComplianceResult:
    """
    Evaluate query against known regulatory rules.
    Returns ComplianceResult with status, explanation, and source refs.
    """
    triggered_rules = []
    worst_status = ComplianceStatus.COMPLIANT
    explanations = []

    status_priority = {
        ComplianceStatus.NON_COMPLIANT: 3,
        ComplianceStatus.RISKY: 2,
        ComplianceStatus.COMPLIANT: 1,
        ComplianceStatus.UNKNOWN: 0,
    }

    for rule in COMPLIANCE_RULES:
        if _query_triggers_rule(query, rule):
            status = rule["check"](query)
            triggered_rules.append(rule["id"])
            if status_priority[status] > status_priority[worst_status]:
                worst_status = status
                explanations.append(rule["violation_msg"])

    # If no rules triggered, derive status from LLM context presence
    if not triggered_rules:
        if retrieved_chunks:
            worst_status = ComplianceStatus.UNKNOWN
            explanations.append("No specific compliance rule triggered. Review retrieved context manually.")
        else:
            worst_status = ComplianceStatus.UNKNOWN
            explanations.append("No regulatory context found to assess compliance.")

    source_refs = list({
        f"{c['source_name']} — {c['section']}"
        for c in retrieved_chunks
    })

    return ComplianceResult(
        status=worst_status,
        explanation=" | ".join(explanations) if explanations else "Query appears compliant with known regulations.",
        triggered_rules=triggered_rules,
        source_refs=source_refs,
    )


def infer_compliance_from_llm_answer(llm_answer: str) -> ComplianceStatus:
    """
    Secondary check: parse LLM answer text for compliance signals
    when the rule engine returns UNKNOWN.
    """
    answer_lower = llm_answer.lower()
    non_compliant_signals = [
        "non-compliant", "not compliant", "violation", "prohibited",
        "must not", "shall not", "not permitted", "illegal", "penalty"
    ]
    risky_signals = [
        "risky", "caution", "may violate", "should verify", "unclear",
        "subject to", "depends on", "consult"
    ]
    compliant_signals = [
        "compliant", "permitted", "allowed", "in accordance", "satisfies",
        "meets the requirement", "as per rbi", "as per regulation"
    ]

    if any(s in answer_lower for s in non_compliant_signals):
        return ComplianceStatus.NON_COMPLIANT
    if any(s in answer_lower for s in risky_signals):
        return ComplianceStatus.RISKY
    if any(s in answer_lower for s in compliant_signals):
        return ComplianceStatus.COMPLIANT
    return ComplianceStatus.UNKNOWN
