from __future__ import annotations

import copy
import json
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import uuid4

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "workspace.json"
_LOCK = RLock()


def _load_initial() -> dict[str, Any]:
    with DATA_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


_STATE = _load_initial()


def reset() -> dict[str, Any]:
    global _STATE
    with _LOCK:
        _STATE = _load_initial()
        return snapshot()


def snapshot() -> dict[str, Any]:
    with _LOCK:
        return copy.deepcopy(_STATE)


def opportunities(*, include_done: bool = True) -> list[dict[str, Any]]:
    items = snapshot()["opportunities"]
    return items if include_done else [item for item in items if item["status"] != "done"]


def get_opportunity(opportunity_id: str) -> dict[str, Any]:
    for item in snapshot()["opportunities"]:
        if item["id"] == opportunity_id:
            return item
    raise KeyError(f"Unknown opportunity_id: {opportunity_id}")


def update_opportunity(opportunity_id: str, status: str) -> dict[str, Any]:
    allowed = {"pending", "later", "in_progress", "done"}
    if status not in allowed:
        raise ValueError(f"Unsupported opportunity status: {status}")
    with _LOCK:
        for item in _STATE["opportunities"]:
            if item["id"] == opportunity_id:
                item["status"] = status
                return copy.deepcopy(item)
    raise KeyError(f"Unknown opportunity_id: {opportunity_id}")


def followups() -> list[dict[str, Any]]:
    return snapshot()["followups"]


def add_followup_event(customer_id: str, event: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        for item in _STATE["followups"]:
            if item["customer_id"] != customer_id:
                continue
            stored = {
                "id": f"event-{uuid4().hex[:8]}",
                "type": str(event.get("type") or "advisor_note"),
                "actor": str(event.get("actor") or "顾问"),
                "time": datetime.now().strftime("今天 %H:%M"),
                "title": str(event.get("title") or "新增记录"),
                "content": str(event.get("content") or "").strip(),
                "status": str(event.get("status") or "completed"),
            }
            item["events"].append(stored)
            if stored["type"] == "test_drive_booked":
                item["stage"] = "已预约试驾"
                item["next_action"] = "试驾前一天确认到店人数与携带物品。"
                item["next_action_due"] = "试驾前一天"
            if stored["type"] == "customer_message" and stored["content"]:
                item["memories"].append({
                    "id": f"memory-{uuid4().hex[:8]}",
                    "scope": "customer",
                    "title": "最新客户反馈",
                    "value": stored["content"],
                    "source": "手动补录客户回复",
                    "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "active": True,
                })
            return copy.deepcopy(item)
    raise KeyError(f"Unknown customer_id: {customer_id}")


def toggle_memory(customer_id: str, memory_id: str, active: bool) -> dict[str, Any]:
    with _LOCK:
        for item in _STATE["followups"]:
            if item["customer_id"] != customer_id:
                continue
            for memory in item["memories"]:
                if memory["id"] == memory_id:
                    memory["active"] = active
                    return copy.deepcopy(memory)
    raise KeyError(f"Unknown memory_id: {memory_id}")


def reviews() -> list[dict[str, Any]]:
    return snapshot()["reviews"]


def decide_review(review_id: str, decision: str, reason: str) -> dict[str, Any]:
    if decision not in {"approved", "returned"}:
        raise ValueError("decision must be approved or returned")
    with _LOCK:
        for item in _STATE["reviews"]:
            if item["id"] == review_id:
                item["status"] = decision
                item["decision_reason"] = reason.strip()
                return copy.deepcopy(item)
    raise KeyError(f"Unknown review_id: {review_id}")


def campaigns() -> list[dict[str, Any]]:
    return snapshot()["campaigns"]


def update_campaign_run(campaign_id: str, summary: dict[str, int]) -> dict[str, Any]:
    with _LOCK:
        for item in _STATE["campaigns"]:
            if item["id"] == campaign_id:
                item["status"] = "completed"
                item["task_summary"] = summary
                item["last_run"] = datetime.now().strftime("今天 %H:%M")
                return copy.deepcopy(item)
    raise KeyError(f"Unknown campaign_id: {campaign_id}")


def save_draft(payload: dict[str, Any]) -> dict[str, Any]:
    stored = {
        "id": str(payload.get("id") or f"draft-{uuid4().hex[:10]}"),
        "task_id": str(payload.get("task_id") or ""),
        "variant_id": str(payload.get("variant_id") or ""),
        "platform": str(payload.get("platform") or ""),
        "title": str(payload.get("title") or ""),
        "body": str(payload.get("body") or ""),
        "call_to_action": str(payload.get("call_to_action") or ""),
        "status": str(payload.get("status") or "draft"),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    with _LOCK:
        for index, item in enumerate(_STATE["drafts"]):
            if item["task_id"] == stored["task_id"] and item["variant_id"] == stored["variant_id"]:
                stored["id"] = item["id"]
                _STATE["drafts"][index] = stored
                return copy.deepcopy(stored)
        _STATE["drafts"].append(stored)
    return copy.deepcopy(stored)


def submit_review(payload: dict[str, Any]) -> dict[str, Any]:
    draft = save_draft({**payload, "status": "submitted"})
    review = {
        "id": f"review-{uuid4().hex[:8]}",
        "task_id": draft["task_id"],
        "title": f"{payload.get('campaign_name') or '内容任务'} · {draft['platform']}",
        "advisor_id": str(payload.get("advisor_id") or ""),
        "advisor_name": str(payload.get("advisor_name") or ""),
        "vehicle_id": str(payload.get("vehicle_id") or ""),
        "status": "pending",
        "risk_level": str(payload.get("risk_level") or "low"),
        "reason": str(payload.get("reason") or "事实与风险已完成自动预检，等待门店经理确认。"),
        "content_excerpt": draft["body"][:160],
        "evidence_status": str(payload.get("evidence_status") or "已绑定"),
        "submitted_at": datetime.now().strftime("今天 %H:%M"),
        "decision_reason": "",
    }
    with _LOCK:
        _STATE["reviews"].insert(0, review)
    return copy.deepcopy(review)
