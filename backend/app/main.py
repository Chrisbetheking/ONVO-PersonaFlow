from __future__ import annotations

import os
from statistics import mean
from typing import Any
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .services.compliance import check_content
from .services.content_engine import generate_content
from .services.lead_engine import analyze as analyze_leads
from .services.llm_provider import enhance_result, is_enabled, provider_status, rewrite_text
from .services.store import advisors, get_advisor, get_vehicle, vehicles
from .services.workspace import (
    add_followup_event,
    campaigns,
    decide_review,
    followups,
    get_opportunity,
    opportunities,
    reset as reset_workspace,
    reviews,
    save_draft,
    submit_review,
    toggle_memory,
    update_campaign_run,
    update_opportunity,
)

APP_VERSION = "0.3.0"
KNOWLEDGE_VERSION = "onvo-cn-2026.07.18"

app = FastAPI(
    title="蔚见 API",
    version=APP_VERSION,
    description="购车顾问机会、内容、事实、审核与跟进工作流。",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    advisor_id: str
    vehicle_id: str
    campaign_name: str = Field(min_length=2, max_length=100)
    campaign_brief: str = Field(min_length=5, max_length=1000)
    platforms: list[str] = Field(min_length=1, max_length=6)
    objective: str = "预约试驾"
    use_llm: bool = True
    opportunity_id: str | None = None
    customer_context: dict[str, Any] | None = None


class BatchGenerateRequest(BaseModel):
    advisor_ids: list[str] = Field(min_length=1, max_length=1000)
    vehicle_id: str
    campaign_name: str = Field(min_length=2, max_length=100)
    campaign_brief: str = Field(min_length=5, max_length=1000)
    platforms: list[str] = Field(min_length=1, max_length=4)
    use_llm: bool = False
    campaign_id: str | None = None


class RewriteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    instruction: str = Field(min_length=2, max_length=100)
    advisor_id: str
    vehicle_id: str
    customer_context: dict[str, Any] | None = None


class ComplianceRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    has_evidence: bool = True


class LeadRequest(BaseModel):
    messages: list[str] = Field(min_length=1, max_length=500)


class VideoRequest(BaseModel):
    task_id: str
    advisor_id: str
    video_package: dict[str, Any]


class OpportunityStatusRequest(BaseModel):
    status: str


class FollowupEventRequest(BaseModel):
    type: str = "advisor_note"
    actor: str = "顾问"
    title: str = "新增记录"
    content: str = Field(min_length=1, max_length=5000)
    status: str = "completed"


class MemoryToggleRequest(BaseModel):
    active: bool


class ReviewDecisionRequest(BaseModel):
    decision: str
    reason: str = Field(default="", max_length=1000)


class DraftRequest(BaseModel):
    id: str | None = None
    task_id: str
    variant_id: str
    platform: str
    title: str
    body: str
    call_to_action: str
    status: str = "draft"


class ReviewSubmitRequest(DraftRequest):
    campaign_name: str = "内容任务"
    advisor_id: str
    advisor_name: str
    vehicle_id: str
    risk_level: str = "low"
    reason: str = "事实与风险已完成自动预检，等待门店经理确认。"
    evidence_status: str = "已绑定"


def _safe_get_advisor(advisor_id: str) -> dict[str, Any]:
    try:
        return get_advisor(advisor_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _safe_get_vehicle(vehicle_id: str) -> dict[str, Any]:
    try:
        return get_vehicle(vehicle_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, KeyError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "mode": "demo-adapter",
        "version": APP_VERSION,
        "knowledge_version": KNOWLEDGE_VERSION,
        "provider": provider_status(),
    }


@app.get("/api/bootstrap")
def bootstrap() -> dict[str, Any]:
    return {
        "advisors": advisors(),
        "vehicles": [{key: value for key, value in item.items() if key != "verified_facts"} for item in vehicles()],
        "defaults": {
            "campaign_name": "L80 家庭空间体验周",
            "campaign_brief": "围绕二孩家庭满员乘坐、儿童用品收纳和周末出行，邀请客户携带真实物品到店体验。",
            "platforms": ["私聊跟进", "朋友圈", "小红书"],
        },
        "data_notice": "顾问、客户和活动为脱敏演示数据；车型事实来自公开官方页面并保留核验日期。",
    }


@app.get("/api/workspace")
def workspace_overview() -> dict[str, Any]:
    return {
        "opportunities": opportunities(),
        "followups": followups(),
        "reviews": reviews(),
        "campaigns": campaigns(),
        "data_mode": "demo",
    }


@app.get("/api/opportunities")
def list_opportunities(include_done: bool = True) -> dict[str, Any]:
    return {"items": opportunities(include_done=include_done), "data_mode": "demo"}


@app.get("/api/opportunities/{opportunity_id}")
def read_opportunity(opportunity_id: str) -> dict[str, Any]:
    try:
        return get_opportunity(opportunity_id)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/opportunities/{opportunity_id}/status")
def set_opportunity_status(opportunity_id: str, request: OpportunityStatusRequest) -> dict[str, Any]:
    try:
        return update_opportunity(opportunity_id, request.status)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/followups")
def list_followups() -> dict[str, Any]:
    return {"items": followups(), "data_mode": "demo"}


@app.post("/api/followups/{customer_id}/events")
def append_followup_event(customer_id: str, request: FollowupEventRequest) -> dict[str, Any]:
    try:
        return add_followup_event(customer_id, request.model_dump())
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/followups/{customer_id}/memories/{memory_id}")
def set_memory_active(customer_id: str, memory_id: str, request: MemoryToggleRequest) -> dict[str, Any]:
    try:
        return toggle_memory(customer_id, memory_id, request.active)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/reviews")
def list_reviews() -> dict[str, Any]:
    return {"items": reviews(), "data_mode": "demo"}


@app.post("/api/reviews/{review_id}/decision")
def review_decision(review_id: str, request: ReviewDecisionRequest) -> dict[str, Any]:
    try:
        return decide_review(review_id, request.decision, request.reason)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/campaigns")
def list_campaigns() -> dict[str, Any]:
    return {"items": campaigns(), "data_mode": "demo"}


@app.post("/api/drafts/save")
def draft_save(request: DraftRequest) -> dict[str, Any]:
    return save_draft(request.model_dump())


@app.post("/api/drafts/submit-review")
def draft_submit_review(request: ReviewSubmitRequest) -> dict[str, Any]:
    return submit_review(request.model_dump())


@app.post("/api/demo/reset")
def demo_reset() -> dict[str, Any]:
    return reset_workspace()


@app.post("/api/content/generate")
async def content_generate(request: GenerateRequest) -> dict[str, Any]:
    advisor = _safe_get_advisor(request.advisor_id)
    vehicle = _safe_get_vehicle(request.vehicle_id)
    customer_context = request.customer_context
    if request.opportunity_id and not customer_context:
        try:
            customer_context = get_opportunity(request.opportunity_id).get("customer")
        except KeyError:
            customer_context = None
    result = generate_content(
        advisor=advisor,
        vehicle=vehicle,
        campaign_name=request.campaign_name,
        campaign_brief=request.campaign_brief,
        platforms=request.platforms,
        customer_context=customer_context,
        opportunity_id=request.opportunity_id,
    )
    result["audit"].update({"ai_used": False, "provider": "规则引擎", "model": "grounded-template"})

    if request.use_llm:
        if is_enabled():
            try:
                result = await enhance_result(
                    result,
                    advisor=advisor,
                    vehicle=vehicle,
                    campaign_name=request.campaign_name,
                    campaign_brief=request.campaign_brief,
                    customer_context=customer_context,
                )
            except (httpx.HTTPError, RuntimeError, ValueError) as exc:
                result["audit"]["ai_warning"] = f"模型调用失败，已保留可审核的基础版本：{exc}"
        else:
            result["audit"]["ai_warning"] = "尚未配置可用的大模型，已使用规则与事实库生成基础版本。"
    return result


@app.post("/api/content/rewrite")
async def content_rewrite(request: RewriteRequest) -> dict[str, Any]:
    advisor = _safe_get_advisor(request.advisor_id)
    vehicle = _safe_get_vehicle(request.vehicle_id)
    try:
        return await rewrite_text(
            request.text,
            instruction=request.instruction,
            advisor=advisor,
            vehicle=vehicle,
            customer_context=request.customer_context,
        )
    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"局部改写失败：{exc}") from exc


@app.post("/api/content/batch-generate")
async def content_batch_generate(request: BatchGenerateRequest) -> dict[str, Any]:
    if len(set(request.advisor_ids)) != len(request.advisor_ids):
        raise HTTPException(status_code=422, detail="advisor_ids must not contain duplicates")
    vehicle = _safe_get_vehicle(request.vehicle_id)
    results: list[dict[str, Any]] = []
    warnings: list[str] = []
    for advisor_id in request.advisor_ids:
        advisor = _safe_get_advisor(advisor_id)
        result = generate_content(
            advisor=advisor,
            vehicle=vehicle,
            campaign_name=request.campaign_name,
            campaign_brief=request.campaign_brief,
            platforms=request.platforms,
        )
        result["audit"].update({"ai_used": False, "provider": "规则引擎", "model": "grounded-template"})
        if request.use_llm and is_enabled():
            try:
                result = await enhance_result(
                    result,
                    advisor=advisor,
                    vehicle=vehicle,
                    campaign_name=request.campaign_name,
                    campaign_brief=request.campaign_brief,
                )
            except (httpx.HTTPError, RuntimeError, ValueError) as exc:
                warnings.append(f"{advisor['name']}：{exc}")
        results.append(result)
    personalization_scores = [variant["personalization_score"] for result in results for variant in result["variants"]]
    compliance_scores = [variant["compliance_score"] for result in results for variant in result["variants"]]
    summary = {
        "total": sum(len(result["variants"]) for result in results),
        "ready": sum(1 for result in results for variant in result["variants"] if variant["status"] == "ready_for_human_review"),
        "pending_review": sum(1 for result in results for variant in result["variants"] if variant["status"] != "ready_for_human_review"),
        "failed": len(warnings),
    }
    if request.campaign_id:
        try:
            update_campaign_run(request.campaign_id, summary)
        except KeyError:
            warnings.append("活动状态未更新：未找到对应 campaign_id")
    return {
        "batch_id": f"batch-{uuid4().hex[:12]}",
        "advisor_count": len(results),
        "variant_count": sum(len(result["variants"]) for result in results),
        "results": results,
        "warnings": warnings,
        "summary": {
            **summary,
            "avg_personalization": round(mean(personalization_scores), 1) if personalization_scores else 0,
            "avg_compliance": round(mean(compliance_scores), 1) if compliance_scores else 0,
            "human_review_required": 1,
        },
    }


@app.post("/api/compliance/check")
def compliance_check(request: ComplianceRequest) -> dict[str, Any]:
    return check_content(request.text, has_evidence=request.has_evidence)


@app.post("/api/leads/analyze")
def leads_analyze(request: LeadRequest) -> dict[str, Any]:
    cleaned = [message.strip() for message in request.messages if message.strip()]
    if not cleaned:
        raise HTTPException(status_code=422, detail="No non-empty messages")
    return analyze_leads(cleaned)


@app.post("/api/video/start")
async def video_start(request: VideoRequest) -> dict[str, str]:
    backend_url = os.getenv("VIDEO_BACKEND_URL", "").rstrip("/")
    if not backend_url:
        return {
            "job_id": f"demo-video-{uuid4().hex[:10]}",
            "status": "queued",
            "mode": "preview",
            "message": "已保存短视频脚本与分镜。配置独立渲染服务后可继续生成成片。",
        }

    payload = {
        "title": request.video_package.get("hook", "购车顾问短视频"),
        "script": request.video_package.get("voiceover", ""),
        "manual_shot_plan": request.video_package.get("shots", []),
        "metadata": {
            "source": "weijian-workspace",
            "task_id": request.task_id,
            "advisor_id": request.advisor_id,
            "contains_real_customer_data": False,
        },
    }
    headers: dict[str, str] = {"Content-Type": "application/json"}
    token = os.getenv("VIDEO_BACKEND_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(f"{backend_url}/api/full-ai/start", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"视频服务调用失败：{exc}") from exc
    return {
        "job_id": str(data.get("job_id") or data.get("id") or f"video-{uuid4().hex[:10]}"),
        "status": str(data.get("status") or "submitted"),
        "mode": "connected",
        "message": "短视频任务已提交。",
    }
