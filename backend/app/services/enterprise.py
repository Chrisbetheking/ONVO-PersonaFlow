from __future__ import annotations

import copy
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from .integrations import adapter_statuses, run_demo_sync
from .workspace import append_audit, get_advisor, mutate_state, reset, snapshot


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _find(items: list[dict[str, Any]], item_id: str, label: str) -> dict[str, Any]:
    for item in items:
        if item.get("id") == item_id:
            return item
    raise KeyError(f"Unknown {label}: {item_id}")


def _audit_event(state: dict[str, Any], workspace_id: str, *, actor: str, role: str, action: str, object_type: str, object_id: str, before: Any = None, after: Any = None, knowledge_version: str = "", verification_version: int = 0) -> None:
    state.setdefault("audit_log", []).insert(0, {
        "id": f"audit-{uuid4().hex[:10]}", "actor": actor, "role": role, "action": action,
        "object_type": object_type, "object_id": object_id, "before": copy.deepcopy(before), "after": copy.deepcopy(after),
        "knowledge_version": knowledge_version, "verification_version": verification_version, "demo_flag": True,
        "workspace_id": workspace_id, "created_at": _now(),
    })


def _append_followup_event(state: dict[str, Any], customer_id: str, *, event_type: str, actor: str, title: str, content: str, status: str = "completed", source_label: str = "系统事件") -> None:
    followup = next((item for item in state.get("followups", []) if item.get("customer_id") == customer_id), None)
    if not followup:
        return
    followup.setdefault("events", []).append({
        "id": f"event-{uuid4().hex[:8]}", "type": event_type, "actor": actor, "time": datetime.now().strftime("今天 %H:%M"),
        "title": title, "content": content, "status": status, "source_label": source_label,
        "sync_status": "本地记录", "source_detail": "当前 workspace",
    })


def enterprise_snapshot(workspace_id: str) -> dict[str, Any]:
    state = snapshot(workspace_id)
    keys = [
        "enterprise_meta", "hotspots", "knowledge_items", "knowledge_impacts", "sync_events",
        "customer_profiles", "promises", "quality_signals", "coaching_plans", "best_practices",
        "customer_risks", "experiments", "notifications", "approvals", "revalidation_tasks",
        "audit_log", "demo_scenarios",
    ]
    result = {key: state.get(key, [] if key != "enterprise_meta" else {}) for key in keys}
    result["integrations"] = adapter_statuses()
    result["data_mode"] = "demo"
    return result


def switch_role(workspace_id: str, role: str, actor_id: str | None = None) -> dict[str, Any]:
    allowed = {"advisor", "manager", "hq"}
    if role not in allowed:
        raise ValueError("role must be advisor, manager or hq")

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        before = copy.deepcopy(state["enterprise_meta"])
        state["enterprise_meta"]["current_role"] = role
        if actor_id:
            state["enterprise_meta"]["current_actor_id"] = actor_id
        state["enterprise_meta"]["updated_at"] = _now()
        state.setdefault("audit_log", []).insert(0, {
            "id": f"audit-{uuid4().hex[:10]}", "actor": actor_id or "角色演示用户", "role": role,
            "action": "切换角色空间", "object_type": "workspace_role", "object_id": role,
            "before": before, "after": copy.deepcopy(state["enterprise_meta"]), "knowledge_version": "",
            "demo_flag": True, "workspace_id": workspace_id, "created_at": _now(),
        })
        return state["enterprise_meta"]
    return mutate_state(workspace_id, mutation)


def list_hotspots(workspace_id: str) -> list[dict[str, Any]]:
    return enterprise_snapshot(workspace_id)["hotspots"]


def get_hotspot(workspace_id: str, hotspot_id: str) -> dict[str, Any]:
    return _find(list_hotspots(workspace_id), hotspot_id, "hotspot")


