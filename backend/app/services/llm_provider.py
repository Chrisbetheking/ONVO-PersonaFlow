from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

from .compliance import check_content


def provider_mode() -> str:
    return os.getenv("LLM_PROVIDER_MODE", "demo").strip().lower()


def is_enabled() -> bool:
    return provider_mode() == "openai-compatible"


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("Model response did not contain a JSON object")
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("Model response must be a JSON object")
    return data


async def enhance_result(
    result: dict[str, Any],
    *,
    advisor: dict[str, Any],
    vehicle: dict[str, Any],
    campaign_name: str,
    campaign_brief: str,
) -> dict[str, Any]:
    """Enhance deterministic, grounded variants with a configured OpenAI-compatible model.

    No raw customer data is sent. If a real provider is selected, failures are raised to
    the caller rather than silently pretending that AI generation succeeded.
    """
    if not is_enabled():
        return result

    base_url = os.getenv("LLM_BASE_URL", "").rstrip("/")
    api_key = os.getenv("LLM_API_KEY", "")
    model = os.getenv("LLM_MODEL", "")
    if not base_url or not api_key or not model:
        raise RuntimeError("LLM_PROVIDER_MODE is openai-compatible but LLM_BASE_URL, LLM_API_KEY or LLM_MODEL is missing")

    platforms = [item["platform"] for item in result["variants"]]
    official_facts = "\n".join(f"- {fact}" for fact in vehicle["verified_facts"])
    required_price_note = "具体配置、价格与权益以乐道官方最新信息为准。"
    system = (
        "你是汽车品牌一线内容增长与合规助手。你只能使用用户提供的已核验事实，"
        "不能发明参数、权益、车主评价或销售业绩。涉及辅助驾驶时必须强调它不能替代驾驶员持续关注。"
        "输出必须是合法 JSON，不要使用 Markdown。"
    )
    user = f"""
为一名乐道购车顾问生成多平台内容。

顾问画像：
- 姓名：{advisor['name']}
- 城市/门店：{advisor['city']} / {advisor['store']}
- 目标客群：{advisor['audience']}
- 表达风格：{advisor['style']}

活动：{campaign_name}
任务：{campaign_brief}
车型：{vehicle['name']}
官方事实：
{official_facts}
来源：{vehicle['source_url']}（核验日期 {vehicle['verified_at']}）
输出平台：{', '.join(platforms)}

每个平台返回 title、body、call_to_action、hashtags。内容必须体现顾问画像和平台差异。
凡涉及价格，body 必须逐字包含：{required_price_note}
不要承诺自动发布，CTA 只能邀请咨询或预约体验。

返回结构：
{{"variants":[{{"platform":"小红书","title":"...","body":"...","call_to_action":"...","hashtags":["..."]}}]}}
""".strip()

    endpoint = base_url if base_url.endswith("/chat/completions") else f"{base_url}/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.55,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()
        raw = response.json()

    try:
        text = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Unexpected OpenAI-compatible response schema") from exc
    data = _extract_json(str(text))
    variants = data.get("variants")
    if not isinstance(variants, list):
        raise ValueError("Model JSON must include a variants array")

    by_platform: dict[str, dict[str, Any]] = {}
    for item in variants:
        if isinstance(item, dict) and isinstance(item.get("platform"), str):
            by_platform[item["platform"]] = item

    for variant in result["variants"]:
        enhanced = by_platform.get(variant["platform"])
        if not enhanced:
            continue
        title = str(enhanced.get("title") or variant["title"]).strip()[:120]
        body = str(enhanced.get("body") or variant["body"]).strip()[:5000]
        cta = str(enhanced.get("call_to_action") or variant["call_to_action"]).strip()[:500]
        hashtags = enhanced.get("hashtags")
        if isinstance(hashtags, list):
            variant["hashtags"] = [str(tag).lstrip("#").strip()[:30] for tag in hashtags[:8] if str(tag).strip()]
        variant["title"] = title
        variant["body"] = body
        variant["call_to_action"] = cta
        compliance = check_content(f"{title}\n{body}\n{cta}", has_evidence=True)
        variant["compliance_score"] = compliance["score"]
        variant["status"] = "ready_for_human_review" if compliance["passed"] else "needs_revision"

    aggregate = check_content(
        "\n".join(f"{item['title']}\n{item['body']}\n{item['call_to_action']}" for item in result["variants"]),
        has_evidence=True,
    )
    result["compliance"] = aggregate
    result["audit"]["generator_mode"] = "openai-compatible-llm-with-grounding-and-rules"
    result["audit"]["model"] = model
    return result
