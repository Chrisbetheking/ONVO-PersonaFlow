from __future__ import annotations

from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
A = {"X-Workspace-Id": "workspace-test-a-0001"}
B = {"X-Workspace-Id": "workspace-test-b-0002"}


def reset(headers: dict[str, str]) -> None:
    response = client.post("/api/demo/reset", headers=headers)
    assert response.status_code == 200


def setup_function() -> None:
    reset(A)
    reset(B)


def generation_payload() -> dict[str, Any]:
    return {
        "advisor_id": "advisor-hz-02",
        "vehicle_id": "l80",
        "campaign_name": "L80 家庭空间体验周",
        "campaign_brief": "围绕满员收纳和周末出行，邀请客户携带真实物品到店体验。",
        "platforms": ["私聊跟进", "朋友圈", "小红书"],
        "opportunity_id": "opp-chen-l80",
        "use_llm": False,
    }

def save_verified_draft(headers: dict[str, str], generated: dict[str, Any], variant: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "task_id": generated["task_id"], "variant_id": variant["id"], "platform": variant["platform"],
        "title": variant["title"], "body": variant["body"], "call_to_action": variant["call_to_action"],
        "claims": variant["claims"], "risk_annotations": variant["risk_annotations"], "evidence": generated["evidence"],
        "status": "draft", "verification_status": variant["verification_status"],
        "compliance_status": variant["compliance_status"], "knowledge_version": variant["knowledge_version"],
        "verification_version": variant["verification_version"], "verified_at": variant["verified_at"],
        "verification_token": variant["verification_token"], "version_history": variant["version_history"],
    }
    response = client.post("/api/drafts/save", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    return payload


def submit_saved_variant(headers: dict[str, str], generated: dict[str, Any], variant: dict[str, Any], *, reason: str = "审核记录") -> httpx.Response:
    save_verified_draft(headers, generated, variant)
    return client.post("/api/drafts/submit-review", headers=headers, json={
        "task_id": generated["task_id"], "variant_id": variant["id"], "platform": variant["platform"],
        "title": variant["title"], "body": variant["body"], "call_to_action": variant["call_to_action"],
        "claims": variant["claims"], "risk_annotations": variant["risk_annotations"], "evidence": generated["evidence"],
        "campaign_name": generated["campaign_name"], "advisor_id": variant["advisor_id"],
        "advisor_name": variant["advisor_name"], "vehicle_id": generated["vehicle"]["id"],
        "risk_level": "medium", "reason": reason, "evidence_status": "已绑定",
        "verification_status": variant["verification_status"], "compliance_status": variant["compliance_status"],
        "knowledge_version": variant["knowledge_version"], "verification_version": variant["verification_version"],
        "verified_at": variant["verified_at"], "verification_token": variant["verification_token"],
        "version_history": variant["version_history"],
    })


def test_health_and_anonymous_workspace_header() -> None:
    health = client.get("/api/health")
    workspace = client.get("/api/workspace")
    assert health.status_code == 200
    assert health.json()["version"] == "0.4.1"
    generated = workspace.headers.get("X-Workspace-Id")
    assert generated and generated.startswith("anon-")
    followup = client.get("/api/workspace", headers={"X-Workspace-Id": generated})
    assert followup.status_code == 200
    assert followup.json()["opportunities"]


def test_two_workspaces_are_isolated_and_reset_is_scoped() -> None:
    update = client.post("/api/opportunities/opp-chen-l80/status", headers=A, json={"status": "done"})
    assert update.status_code == 200
    event = client.post("/api/followups/customer-chen/events", headers=B, json={
        "type": "customer_message",
        "actor": "陈女士",
        "title": "B 工作区客户回复",
        "content": "B 工作区仍保留这条跟进。",
        "status": "received",
    })
    assert event.status_code == 200
    generated_b = client.post("/api/content/generate", headers=B, json=generation_payload()).json()
    variant_b = generated_b["variants"][0]
    review_b = submit_saved_variant(B, generated_b, variant_b, reason="B 工作区审核记录")
    assert review_b.status_code == 200

    workspace_a = client.get("/api/workspace", headers=A).json()
    workspace_b = client.get("/api/workspace", headers=B).json()
    assert next(item for item in workspace_a["opportunities"] if item["id"] == "opp-chen-l80")["status"] == "done"
    assert next(item for item in workspace_b["opportunities"] if item["id"] == "opp-chen-l80")["status"] == "pending"
    assert workspace_b["followups"][0]["events"][-1]["title"] == "B 工作区客户回复"

    reset(A)
    after_reset_a = client.get("/api/workspace", headers=A).json()
    after_reset_b = client.get("/api/workspace", headers=B).json()
    assert next(item for item in after_reset_a["opportunities"] if item["id"] == "opp-chen-l80")["status"] == "pending"
    assert after_reset_b["followups"][0]["events"][-1]["title"] == "B 工作区客户回复"
    assert any(item["reason"] == "B 工作区审核记录" for item in after_reset_b["reviews"])


def test_generation_submit_review_preserves_full_content_and_requires_revalidation_after_manager_edit() -> None:
    generated = client.post("/api/content/generate", headers=A, json=generation_payload()).json()
    original = generated["variants"][1]
    long_body = original["body"] + "\n\n这是审核时必须保留的完整尾部内容。"
    checked_response = client.post("/api/content/revalidate", headers=A, json={
        "task_id": generated["task_id"], "variant_id": original["id"], "advisor_id": original["advisor_id"],
        "vehicle_id": generated["vehicle"]["id"], "platform": original["platform"], "title": original["title"],
        "body": long_body, "call_to_action": original["call_to_action"], "version": original["verification_version"],
    })
    assert checked_response.status_code == 200
    variant = checked_response.json()["variant"]
    generated["evidence"] = checked_response.json()["evidence"]
    submit = submit_saved_variant(A, generated, variant, reason="逐句审核测试")
    assert submit.status_code == 200, submit.text
    review = submit.json()
    assert review["body"] == long_body
    assert review["claims"] == variant["claims"]
    assert review["risk_annotations"] == variant["risk_annotations"]
    assert review["evidence"] == generated["evidence"]

    edited = long_body.replace("这是审核时必须保留的完整尾部内容。", "经理已完成逐句修改。")
    blocked = client.post(f"/api/reviews/{review['id']}/decision", headers=A, json={
        "decision": "approved", "reason": "尝试直接批准", "body": edited,
        "call_to_action": "预约前请再次确认具体时间。", "risk_annotations": variant["risk_annotations"],
    })
    assert blocked.status_code == 422
    stale = next(item for item in client.get("/api/reviews", headers=A).json()["items"] if item["id"] == review["id"])
    assert stale["verification_status"] == "needs_revalidation"
    checked = client.post(f"/api/reviews/{review['id']}/revalidate", headers=A, json={
        "body": edited, "call_to_action": "预约前请再次确认具体时间。", "risk_annotations": variant["risk_annotations"],
    })
    assert checked.status_code == 200
    assert checked.json()["reviewed_body"] == edited
    assert checked.json()["verification_status"] == "verified"
    approved = client.post(f"/api/reviews/{review['id']}/decision", headers=A, json={
        "decision": "approved", "reason": "重新核验后批准", "body": edited,
        "call_to_action": "预约前请再次确认具体时间。", "risk_annotations": checked.json()["risk_annotations"],
    })
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

def test_advisor_profile_persists_per_workspace_and_reset_restores_initial() -> None:
    update = client.patch("/api/advisors/advisor-hz-02", headers=A, json={
        "audience": "重视露营收纳的二孩家庭",
        "style": "先问需求再给建议",
    })
    assert update.status_code == 200
    assert update.json()["audience"] == "重视露营收纳的二孩家庭"
    assert next(item for item in client.get("/api/bootstrap", headers=A).json()["advisors"] if item["id"] == "advisor-hz-02")["style"] == "先问需求再给建议"
    assert next(item for item in client.get("/api/bootstrap", headers=B).json()["advisors"] if item["id"] == "advisor-hz-02")["style"] == "场景叙事"
    reset(A)
    restored = next(item for item in client.get("/api/bootstrap", headers=A).json()["advisors"] if item["id"] == "advisor-hz-02")
    assert restored["audience"] == "重视空间的二孩家庭"


def test_followup_booking_uses_supplied_real_advisor_and_updates_stage() -> None:
    response = client.post("/api/followups/customer-xu/events", headers=A, json={
        "type": "test_drive_booked",
        "actor": "林悦",
        "title": "已预约晚间试驾",
        "content": "2026-07-22 19:30 到店，携带日常通勤行李。",
        "scheduled_at": "2026-07-22 19:30",
        "items": ["通勤背包"],
        "notes": "体验城市通勤路线",
        "status": "completed",
    })
    assert response.status_code == 200
    followup = response.json()
    assert followup["events"][-1]["actor"] == "林悦"
    assert followup["events"][-1]["scheduled_at"] == "2026-07-22 19:30"
    assert followup["stage"] == "已预约试驾"
    assert followup["next_action_due"] == "2026-07-22 19:30"




@pytest.mark.parametrize(("customer_id", "actor"), [
    ("customer-xu", "林悦"),
    ("customer-chen", "周辰"),
])
def test_booking_records_the_customer_owner_advisor(customer_id: str, actor: str) -> None:
    response = client.post(f"/api/followups/{customer_id}/events", headers=A, json={
        "type": "test_drive_booked",
        "actor": "客户端伪造姓名",
        "title": "预约归属顾问测试",
        "content": "2026-07-23 14:00 到店。",
        "scheduled_at": "2026-07-23 14:00",
        "items": ["日常行李"],
        "notes": "按家庭场景体验",
        "status": "completed",
    })
    assert response.status_code == 200
    assert response.json()["events"][-1]["actor"] == actor


def test_customer_reply_adds_memory() -> None:
    response = client.post("/api/followups/customer-chen/events", headers=A, json={
        "type": "customer_message",
        "actor": "陈女士",
        "title": "客户确认到店",
        "content": "周日两点半可以到店，我会带儿童推车和两个登机箱。",
        "status": "received",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["events"][-1]["title"] == "客户确认到店"
    assert data["memories"][-1]["value"].startswith("周日两点半")


def test_campaign_task_details_retry_and_submit_review() -> None:
    initial = client.get("/api/campaigns", headers=A).json()["items"][0]
    failed = next(task for task in initial["tasks"] if task["status"] == "failed")
    retried = client.post(f"/api/campaigns/{initial['id']}/tasks/{failed['id']}/retry", headers=A, json={})
    assert retried.status_code == 200
    campaign = retried.json()
    task = next(item for item in campaign["tasks"] if item["id"] == failed["id"])
    assert task["retry_count"] == 1
    assert task["status"] in {"ready", "needs_review"}
    assert task["result"]["variant"]["body"]

    submitted = client.post(f"/api/campaigns/{campaign['id']}/tasks/{task['id']}/submit-review", headers=A, json={})
    assert submitted.status_code == 200
    review = submitted.json()
    assert review["body"] == task["result"]["variant"]["body"]
    assert review["claims"] == task["result"]["variant"]["claims"]


def test_full_batch_generation_saves_task_details() -> None:
    response = client.post("/api/content/batch-generate", headers=A, json={
        "advisor_ids": ["advisor-sh-01", "advisor-hz-02"],
        "vehicle_id": "l80",
        "campaign_name": "L80 家庭空间体验周",
        "campaign_brief": "按不同顾问所在城市和客群生成家庭场景内容。",
        "platforms": ["朋友圈", "小红书"],
        "campaign_id": "camp-l80-family",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["tasks"]) == 4
    assert all({"advisor_name", "platform", "status", "retry_count"}.issubset(task) for task in data["tasks"])
    stored = client.get("/api/campaigns", headers=A).json()["items"][0]
    assert len(stored["tasks"]) == 4


def test_video_preview_success_and_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VIDEO_BACKEND_URL", raising=False)
    preview = client.post("/api/video/start", headers=A, json={"task_id": "task-1", "advisor_id": "advisor-hz-02", "video_package": {"hook": "hook", "voiceover": "voice", "shots": []}})
    assert preview.status_code == 200
    assert preview.json()["status"] == "preview"
    assert "未生成成片" in preview.json()["message"]

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"job_id": "remote-job-1", "status": "submitted"}

    class FakeClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> "FakeClient":
            return self

        async def __aexit__(self, *args: Any) -> None:
            return None

        async def post(self, *args: Any, **kwargs: Any) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setenv("VIDEO_BACKEND_URL", "https://video.example.test")
    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    success = client.post("/api/video/start", headers=A, json={"task_id": "task-2", "advisor_id": "advisor-hz-02", "video_package": {"hook": "hook", "voiceover": "voice", "shots": []}})
    assert success.status_code == 200
    assert success.json()["status"] == "submitted"

    class FailingClient(FakeClient):
        async def post(self, *args: Any, **kwargs: Any) -> FakeResponse:
            raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx, "AsyncClient", FailingClient)
    failed = client.post("/api/video/start", headers=A, json={"task_id": "task-3", "advisor_id": "advisor-hz-02", "video_package": {"hook": "hook", "voiceover": "voice", "shots": []}})
    assert failed.status_code == 502


def test_workspace_store_ttl_cleanup_and_thread_safe_mutation(monkeypatch: pytest.MonkeyPatch) -> None:
    import time
    from concurrent.futures import ThreadPoolExecutor

    import app.services.workspace as workspace_module

    store = workspace_module.WorkspaceStore()
    workspace_id = "workspace-thread-test-0001"

    def add_draft(index: int) -> None:
        def mutation(state: dict[str, Any]) -> None:
            state.setdefault("drafts", []).append({"id": f"draft-{index}"})
        store.mutate(workspace_id, mutation)

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(add_draft, range(40)))
    assert len(store.snapshot(workspace_id)["drafts"]) == 40

    monkeypatch.setattr(workspace_module, "WORKSPACE_TTL_SECONDS", 1)
    monkeypatch.setattr(workspace_module, "WORKSPACE_CLEANUP_INTERVAL_SECONDS", 0)
    with store._lock:
        store._entries[workspace_id]["last_access"] = time.monotonic() - 5
    assert store.active_count() == 0


def test_feishu_demo_sync_creates_version_impact_and_stales_review() -> None:
    before = client.get("/api/knowledge/knowledge-l80-positioning", headers=A).json()
    response = client.post("/api/integrations/feishu/simulate-change", headers=A, json={"change_type":"campaign_end"})
    assert response.status_code == 200
    data = response.json()
    assert data["knowledge"]["version"] != before["version"]
    assert data["impact"]["affected"]["customers"] > 0
    assert data["notification"]["demo_flag"] is True
    reviews = client.get("/api/reviews", headers=A).json()["items"]
    assert any(item["verification_status"] == "needs_revalidation" for item in reviews if item["vehicle_id"] == "l80")


def test_content_edit_requires_revalidation_before_submit() -> None:
    generated = client.post("/api/content/generate", headers=A, json=generation_payload()).json()
    variant = generated["variants"][0]
    stale_payload = {
        "task_id":generated["task_id"],"variant_id":variant["id"],"platform":variant["platform"],"title":variant["title"],
        "body":variant["body"]+" 已修改", "call_to_action":variant["call_to_action"],"claims":variant["claims"],
        "risk_annotations":variant["risk_annotations"],"evidence":generated["evidence"],"campaign_name":generated["campaign_name"],
        "advisor_id":variant["advisor_id"],"advisor_name":variant["advisor_name"],"vehicle_id":"l80",
        "verification_status":"needs_revalidation","compliance_status":"needs_revalidation",
    }
    assert client.post("/api/drafts/submit-review", headers=A, json=stale_payload).status_code == 422
    checked = client.post("/api/content/revalidate", headers=A, json={
        "task_id":generated["task_id"],"variant_id":variant["id"],"advisor_id":variant["advisor_id"],"vehicle_id":"l80",
        "platform":variant["platform"],"title":variant["title"],"body":stale_payload["body"],"call_to_action":variant["call_to_action"],"version":1,
    })
    assert checked.status_code == 200
    assert checked.json()["variant"]["verification_status"] == "verified"


def test_promise_quality_best_practice_and_scenario_isolation() -> None:
    promise = client.post("/api/promises", headers=A, json={
        "customer_id":"customer-chen","advisor_id":"advisor-hz-02","commitment":"今晚发送空间清单","due_at":"2026-07-20T20:00","original_message":"今晚发给您",
    })
    assert promise.status_code == 200
    promise_id = promise.json()["id"]
    assert client.post(f"/api/promises/{promise_id}/actions", headers=A, json={"action":"confirm"}).json()["status"] == "pending_execution"
    assert client.post(f"/api/promises/{promise_id}/simulate/overdue", headers=A, json={}).json()["promise"]["overdue"] is True
    assert client.post(f"/api/promises/{promise_id}/actions", headers=A, json={"action":"complete","evidence":"已发送"}).json()["status"] == "completed"

    signal = client.get("/api/quality-signals", headers=A).json()["items"][0]
    assert client.post(f"/api/quality-signals/{signal['id']}/employee-response", headers=A, json={"response":"客户当时询问旧活动截图","improvement_plan":"今后先核验知识版本"}).status_code == 200
    decision = client.post(f"/api/quality-signals/{signal['id']}/manager-decision", headers=A, json={"decision":"coaching","reason":"安排动态事实辅导"})
    assert decision.status_code == 200
    assert decision.json()["created"]["type"] == "coaching"
    practice = client.get("/api/enterprise", headers=A).json()["best_practices"][0]
    published = client.post(f"/api/best-practices/{practice['id']}/publish", headers=A, json={})
    assert published.status_code == 200 and published.json()["status"] == "published"
    training = client.post(f"/api/best-practices/{practice['id']}/actions", headers=A, json={"action":"training_reference"})
    assert training.status_code == 200 and training.json()["training_status"] == "ready"
    cross_store = client.post(f"/api/best-practices/{practice['id']}/actions", headers=A, json={"action":"cross_store_publish"})
    assert cross_store.status_code == 200 and cross_store.json()["adoption_status"] == "tracking"

    client.post("/api/demo/scenario", headers=A, json={"scenario_id":"promise-overdue"})
    assert client.get("/api/enterprise", headers=A).json()["enterprise_meta"]["demo_scenario"] == "promise-overdue"
    assert client.get("/api/enterprise", headers=B).json()["enterprise_meta"]["demo_scenario"] != "promise-overdue"


def test_enterprise_objects_include_workspace_and_audit_metadata() -> None:
    enterprise = client.get("/api/enterprise", headers=A)
    assert enterprise.status_code == 200
    payload = enterprise.json()
    required = {"workspace_id", "created_at", "updated_at", "source_type", "demo_flag", "created_by", "version"}
    for key in [
        "hotspots", "knowledge_items", "customer_profiles", "promises", "quality_signals",
        "best_practices", "customer_risks", "experiments", "demo_scenarios", "audit_log",
    ]:
        assert payload[key], key
        assert required.issubset(payload[key][0]), (key, payload[key][0])
        assert payload[key][0]["workspace_id"] == A["X-Workspace-Id"]
    assert required.issubset(payload["hotspots"][0]["evidence"][0])
    assert required.issubset(payload["knowledge_items"][0]["versions"][0])
    assert required.issubset(payload["customer_profiles"][0]["next_best_actions"][0])


def test_server_rejects_forged_verification_and_unverified_send() -> None:
    generated = client.post("/api/content/generate", headers=A, json=generation_payload()).json()
    variant = generated["variants"][0]
    forged = {**variant, "verification_token": "forged-token"}
    bad_save = client.post("/api/drafts/save", headers=A, json={
        "task_id": generated["task_id"], "variant_id": forged["id"], "platform": forged["platform"],
        "title": forged["title"], "body": forged["body"], "call_to_action": forged["call_to_action"],
        "claims": forged["claims"], "risk_annotations": forged["risk_annotations"], "evidence": generated["evidence"],
        "verification_status": "verified", "compliance_status": "verified", "knowledge_version": forged["knowledge_version"],
        "verification_version": forged["verification_version"], "verified_at": forged["verified_at"],
        "verification_token": forged["verification_token"], "version_history": forged["version_history"],
    })
    assert bad_save.status_code == 422
    sent = client.post("/api/followups/customer-chen/events", headers=A, json={
        "type": "advisor_sent", "actor": "周辰", "title": "绕过核验发送", "content": variant["body"],
        "task_id": generated["task_id"], "variant_id": variant["id"], "verification_version": variant["verification_version"],
        "verification_token": variant["verification_token"],
    })
    assert sent.status_code == 422


def test_followup_message_conversion_and_sync_retry_are_persistent() -> None:
    followup = client.post("/api/followups/customer-chen/events", headers=A, json={
        "type": "customer_message", "actor": "陈女士", "title": "客户承诺线索",
        "content": "请周日提醒我带儿童推车。", "status": "received",
        "source_label": "授权沟通 Demo", "sync_status": "已同步",
    }).json()
    event_id = followup["events"][-1]["id"]
    converted = client.post(f"/api/followups/customer-chen/events/{event_id}/convert", headers=A, json={"action": "promise", "note": "周日提醒"})
    assert converted.status_code == 200, converted.text
    assert converted.json()["created"]["status"] == "pending_confirmation"
    enterprise = client.get("/api/enterprise", headers=A).json()
    assert any(item["original_message"] == "请周日提醒我带儿童推车。" for item in enterprise["promises"])

    sync = client.post("/api/integrations/messaging/sync", headers=A, json={}).json()
    event_id = sync["id"]
    retry = client.post(f"/api/sync-events/{event_id}/retry", headers=A, json={"reason": "恢复网络后重试"})
    assert retry.status_code == 200
    assert retry.json()["retry_count"] == 1


def test_promise_uses_customer_actual_advisor_and_writes_audit() -> None:
    client.post("/api/demo/reset", headers=A)
    created = client.post("/api/promises", headers=A, json={
        "customer_id": "customer-xu",
        "advisor_id": "advisor-hz-02",
        "commitment": "明天确认置换资料",
        "due_at": "2026-07-21T10:00",
        "original_message": "我明天回复您",
    })
    assert created.status_code == 200, created.text
    promise = created.json()
    customer = next(item for item in client.get("/api/customers", headers=A).json()["items"] if item["id"] == "customer-xu")
    assert promise["advisor_id"] == customer["advisor_id"]
    enterprise = client.get("/api/enterprise", headers=A).json()
    assert any(event["object_type"] == "promise" and event["object_id"] == promise["id"] for event in enterprise["audit_log"])


def test_title_and_cta_changes_require_fresh_signed_verification() -> None:
    client.post("/api/demo/reset", headers=A)
    generated = client.post("/api/content/generate", headers=A, json=generation_payload()).json()
    variant = generated["variants"][0]
    save_verified_draft(A, generated, variant)
    for changed_field in ("title", "call_to_action"):
        changed = dict(variant)
        changed[changed_field] = changed[changed_field] + " 已编辑"
        response = client.post("/api/drafts/save", headers=A, json={
            "task_id": generated["task_id"],
            "variant_id": changed["id"],
            "platform": changed["platform"],
            "title": changed["title"],
            "body": changed["body"],
            "call_to_action": changed["call_to_action"],
            "claims": changed["claims"],
            "risk_annotations": changed["risk_annotations"],
            "evidence": generated["evidence"],
            "verification_status": "verified",
            "compliance_status": "verified",
            "knowledge_version": changed["knowledge_version"],
            "verification_version": changed["verification_version"],
            "verified_at": changed["verified_at"],
            "verification_token": changed["verification_token"],
            "version_history": changed["version_history"],
        })
        assert response.status_code == 422