def hotspot_action(workspace_id: str, hotspot_id: str, action: str, reason: str = "") -> dict[str, Any]:
    allowed = {"content_task", "customer_outreach", "knowledge_draft", "coaching", "manager_review", "campaign", "customer_segment", "ignore"}
    if action not in allowed:
        raise ValueError("Unsupported hotspot action")

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        hotspot = _find(state["hotspots"], hotspot_id, "hotspot")
        created_id = f"{action}-{uuid4().hex[:8]}"
        if action == "content_task":
            state["opportunities"].insert(0, {
                "id": created_id, "kind": "topic", "priority": "high", "status": "pending",
                "title": f"热点任务 · {hotspot['title']}", "source": "热点雷达 Demo", "why_now": hotspot["recommended_action"],
                "signal": hotspot["source_label"], "recommended_action": "生成有依据的场景解释内容并提交审核。",
                "due_label": "24 小时内", "advisor_id": "advisor-hz-02", "vehicle_id": hotspot["vehicle_ids"][0],
                "campaign_id": None, "customer": None,
            })
        elif action == "customer_outreach":
            state.setdefault("revalidation_tasks", []).append({"id": created_id, "type": "customer_outreach", "title": hotspot["title"], "status": "pending", "owner": hotspot["owner"], "demo_flag": True, "created_at": _now()})
        elif action == "knowledge_draft":
            state["knowledge_items"].append({
                "id": created_id, "title": f"草稿：{hotspot['title']}", "type": "FAQ", "content": hotspot["recommended_action"],
                "source": "热点雷达 Demo", "source_url": f"demo://hotspot/{hotspot_id}", "vehicle_ids": hotspot["vehicle_ids"],
                "regions": ["全国"], "effective_at": "", "expires_at": "", "version": "0.1", "status": "草稿",
                "created_by": hotspot["owner"], "reviewed_by": "", "updated_at": _now(), "replacement_id": "",
                "linked_content_count": 0, "linked_customer_count": 0, "demo_flag": True,
                "versions": [{"id": f"kv-{uuid4().hex[:8]}", "version": "0.1", "content": hotspot["recommended_action"], "status": "draft", "created_at": _now(), "source": "热点雷达 Demo", "created_by": hotspot["owner"]}],
            })
        elif action == "campaign":
            state.setdefault("campaigns", []).insert(0, {
                "id": created_id,
                "name": f"热点活动 · {hotspot['title']}",
                "vehicle_id": hotspot["vehicle_ids"][0],
                "brief": hotspot["recommended_action"],
                "status": "draft",
                "target_advisors": ["advisor-hz-02"],
                "platforms": ["朋友圈", "小红书"],
                "tasks": [],
                "task_summary": {"total": 0, "ready": 0, "pending_review": 0, "failed": 0},
                "created_at": _now(),
                "source": "热点雷达 Demo",
                "demo_flag": True,
            })
        elif action == "customer_segment":
            state.setdefault("customer_segments", []).insert(0, {
                "id": created_id,
                "name": f"热点客群 · {hotspot['title']}",
                "hotspot_id": hotspot_id,
                "customer_ids": [item.get("id") for item in state.get("customer_profiles", [])[:3]],
                "criteria": hotspot.get("audiences", []),
                "status": "ready",
                "created_at": _now(),
                "demo_flag": True,
            })
        elif action in {"coaching", "manager_review"}:
            state.setdefault("quality_signals", []).append({
                "id": created_id, "advisor_id": "advisor-hz-02", "customer_id": "", "category": "客户理解",
                "risk_level": "medium", "status": "pending_review", "original_message": hotspot["title"],
                "trigger_rule": "热点雷达转人工复核", "system_explanation": hotspot["recommended_action"], "fact_ids": [],
                "repeat_count": 1, "employee_response": "", "manager_decision": "", "decision_reason": "", "created_at": _now(), "demo_flag": True,
            })
        hotspot.setdefault("created_task_ids", []).append(created_id)
        hotspot["status"] = "已忽略" if action == "ignore" else "已转任务"
        hotspot["last_action"] = {"action": action, "reason": reason, "created_id": created_id, "at": _now()}
        state.setdefault("audit_log", []).insert(0, {
            "id": f"audit-{uuid4().hex[:10]}", "actor": "总部运营 Demo", "role": "总部运营空间", "action": f"热点处理：{action}",
            "object_type": "hotspot", "object_id": hotspot_id, "before": None, "after": hotspot["last_action"],
            "knowledge_version": "", "demo_flag": True, "workspace_id": workspace_id, "created_at": _now(),
        })
        return {"hotspot": hotspot, "created_id": created_id}
    return mutate_state(workspace_id, mutation)


def list_knowledge(workspace_id: str) -> list[dict[str, Any]]:
    return enterprise_snapshot(workspace_id)["knowledge_items"]


def get_knowledge(workspace_id: str, knowledge_id: str) -> dict[str, Any]:
    return _find(list_knowledge(workspace_id), knowledge_id, "knowledge")


