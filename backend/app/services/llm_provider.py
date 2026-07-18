from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

import httpx

from .compliance import check_content


@dataclass(frozen=True)
class ProviderConfig:
    mode: str
    label: str
    base_url: str
    api_key: str
    model: str
    thinking: str

    @property
    def ready(self) -> bool:
        return bool(self.base_url and self.api_key and self.model)


def provider_mode() -> str:
    return os.getenv("LLM_PROVIDER_MODE", "demo").strip().lower()


def provider_config() -> ProviderConfig:
    mode = provider_mode()
    if mode == "deepseek":
        return ProviderConfig(
            mode=mode,
            label="DeepSeek",
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip().rstrip("/"),
            api_key=os.getenv("DEEPSEEK_API_KEY", "").strip(),
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash").strip(),
            thinking=os.getenv("DEEPSEEK_THINKING", "disabled").strip().lower(),
        )
    if mode == "openai-compatible":
        return ProviderConfig(
            mode=mode,
            label=os.getenv("LLM_PROVIDER_LABEL", "外部模型").strip() or "外部模型",
            base_url=os.getenv("LLM_BASE_URL", "").strip().rstrip("/"),
            api_key=os.getenv("LLM_API_KEY", "").strip(),
            model=os.getenv("LLM_MODEL", "").strip(),
            thinking=os.getenv("LLM_THINKING", "disabled").strip().lower(),
        )
    return ProviderConfig(mode="demo", label="规则引擎", base_url="", api_key="", model="", thinking="disabled")


def provider_status() -> dict[str, Any]:
    config = provider_config()
    return {
        "mode": config.mode,
        "label": config.label,
        "ready": config.ready,
        "model": config.model or "规则生成",
        "thinking": config.thinking,
    }


def is_enabled() -> bool:
    return provider_config().ready


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
            raise ValueError("模型没有返回可解析的 JSON")
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("模型返回结果必须是 JSON 对象")
    return data


def _endpoint(base_url: str) -> str:
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"


def _personalization_score(text: str, advisor: dict[str, Any]) -> int:
    audience_tokens = [token for token in re.split(r"[、，,与和的\s]+", advisor["audience"]) if len(token) >= 2]
    signals = [
        advisor["city"] in text,
        advisor["store"] in text or advisor["name"] in text,
        any(token in text for token in audience_tokens),
        any(word in text for word in ("家庭", "通勤", "孩子", "出行", "试驾")),
    ]
    return 60 + sum(10 for matched in signals if matched)


def _grounding_score(text: str, vehicle: dict[str, Any]) -> int:
    signals = [
        vehicle["name"] in text,
        vehicle["full_purchase_from"] in text,
        vehicle["baas_from"] in text,
        "以乐道官方最新信息为准" in text,
    ]
    return 60 + sum(10 for matched in signals if matched)


async def enhance_result(
    result: dict[str, Any],
    *,
    advisor: dict[str, Any],
    vehicle: dict[str, Any],
    campaign_name: str,
    campaign_brief: str,
) -> dict[str, Any]:
    """Use a configured model to rewrite content while retaining facts and review controls."""
    config = provider_config()
    if not config.ready:
        return result

    platforms = [item["platform"] for item in result["variants"]]
    official_facts = "\n".join(f"- {fact}" for fact in vehicle["verified_facts"])
    required_price_note = "具体配置、价格与权益以乐道官方最新信息为准。"
    system = (
        "你是购车顾问的内容编辑，不是广告口号生成器。"
        "写得像一名真实、克制、有经验的顾问：说人话，少用排比，不喊口号，不制造虚假紧迫感。"
        "只能使用用户提供的已核验事实，不得发明参数、权益、用户评价、销量或成交数据。"
        "涉及辅助驾驶时，必须明确不能替代驾驶员持续关注和必要操作。"
        "输出必须是合法 JSON，不要输出 Markdown。"
    )
    user = f"""
请把下面任务改写成适合不同平台发布的内容。

顾问：{advisor['name']}，{advisor['city']}，{advisor['store']}
主要服务人群：{advisor['audience']}
表达习惯：{advisor['style']}
活动名称：{campaign_name}
内容要求：{campaign_brief}
车型：{vehicle['name']}
已核验事实：
{official_facts}
事实来源：{vehicle['source_url']}，核验日期 {vehicle['verified_at']}
平台：{', '.join(platforms)}

写作要求：
1. 每个平台明显不同，不能只是换标题。
2. 朋友圈像顾问本人分享；小红书有清晰场景和信息层次；短视频口播自然、好说出口；私聊简短且不骚扰。
3. 不要使用“闭眼入、绝对、最强、第一、零风险、完全自动驾驶”等表达。
4. 涉及价格时，正文必须逐字包含：{required_price_note}
5. 行动引导只能邀请咨询、了解或预约体验，不能承诺优惠或自动发布。
6. 每个平台正文控制在 120 至 420 个汉字，私聊不超过 180 个汉字。

只返回下面结构的 JSON：
{{"variants":[{{"platform":"小红书","title":"...","body":"...","call_to_action":"...","hashtags":["..."]}}]}}
""".strip()

    payload: dict[str, Any] = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": int(os.getenv("LLM_MAX_TOKENS", "2600")),
        "stream": False,
    }
    if config.mode == "deepseek":
        payload["thinking"] = {"type": "enabled" if config.thinking == "enabled" else "disabled"}
        if config.thinking != "enabled":
            payload["temperature"] = 0.55
        payload["user_id"] = os.getenv("DEEPSEEK_USER_ID", "personaflow-demo")
    else:
        payload["temperature"] = 0.55

    headers = {"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "75"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(_endpoint(config.base_url), headers=headers, json=payload)
        response.raise_for_status()
        raw = response.json()

    try:
        text = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("模型返回结构不符合预期") from exc
    data = _extract_json(str(text))
    variants = data.get("variants")
    if not isinstance(variants, list):
        raise ValueError("模型 JSON 缺少 variants 数组")

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
        combined = f"{title}\n{body}\n{cta}"
        compliance = check_content(combined, has_evidence=True)
        variant["personalization_score"] = _personalization_score(combined, advisor)
        variant["grounding_score"] = _grounding_score(combined, vehicle)
        variant["compliance_score"] = compliance["score"]
        variant["status"] = "ready_for_human_review" if compliance["passed"] else "needs_revision"

    aggregate = check_content(
        "\n".join(f"{item['title']}\n{item['body']}\n{item['call_to_action']}" for item in result["variants"]),
        has_evidence=True,
    )
    result["compliance"] = aggregate
    result["audit"].update({
        "generator_mode": "ai-with-grounding-and-rules",
        "provider": config.label,
        "model": config.model,
        "ai_used": True,
    })
    return result
