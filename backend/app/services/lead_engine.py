from __future__ import annotations

from collections import Counter
from typing import Any
from uuid import uuid4

TOPIC_RULES = {
    "空间与家庭成员": ["空间", "二排", "第二排", "三排", "第三排", "后备箱", "孩子", "三代", "几个人", "行李", "露营"],
    "价格与 BaaS": ["价格", "多少钱", "BaaS", "租电", "全购", "优惠", "权益"],
    "试驾与到店": ["试驾", "到店", "有空", "预约", "体验"],
    "补能与续航": ["续航", "充电", "换电", "补能", "长途"],
    "辅助驾驶": ["辅助驾驶", "智驾", "自动驾驶", "方向盘", "接管"],
}

HIGH_INTENT_WORDS = ["试驾", "预约", "到店", "今晚", "周末", "怎么选", "多少钱", "全购", "租电", "有空"]
MEDIUM_INTENT_WORDS = ["够不够", "想了解", "区别", "会不会", "适合", "续航", "空间", "第三排"]


def _concern(text: str) -> str:
    for topic, words in TOPIC_RULES.items():
        if any(word.lower() in text.lower() for word in words):
            return topic
    return "一般了解"


def _intent(text: str) -> str:
    if any(word.lower() in text.lower() for word in HIGH_INTENT_WORDS):
        return "高"
    if any(word.lower() in text.lower() for word in MEDIUM_INTENT_WORDS):
        return "中"
    return "低"


def _next_action(intent: str, concern: str) -> str:
    if intent == "高" and concern == "试驾与到店":
        return "确认城市、门店与可用时间，提交试驾预约"
    if intent == "高":
        return "补充 2 个需求问题后，邀请场景试驾"
    if intent == "中":
        return "发送对应官方事实卡，24 小时后轻跟进"
    return "进入低频培育，不主动高频触达"


def _reply(intent: str, concern: str) -> str:
    replies = {
        "空间与家庭成员": "可以按家庭人数和常带物品来体验。你方便说下几位成人、几个孩子，以及最常见的出行场景吗？我先给你准备一份试驾检查清单。",
        "价格与 BaaS": "全购与电池租用方式适合不同的现金流和使用计划。我可以先按你的预算与用车年限做一个不带促销承诺的对比，具体价格与权益以官方最新信息为准。",
        "试驾与到店": "可以安排。请告诉我所在城市和方便的时间段，我核对门店后再确认，不会反复打扰。",
        "补能与续航": "建议结合日均里程、是否有家充和长途频率一起判断。你把这三项告诉我，我按真实路线整理体验重点。",
        "辅助驾驶": "智能辅助驾驶不能替代驾驶员的持续关注与必要操作，实际体验请以车辆功能说明、适用条件和安全要求为准。可以在试驾时由顾问规范演示。",
        "一般了解": "可以先从你的家庭人数、主要路线和最看重的两点开始，我只发与你需求相关的信息。",
    }
    prefix = "看到了你的问题。" if intent != "低" else "没问题，先慢慢了解。"
    return prefix + replies[concern]


def analyze(messages: list[str]) -> dict[str, Any]:
    leads: list[dict[str, str]] = []
    concerns: Counter[str] = Counter()
    counts: Counter[str] = Counter()
    for text in messages:
        intent = _intent(text)
        concern = _concern(text)
        counts[intent] += 1
        concerns[concern] += 1
        leads.append({
            "id": f"lead-{uuid4().hex[:8]}",
            "text": text,
            "intent": intent,
            "concern": concern,
            "next_action": _next_action(intent, concern),
            "recommended_reply": _reply(intent, concern),
        })

    top = [{"topic": topic, "count": count} for topic, count in concerns.most_common(5)]
    next_topics = []
    topic_templates = {
        "空间与家庭成员": "不同家庭人数，怎样设计一次有效的空间试驾？",
        "价格与 BaaS": "全购与 BaaS 怎么结合预算和用车年限判断？",
        "试驾与到店": "家庭用户试驾前，最值得提前准备的 5 个问题",
        "补能与续航": "没有家充、经常长途，补能方案应该怎么体验？",
        "辅助驾驶": "辅助驾驶能做什么、不能做什么：安全体验清单",
        "一般了解": "第一次了解家庭智能电动车，先确定哪三项需求？",
    }
    for item in top[:3]:
        next_topics.append(topic_templates[item["topic"]])

    return {
        "total": len(messages),
        "high_intent": counts["高"],
        "medium_intent": counts["中"],
        "low_intent": counts["低"],
        "top_concerns": top,
        "leads": leads,
        "next_content_topics": next_topics,
    }