def simulate_feishu_change(workspace_id: str, change_type: str) -> dict[str, Any]:
    change_map = {
        "l80_price": ("knowledge-l80-positioning", "整车购买价格口径", "24.28 万元起", "具体价格以发布当天官方页面为准"),
        "campaign_end": ("knowledge-l80-positioning", "活动结束日期", "2026-07-31", "2026-07-28"),
        "regional_benefit": ("knowledge-l80-positioning", "区域权益", "未记录", "杭州区域权益须由门店当天确认"),
        "retire_script": ("knowledge-compliance-absolute", "旧销售口径", "可直接承诺不会变化", "动态事实必须核验后表达"),
        "compliance": ("knowledge-compliance-absolute", "合规要求", "动态事实带时效说明", "动态事实需绑定知识版本、来源和核验时间"),
    }
    if change_type not in change_map:
        raise ValueError("Unsupported Feishu demo change")
    knowledge_id, field, before, after = change_map[change_type]

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        item = _find(state["knowledge_items"], knowledge_id, "knowledge")
        old_version = item["version"]
        try:
            major, minor = old_version.split(".", 1)
            new_version = f"{major}.{int(minor)+1}"
        except Exception:
            new_version = f"{old_version}.1"
        for version in item.get("versions", []):
            if version.get("status") == "current":
                version["status"] = "superseded"
        content = item["content"] + f"\n\n变更：{field}从“{before}”调整为“{after}”。"
        version_entry = {"id": f"kv-{uuid4().hex[:8]}", "version": new_version, "content": content, "status": "current", "created_at": _now(), "source": "飞书知识 Demo Adapter", "created_by": "总部运营 Demo"}
        item["versions"].insert(0, version_entry)
        item["version"] = new_version
        item["content"] = content
        item["updated_at"] = _now()
        impact = {
            "id": f"impact-{uuid4().hex[:8]}", "knowledge_id": knowledge_id, "knowledge_title": item["title"],
            "from_version": old_version, "to_version": new_version, "change_field": field, "before": before, "after": after,
            "summary": f"{field}从 {before} 调整为 {after}",
            "affected": {"pending_contents": 12, "pending_reviews": 3, "customers": 18, "advisor_tasks": 4, "campaigns": 1},
            "objects": [
                {"id":"review-l80-001","type":"待审核内容","title":"L80 家庭体验活动 · 朋友圈","status":"needs_revalidation","owner":"周辰"},
                {"id":"customer-chen","type":"客户任务","title":"陈女士价格与活动更新","status":"pending","owner":"周辰"},
                {"id":"camp-l80-family","type":"批量活动","title":"L80 家庭空间体验周","status":"frozen","owner":"总部运营"},
            ],
            "status": "pending", "created_at": _now(), "demo_flag": True,
        }
        state.setdefault("knowledge_impacts", []).insert(0, impact)
        for obj in impact["objects"]:
            state.setdefault("revalidation_tasks", []).append({"id": f"reval-{uuid4().hex[:8]}", "impact_id": impact["id"], "object_id": obj["id"], "object_type": obj["type"], "title": obj["title"], "status": "pending", "owner": obj["owner"], "created_at": _now(), "demo_flag": True})
        for review in state.get("reviews", []):
            if review.get("vehicle_id") in item.get("vehicle_ids", []) and review.get("status") in {"pending", "needs_revision"}:
                review["verification_status"] = "needs_revalidation"
                review["compliance_status"] = "needs_revalidation"
                review["evidence_status"] = "知识变更后需要重新核验"
        notification = {"id": f"notice-{uuid4().hex[:8]}", "channel": "飞书机器人 Demo", "title": f"知识版本已更新：{item['title']}", "body": f"发现 {impact['affected']['pending_contents']} 条待发布内容和 {impact['affected']['customers']} 位客户可能受影响。", "status": "preview", "created_at": _now(), "demo_flag": True}
        approval = {"id": f"approval-{uuid4().hex[:8]}", "type": "飞书审批 Demo", "title": f"确认知识版本 {new_version}", "status": "pending", "requester": "总部运营 Demo", "created_at": _now(), "demo_flag": True}
        state.setdefault("notifications", []).insert(0, notification)
        state.setdefault("approvals", []).insert(0, approval)
        sync = run_demo_sync("feishu", {"change_type": change_type})
        state.setdefault("sync_events", []).insert(0, sync)
        state.setdefault("audit_log", []).insert(0, {
            "id": f"audit-{uuid4().hex[:10]}", "actor": "飞书 Demo Adapter", "role": "总部运营空间", "action": "创建知识新版本并执行影响分析",
            "object_type": "knowledge", "object_id": knowledge_id, "before": {"version": old_version, field: before}, "after": {"version": new_version, field: after},
            "knowledge_version": new_version, "demo_flag": True, "workspace_id": workspace_id, "created_at": _now(),
        })
        return {"knowledge": item, "impact": impact, "notification": notification, "approval": approval, "sync_event": sync}
    return mutate_state(workspace_id, mutation)


def impact_action(workspace_id: str, impact_id: str, object_id: str, action: str, reason: str = "", owner: str = "") -> dict[str, Any]:
    if action not in {"view", "revalidate", "bulk_update", "assign", "ignore"}:
        raise ValueError("Unsupported impact action")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        impact = _find(state["knowledge_impacts"], impact_id, "impact")
        obj = _find(impact["objects"], object_id, "impact object")
        obj["last_action"] = action
        if action == "revalidate": obj["status"] = "revalidated"
        elif action == "bulk_update": obj["status"] = "updated"
        elif action == "assign": obj["owner"] = owner or obj.get("owner") or "待分配"; obj["status"] = "assigned"
        elif action == "ignore": obj["status"] = "ignored"; obj["ignore_reason"] = reason
        impact["status"] = "in_progress" if any(item.get("status") not in {"revalidated", "updated", "ignored"} for item in impact["objects"]) else "completed"
        return impact
    return mutate_state(workspace_id, mutation)


