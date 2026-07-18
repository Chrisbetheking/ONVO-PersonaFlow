from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def setup_function() -> None:
    response = client.post("/api/demo/reset")
    assert response.status_code == 200


def test_health_and_workspace_bootstrap() -> None:
    health = client.get("/api/health")
    workspace = client.get("/api/workspace")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert health.json()["version"] == "0.3.0"
    assert workspace.status_code == 200
    assert workspace.json()["opportunities"]
    assert workspace.json()["data_mode"] == "demo"


def test_today_opportunity_enters_grounded_studio_flow() -> None:
    opportunity = client.get("/api/opportunities/opp-chen-l80").json()
    response = client.post("/api/content/generate", json={
        "advisor_id": opportunity["advisor_id"],
        "vehicle_id": opportunity["vehicle_id"],
        "campaign_name": "L80 家庭空间体验周",
        "campaign_brief": "围绕满员收纳和周末出行，邀请客户携带真实物品到店体验。",
        "platforms": ["私聊跟进", "朋友圈", "小红书"],
        "opportunity_id": opportunity["id"],
        "customer_context": opportunity["customer"],
        "use_llm": False,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["opportunity_id"] == "opp-chen-l80"
    assert data["customer_context"]["name"] == "陈女士"
    assert len(data["variants"]) == 3
    assert data["evidence"]
    assert data["variants"][0]["claims"]
    assert data["variants"][0]["risk_annotations"]
    assert "陈女士" in data["variants"][0]["body"]


def test_local_rewrite_keeps_endpoint_available_without_model() -> None:
    response = client.post("/api/content/rewrite", json={
        "text": "这是第一句。这是第二句。这是第三句。这是第四句。",
        "instruction": "更简洁",
        "advisor_id": "advisor-hz-02",
        "vehicle_id": "l80",
    })
    assert response.status_code == 200
    assert response.json()["ai_used"] is False
    assert "第四句" not in response.json()["text"]


def test_save_submit_and_manager_decision() -> None:
    payload = {
        "task_id": "task-test-001",
        "variant_id": "variant-test-001",
        "platform": "朋友圈",
        "title": "家庭体验",
        "body": "乐道 L80 当前官方信息已绑定，具体配置、价格与权益以乐道官方最新信息为准。",
        "call_to_action": "欢迎预约体验。",
        "advisor_id": "advisor-hz-02",
        "advisor_name": "周辰",
        "vehicle_id": "l80",
        "campaign_name": "L80 家庭空间体验周",
    }
    saved = client.post("/api/drafts/save", json=payload)
    submitted = client.post("/api/drafts/submit-review", json=payload)
    assert saved.status_code == 200
    assert submitted.status_code == 200
    review_id = submitted.json()["id"]
    decision = client.post(f"/api/reviews/{review_id}/decision", json={"decision": "approved", "reason": "事实已复核"})
    assert decision.status_code == 200
    assert decision.json()["status"] == "approved"
    reviews = client.get("/api/reviews").json()["items"]
    assert any(item["id"] == review_id and item["status"] == "approved" for item in reviews)


def test_customer_reply_updates_timeline_and_memory() -> None:
    response = client.post("/api/followups/customer-chen/events", json={
        "type": "customer_message",
        "actor": "陈女士",
        "title": "客户确认到店",
        "content": "周日两点半可以到店，我会带儿童推车和两个登机箱。",
        "status": "received",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["events"][-1]["title"] == "客户确认到店"
    assert any(item["title"] == "最新客户反馈" for item in data["memories"])


def test_compliance_blocks_misleading_driving_claim() -> None:
    response = client.post("/api/compliance/check", json={
        "text": "这辆车完全自动驾驶，无需接管，绝对安全。",
        "has_evidence": False,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["passed"] is False
    assert data["score"] < 60


def test_lead_analysis_builds_feedback_loop() -> None:
    response = client.post("/api/leads/analyze", json={
        "messages": [
            "周末可以预约 L80 试驾吗？家里两个孩子。",
            "BaaS 和全购怎么选？",
            "我先随便看看。",
        ]
    })
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert data["high_intent"] >= 2
    assert data["next_content_topics"]


def test_campaign_batch_generation_updates_status() -> None:
    response = client.post("/api/content/batch-generate", json={
        "advisor_ids": ["advisor-sh-01", "advisor-hz-02", "advisor-cd-03"],
        "vehicle_id": "l80",
        "campaign_name": "L80 家庭空间体验周",
        "campaign_brief": "按不同顾问所在城市和客群生成家庭场景内容。",
        "platforms": ["朋友圈", "小红书"],
        "campaign_id": "camp-l80-family",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["advisor_count"] == 3
    assert data["variant_count"] == 6
    campaign = client.get("/api/campaigns").json()["items"][0]
    assert campaign["status"] == "completed"
