from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_generate_is_grounded_and_personalized() -> None:
    response = client.post("/api/content/generate", json={
        "advisor_id": "advisor-hz-02",
        "vehicle_id": "l80",
        "campaign_name": "家庭空间体验",
        "campaign_brief": "面向二孩家庭，说明真实出行和收纳体验，邀请场景试驾。",
        "platforms": ["朋友圈", "小红书", "抖音口播", "私聊跟进"],
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["variants"]) == 4
    assert data["vehicle"]["name"] == "乐道 L80"
    assert data["evidence"]
    assert data["audit"]["human_review_required"] is True
    assert "周辰" in data["variants"][0]["advisor_name"]


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


def test_batch_generation() -> None:
    response = client.post("/api/content/batch-generate", json={
        "advisor_ids": ["advisor-sh-01", "advisor-hz-02", "advisor-cd-03"],
        "vehicle_id": "l90",
        "campaign_name": "家庭大三排体验",
        "campaign_brief": "按不同顾问所在城市和客群生成家庭场景内容。",
        "platforms": ["朋友圈", "小红书"],
    })
    assert response.status_code == 200
    data = response.json()
    assert data["advisor_count"] == 3
    assert data["variant_count"] == 6
