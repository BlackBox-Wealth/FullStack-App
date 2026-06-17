from datetime import datetime
import os
from typing import Dict, Any, List
import uuid


_THREAT_ANALYSIS = {
    "phishing": {
        "goal": "steal your banking portal credentials and gain unauthorized access to internal systems",
        "real_world": "If this were a real attack, the attacker would have used your credentials to access customer accounts, initiate unauthorized transactions, or exfiltrate sensitive data.",
    },
    "social_eng": {
        "goal": "manipulate you into bypassing security controls through psychological pressure",
        "real_world": "Real social engineers exploit urgency and authority to make targets act before thinking. The attacker would have used any information or access you provided to escalate privileges.",
    },
    "incident_drill": {
        "goal": "measure your response time and procedure accuracy under simulated incident pressure",
        "real_world": "Delayed or incorrect incident reporting allows attackers to maintain persistence longer, increasing damage scope.",
    },
}

_CORRECT_ACTIONS = {
    "phishing": [
        "Do NOT click any links in unsolicited emails — hover to preview URLs first.",
        "Verify sender domains carefully — rbi.org.in is official, rbi-verify.in is NOT.",
        "Use the 'Report Suspicious Email' button in your Internal Mail immediately.",
        "Contact IT Security directly if you are unsure: security@psb-internal.in.",
        "Never enter credentials via a link in an email — always navigate directly.",
    ],
    "social_eng": [
        "Never provide credentials or system access over the phone, regardless of claimed authority.",
        "All privileged access requests must go through IT Helpdesk via official channels.",
        "Hang up and call back the person on their official directory number to verify identity.",
        "Escalate immediately to your supervisor and IT Security.",
        "Document the caller's claimed identity, number, and time of call.",
    ],
    "incident_drill": [
        "Report immediately via the PSB Incident Management System.",
        "Follow escalation path: IT Security Team → CISO → Branch Manager.",
        "Preserve evidence — do not power off affected devices.",
        "Document exact timestamps and actions taken.",
        "Notify your direct supervisor in parallel.",
    ],
}


def generate_report(attempt: Dict[str, Any], template: Dict[str, Any], employee_name: str = "Employee") -> Dict[str, Any]:
    module = attempt.get("module", "phishing")
    score = attempt.get("score", 0)
    passed = attempt.get("passed", False)
    actions = attempt.get("actions", [])
    started_at = attempt.get("started_at", datetime.utcnow().isoformat())
    completed_at = attempt.get("completed_at", datetime.utcnow().isoformat())

    action_timeline = []
    for a in actions:
        action_timeline.append(f"• {a['action'].replace('_', ' ').title()} at {a['timestamp']}")

    red_flags = template.get("content", {}).get("red_flags", [])
    red_flag_explanations = []
    for flag in red_flags:
        red_flag_explanations.append({
            "flag": flag,
            "explanation": _explain_red_flag(flag, module),
        })

    threat_info = _THREAT_ANALYSIS.get(module, _THREAT_ANALYSIS["phishing"])
    correct_steps = _CORRECT_ACTIONS.get(module, [])

    cert_impact = _cert_impact(score)

    sections = {
        "what_happened": (
            f"On {started_at[:10]}, you received a simulated {module.replace('_', ' ')} scenario "
            f"as part of PSB's ongoing security awareness programme. "
            f"The simulation was designed to test your ability to identify and respond to "
            f"{module.replace('_', ' ')} attacks. Your session lasted from {started_at[11:19]} to {completed_at[11:19]}."
        ),
        "your_response": {
            "summary": "Here is a timeline of your actions during the simulation:",
            "timeline": action_timeline if action_timeline else ["No actions were recorded during this simulation."],
        },
        "threat_analysis": {
            "attacker_goal": threat_info["goal"],
            "real_world_impact": threat_info["real_world"],
            "simulation_context": template.get("content", {}).get("trigger_scenario", "A simulated attack scenario was delivered to test your response."),
        },
        "red_flags_missed": red_flag_explanations,
        "correct_action": {
            "summary": f"The correct response to this {module.replace('_', ' ')} scenario:",
            "steps": correct_steps,
        },
        "score": {
            "value": score,
            "max": 100,
            "passed": passed,
            "explanation": _score_explanation(score, passed, module),
            "certification_impact": cert_impact,
        },
        "resources": [
            {"title": "PSB Phishing Awareness Policy", "url": "/internal/policies/phishing-awareness"},
            {"title": "Incident Response Procedure SOP-SEC-001", "url": "/internal/sop/sec-001"},
            {"title": "Password and Credential Security Guidelines", "url": "/internal/policies/credential-security"},
            {"title": "Social Engineering Defence Framework", "url": "/internal/training/social-engineering"},
            {"title": "Report a Security Incident", "url": "/internal/incident/report"},
        ],
    }

    return {
        "report_id": str(uuid.uuid4()),
        "attempt_id": attempt.get("attempt_id"),
        "employee_id_hash": attempt.get("employee_id_hash"),
        "generated_at": datetime.utcnow().isoformat(),
        "delivered_at": None,
        "module": module,
        "score": score,
        "passed": passed,
        "sections": sections,
        "email_message_id": None,
    }


