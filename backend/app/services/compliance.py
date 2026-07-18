from __future__ import annotations

import re
from typing import Any

from .store import compliance_rules


def check_content(text: str, *, has_evidence: bool = True) -> dict[str, Any]:
    rules = compliance_rules()
    findings: list[dict[str, str]] = []
    score = 100

    for phrase in rules["blocked_phrases"]:
        if phrase in text:
            findings.append({
                "level": "block",
                "rule": "禁用或高风险表达",
                "message": f"发现高风险表述：{phrase}",
                "suggestion": "删除绝对化、无法证明或可能误导驾驶行为的表达。",
            })
            score -= 22

    has_dynamic = any(term in text for term in rules["dynamic_terms"])
    if has_dynamic and rules["required_dynamic_disclaimer"] not in text:
        findings.append({
            "level": "warning",
            "rule": "动态价格与权益",
            "message": "内容涉及价格或权益，但缺少时效说明。",
            "suggestion": rules["required_dynamic_disclaimer"],
        })
        score -= 7

    has_assisted = any(term in text for term in rules["assisted_driving_terms"])
    if has_assisted and rules["assisted_driving_disclaimer"] not in text:
        findings.append({
            "level": "warning",
            "rule": "辅助驾驶安全边界",
            "message": "内容涉及辅助驾驶，需明确驾驶员责任边界。",
            "suggestion": rules["assisted_driving_disclaimer"],
        })
        score -= 10

    if re.search(r"(?:我家|车主都说|用户一致认为|成交了\d+台)", text):
        findings.append({
            "level": "warning",
            "rule": "虚假见证与无法核验业绩",
            "message": "出现可能被理解为真实用户见证或业绩的数据。",
            "suggestion": "仅使用取得授权且可验证的真实案例，否则改为一般场景描述。",
        })
        score -= 12

    if not has_evidence:
        findings.append({
            "level": "block",
            "rule": "事实来源",
            "message": "车型或价格事实缺少可追溯来源。",
            "suggestion": "绑定官方知识库字段、来源链接与核验日期后再发布。",
        })
        score -= 25

    if not findings:
        findings.append({
            "level": "pass",
            "rule": "自动预检",
            "message": "未发现阻断项；事实字段已有来源，仍需人工确认发布。",
            "suggestion": "发布前复核本地活动、配置和权益的最新状态。",
        })

    score = max(0, min(100, score))
    return {
        "passed": not any(item["level"] == "block" for item in findings),
        "score": score,
        "findings": findings,
    }