def list_customers(workspace_id: str) -> list[dict[str, Any]]:
    return enterprise_snapshot(workspace_id)["customer_profiles"]


def customer_action(workspace_id: str, customer_id: str, action_id: str, action: str, note: str = "") -> dict[str, Any]:
    allowed = {"accept", "modify", "delay", "ignore", "escalate", "complete"}
    if action not in allowed:
        raise ValueError("Unsupported customer action")
    if action in {"modify", "delay", "ignore", "escalate"} and not note.strip():
        raise ValueError("该操作需要填写原因或说明")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        customer = _find(state["customer_profiles"], customer_id, "customer")
        next_action = _find(customer["next_best_actions"], action_id, "next best action")
        before = copy.deepcopy(next_action)
        next_action["status"] = {"accept":"accepted","modify":"modified","delay":"delayed","ignore":"ignored","escalate":"escalated","complete":"completed"}[action]
        next_action["note"] = note
        next_action["updated_at"] = _now()
        _append_followup_event(state, customer_id, event_type="next_best_action", actor="顾问演示用户", title=f"下一最佳行动：{action}", content=f"{next_action['action']}。{note}".strip(), source_label="客户 360")
        _audit_event(state, workspace_id, actor="顾问演示用户", role="顾问空间", action=f"下一最佳行动：{action}", object_type="next_best_action", object_id=action_id, before=before, after=next_action)
        return customer
    return mutate_state(workspace_id, mutation)


def list_promises(workspace_id: str) -> list[dict[str, Any]]:
    return enterprise_snapshot(workspace_id)["promises"]


