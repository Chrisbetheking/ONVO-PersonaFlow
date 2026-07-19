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

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WORKSPACE_FILE = DATA_DIR / "workspace.json"
ADVISORS_FILE = DATA_DIR / "advisors.json"
ENTERPRISE_FILE = DATA_DIR / "enterprise.json"
WORKSPACE_TTL_SECONDS = max(300, int(os.getenv("WORKSPACE_TTL_SECONDS", "21600")))
WORKSPACE_CLEANUP_INTERVAL_SECONDS = max(30, int(os.getenv("WORKSPACE_CLEANUP_INTERVAL_SECONDS", "300")))
MAX_WORKSPACES = max(20, int(os.getenv("MAX_WORKSPACES", "5000")))
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
    normalized.setdefault("version_history", [])
    return normalized


def _normalize_campaign(item: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(item)
    normalized.setdefault("tasks", [])
    normalized.setdefault("task_summary", {"total": 0, "ready": 0, "pending_review": 0, "failed": 0})
    return normalized


def _load_initial() -> dict[str, Any]:
    state = _read_json(WORKSPACE_FILE)
    state["advisors"] = _read_json(ADVISORS_FILE)
    enterprise = _read_json(ENTERPRISE_FILE)
    for key, value in enterprise.items():
        state.setdefault(key, value)
    state.setdefault("drafts", [])
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


def _new_workspace_state(workspace_id: str) -> dict[str, Any]:
    state = copy.deepcopy(_INITIAL_STATE)
    _stamp_enterprise_state(state, workspace_id)
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

    def _cleanup_locked(self, now: float) -> None:
        if now - self._last_cleanup < WORKSPACE_CLEANUP_INTERVAL_SECONDS and len(self._entries) <= MAX_WORKSPACES:
            return
        expired = [
            workspace_id
            for workspace_id, entry in self._entries.items()
            if now - float(entry["last_access"]) > WORKSPACE_TTL_SECONDS
        ]
        for workspace_id in expired:
            self._entries.pop(workspace_id, None)
        if len(self._entries) > MAX_WORKSPACES:
            ordered = sorted(self._entries.items(), key=lambda pair: float(pair[1]["last_access"]))
            for workspace_id, _entry in ordered[: len(self._entries) - MAX_WORKSPACES]:
                self._entries.pop(workspace_id, None)
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
            self._entries[workspace_id] = {"state": _new_workspace_state(workspace_id), "last_access": time.monotonic()}
            return copy.deepcopy(self._entries[workspace_id]["state"])

    def mutate(self, workspace_id: str, mutation: Callable[[dict[str, Any]], Any]) -> Any:
        with self._lock:
            state = self._entry_locked(workspace_id)["state"]
            result = mutation(state)
            _stamp_enterprise_state(state, workspace_id)
            return copy.deepcopy(result)

    def active_count(self) -> int:
        with self._lock:
            self._cleanup_locked(time.monotonic())
            return len(self._entries)


_STORE = WorkspaceStore()


def reset(workspace_id: str) -> dict[str, Any]:
    return _STORE.reset(workspace_id)


def snapshot(workspace_id: str) -> dict[str, Any]:
    return _STORE.snapshot(workspace_id)


def workspace_stats() -> dict[str, int]:
    return {"active_workspaces": _STORE.active_count(), "ttl_seconds": WORKSPACE_TTL_SECONDS}


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
            for key, value in patch.items():
                if key not in allowed:
                    continue
                if key == "platforms":
                    item[key] = [str(entry).strip() for entry in value if str(entry).strip()]
                else:
                    item[key] = str(value).strip()
            item["updated_at"] = datetime.now().isoformat(timespec="seconds")
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
                    memory["active"] = active
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
            if decision == "approved" and item.get("verification_status") != "verified":
                raise ValueError("经理修改后的内容必须重新核验，不能直接批准")
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
        "version_history": copy.deepcopy(payload.get("version_history") or []),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        for index, item in enumerate(state["drafts"]):
            if item["task_id"] == stored["task_id"] and item["variant_id"] == stored["variant_id"]:
                stored["id"] = item["id"]
                state["drafts"][index] = stored
                return stored
        state["drafts"].append(stored)
        return stored

    return _STORE.mutate(workspace_id, mutation)


def submit_review(workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if str(payload.get("verification_status") or "verified") != "verified":
        raise ValueError("内容已发生变化，必须重新核验后才能提交审核")
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
        "version_history": draft.get("version_history", []),
    })

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        state["reviews"].insert(0, review)
        return review

    return _STORE.mutate(workspace_id, mutation)
