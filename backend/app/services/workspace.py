from __future__ import annotations

import copy
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Any, Callable
from uuid import uuid4

from .verification import verify_verification_token

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WORKSPACE_FILE = DATA_DIR / "workspace.json"
ADVISORS_FILE = DATA_DIR / "advisors.json"
ENTERPRISE_FILE = DATA_DIR / "enterprise.json"
WORKSPACE_TTL_SECONDS = max(300, int(os.getenv("WORKSPACE_TTL_SECONDS", "21600")))
WORKSPACE_CLEANUP_INTERVAL_SECONDS = max(30, int(os.getenv("WORKSPACE_CLEANUP_INTERVAL_SECONDS", "300")))
MAX_WORKSPACES = max(20, int(os.getenv("MAX_WORKSPACES", "300")))
MAX_AUDIT_EVENTS = max(20, int(os.getenv("MAX_AUDIT_EVENTS", "200")))
MAX_PROMISES = max(20, int(os.getenv("MAX_PROMISES", "120")))
MAX_NOTIFICATIONS = max(20, int(os.getenv("MAX_NOTIFICATIONS", "120")))
MAX_SYNC_EVENTS = max(20, int(os.getenv("MAX_SYNC_EVENTS", "120")))
MAX_REVALIDATION_TASKS = max(20, int(os.getenv("MAX_REVALIDATION_TASKS", "160")))
MAX_CAMPAIGN_TASKS = max(20, int(os.getenv("MAX_CAMPAIGN_TASKS", "200")))
MAX_FOLLOWUP_EVENTS = max(20, int(os.getenv("MAX_FOLLOWUP_EVENTS", "160")))
_WORKSPACE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$")


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _normalize_review(item: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(item)
    normalized.setdefault("platform", str(normalized.get("title") or "").split("·")[-1].strip() or "内容")
    normalized.setdefault("content_title", normalized.get("title", ""))
    normalized.setdefault("body", normalized.get("content_excerpt", ""))
    normalized.setdefault("call_to_action", "")
    normalized.setdefault("claims", [])
    normalized.setdefault("risk_annotations", [])
    normalized.setdefault("evidence", [])
    normalized.setdefault("reviewed_body", normalized["body"])
    normalized.setdefault("reviewed_call_to_action", normalized["call_to_action"])
    normalized.setdefault("decision_reason", "")
    normalized.setdefault("decision_at", "")
    normalized.setdefault("change_log", [])
    normalized.setdefault("verification_status", "verified")
    normalized.setdefault("compliance_status", "verified")
    normalized.setdefault("knowledge_version", "onvo-cn-2026.07.18")
    normalized.setdefault("verification_version", 1)
    normalized.setdefault("verified_at", normalized.get("submitted_at", ""))
    normalized.setdefault("verification_token", "")
    normalized.setdefault("version_history", [])
    return normalized


def _normalize_campaign(item: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(item)
    normalized.setdefault("tasks", [])
    normalized.setdefault("task_summary", {"total": 0, "ready": 0, "pending_review": 0, "failed": 0})
    return normalized


def _normalize_opportunity(item: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(item)
    source = str(normalized.get("source") or "客户信号")
    kind = str(normalized.get("kind") or "customer")
    if "活动" in source or normalized.get("campaign_id"):
        source_type = "总部活动"
    elif "热点" in source or kind == "topic":
        source_type = "热点机会"
    elif "知识" in source:
        source_type = "知识变更"
    elif "承诺" in source:
        source_type = "承诺到期"
    elif "风险" in source:
        source_type = "客户风险"
    else:
        source_type = "客户信号"
    normalized.setdefault("source_type", source_type)
    normalized.setdefault("owner", "当前负责顾问")
    normalized.setdefault("due_at", normalized.get("due_label", "24 小时内"))
    normalized.setdefault("impact_label", "1 位客户" if normalized.get("customer") else "客户分群")
    normalized.setdefault("manager_help", source_type in {"客户风险", "知识变更"})
    if kind == "segment":
        normalized.setdefault("segment_customers", ["陈女士", "许先生", "李女士"])
    return normalized


def _normalize_followup(item: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(item)
    for event in normalized.get("events", []):
        event.setdefault("source_label", "授权沟通 Demo" if event.get("type") in {"customer_message", "advisor_sent"} else "系统事件")
        event.setdefault("sync_status", "已同步" if event.get("type") in {"customer_message", "advisor_sent"} else "本地记录")
        event.setdefault("source_detail", "Messaging Demo Adapter" if "Demo" in event.get("source_label", "") else "当前工作区")
    return normalized


def _normalize_customer_profile(item: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(item)
    state = normalized.get("state", {})
    for key in ["need_clarity", "product_fit", "price_acceptance", "family_decision", "urgency", "relationship"]:
        dimension = state.get(key)
        if not isinstance(dimension, dict):
            continue
        evidence_items = []
        for evidence in dimension.get("evidence", []) or []:
            if isinstance(evidence, dict):
                entry = copy.deepcopy(evidence)
            else:
                entry = {"text": str(evidence)}
            entry.setdefault("source_event", "最近客户沟通")
            entry.setdefault("occurred_at", normalized.get("last_synced_at", "最近同步"))
            entry.setdefault("channel", "授权沟通 Demo")
            entry.setdefault("method", "规则")
            entry.setdefault("demo_flag", True)
            evidence_items.append(entry)
        dimension["evidence"] = evidence_items
    return normalized


def _load_initial() -> dict[str, Any]:
    state = _read_json(WORKSPACE_FILE)
    state["advisors"] = _read_json(ADVISORS_FILE)
    enterprise = _read_json(ENTERPRISE_FILE)
    for key, value in enterprise.items():
        state.setdefault(key, value)
    state["customer_profiles"] = [_normalize_customer_profile(item) for item in state.get("customer_profiles", [])]
    state.setdefault("drafts", [])
    state["opportunities"] = [_normalize_opportunity(item) for item in state.get("opportunities", [])]
    state["followups"] = [_normalize_followup(item) for item in state.get("followups", [])]
    state["reviews"] = [_normalize_review(item) for item in state.get("reviews", [])]
    state["campaigns"] = [_normalize_campaign(item) for item in state.get("campaigns", [])]
    return state


_INITIAL_STATE = _load_initial()

_ENTERPRISE_OBJECT_LISTS = [
    "hotspots", "knowledge_items", "knowledge_impacts", "sync_events", "customer_profiles",
    "promises", "quality_signals", "coaching_plans", "best_practices", "customer_risks",
    "experiments", "demo_scenarios", "notifications", "approvals", "revalidation_tasks", "audit_log",
]


def _stamp_object_metadata(item: dict[str, Any], workspace_id: str, *, source_type: str = "demo_template") -> None:
    created_at = str(item.get("created_at") or item.get("updated_at") or "2026-07-19T09:00:00")
    item["workspace_id"] = workspace_id
    item.setdefault("created_at", created_at)
    item.setdefault("updated_at", created_at)
    item.setdefault("source_type", str(item.get("source") or source_type))
    item.setdefault("demo_flag", True)
    item.setdefault("created_by", str(item.get("actor") or item.get("owner") or "system_demo"))
    item.setdefault("version", 1)


def _stamp_enterprise_state(state: dict[str, Any], workspace_id: str) -> None:
    for key in _ENTERPRISE_OBJECT_LISTS:
        for item in state.get(key, []) or []:
            if not isinstance(item, dict):
                continue
            _stamp_object_metadata(item, workspace_id, source_type=f"{key}_demo")
            if key == "hotspots":
                for evidence in item.get("evidence", []) or []:
                    if isinstance(evidence, dict):
                        _stamp_object_metadata(evidence, workspace_id, source_type="hotspot_evidence_demo")
            if key == "knowledge_items":
                for version in item.get("versions", []) or []:
                    if isinstance(version, dict):
                        _stamp_object_metadata(version, workspace_id, source_type="knowledge_version_demo")
            if key == "customer_profiles":
                for action in item.get("next_best_actions", []) or []:
                    if isinstance(action, dict):
                        _stamp_object_metadata(action, workspace_id, source_type="next_best_action_demo")


def _enforce_state_limits(state: dict[str, Any]) -> None:
    """Bound public-demo memory growth while preserving the most useful recent state."""
    for key, limit in (
        ("audit_log", MAX_AUDIT_EVENTS),
        ("promises", MAX_PROMISES),
        ("notifications", MAX_NOTIFICATIONS),
        ("sync_events", MAX_SYNC_EVENTS),
        ("revalidation_tasks", MAX_REVALIDATION_TASKS),
    ):
        items = state.get(key)
        if isinstance(items, list) and len(items) > limit:
            state[key] = items[:limit]

    for followup in state.get("followups", []) or []:
        if not isinstance(followup, dict):
            continue
        events = followup.get("events")
        if isinstance(events, list) and len(events) > MAX_FOLLOWUP_EVENTS:
            followup["events"] = events[-MAX_FOLLOWUP_EVENTS:]

    for campaign in state.get("campaigns", []) or []:
        if not isinstance(campaign, dict):
            continue
        tasks = campaign.get("tasks")
        if isinstance(tasks, list) and len(tasks) > MAX_CAMPAIGN_TASKS:
            campaign["tasks"] = tasks[-MAX_CAMPAIGN_TASKS:]
            summary = campaign.setdefault("task_summary", {})
            summary.update({
                "total": len(campaign["tasks"]),
                "ready": sum(1 for item in campaign["tasks"] if item.get("status") in {"ready", "submitted"}),
                "pending_review": sum(1 for item in campaign["tasks"] if item.get("status") == "needs_review"),
                "failed": sum(1 for item in campaign["tasks"] if item.get("status") == "failed"),
            })


def _new_workspace_state(workspace_id: str) -> dict[str, Any]:
    state = copy.deepcopy(_INITIAL_STATE)
    _stamp_enterprise_state(state, workspace_id)
    _enforce_state_limits(state)
    return state


def normalize_workspace_id(value: str | None) -> str:
    candidate = (value or "").strip()
    if candidate and _WORKSPACE_ID_PATTERN.fullmatch(candidate):
        return candidate
    return f"anon-{uuid4()}"


class WorkspaceStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._entries: dict[str, dict[str, Any]] = {}
        self._last_cleanup = 0.0
        self._expired_total = 0
        self._evicted_total = 0

    def _cleanup_locked(self, now: float) -> None:
        if now - self._last_cleanup < WORKSPACE_CLEANUP_INTERVAL_SECONDS and len(self._entries) <= MAX_WORKSPACES:
            return
        expired = [
            workspace_id
            for workspace_id, entry in self._entries.items()
            if now - float(entry["last_access"]) > WORKSPACE_TTL_SECONDS
        ]
        for workspace_id in expired:
            if self._entries.pop(workspace_id, None) is not None:
                self._expired_total += 1
        if len(self._entries) > MAX_WORKSPACES:
            ordered = sorted(self._entries.items(), key=lambda pair: float(pair[1]["last_access"]))
            for workspace_id, _entry in ordered[: len(self._entries) - MAX_WORKSPACES]:
                if self._entries.pop(workspace_id, None) is not None:
                    self._evicted_total += 1
        self._last_cleanup = now

    def _entry_locked(self, workspace_id: str) -> dict[str, Any]:
        now = time.monotonic()
        self._cleanup_locked(now)
        entry = self._entries.get(workspace_id)
        if entry is None:
            entry = {"state": _new_workspace_state(workspace_id), "last_access": now}
            self._entries[workspace_id] = entry
        else:
            entry["last_access"] = now
        return entry

    def snapshot(self, workspace_id: str) -> dict[str, Any]:
        with self._lock:
            return copy.deepcopy(self._entry_locked(workspace_id)["state"])

    def reset(self, workspace_id: str) -> dict[str, Any]:
        with self._lock:
            state = _new_workspace_state(workspace_id)
            _enforce_state_limits(state)
            self._entries[workspace_id] = {"state": state, "last_access": time.monotonic()}
            return copy.deepcopy(state)

    def mutate(self, workspace_id: str, mutation: Callable[[dict[str, Any]], Any]) -> Any:
        with self._lock:
            state = self._entry_locked(workspace_id)["state"]
            result = mutation(state)
            _stamp_enterprise_state(state, workspace_id)
            _enforce_state_limits(state)
            return copy.deepcopy(result)

    def stats(self) -> dict[str, int]:
        with self._lock:
            self._cleanup_locked(time.monotonic())
            return {
                "active_workspaces": len(self._entries),
                "max_workspaces": MAX_WORKSPACES,
                "ttl_seconds": WORKSPACE_TTL_SECONDS,
                "expired_total": self._expired_total,
                "evicted_total": self._evicted_total,
            }

    def active_count(self) -> int:
        return self.stats()["active_workspaces"]


_STORE = WorkspaceStore()


def reset(workspace_id: str) -> dict[str, Any]:
    return _STORE.reset(workspace_id)


def snapshot(workspace_id: str) -> dict[str, Any]:
    return _STORE.snapshot(workspace_id)


def workspace_stats() -> dict[str, int]:
    return _STORE.stats()


def mutate_state(workspace_id: str, mutation: Callable[[dict[str, Any]], Any]) -> Any:
    """Thread-safe workspace mutation used by enterprise services."""
    return _STORE.mutate(workspace_id, mutation)


def append_audit(
    workspace_id: str,
    *,
    actor: str,
    role: str,
    action: str,
    object_type: str,
    object_id: str,
    before: Any = None,
    after: Any = None,
    knowledge_version: str = "",
    demo_flag: bool = True,
) -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        event = {
            "id": f"audit-{uuid4().hex[:10]}",
            "actor": actor,
            "role": role,
            "action": action,
            "object_type": object_type,
            "object_id": object_id,
            "before": copy.deepcopy(before),
            "after": copy.deepcopy(after),
            "knowledge_version": knowledge_version,
            "demo_flag": demo_flag,
            "workspace_id": workspace_id,
            "created_at": datetime.now().isoformat(timespec="seconds"),
        }
        state.setdefault("audit_log", []).insert(0, event)
        return event
    return _STORE.mutate(workspace_id, mutation)


def advisors(workspace_id: str) -> list[dict[str, Any]]:
    return snapshot(workspace_id)["advisors"]


def get_advisor(workspace_id: str, advisor_id: str) -> dict[str, Any]:
    for item in advisors(workspace_id):
        if item["id"] == advisor_id:
            return item
    raise KeyError(f"Unknown advisor_id: {advisor_id}")


def update_advisor(workspace_id: str, advisor_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    allowed = {"audience", "style", "platforms", "model_focus"}

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for item in state["advisors"]:
            if item["id"] != advisor_id:
                continue
            before = copy.deepcopy(item)
            for key, value in patch.items():
                if key not in allowed:
                    continue
                if key == "platforms":
                    item[key] = [str(entry).strip() for entry in value if str(entry).strip()]
                else:
                    item[key] = str(value).strip()
            item["updated_at"] = datetime.now().isoformat(timespec="seconds")
            state.setdefault("audit_log", []).insert(0, {
                "id": f"audit-{uuid4().hex[:10]}",
                "actor": item.get("name") or "顾问演示用户",
                "role": "顾问空间",
                "action": "更新顾问画像",
                "object_type": "advisor",
                "object_id": advisor_id,
                "before": before,
                "after": copy.deepcopy(item),
                "knowledge_version": "",
                "verification_version": 0,
                "demo_flag": True,
                "workspace_id": workspace_id,
                "created_at": item["updated_at"],
            })
            return item
        raise KeyError(f"Unknown advisor_id: {advisor_id}")

    return _STORE.mutate(workspace_id, mutation)


def opportunities(workspace_id: str, *, include_done: bool = True) -> list[dict[str, Any]]:
    items = snapshot(workspace_id)["opportunities"]
    return items if include_done else [item for item in items if item["status"] != "done"]


def get_opportunity(workspace_id: str, opportunity_id: str) -> dict[str, Any]:
    for item in opportunities(workspace_id):
        if item["id"] == opportunity_id:
            return item
    raise KeyError(f"Unknown opportunity_id: {opportunity_id}")


def update_opportunity(workspace_id: str, opportunity_id: str, status: str) -> dict[str, Any]:
    allowed = {"pending", "later", "in_progress", "done"}
    if status not in allowed:
        raise ValueError(f"Unsupported opportunity status: {status}")

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for item in state["opportunities"]:
            if item["id"] == opportunity_id:
                item["status"] = status
                return item
        raise KeyError(f"Unknown opportunity_id: {opportunity_id}")

    return _STORE.mutate(workspace_id, mutation)


def followups(workspace_id: str) -> list[dict[str, Any]]:
    return snapshot(workspace_id)["followups"]


def add_followup_event(workspace_id: str, customer_id: str, event: dict[str, Any]) -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for item in state["followups"]:
            if item["customer_id"] != customer_id:
                continue
            advisor = next((advisor for advisor in state.get("advisors", []) if advisor.get("id") == item.get("advisor_id")), None)
            event_type = str(event.get("type") or "advisor_note")
            if event_type == "customer_message":
                actor = item.get("customer_name") or "客户"
            elif event_type in {"advisor_note", "advisor_sent", "test_drive_booked", "promise_created", "promise_completed"}:
                actor = (advisor or {}).get("name") or "顾问"
            else:
                actor = str(event.get("actor") or (advisor or {}).get("name") or "系统")
            if event_type == "advisor_sent":
                task_id = str(event.get("task_id") or "")
                variant_id = str(event.get("variant_id") or "")
                draft = next((draft for draft in state.get("drafts", []) if draft.get("task_id") == task_id and draft.get("variant_id") == variant_id), None)
                if not draft:
                    raise ValueError("发送前必须先保存当前已核验版本")
                if draft.get("verification_status") != "verified" or draft.get("compliance_status") != "verified":
                    raise ValueError("内容事实或合规状态已失效，重新核验后才能记录发送")
                if int(event.get("verification_version") or 0) != int(draft.get("verification_version") or 0):
                    raise ValueError("发送版本不是最新核验版本")
                if str(event.get("verification_token") or "") != str(draft.get("verification_token") or ""):
                    raise ValueError("发送核验凭证无效，请重新核验")
            stored = {
                "id": f"event-{uuid4().hex[:8]}",
                "type": event_type,
                "actor": actor,
                "time": datetime.now().strftime("今天 %H:%M"),
                "title": str(event.get("title") or "新增记录"),
                "content": str(event.get("content") or "").strip(),
                "status": str(event.get("status") or "completed"),
                "scheduled_at": str(event.get("scheduled_at") or "").strip(),
                "items": [str(value).strip() for value in event.get("items", []) if str(value).strip()],
                "notes": str(event.get("notes") or "").strip(),
                "source_label": str(event.get("source_label") or ("授权沟通 Demo" if event_type in {"customer_message", "advisor_sent"} else "人工补录" if event_type == "advisor_note" else "系统事件")),
                "sync_status": str(event.get("sync_status") or ("已同步" if event_type in {"customer_message", "advisor_sent"} else "本地记录")),
                "source_detail": str(event.get("source_detail") or "当前工作区"),
            }
            item["events"].append(stored)
            if stored["type"] == "test_drive_booked":
                item["stage"] = "已预约试驾"
                due = stored["scheduled_at"] or "预约时间前"
                item["next_action"] = "试驾前确认到店人数、携带物品与体验路线。"
                item["next_action_due"] = due
                for opportunity in state["opportunities"]:
                    customer = opportunity.get("customer")
                    if customer and customer.get("id") == customer_id:
                        customer["stage"] = "已预约试驾"
                        opportunity["status"] = "done"
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
                item["next_action"] = "根据客户最新回复确认具体问题，并推动下一步到店或试驾。"
                item["next_action_due"] = "24 小时内"
            state.setdefault("audit_log", []).insert(0, {
                "id": f"audit-{uuid4().hex[:10]}", "actor": actor, "role": "顾问空间",
                "action": f"记录客户沟通：{stored['type']}", "object_type": "followup", "object_id": customer_id,
                "before": None, "after": copy.deepcopy(stored), "knowledge_version": "", "verification_version": int(event.get("verification_version") or 0),
                "demo_flag": True, "workspace_id": workspace_id, "created_at": datetime.now().isoformat(timespec="seconds"),
            })
            return item
        raise KeyError(f"Unknown customer_id: {customer_id}")

    return _STORE.mutate(workspace_id, mutation)


def toggle_memory(workspace_id: str, customer_id: str, memory_id: str, active: bool) -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for item in state["followups"]:
            if item["customer_id"] != customer_id:
                continue
            for memory in item["memories"]:
                if memory["id"] == memory_id:
                    before = copy.deepcopy(memory)
                    memory["active"] = active
                    state.setdefault("audit_log", []).insert(0, {
                        "id": f"audit-{uuid4().hex[:10]}",
                        "actor": "顾问演示用户",
                        "role": "顾问空间",
                        "action": "启用客户记忆" if active else "停用客户记忆",
                        "object_type": "memory",
                        "object_id": memory_id,
                        "before": before,
                        "after": copy.deepcopy(memory),
                        "knowledge_version": "",
                        "verification_version": 0,
                        "demo_flag": True,
                        "workspace_id": workspace_id,
                        "created_at": datetime.now().isoformat(timespec="seconds"),
                    })
                    return memory
        raise KeyError(f"Unknown memory_id: {memory_id}")

    return _STORE.mutate(workspace_id, mutation)


def reviews(workspace_id: str) -> list[dict[str, Any]]:
    return snapshot(workspace_id)["reviews"]


def decide_review(workspace_id: str, review_id: str, decision: str, reason: str, changes: dict[str, Any] | None = None) -> dict[str, Any]:
    if decision not in {"approved", "returned"}:
        raise ValueError("decision must be approved or returned")
    changes = changes or {}

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for item in state["reviews"]:
            if item["id"] != review_id:
                continue
            before = {"body": item.get("reviewed_body", item.get("body", "")), "call_to_action": item.get("reviewed_call_to_action", item.get("call_to_action", ""))}
            body = str(changes.get("body") if changes.get("body") is not None else before["body"])
            cta = str(changes.get("call_to_action") if changes.get("call_to_action") is not None else before["call_to_action"])
            before_risks = copy.deepcopy(item.get("risk_annotations", []))
            risks = copy.deepcopy(changes.get("risk_annotations")) if changes.get("risk_annotations") is not None else before_risks
            content_changed = body != before["body"] or cta != before["call_to_action"] or risks != before_risks
            if content_changed:
                item["reviewed_body"] = body
                item["reviewed_call_to_action"] = cta
                item["risk_annotations"] = risks
                item["verification_status"] = "needs_revalidation"
                item["compliance_status"] = "needs_revalidation"
                item["evidence_status"] = "需要重新核验"
                item.setdefault("version_history", []).append({
                    "type": "manager_edit",
                    "at": datetime.now().isoformat(timespec="seconds"),
                    "body": body,
                    "call_to_action": cta,
                })
            if decision == "approved":
                if item.get("verification_status") != "verified" or item.get("compliance_status") != "verified":
                    raise ValueError("经理修改后的内容必须重新核验，不能直接批准")
                valid = verify_verification_token(
                    item.get("verification_token"), task_id=item.get("task_id", ""), variant_id=item.get("variant_id", ""),
                    platform=item.get("platform", ""), title=item.get("content_title", ""), body=item.get("reviewed_body", ""),
                    call_to_action=item.get("reviewed_call_to_action", ""), verification_version=int(item.get("verification_version") or 0),
                    knowledge_version=item.get("knowledge_version", ""),
                )
                if not valid:
                    raise ValueError("审核内容不是最新核验版本，不能批准")
            item["status"] = decision
            item["decision_reason"] = reason.strip()
            item["decision_at"] = datetime.now().isoformat(timespec="seconds")
            item.setdefault("change_log", []).append({
                "at": item["decision_at"],
                "decision": decision,
                "reason": item["decision_reason"],
                "body_changed": body != before["body"],
                "cta_changed": cta != before["call_to_action"],
                "risk_annotations_changed": risks != before_risks,
            })
            state.setdefault("audit_log", []).insert(0, {
                "id": f"audit-{uuid4().hex[:10]}", "actor": "门店经理 Demo", "role": "门店经理空间",
                "action": "批准内容" if decision == "approved" else "退回内容", "object_type": "review", "object_id": review_id,
                "before": before, "after": {"status": decision, "reason": reason}, "knowledge_version": item.get("knowledge_version", ""),
                "demo_flag": True, "workspace_id": workspace_id, "created_at": item["decision_at"],
            })
            return item
        raise KeyError(f"Unknown review_id: {review_id}")

    return _STORE.mutate(workspace_id, mutation)


def campaigns(workspace_id: str) -> list[dict[str, Any]]:
    return snapshot(workspace_id)["campaigns"]


def get_campaign(workspace_id: str, campaign_id: str) -> dict[str, Any]:
    for item in campaigns(workspace_id):
        if item["id"] == campaign_id:
            return item
    raise KeyError(f"Unknown campaign_id: {campaign_id}")


def _task_summary(tasks: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "total": len(tasks),
        "ready": sum(1 for task in tasks if task.get("status") in {"ready", "submitted"}),
        "pending_review": sum(1 for task in tasks if task.get("status") == "needs_review"),
        "failed": sum(1 for task in tasks if task.get("status") == "failed"),
    }


def update_campaign_run(workspace_id: str, campaign_id: str, tasks: list[dict[str, Any]]) -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for item in state["campaigns"]:
            if item["id"] == campaign_id:
                item["status"] = "completed"
                item["tasks"] = tasks
                item["task_summary"] = _task_summary(tasks)
                item["last_run"] = datetime.now().strftime("今天 %H:%M")
                return item
        raise KeyError(f"Unknown campaign_id: {campaign_id}")

    return _STORE.mutate(workspace_id, mutation)


def update_campaign_task(workspace_id: str, campaign_id: str, task_id: str, task: dict[str, Any]) -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for campaign in state["campaigns"]:
            if campaign["id"] != campaign_id:
                continue
            tasks = campaign.setdefault("tasks", [])
            for index, existing in enumerate(tasks):
                if existing["id"] == task_id:
                    tasks[index] = task
                    break
            else:
                tasks.append(task)
            campaign["task_summary"] = _task_summary(tasks)
            campaign["last_run"] = datetime.now().strftime("今天 %H:%M")
            return campaign
        raise KeyError(f"Unknown campaign_id: {campaign_id}")

    return _STORE.mutate(workspace_id, mutation)


def save_draft(workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    stored = {
        "id": str(payload.get("id") or f"draft-{uuid4().hex[:10]}"),
        "task_id": str(payload.get("task_id") or ""),
        "variant_id": str(payload.get("variant_id") or ""),
        "platform": str(payload.get("platform") or ""),
        "title": str(payload.get("title") or ""),
        "body": str(payload.get("body") or ""),
        "call_to_action": str(payload.get("call_to_action") or ""),
        "claims": copy.deepcopy(payload.get("claims") or []),
        "risk_annotations": copy.deepcopy(payload.get("risk_annotations") or []),
        "evidence": copy.deepcopy(payload.get("evidence") or []),
        "status": str(payload.get("status") or "draft"),
        "verification_status": str(payload.get("verification_status") or "verified"),
        "compliance_status": str(payload.get("compliance_status") or payload.get("verification_status") or "verified"),
        "knowledge_version": str(payload.get("knowledge_version") or "onvo-cn-2026.07.18"),
        "verification_version": int(payload.get("verification_version") or 1),
        "verified_at": str(payload.get("verified_at") or datetime.now().isoformat(timespec="seconds")),
        "verification_token": str(payload.get("verification_token") or ""),
        "version_history": copy.deepcopy(payload.get("version_history") or []),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }

    if stored["verification_status"] == "verified":
        valid = verify_verification_token(
            stored.get("verification_token"), task_id=stored["task_id"], variant_id=stored["variant_id"],
            platform=stored["platform"], title=stored["title"], body=stored["body"], call_to_action=stored["call_to_action"],
            verification_version=stored["verification_version"], knowledge_version=stored["knowledge_version"],
        )
        if not valid:
            raise ValueError("核验凭证无效或内容已变化，请重新核验后保存")

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        before = None
        for index, item in enumerate(state["drafts"]):
            if item["task_id"] == stored["task_id"] and item["variant_id"] == stored["variant_id"]:
                before = copy.deepcopy(item)
                stored["id"] = item["id"]
                state["drafts"][index] = stored
                break
        else:
            state["drafts"].append(stored)
        state.setdefault("audit_log", []).insert(0, {
            "id": f"audit-{uuid4().hex[:10]}",
            "actor": "顾问演示用户",
            "role": "顾问空间",
            "action": "保存已核验内容" if stored["verification_status"] == "verified" else "保存待重新核验草稿",
            "object_type": "draft",
            "object_id": stored["id"],
            "before": before,
            "after": copy.deepcopy(stored),
            "knowledge_version": stored.get("knowledge_version", ""),
            "verification_version": stored.get("verification_version", 0),
            "demo_flag": True,
            "workspace_id": workspace_id,
            "created_at": stored["updated_at"],
        })
        return stored

    return _STORE.mutate(workspace_id, mutation)


def submit_review(workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if str(payload.get("verification_status") or "") != "verified" or str(payload.get("compliance_status") or "") != "verified":
        raise ValueError("内容已发生变化，必须重新核验后才能提交审核")
    current = snapshot(workspace_id)
    existing = next((item for item in current.get("drafts", []) if item.get("task_id") == payload.get("task_id") and item.get("variant_id") == payload.get("variant_id")), None)
    if not existing:
        raise ValueError("提交审核前必须先保存当前已核验版本")
    for field in ["platform", "title", "body", "call_to_action", "verification_version", "verification_token"]:
        if str(existing.get(field, "")) != str(payload.get(field, "")):
            raise ValueError("提交内容与最近保存的核验版本不一致，请重新保存并核验")
    draft = save_draft(workspace_id, {**payload, "status": "submitted"})
    review = _normalize_review({
        "id": f"review-{uuid4().hex[:8]}",
        "task_id": draft["task_id"],
        "variant_id": draft["variant_id"],
        "title": f"{payload.get('campaign_name') or '内容任务'} · {draft['platform']}",
        "content_title": draft["title"],
        "advisor_id": str(payload.get("advisor_id") or ""),
        "advisor_name": str(payload.get("advisor_name") or ""),
        "vehicle_id": str(payload.get("vehicle_id") or ""),
        "platform": draft["platform"],
        "status": "pending",
        "risk_level": str(payload.get("risk_level") or "low"),
        "reason": str(payload.get("reason") or "事实与风险已完成自动预检，等待门店经理确认。"),
        "body": draft["body"],
        "call_to_action": draft["call_to_action"],
        "claims": draft["claims"],
        "risk_annotations": draft["risk_annotations"],
        "evidence": draft["evidence"],
        "evidence_status": str(payload.get("evidence_status") or "已绑定"),
        "submitted_at": datetime.now().strftime("今天 %H:%M"),
        "decision_reason": "",
        "verification_status": draft.get("verification_status", "verified"),
        "compliance_status": draft.get("compliance_status", "verified"),
        "knowledge_version": draft.get("knowledge_version", "onvo-cn-2026.07.18"),
        "verification_version": draft.get("verification_version", 1),
        "verified_at": draft.get("verified_at", ""),
        "verification_token": draft.get("verification_token", ""),
        "version_history": draft.get("version_history", []),
    })

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        state["reviews"].insert(0, review)
        state.setdefault("audit_log", []).insert(0, {
            "id": f"audit-{uuid4().hex[:10]}",
            "actor": review.get("advisor_name") or "顾问演示用户",
            "role": "顾问空间",
            "action": "提交内容审核",
            "object_type": "review",
            "object_id": review["id"],
            "before": None,
            "after": copy.deepcopy(review),
            "knowledge_version": review.get("knowledge_version", ""),
            "verification_version": review.get("verification_version", 0),
            "demo_flag": True,
            "workspace_id": workspace_id,
            "created_at": datetime.now().isoformat(timespec="seconds"),
        })
        return review

    return _STORE.mutate(workspace_id, mutation)