def create_promise(workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    customer_id = str(payload.get("customer_id") or "")
    if not customer_id:
        raise ValueError("customer_id is required")

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        customer = _find(state["customer_profiles"], customer_id, "customer")
        advisor_id = str(customer.get("advisor_id") or "")
        advisor = _find(state["advisors"], advisor_id, "advisor")
        promise = {
            "id": f"promise-{uuid4().hex[:8]}",
            "customer_id": customer_id,
            "advisor_id": advisor_id,
            "original_message": str(payload.get("original_message") or payload.get("commitment") or ""),
            "source_event_id": str(payload.get("source_event_id") or ""),
            "commitment": str(payload.get("commitment") or ""),
            "due_at": str(payload.get("due_at") or ""),
            "completion_criteria": str(payload.get("completion_criteria") or "顾问确认完成"),
            "status": "pending_confirmation",
            "source": str(payload.get("source") or "手动创建 Demo"),
            "created_at": _now(),
            "remind_at": str(payload.get("remind_at") or ""),
            "overdue": False,
            "manager_attention": False,
            "evidence": [],
            "demo_flag": True,
        }
        if not promise["commitment"].strip() or not promise["due_at"].strip():
            raise ValueError("承诺事项和截止时间不能为空")
        state["promises"].insert(0, promise)
        _append_followup_event(
            state,
            customer_id,
            event_type="promise_created",
            actor=advisor["name"],
            title="沟通内容已转为待确认承诺",
            content=promise["commitment"],
            status="pending_confirmation",
            source_label=promise["source"],
        )
        _audit_event(
            state,
            workspace_id,
            actor=advisor["name"],
            role="顾问空间",
            action="创建客户承诺",
            object_type="promise",
            object_id=promise["id"],
            after=promise,
        )
        return promise

    return mutate_state(workspace_id, mutation)


def update_promise(workspace_id: str, promise_id: str, action: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    allowed = {"confirm", "reschedule", "complete", "delay", "cancel", "request_manager", "manager_remind", "dismiss"}
    if action not in allowed:
        raise ValueError("Unsupported promise action")
    if action in {"reschedule", "delay", "cancel"} and not str(payload.get("reason") or "").strip():
        raise ValueError("修改、延期或取消承诺时必须填写原因")
    if action == "reschedule" and not str(payload.get("due_at") or "").strip():
        raise ValueError("改期必须填写新的截止时间")
    if action == "complete" and not str(payload.get("evidence") or "").strip():
        raise ValueError("标记完成必须填写完成证据或备注")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        promise = _find(state["promises"], promise_id, "promise")
        before = copy.deepcopy(promise)
        advisor = get_advisor(workspace_id, promise["advisor_id"])
        if action == "confirm": promise["status"] = "pending_execution"
        elif action == "reschedule":
            promise["due_at"] = str(payload.get("due_at")); promise["reschedule_reason"] = str(payload.get("reason")); promise["status"] = "pending_execution"
        elif action == "complete":
            promise["status"] = "completed"; promise["completed_at"] = _now(); promise["overdue"] = False; promise["manager_attention"] = False; promise["evidence"].append(str(payload.get("evidence")))
        elif action == "delay": promise["status"] = "delayed"; promise["delay_reason"] = str(payload.get("reason"))
        elif action == "cancel": promise["status"] = "cancelled"; promise["cancel_reason"] = str(payload.get("reason"))
        elif action == "request_manager": promise["manager_attention"] = True; promise["manager_attention_reason"] = str(payload.get("reason") or "顾问请求协助")
        elif action == "manager_remind":
            promise["manager_attention"] = True
            state.setdefault("notifications", []).insert(0, {"id":f"notice-{uuid4().hex[:8]}","channel":"飞书机器人 Demo","title":"经理提醒：客户承诺待处理","body":promise["commitment"],"status":"preview","created_at":_now(),"demo_flag":True})
        elif action == "dismiss": promise["manager_attention"] = False
        promise["updated_at"] = _now()
        label = {"confirm":"确认承诺","reschedule":"调整承诺截止时间","complete":"完成承诺","delay":"延期承诺","cancel":"取消承诺","request_manager":"请求经理协助","manager_remind":"经理提醒","dismiss":"经理确认无需处理"}[action]
        _append_followup_event(state, promise["customer_id"], event_type="promise_completed" if action == "complete" else "promise_updated", actor=advisor["name"] if action not in {"manager_remind", "dismiss"} else "门店经理 Demo", title=label, content=f"{promise['commitment']} · {payload.get('reason') or payload.get('evidence') or ''}".strip(" ·"), source_label="承诺台账")
        if action == "request_manager":
            state.setdefault("quality_signals", []).insert(0, {"id":f"quality-{uuid4().hex[:8]}","advisor_id":promise["advisor_id"],"customer_id":promise["customer_id"],"category":"承诺履约","risk_level":"medium","status":"pending_review","original_message":promise["original_message"],"trigger_rule":"顾问请求经理协助","system_explanation":promise["manager_attention_reason"],"fact_ids":[],"repeat_count":1,"employee_response":"","manager_decision":"","decision_reason":"","created_at":_now(),"demo_flag":True})
        _audit_event(state, workspace_id, actor=advisor["name"] if action not in {"manager_remind", "dismiss"} else "门店经理 Demo", role="顾问空间" if action not in {"manager_remind", "dismiss"} else "门店经理空间", action=label, object_type="promise", object_id=promise_id, before=before, after=promise)
        return promise
    return mutate_state(workspace_id, mutation)


def simulate_promise_time(workspace_id: str, promise_id: str, state_name: str) -> dict[str, Any]:
    if state_name not in {"due_soon", "overdue"}:
        raise ValueError("state must be due_soon or overdue")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        promise = _find(state["promises"], promise_id, "promise")
        before = copy.deepcopy(promise)
        promise["due_at"] = (datetime.now() + (timedelta(minutes=30) if state_name == "due_soon" else timedelta(hours=-2))).isoformat(timespec="minutes")
        promise["overdue"] = state_name == "overdue"
        promise["manager_attention"] = state_name == "overdue" or promise.get("manager_attention", False)
        promise["status"] = "overdue" if state_name == "overdue" else "pending_execution"
        notice = {"id":f"notice-{uuid4().hex[:8]}","channel":"飞书机器人 Demo","title":"承诺已超时" if promise["overdue"] else "承诺即将到期","body":promise["commitment"],"status":"preview","created_at":_now(),"demo_flag":True}
        state.setdefault("notifications", []).insert(0, notice)
        if promise["overdue"]:
            state.setdefault("quality_signals", []).insert(0, {"id":f"quality-{uuid4().hex[:8]}","advisor_id":promise["advisor_id"],"customer_id":promise["customer_id"],"category":"承诺未履行","risk_level":"high","status":"pending_review","original_message":promise["original_message"],"trigger_rule":"承诺超过截止时间","system_explanation":"承诺已超时，需要经理确认是否提醒或辅导。","fact_ids":[],"repeat_count":1,"employee_response":"","manager_decision":"","decision_reason":"","created_at":_now(),"demo_flag":True})
        _append_followup_event(state, promise["customer_id"], event_type="promise_overdue" if promise["overdue"] else "promise_due_soon", actor="系统 Demo", title=notice["title"], content=promise["commitment"], source_label="飞书提醒 Demo 预览")
        _audit_event(state, workspace_id, actor="场景模拟器", role="角色演示", action=notice["title"], object_type="promise", object_id=promise_id, before=before, after=promise)
        return {"promise": promise, "notification": notice}
    return mutate_state(workspace_id, mutation)


def list_quality(workspace_id: str) -> list[dict[str, Any]]:
    return enterprise_snapshot(workspace_id)["quality_signals"]


def employee_response(workspace_id: str, signal_id: str, response: str, improvement_plan: str = "") -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        signal = _find(state["quality_signals"], signal_id, "quality signal")
        signal["employee_response"] = response
        signal["improvement_plan"] = improvement_plan
        signal["status"] = "employee_responded"
        signal["employee_responded_at"] = _now()
        _audit_event(state, workspace_id, actor=get_advisor(workspace_id, signal["advisor_id"])["name"], role="顾问空间", action="补充质量复核上下文", object_type="quality_signal", object_id=signal_id, after=signal)
        return signal
    return mutate_state(workspace_id, mutation)


def manager_quality_decision(workspace_id: str, signal_id: str, decision: str, reason: str = "") -> dict[str, Any]:
    allowed = {"no_action", "remind", "coaching", "training", "observe", "formal_process", "best_practice"}
    if decision not in allowed:
        raise ValueError("Unsupported quality decision")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        signal = _find(state["quality_signals"], signal_id, "quality signal")
        signal["manager_decision"] = decision
        signal["decision_reason"] = reason
        signal["status"] = "decided"
        signal["decided_at"] = _now()
        created = None
        if decision in {"coaching", "training", "observe"}:
            created = {"id": f"coach-{uuid4().hex[:8]}", "signal_id": signal_id, "advisor_id": signal["advisor_id"], "type": decision, "title": "动态事实与客户承诺辅导", "status": "open", "due_at": (datetime.now()+timedelta(days=7)).date().isoformat(), "reason": reason, "created_at": _now(), "demo_flag": True}
            state.setdefault("coaching_plans", []).insert(0, created)
        elif decision == "best_practice":
            created = {"id": f"practice-{uuid4().hex[:8]}", "scenario": signal["category"], "customer_question": signal["original_message"], "advisor_approach": signal["system_explanation"], "why_effective": reason or "经理确认该处理方式值得复用。", "result": "待补充", "audiences": [], "vehicle_ids": [], "not_for": [], "reviewer": "门店经理 Demo", "source": "质量信号转候选", "anonymous": True, "status": "candidate", "demo_flag": True}
            state.setdefault("best_practices", []).insert(0, created)
        _audit_event(state, workspace_id, actor="门店经理 Demo", role="门店经理空间", action=f"质量复核决定：{decision}", object_type="quality_signal", object_id=signal_id, after={"signal": signal, "created": created})
        return {"signal": signal, "created": created}
    return mutate_state(workspace_id, mutation)


def publish_best_practice(workspace_id: str, practice_id: str) -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        practice = _find(state["best_practices"], practice_id, "best practice")
        practice["status"] = "published"
        practice["reviewer"] = practice.get("reviewer") or "门店经理 Demo"
        practice["published_at"] = _now()
        return practice
    return mutate_state(workspace_id, mutation)



def best_practice_action(workspace_id: str, practice_id: str, action: str) -> dict[str, Any]:
    allowed = {"training_reference", "cross_store_publish"}
    if action not in allowed:
        raise ValueError("Unsupported best practice action")

    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        practice = _find(state["best_practices"], practice_id, "best practice")
        if practice.get("status") != "published":
            raise ValueError("案例必须先由经理确认发布")
        now = _now()
        if action == "training_reference":
            practice.setdefault("uses", [])
            if "training_reference" not in practice["uses"]:
                practice["uses"].append("training_reference")
            practice["training_status"] = "ready"
        else:
            practice["cross_store_status"] = "published_to_selected_stores"
            practice["target_stores"] = ["杭州城西体验店", "上海浦东体验店"]
            practice["adoption_status"] = "tracking"
        practice["updated_at"] = now
        state.setdefault("audit_log", []).insert(0, {
            "id": f"audit-{uuid4().hex[:10]}", "actor": "总部运营 Demo", "role": "总部运营空间",
            "action": f"优秀案例操作：{action}", "object_type": "best_practice", "object_id": practice_id,
            "before": None, "after": {"action": action}, "knowledge_version": "", "demo_flag": True,
            "workspace_id": workspace_id, "created_at": now,
        })
        return practice
    return mutate_state(workspace_id, mutation)

def customer_risk_action(workspace_id: str, risk_id: str, action: str, note: str = "") -> dict[str, Any]:
    allowed = {"assign_manager", "assign_advisor", "create_followup", "create_explanation", "create_promise", "false_positive", "resolve", "close", "snooze"}
    if action not in allowed:
        raise ValueError("Unsupported customer risk action")
    if action == "false_positive" and not note.strip():
        raise ValueError("标记误报必须填写原因")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        risk = _find(state["customer_risks"], risk_id, "customer risk")
        before = copy.deepcopy(risk)
        risk["status"] = {"assign_manager":"manager_assigned","assign_advisor":"advisor_assigned","create_followup":"followup_created","create_explanation":"explanation_task_created","create_promise":"promise_created","false_positive":"false_positive","resolve":"resolved","close":"closed","snooze":"snoozed"}[action]
        risk["note"] = note
        risk["updated_at"] = _now()
        if action == "create_followup":
            _append_followup_event(state, risk["customer_id"], event_type="manager_followup", actor="门店经理 Demo", title="经理创建客户跟进任务", content=risk["recommended_action"], source_label="客户风险")
        elif action == "create_explanation":
            state["opportunities"].insert(0, {"id":f"risk-task-{uuid4().hex[:8]}","kind":"customer","priority":"high","status":"pending","title":"客户风险解释任务","source":"客户风险","source_type":"客户风险","why_now":risk["reason"],"signal":risk["evidence"][0] if risk.get("evidence") else risk["reason"],"recommended_action":risk["recommended_action"],"due_label":risk["due_at"],"due_at":risk["due_at"],"advisor_id":next((c["advisor_id"] for c in state["customer_profiles"] if c["id"]==risk["customer_id"]),"advisor-hz-02"),"owner":"当前负责顾问","impact_label":"1 位客户","manager_help":True,"vehicle_id":"onvo-l80","campaign_id":None,"customer":None})
        elif action == "create_promise":
            customer = _find(state["customer_profiles"], risk["customer_id"], "customer")
            state["promises"].insert(0, {"id":f"promise-{uuid4().hex[:8]}","customer_id":customer["id"],"advisor_id":customer["advisor_id"],"original_message":risk["reason"],"commitment":risk["recommended_action"],"due_at":risk["due_at"],"completion_criteria":"顾问提交处理结果","status":"pending_confirmation","source":"客户风险转承诺","created_at":_now(),"remind_at":"","overdue":False,"manager_attention":True,"evidence":risk.get("evidence",[]),"demo_flag":True})
        _audit_event(state, workspace_id, actor="门店经理 Demo", role="门店经理空间", action=f"客户风险处理：{action}", object_type="customer_risk", object_id=risk_id, before=before, after=risk)
        return risk
    return mutate_state(workspace_id, mutation)


def integration_sync(workspace_id: str, name: str) -> dict[str, Any]:
    result = run_demo_sync(name)
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        state.setdefault("sync_events", []).insert(0, result)
        state["enterprise_meta"]["last_sync_at"] = result["created_at"]
        return result
    return mutate_state(workspace_id, mutation)


def retry_sync_event(workspace_id: str, event_id: str) -> dict[str, Any]:
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        event = _find(state["sync_events"], event_id, "sync event")
        before = copy.deepcopy(event)
        event["status"] = "success"
        event["summary"] = f"重试成功：{event.get('summary', '')}"
        event["retry_count"] = int(event.get("retry_count") or 0) + 1
        event["retried_at"] = _now()
        _audit_event(state, workspace_id, actor="系统管理员 Demo", role="总部运营空间", action="重试同步事件", object_type="sync_event", object_id=event_id, before=before, after=event)
        return event
    return mutate_state(workspace_id, mutation)


def convert_followup_event(workspace_id: str, customer_id: str, event_id: str, action: str, note: str = "") -> dict[str, Any]:
    allowed = {"memory", "concern", "promise", "next_action", "manager_help"}
    if action not in allowed:
        raise ValueError("Unsupported conversation conversion")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        followup = next((item for item in state["followups"] if item.get("customer_id") == customer_id), None)
        if not followup:
            raise KeyError(f"Unknown followup: {customer_id}")
        event = _find(followup["events"], event_id, "followup event")
        customer = _find(state["customer_profiles"], customer_id, "customer")
        result: dict[str, Any]
        if action in {"memory", "concern"}:
            memory = {"id":f"memory-{uuid4().hex[:8]}","scope":"customer","title":"客户顾虑" if action=="concern" else "客户记忆","value":note.strip() or event["content"],"source":f"客户沟通事件 {event_id}","updated_at":datetime.now().strftime("%Y-%m-%d %H:%M"),"active":True}
            followup.setdefault("memories", []).append(memory)
            if action == "concern" and memory["value"] not in customer["state"].setdefault("concerns", []): customer["state"]["concerns"].append(memory["value"])
            result = memory
        elif action == "promise":
            promise = {"id":f"promise-{uuid4().hex[:8]}","customer_id":customer_id,"advisor_id":customer["advisor_id"],"original_message":event["content"],"source_event_id":event_id,"commitment":note.strip() or "根据客户消息完成后续确认","due_at":(datetime.now()+timedelta(days=1)).isoformat(timespec="minutes"),"completion_criteria":"顾问提交完成证据","status":"pending_confirmation","source":"客户沟通转承诺","created_at":_now(),"remind_at":"","overdue":False,"manager_attention":False,"evidence":[],"demo_flag":True}
            state.setdefault("promises", []).insert(0,promise); result=promise
        elif action == "next_action":
            next_action={"id":f"nba-{uuid4().hex[:8]}","action":note.strip() or "根据客户最新消息完成下一步沟通","reason":event["content"],"due_at":"24 小时内","owner":"当前负责顾问","risk":"未及时回应会降低客户信任","required_materials":[],"manager_help":False,"status":"recommended","demo_flag":True,"created_at":_now(),"updated_at":_now()}
            customer.setdefault("next_best_actions", []).insert(0,next_action); result=next_action
        else:
            signal={"id":f"quality-{uuid4().hex[:8]}","advisor_id":customer["advisor_id"],"customer_id":customer_id,"category":"经理协助","risk_level":"medium","status":"pending_review","original_message":event["content"],"trigger_rule":"顾问从客户沟通请求经理协助","system_explanation":note.strip() or "客户沟通需要经理协助判断。","fact_ids":[],"repeat_count":1,"employee_response":"","manager_decision":"","decision_reason":"","created_at":_now(),"demo_flag":True}
            state.setdefault("quality_signals", []).insert(0,signal); result=signal
        _audit_event(state, workspace_id, actor="顾问演示用户", role="顾问空间", action=f"客户沟通转为：{action}", object_type="followup_event", object_id=event_id, after=result)
        return {"action": action, "created": result, "followup": followup}
    return mutate_state(workspace_id, mutation)


def reset_scenario(workspace_id: str, scenario_id: str) -> dict[str, Any]:
    base = reset(workspace_id)
    valid = {item["id"] for item in base.get("demo_scenarios", [])}
    if scenario_id not in valid:
        raise ValueError("Unknown demo scenario")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        state["enterprise_meta"]["demo_scenario"] = scenario_id
        if scenario_id == "knowledge-change":
            state["enterprise_meta"]["current_role"] = "hq"
        elif scenario_id == "promise-overdue":
            state["enterprise_meta"]["current_role"] = "manager"
            state["promises"][0]["status"] = "overdue"; state["promises"][0]["overdue"] = True
        elif scenario_id == "quality-coaching":
            state["enterprise_meta"]["current_role"] = "manager"
        elif scenario_id == "best-practice":
            state["enterprise_meta"]["current_role"] = "hq"
            state["best_practices"][1]["status"] = "candidate"
        else:
            state["enterprise_meta"]["current_role"] = "advisor"
        state.setdefault("audit_log", []).insert(0, {"id":f"audit-{uuid4().hex[:10]}","actor":"场景模拟器","role":"角色演示","action":"切换演示场景","object_type":"demo_scenario","object_id":scenario_id,"before":None,"after":{"scenario":scenario_id},"knowledge_version":"","demo_flag":True,"workspace_id":workspace_id,"created_at":_now()})
        return enterprise_snapshot(workspace_id)
    # cannot call snapshot from inside mutation due RLock is reentrant but returns copy okay; return state subset directly
    def actual(state: dict[str, Any]) -> dict[str, Any]:
        state["enterprise_meta"]["demo_scenario"] = scenario_id
        if scenario_id == "knowledge-change": state["enterprise_meta"]["current_role"] = "hq"
        elif scenario_id == "promise-overdue":
            state["enterprise_meta"]["current_role"] = "manager"; state["promises"][0]["status"] = "overdue"; state["promises"][0]["overdue"] = True
        elif scenario_id == "quality-coaching": state["enterprise_meta"]["current_role"] = "manager"
        elif scenario_id == "best-practice": state["enterprise_meta"]["current_role"] = "hq"; state["best_practices"][1]["status"] = "candidate"
        else: state["enterprise_meta"]["current_role"] = "advisor"
        state.setdefault("audit_log", []).insert(0, {"id":f"audit-{uuid4().hex[:10]}","actor":"场景模拟器","role":"角色演示","action":"切换演示场景","object_type":"demo_scenario","object_id":scenario_id,"before":None,"after":{"scenario":scenario_id},"knowledge_version":"","demo_flag":True,"workspace_id":workspace_id,"created_at":_now()})
        return {key: copy.deepcopy(state.get(key)) for key in ["enterprise_meta","hotspots","knowledge_items","knowledge_impacts","customer_profiles","promises","quality_signals","best_practices","customer_risks","experiments","notifications","approvals","revalidation_tasks","audit_log","demo_scenarios"]}
    return mutate_state(workspace_id, actual)