def _explain_red_flag(flag: str, module: str) -> str:
    explanations = {
        "spoofed domain": "The sender domain does not match the official domain of the claimed organisation. Always verify the full domain, not just the display name.",
        "urgency language": "Legitimate communications rarely demand immediate action with threats of consequences. Urgency is a classic social engineering tactic.",
        "requests credentials via link": "No legitimate internal system or regulator will ask you to enter credentials via an email link. Always navigate directly.",
        "unfamiliar caller": "Always verify caller identity via official directory numbers before sharing any information.",
        "bypasses official process": "Any request that asks you to skip normal procedures should be treated as suspicious.",
        "urgency pressure": "Artificial time pressure is a manipulation tactic designed to prevent you from thinking carefully.",
        "credential request": "Credentials should never be shared verbally or via unofficial channels.",
    }
    for key, val in explanations.items():
        if key.lower() in flag.lower():
            return val
    return f"This is a known social engineering indicator: '{flag}'. Always pause and verify before acting."


def _score_explanation(score: int, passed: bool, module: str) -> str:
    if score == 100:
        return "Perfect score — you identified and reported the simulation immediately without taking any unsafe actions."
    if score >= 85:
        return "Excellent — you reported the simulation but may have hovered over or interacted with elements before reporting."
    if score >= 70:
        return "Good — you passed but there is room for improvement. Review the red flags section."
    if score == 50:
        return "You clicked a link but recovered by reporting before submitting credentials. Partial credit awarded."
    if score == 20:
        return "No action was taken within the 48-hour window. Passive non-response is considered a fail."
    if score == 0:
        return "Credentials were submitted. This is an immediate fail — in a real attack, your account would now be compromised."
    return f"Your score of {score}/100 reflects your response pattern during this simulation."


def _cert_impact(score: int) -> str:
    if score >= 90:
        return "This score contributes toward your Certified tier. Keep it up."
    if score >= 75:
        return "This score contributes toward your Trained tier."
    if score >= 50:
        return "This score places you in the Aware tier. More practice recommended."
    return "This score places you in the Needs Training tier. Mandatory retraining has been flagged."


