from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .annotations import annotate_variant
from .compliance import check_content
from .store import compliance_rules

PLATFORM_NAMES = {
    "朋友圈": "朋友圈",
    "小红书": "小红书",
    "抖音": "抖音口播",
    "抖音口播": "抖音口播",
    "视频号": "视频号口播",
    "视频号口播": "视频号口播",
    "私聊": "私聊跟进",
    "私聊跟进": "私聊跟进",
}


def _audience_tokens(audience: str) -> list[str]:
    return [token for token in audience.replace("、", " ").replace("与", " ").replace("和", " ").split() if len(token) >= 2]


def _personalization_score(text: str, advisor: dict[str, Any], customer_context: dict[str, Any] | None) -> int:
    signals = [
        advisor["city"] in text,
        advisor["store"] in text or advisor["name"] in text,
        any(token in text for token in _audience_tokens(advisor["audience"])),
        any(word in text for word in ("家庭", "通勤", "孩子", "出行", "试驾")),
        bool(customer_context and customer_context.get("name") and customer_context["name"] in text),
        bool(customer_context and any(concern in text for concern in customer_context.get("concerns", []))),
    ]
    return min(100, 52 + sum(8 for matched in signals if matched))


def _grounding_score(text: str, vehicle: dict[str, Any]) -> int:
    signals = [
        vehicle["name"] in text,
        vehicle["full_purchase_from"] in text,
        vehicle["baas_from"] in text,
        "以乐道官方最新信息为准" in text,
    ]
    return min(100, 60 + sum(10 for matched in signals if matched))


def _style_opening(advisor: dict[str, Any], vehicle: dict[str, Any]) -> str:
    style = advisor["style"]
    if "专业" in style:
        return f"先不堆参数，我们按一家人真实坐进 {vehicle['name']} 后最关心的几个问题来判断。"
    if "场景" in style:
        return "想象一个周六早晨：两个孩子、露营车和全家人的随身物品，都要一起出发。"
    return f"最近在{advisor['city']}接待家庭用户时，我发现大家选车最先问的不是参数，而是日常到底好不好用。"


def _customer_line(customer_context: dict[str, Any] | None) -> str:
    if not customer_context:
        return ""
    name = str(customer_context.get("name") or "这位客户")
    concerns = customer_context.get("concerns") or []
    recent = str(customer_context.get("recent_message") or "")
    if concerns:
        return f"{name}目前最关心的是{'、'.join(str(item) for item in concerns[:2])}。"
    if recent:
        return f"{name}最近提到：{recent}"
    return ""


def _body_for(
    platform: str,
    advisor: dict[str, Any],
    vehicle: dict[str, Any],
    brief: str,
    customer_context: dict[str, Any] | None,
) -> tuple[str, str, str]:
    rules = compliance_rules()
    opening = _style_opening(advisor, vehicle)
    scenario = "、".join(vehicle["scenarios"][:2])
    facts = f"{vehicle['name']}定位为{vehicle['positioning']}，当前官方页面显示整车购买{vehicle['full_purchase_from']}，电池租用方式购买{vehicle['baas_from']}。"
    disclaimer = rules["required_dynamic_disclaimer"]
    audience_line = f"对{advisor['audience']}来说，建议把体验重点放在{scenario}这些真实场景，而不是只看一张参数表。"
    customer_line = _customer_line(customer_context)

    if platform == "小红书":
        title = f"二孩家庭看 {vehicle['name']}，我建议把试驾做成一次真实装载"
        body = (
            f"{opening}\n\n"
            "我会建议一家人把平时真正会带的东西列出来：儿童用品、周末行李、露营装备，再按满员状态去试乘和装载。\n\n"
            f"{facts}\n{audience_line}\n{customer_line}\n\n"
            f"这次体验重点是：{brief}\n{disclaimer}"
        )
        cta = f"在{advisor['city']}想按自己的家庭成员和常带物品体验，可以把清单发给我，我先帮你准备试驾路线。"
    elif platform in {"抖音口播", "视频号口播"}:
        title = f"家庭试 {vehicle['name']}，不要只看空车状态"
        body = (
            f"{opening} 真正有用的试驾，是把孩子、行李和日常路线都带进去。"
            f"先看满员乘坐，再看常带物品怎么放，最后按自己的通勤和长途频率体验补能。{facts}"
            f"{customer_line}{disclaimer}"
        )
        cta = "把家庭人数和最常带的三样东西告诉我，我按你的场景整理一份试驾检查清单。"
    elif platform == "私聊跟进":
        customer_name = str((customer_context or {}).get("name") or "你好")
        title = f"{vehicle['name']}家庭场景体验邀请"
        body = (
            f"{customer_name}，我是{advisor['store']}的{advisor['name']}。你提到的家庭空间问题我记下了。"
            f"这次不只看空车，我可以按你家的人数和常带物品准备满员收纳体验。{facts}{disclaimer}"
        )
        cta = "你把周日大概方便的时间和想带到店的物品告诉我，我先确认体验安排，不做重复打扰。"
    else:
        title = f"今天不讲空泛卖点，聊聊 {vehicle['name']} 是否适合你的家庭"
        body = f"{opening}\n{facts}\n{audience_line}\n{customer_line}\n{brief}\n{disclaimer}"
        cta = f"想在{advisor['city']}按真实路线试一遍，可以和我约时间。"
    return title, body, cta


