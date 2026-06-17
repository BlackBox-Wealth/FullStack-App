from typing import List, Dict, Any
from datetime import datetime


def score_phishing(actions: List[Dict[str, Any]], completed_at: datetime, assigned_at: datetime) -> tuple[int, bool]:
    action_types = [a["action"] for a in actions]
    minutes_elapsed = (completed_at - assigned_at).total_seconds() / 60

    if "submitted_credentials" in action_types:
        return 0, False

    if "reported_phishing" in action_types:
        clicked = "clicked_link" in action_types
        if not clicked:
            score = 100
        else:
            score = 50
        # time bonus
        if minutes_elapsed < 5:
            score = min(100, score + 10)
        elif minutes_elapsed < 30:
            score = min(100, score + 5)
        return score, score >= 70

    if "no_action" in action_types:
        return 20, False

    return 0, False


def score_social_eng(nodes: List[Dict[str, Any]], chosen_options: List[int]) -> tuple[int, bool]:
    total_earned = 0
    total_possible = 0

    for i, node in enumerate(nodes):
        options = node.get("options", [])
        max_node_score = max((o.get("score", 0) for o in options), default=0)
        total_possible += max_node_score
        if i < len(chosen_options) and chosen_options[i] < len(options):
            total_earned += options[chosen_options[i]].get("score", 0)

    if total_possible == 0:
        return 0, False

    normalized = round((total_earned / total_possible) * 100)
    return normalized, normalized >= 70


def score_incident_drill(
    fields: Dict[str, str],
    required_fields: List[str],
    correct_escalation: str,
    time_limit_seconds: int,
    elapsed_seconds: float,
) -> tuple[int, bool]:
    score = 0

    # Completeness (40 pts)
    filled = sum(1 for f in required_fields if len(fields.get(f, "")) > 10)
    score += round((filled / len(required_fields)) * 40)

    # Correct escalation (30 pts)
    submitted_escalation = fields.get("escalation_path", "").strip().lower()
    if submitted_escalation == correct_escalation.strip().lower():
        score += 30

    # Time bonus (20 pts)
    ratio = elapsed_seconds / time_limit_seconds if time_limit_seconds > 0 else 1
    if ratio < 0.5:
        score += 20
    elif ratio < 0.8:
        score += 10

    # Detail quality (10 pts)
    avg_len = sum(len(fields.get(f, "")) for f in required_fields) / max(len(required_fields), 1)
    if avg_len > 50:
        score += 10

    return min(score, 100), score >= 70


def compute_pam_trust_score(history: List[Dict[str, Any]], flagged: bool) -> float:
    if flagged:
        return max(0.0, 0.3)
    if not history:
        return 0.6
    recent = history[-10:]
    scores = [h.get("score", 0) for h in recent]
    avg = sum(scores) / len(scores) if scores else 0
    return round(min(1.0, avg / 100), 4)


def update_profile_after_attempt(profile: Dict, attempt: Dict) -> Dict:
    score = attempt.get("score", 0)
    passed = attempt.get("passed", False)
    module = attempt.get("module")

    profile["total_attempts"] = profile.get("total_attempts", 0) + 1
    all_scores = profile.get("_all_scores", [])
    all_scores.append(score)
    profile["_all_scores"] = all_scores
    profile["average_score"] = round(sum(all_scores) / len(all_scores), 2)

    module_scores = profile.get("module_scores", {})
    module_counts = profile.get("module_attempt_counts", {})
    module_scores[module] = round(
        (module_scores.get(module, 0) * module_counts.get(module, 0) + score)
        / (module_counts.get(module, 0) + 1),
        2,
    )
    module_counts[module] = module_counts.get(module, 0) + 1
    profile["module_scores"] = module_scores
    profile["module_attempt_counts"] = module_counts

    avg = profile["average_score"]
    if avg >= 90:
        profile["certification_status"] = "certified"
    elif avg >= 75:
        profile["certification_status"] = "trained"
    elif avg >= 50:
        profile["certification_status"] = "aware"
    else:
        profile["certification_status"] = "needs_training"

    profile["last_simulation"] = attempt.get("completed_at")

    # Check flagging conditions
    actions = attempt.get("actions", [])
    action_types = [a["action"] for a in actions]
    if "submitted_credentials" in action_types:
        profile["flagged"] = True
        profile["flag_reason"] = "Submitted credentials in phishing simulation"

    profile["pam_trust_score"] = compute_pam_trust_score(
        profile.get("history", []), profile.get("flagged", False)
    )

    history = profile.get("history", [])
    history.append({
        "date": attempt.get("completed_at"),
        "module": module,
        "score": score,
        "passed": passed,
        "attempt_id": attempt.get("attempt_id"),
    })
    profile["history"] = history[-20:]

    return profile