def build_report_email_html(report: Dict, employee_name: str, simulation_date: str, contact_email: str = None) -> str:
    sections = report.get("sections", {})
    score = report.get("score", 0)
    passed = report.get("passed", False)
    module = report.get("module", "phishing")
    score_color = "#0f9d58" if passed else "#dc2626"
    badge = "PASSED" if passed else "FAILED"

    red_flags_html = ""
    for rf in sections.get("red_flags_missed", []):
        red_flags_html += f"""
        <div style="margin:8px 0;padding:10px 14px;background:#fef9c3;border-left:3px solid #d97706;border-radius:6px;">
            <strong style="color:#92400e;">{rf['flag']}</strong><br>
            <span style="color:#78350f;font-size:13px;">{rf['explanation']}</span>
        </div>"""

    steps_html = "".join(
        f"<li style='margin:6px 0;color:#1e293b;'>{s}</li>"
        for s in sections.get("correct_action", {}).get("steps", [])
    )

    timeline_html = "".join(
        f"<li style='margin:4px 0;color:#475569;font-family:monospace;font-size:13px;'>{t}</li>"
        for t in sections.get("your_response", {}).get("timeline", [])
    )

    score_section = sections.get("score", {})
    threat_section = sections.get("threat_analysis", {})
    score_explanation = score_section.get("explanation", "") or _score_explanation(score)
    cert_impact_text = score_section.get("certification_impact", "") or _cert_impact(score)
    attacker_goal = threat_section.get("attacker_goal", "")
    real_world_impact = threat_section.get("real_world_impact", "")

    contact = contact_email or os.getenv("SECURITY_CONTACT_EMAIL", "security@psb-internal.in")

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Manrope',Arial,sans-serif;">
<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f2744 100%);padding:32px 40px;">
    <div style="color:#94a3b8;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">PSB Security Team</div>
    <h1 style="color:#ffffff;font-size:22px;margin:0 0 4px;font-weight:700;">Security Awareness Simulation Report</h1>
    <div style="color:#94a3b8;font-size:14px;">Simulation conducted: {simulation_date}</div>
  </div>

  <div style="padding:32px 40px;">
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px;">
      The {module.replace('_',' ')} communication you received on <strong>{simulation_date}</strong> was a controlled security simulation conducted by the PSB Security Team. Here is your performance analysis.
    </p>

    <div style="display:flex;align-items:center;gap:20px;padding:20px 24px;background:#f8fafc;border-radius:12px;margin-bottom:28px;">
      <div style="text-align:center;">
        <div style="font-size:48px;font-weight:800;color:{score_color};">{score}</div>
        <div style="color:#64748b;font-size:12px;font-weight:600;">out of 100</div>
      </div>
      <div>
        <div style="display:inline-block;padding:4px 14px;background:{score_color}22;color:{score_color};border-radius:20px;font-weight:700;font-size:13px;margin-bottom:6px;">{badge}</div>
        <div style="color:#334155;font-size:14px;">{score_explanation}</div>
      </div>
    </div>

    <h2 style="color:#1e293b;font-size:16px;font-weight:700;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">What Happened</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7;">{sections.get('what_happened','')}</p>

    <h2 style="color:#1e293b;font-size:16px;font-weight:700;margin:24px 0 10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Your Response Timeline</h2>
    <ul style="padding-left:16px;margin:0;">{timeline_html}</ul>

    <h2 style="color:#1e293b;font-size:16px;font-weight:700;margin:24px 0 10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Threat Analysis</h2>
    <div style="padding:16px 20px;background:#eff6ff;border-radius:10px;">
      <p style="margin:0 0 8px;color:#1e40af;font-size:14px;"><strong>Attacker's goal:</strong> {attacker_goal}</p>
      <p style="margin:0;color:#1e40af;font-size:14px;"><strong>If real:</strong> {real_world_impact}</p>
    </div>

    <h2 style="color:#1e293b;font-size:16px;font-weight:700;margin:24px 0 10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Red Flags You May Have Missed</h2>
    {red_flags_html if red_flags_html else '<p style="color:#94a3b8;font-size:14px;">No red flags applicable.</p>'}

    <h2 style="color:#1e293b;font-size:16px;font-weight:700;margin:24px 0 10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">What You Should Have Done</h2>
    <ol style="padding-left:20px;margin:0;">{steps_html}</ol>

    <div style="margin-top:32px;padding:16px 20px;background:#f0fdf4;border-radius:10px;border-left:4px solid #0f9d58;">
      <p style="margin:0;color:#166534;font-size:14px;"><strong>Certification Impact:</strong> {cert_impact_text}</p>
    </div>

        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;text-align:center;">
            This report is confidential and intended only for the named employee. PSB Security Team — {contact}
        </div>
  </div>
</div>
</body>
</html>"""