def _persona_reasons(advisor: dict[str, Any], customer_context: dict[str, Any] | None) -> list[str]:
    reasons = [
        f"顾问常用“{advisor['style']}”表达，避免强推式话术。",
        f"顾问主要服务{advisor['audience']}，优先使用家庭场景而非参数堆砌。",
        f"内容保留{advisor['city']}本地到店和试驾语境。",
    ]
    if customer_context and customer_context.get("concerns"):
        reasons.append(f"本次优先回应客户顾虑：{'、'.join(customer_context['concerns'][:2])}。")
    return reasons


def generate_content(
    *,
    advisor: dict[str, Any],
    vehicle: dict[str, Any],
    campaign_name: str,
    campaign_brief: str,
    platforms: list[str],
    customer_context: dict[str, Any] | None = None,
    opportunity_id: str | None = None,
) -> dict[str, Any]:
    task_id = f"content-{uuid4().hex[:12]}"
    variants: list[dict[str, Any]] = []
    combined_texts: list[str] = []

    evidence = [
        {"id": "evidence-positioning", "field": "车型定位", "value": vehicle["positioning"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"], "source_type": "官方产品页"},
        {"id": "evidence-price-full", "field": "整车购买起价", "value": vehicle["full_purchase_from"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"], "source_type": "官方产品页"},
        {"id": "evidence-price-baas", "field": "BaaS 起价", "value": vehicle["baas_from"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"], "source_type": "官方产品页"},
    ]

    normalized_platforms: list[str] = []
    for raw in platforms:
        name = PLATFORM_NAMES.get(raw, raw)
        if name not in normalized_platforms:
            normalized_platforms.append(name)

    for index, platform in enumerate(normalized_platforms):
        title, body, cta = _body_for(platform, advisor, vehicle, campaign_brief, customer_context)
        combined = f"{title}\n{body}\n{cta}"
        combined_texts.append(combined)
        compliance = check_content(combined, has_evidence=True)
        variant = {
            "id": f"variant-{index + 1}-{uuid4().hex[:6]}",
            "advisor_id": advisor["id"],
            "advisor_name": advisor["name"],
            "platform": platform,
            "title": title,
            "body": body,
            "call_to_action": cta,
            "hashtags": ["乐道汽车", vehicle["name"].replace("乐道 ", ""), advisor["city"] + "看车", "家庭出行"],
            "personalization_score": _personalization_score(combined, advisor, customer_context),
            "grounding_score": _grounding_score(combined, vehicle),
            "compliance_score": compliance["score"],
            "status": "ready_for_human_review" if compliance["passed"] else "needs_revision",
            "personalization_reasons": _persona_reasons(advisor, customer_context),
            "version": 1,
            "verification_status": "verified",
            "compliance_status": "verified",
            "knowledge_version": "onvo-cn-2026.07.18",
            "verification_version": 1,
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "version_history": [{"type": "generated", "at": datetime.now(timezone.utc).isoformat(), "version": 1}],
        }
        variants.append(annotate_variant(variant, evidence, compliance))

    all_compliance = check_content("\n".join(combined_texts), has_evidence=True)
    avg_score = round(sum(item["compliance_score"] for item in variants) / max(1, len(variants)))
    all_compliance["score"] = min(all_compliance["score"], avg_score)

    voiceover = variants[0]["body"].replace("\n", " ") if variants else ""
    shots = [
        {"index": 1, "duration": 3, "visual": f"{advisor['city']}家庭准备出发，儿童用品与行李摆在车旁", "subtitle": "家庭试驾，先把真实物品带上", "asset_hint": "家庭出行 / 竖屏 / 克制真实"},
        {"index": 2, "duration": 5, "visual": f"顾问在车旁说明 {vehicle['name']} 的体验顺序", "subtitle": "先看满员乘坐，再看收纳", "asset_hint": "顾问出镜 / 车型全景"},
        {"index": 3, "duration": 5, "visual": "前后排乘坐与儿童用品、登机箱装载演示", "subtitle": f"更适合：{advisor['audience']}", "asset_hint": "车内 / 收纳 / 家庭成员"},
        {"index": 4, "duration": 4, "visual": "官方事实卡与核验日期", "subtitle": f"整车购买 {vehicle['full_purchase_from']}", "asset_hint": "官方信息卡 / 不用促销风"},
        {"index": 5, "duration": 4, "visual": "顾问邀请用户携带真实物品预约试驾", "subtitle": "按你的真实场景试一次", "asset_hint": "顾问口播 / 门店 / CTA"},
    ]

    return {
        "task_id": task_id,
        "opportunity_id": opportunity_id,
        "campaign_name": campaign_name,
        "vehicle": {key: value for key, value in vehicle.items() if key != "verified_facts"},
        "customer_context": customer_context,
        "variants": variants,
        "video_package": {
            "hook": f"家庭试 {vehicle['name']}，别只看空车状态。",
            "voiceover": voiceover,
            "shots": shots,
            "cover_titles": [
                "满员以后，行李怎么放？",
                f"二孩家庭试 {vehicle['name']} 的顺序",
                "把真实物品带进试驾",
            ],
        },
        "compliance": all_compliance,
        "evidence": evidence,
        "audit": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "knowledge_version": "onvo-cn-2026.07.18",
            "human_review_required": True,
            "generator_mode": "rules-with-grounded-facts",
            "demo_data": True,
        },
    }
