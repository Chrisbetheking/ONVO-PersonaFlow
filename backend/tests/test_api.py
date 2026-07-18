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


def test_health_and_anonymous_workspace_header() -> None:
    health = client.get("/api/health")
    workspace = client.get("/api/workspace")
    assert health.status_code == 200
    assert health.json()["version"] == "0.3.1"
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
    review_b = client.post("/api/drafts/submit-review", headers=B, json={
        "task_id": generated_b["task_id"],
        "variant_id": variant_b["id"],
        "platform": variant_b["platform"],
        "title": variant_b["title"],
        "body": variant_b["body"],
        "call_to_action": variant_b["call_to_action"],
        "claims": variant_b["claims"],
        "risk_annotations": variant_b["risk_annotations"],
        "evidence": generated_b["evidence"],
        "campaign_name": generated_b["campaign_name"],
        "advisor_id": variant_b["advisor_id"],
        "advisor_name": variant_b["advisor_name"],
        "vehicle_id": generated_b["vehicle"]["id"],
        "risk_level": "medium",
        "reason": "B 工作区审核记录",
        "evidence_status": "已绑定",
    })
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


def test_generation_submit_review_preserves_full_content_annotations_and_decision_changes() -> None:
    generated = client.post("/api/content/generate", headers=A, json=generation_payload())
    assert generated.status_code == 200
    data = generated.json()
    variant = data["variants"][1]
    long_body = variant["body"] + "\n\n这是审核时必须保留的完整尾部内容。"
    submit = client.post("/api/drafts/submit-review", headers=A, json={
        "task_id": data["task_id"],
        "variant_id": variant["id"],
        "platform": variant["platform"],
        "title": variant["title"],
        "body": long_body,
        "call_to_action": variant["call_to_action"],
        "claims": variant["claims"],
        "risk_annotations": variant["risk_annotations"],
        "evidence": data["evidence"],
        "campaign_name": data["campaign_name"],
        "advisor_id": variant["advisor_id"],
        "advisor_name": variant["advisor_name"],
        "vehicle_id": data["vehicle"]["id"],
        "risk_level": "medium",
        "reason": "逐句审核测试",
        "evidence_status": "已绑定",
    })
    assert submit.status_code == 200
    review = submit.json()
    assert review["body"] == long_body
    assert review["claims"] == variant["claims"]
    assert review["risk_annotations"] == variant["risk_annotations"]
    assert review["evidence"] == data["evidence"]

    edited = long_body.replace("这是审核时必须保留的完整尾部内容。", "经理已完成逐句修改。")
    resolved_risks = [{**item, "text": item.get("suggestion", item.get("text", "")), "level": "info"} for item in variant["risk_annotations"]]
    decision = client.post(f"/api/reviews/{review['id']}/decision", headers=A, json={
        "decision": "approved",
        "reason": "事实已复核，已应用修改。",
        "body": edited,
        "call_to_action": "预约前请再次确认具体时间。",
        "risk_annotations": resolved_risks,
    })
    assert decision.status_code == 200
    decided = decision.json()
    assert decided["reviewed_body"] == edited
    assert decided["reviewed_call_to_action"] == "预约前请再次确认具体时间。"
    assert decided["risk_annotations"] == resolved_risks
    assert decided["change_log"][-1]["body_changed"] is True
    assert decided["change_log"][-1]["risk_annotations_changed"] is True


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
        "actor": actor,
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
