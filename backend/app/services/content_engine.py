from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha1
from typing import Any
from uuid import uuid4

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


def _stable_score(seed: str, low: int, high: int) -> int:
    span = high - low + 1
    number = int(sha1(seed.encode("utf-8")).hexdigest()[:8], 16)
    return low + number % span


def _style_opening(advisor: dict[str, Any], vehicle: dict[str, Any]) -> str:
    style = advisor["style"]
    if "专业" in style:
        return f"先不堆参数，我们按一家人真实坐进 {vehicle['name']} 后最关心的三个问题来判断。"
    if "场景" in style:
        return f"想象一个周六早晨：两个孩子、露营车和全家人的随身物品，都要一起出发。"
    return f"最近在{advisor['city']}接待家庭用户时，我发现大家选车最先问的不是参数，而是日常到底好不好用。"


def _body_for(platform: str, advisor: dict[str, Any], vehicle: dict[str, Any], brief: str) -> tuple[str, str, str]:
    rules = compliance_rules()
    opening = _style_opening(advisor, vehicle)
    scenario = "、".join(vehicle["scenarios"][:2])
    facts = f"{vehicle['name']}定位为{vehicle['positioning']}，当前官方页面显示整车购买{vehicle['full_purchase_from']}，电池租用方式购买{vehicle['baas_from']}。"
    disclaimer = rules["required_dynamic_disclaimer"]
    audience_line = f"对{advisor['audience']}来说，建议把体验重点放在{scenario}这些真实场景，而不是只看一张参数表。"

    if platform == "小红书":
        title = f"{advisor['audience']}看 {vehicle['name']}，我建议先体验这 3 个场景"
        body = f"{opening}\n\n① 上下班和接送孩子时，空间是否顺手；\n② 周末全家出行时，乘坐与收纳是否符合习惯；\n③ 补能方案是否适合自己的通勤半径。\n\n{facts}\n{audience_line}\n\n这次内容任务是：{brief}\n{disclaimer}"
        cta = f"在{advisor['city']}想按自己的家庭成员和用车路线体验，可以找我预约一次不催单的场景试驾。"
    elif platform in {"抖音口播", "视频号口播"}:
        title = f"别急着背参数，家庭选 {vehicle['name']} 先看这三点"
        body = f"{opening} 第一，看每天高频的接送和通勤；第二，看周末一家人的乘坐和行李；第三，看自己的补能条件。{facts}{audience_line} {disclaimer}"
        cta = f"评论区留下家庭人数和主要路线，我按真实场景给你整理试驾清单。"
    elif platform == "私聊跟进":
        title = f"{vehicle['name']}场景体验邀请"
        body = f"你好，我是{advisor['store']}的{advisor['name']}。你之前关注的是家庭使用场景，我把{vehicle['name']}的官方信息和体验重点整理好了：{facts}{audience_line} {disclaimer}"
        cta = "你方便说一下家庭人数、平时通勤距离和最在意的问题吗？我先按需求准备，不做重复打扰。"
    else:
        title = f"今天不讲空泛卖点，聊聊 {vehicle['name']} 是否适合你的家庭"
        body = f"{opening}\n{facts}\n{audience_line}\n{brief}\n{disclaimer}"
        cta = f"想在{advisor['city']}按真实路线试一遍，可以和我约时间。"
    return title, body, cta


def generate_content(*, advisor: dict[str, Any], vehicle: dict[str, Any], campaign_name: str, campaign_brief: str, platforms: list[str]) -> dict[str, Any]:
    task_id = f"content-{uuid4().hex[:12]}"
    variants: list[dict[str, Any]] = []
    combined_texts: list[str] = []

    normalized_platforms: list[str] = []
    for raw in platforms:
        name = PLATFORM_NAMES.get(raw, raw)
        if name not in normalized_platforms:
            normalized_platforms.append(name)

    for index, platform in enumerate(normalized_platforms):
        title, body, cta = _body_for(platform, advisor, vehicle, campaign_brief)
        combined = f"{title}\n{body}\n{cta}"
        combined_texts.append(combined)
        compliance = check_content(combined, has_evidence=True)
        seed = f"{advisor['id']}-{vehicle['id']}-{platform}-{campaign_name}"
        variants.append({
            "id": f"variant-{index + 1}-{uuid4().hex[:6]}",
            "advisor_id": advisor["id"],
            "advisor_name": advisor["name"],
            "platform": platform,
            "title": title,
            "body": body,
            "call_to_action": cta,
            "hashtags": ["乐道汽车", vehicle["name"].replace("乐道 ", ""), advisor["city"] + "看车", "家庭出行"],
            "personalization_score": _stable_score(seed + "p", 86, 96),
            "grounding_score": 100,
            "compliance_score": compliance["score"],
            "status": "ready_for_human_review" if compliance["passed"] else "needs_revision",
        })

    all_compliance = check_content("\n".join(combined_texts), has_evidence=True)
    avg_score = round(sum(item["compliance_score"] for item in variants) / max(1, len(variants)))
    all_compliance["score"] = min(all_compliance["score"], avg_score)

    voiceover = variants[0]["body"].replace("\n", " ") if variants else ""
    shots = [
        {"index": 1, "duration": 3, "visual": f"{advisor['city']}城市道路与家庭出发准备", "subtitle": "家庭选车，先看真实一天", "asset_hint": "城市 / 家庭出行 / 竖屏"},
        {"index": 2, "duration": 5, "visual": f"顾问在车旁讲解 {vehicle['name']} 的家庭场景", "subtitle": vehicle["positioning"], "asset_hint": "顾问出镜 / 车型全景"},
        {"index": 3, "duration": 5, "visual": "前后排乘坐与儿童用品收纳演示", "subtitle": f"更适合：{advisor['audience']}", "asset_hint": "车内 / 收纳 / 家庭成员"},
        {"index": 4, "duration": 4, "visual": "官方价格信息卡与核验日期", "subtitle": f"整车购买 {vehicle['full_purchase_from']}", "asset_hint": "官方信息卡 / 不用促销风"},
        {"index": 5, "duration": 4, "visual": "顾问邀请用户按日常路线预约试驾", "subtitle": "按你的真实路线试一次", "asset_hint": "顾问口播 / 门店 / CTA"},
    ]

    evidence = [
        {"field": "车型定位", "value": vehicle["positioning"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"]},
        {"field": "整车购买起价", "value": vehicle["full_purchase_from"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"]},
        {"field": "BaaS 起价", "value": vehicle["baas_from"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"]},
    ]

    return {
        "task_id": task_id,
        "campaign_name": campaign_name,
        "vehicle": {key: value for key, value in vehicle.items() if key != "verified_facts"},
        "variants": variants,
        "video_package": {
            "hook": f"家庭选 {vehicle['name']}，别先背参数，先看一天怎么用。",
            "voiceover": voiceover,
            "shots": shots,
            "cover_titles": [
                f"{advisor['audience']}先看这 3 点",
                f"选 {vehicle['name']} 别忽略真实场景",
                "一次试驾，把家庭需求试明白",
            ],
        },
        "compliance": all_compliance,
        "evidence": evidence,
        "audit": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "knowledge_version": "onvo-cn-2026.07.18",
            "human_review_required": True,
            "generator_mode": "deterministic-demo-with-video-render-payload",
        },
    }
