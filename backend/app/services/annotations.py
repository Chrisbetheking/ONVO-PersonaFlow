from __future__ import annotations

import re
from typing import Any

SENTENCE_SPLIT = re.compile(r"(?<=[。！？!?；;\n])")


def _sentences(text: str) -> list[str]:
    return [item.strip() for item in SENTENCE_SPLIT.split(text) if item.strip()]


def annotate_variant(variant: dict[str, Any], evidence: list[dict[str, Any]], compliance: dict[str, Any]) -> dict[str, Any]:
    combined = "\n".join([variant.get("title", ""), variant.get("body", ""), variant.get("call_to_action", "")])
    claims: list[dict[str, Any]] = []
    risks: list[dict[str, Any]] = []

    for index, item in enumerate(evidence, start=1):
        value = str(item.get("value") or "").strip()
        if not value or value not in combined:
            continue
        sentence = next((sentence for sentence in _sentences(combined) if value in sentence), value)
        claims.append({
            "id": f"claim-{variant['id']}-{index}",
            "text": sentence,
            "evidence_id": item["id"],
            "field": item["field"],
        })

    disclaimer_sentence = next((sentence for sentence in _sentences(combined) if "以乐道官方最新信息为准" in sentence or "以发布当天官方页面为准" in sentence), "")
    if disclaimer_sentence:
        risks.append({
            "id": f"risk-{variant['id']}-dynamic",
            "text": disclaimer_sentence,
            "level": "info",
            "rule": "动态事实复核",
            "reason": "价格与权益可能随时间和地区变化，发布前应再次核验官方页面。",
            "suggestion": "保留时效说明，并在发布当天确认来源更新时间。",
        })

    for index, finding in enumerate(compliance.get("findings", []), start=1):
        if finding.get("level") == "pass":
            continue
        message = str(finding.get("message") or "")
        matched_text = ""
        if "：" in message:
            candidate = message.split("：", 1)[1].strip()
            matched_text = next((sentence for sentence in _sentences(combined) if candidate and candidate in sentence), candidate)
        if not matched_text:
            matched_text = next((sentence for sentence in _sentences(combined) if any(term in sentence for term in ("辅助驾驶", "价格", "权益"))), variant.get("body", "")[:100])
        risks.append({
            "id": f"risk-{variant['id']}-{index}",
            "text": matched_text,
            "level": finding.get("level", "warning"),
            "rule": finding.get("rule", "发布前复核"),
            "reason": finding.get("message", "需要人工确认。"),
            "suggestion": finding.get("suggestion", "请根据事实与规范修改。"),
        })

    variant["claims"] = claims
    variant["risk_annotations"] = risks
    return variant
