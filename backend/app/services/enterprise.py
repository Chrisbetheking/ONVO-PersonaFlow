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
    allowed = {"content_task", "customer_outreach", "knowledge_draft", "coaching", "manager_review", "ignore"}
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
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        customer = _find(state["customer_profiles"], customer_id, "customer")
        next_action = _find(customer["next_best_actions"], action_id, "next best action")
        next_action["status"] = {"accept":"accepted","modify":"modified","delay":"delayed","ignore":"ignored","escalate":"escalated","complete":"completed"}[action]
        next_action["note"] = note
        next_action["updated_at"] = _now()
        return customer
    return mutate_state(workspace_id, mutation)


def list_promises(workspace_id: str) -> list[dict[str, Any]]:
    return enterprise_snapshot(workspace_id)["promises"]


def create_promise(workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    customer_id = str(payload.get("customer_id") or "")
    advisor_id = str(payload.get("advisor_id") or "")
    if not customer_id or not advisor_id:
        raise ValueError("customer_id and advisor_id are required")
    get_advisor(workspace_id, advisor_id)
    promise = {
        "id": f"promise-{uuid4().hex[:8]}", "customer_id": customer_id, "advisor_id": advisor_id,
        "original_message": str(payload.get("original_message") or payload.get("commitment") or ""),
        "commitment": str(payload.get("commitment") or ""), "due_at": str(payload.get("due_at") or ""),
        "completion_criteria": str(payload.get("completion_criteria") or "顾问确认完成"), "status": "pending_confirmation",
        "source": str(payload.get("source") or "手动创建 Demo"), "created_at": _now(), "remind_at": str(payload.get("remind_at") or ""),
        "overdue": False, "manager_attention": False, "evidence": [], "demo_flag": True,
    }
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        state["promises"].insert(0, promise)
        return promise
    return mutate_state(workspace_id, mutation)


def update_promise(workspace_id: str, promise_id: str, action: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    allowed = {"confirm", "reschedule", "complete", "delay", "cancel", "request_manager", "manager_remind", "dismiss"}
    if action not in allowed:
        raise ValueError("Unsupported promise action")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        promise = _find(state["promises"], promise_id, "promise")
        if action == "confirm": promise["status"] = "pending_execution"
        elif action == "reschedule": promise["due_at"] = str(payload.get("due_at") or promise["due_at"]); promise["status"] = "pending_execution"
        elif action == "complete": promise["status"] = "completed"; promise["completed_at"] = _now(); promise["evidence"].append(str(payload.get("evidence") or "顾问手动确认完成"))
        elif action == "delay": promise["status"] = "delayed"; promise["delay_reason"] = str(payload.get("reason") or "")
        elif action == "cancel": promise["status"] = "cancelled"; promise["cancel_reason"] = str(payload.get("reason") or "")
        elif action == "request_manager": promise["manager_attention"] = True
        elif action == "manager_remind":
            promise["manager_attention"] = True
            state.setdefault("notifications", []).insert(0, {"id":f"notice-{uuid4().hex[:8]}","channel":"飞书机器人 Demo","title":"经理提醒：客户承诺待处理","body":promise["commitment"],"status":"preview","created_at":_now(),"demo_flag":True})
        elif action == "dismiss": promise["manager_attention"] = False
        promise["updated_at"] = _now()
        return promise
    return mutate_state(workspace_id, mutation)


def simulate_promise_time(workspace_id: str, promise_id: str, state_name: str) -> dict[str, Any]:
    if state_name not in {"due_soon", "overdue"}:
        raise ValueError("state must be due_soon or overdue")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        promise = _find(state["promises"], promise_id, "promise")
        promise["due_at"] = (datetime.now() + (timedelta(minutes=30) if state_name == "due_soon" else timedelta(hours=-2))).isoformat(timespec="minutes")
        promise["overdue"] = state_name == "overdue"
        promise["status"] = "overdue" if state_name == "overdue" else "pending_execution"
        notice = {"id":f"notice-{uuid4().hex[:8]}","channel":"飞书机器人 Demo","title":"承诺已超时" if promise["overdue"] else "承诺即将到期","body":promise["commitment"],"status":"preview","created_at":_now(),"demo_flag":True}
        state.setdefault("notifications", []).insert(0, notice)
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

def customer_risk_action(workspace_id: str, risk_id: str, action: str) -> dict[str, Any]:
    allowed = {"assign_manager", "create_followup", "resolve", "snooze"}
    if action not in allowed:
        raise ValueError("Unsupported customer risk action")
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        risk = _find(state["customer_risks"], risk_id, "customer risk")
        risk["status"] = {"assign_manager":"manager_assigned","create_followup":"followup_created","resolve":"resolved","snooze":"snoozed"}[action]
        risk["updated_at"] = _now()
        return risk
    return mutate_state(workspace_id, mutation)


def integration_sync(workspace_id: str, name: str) -> dict[str, Any]:
    result = run_demo_sync(name)
    def mutation(state: dict[str, Any]) -> dict[str, Any]:
        state.setdefault("sync_events", []).insert(0, result)
        state["enterprise_meta"]["last_sync_at"] = result["created_at"]
        return result
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
