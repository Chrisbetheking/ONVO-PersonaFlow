from __future__ import annotations

import os
from statistics import mean
from typing import Annotated, Any
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .services.compliance import check_content
from .services.content_engine import generate_content
from .services.lead_engine import analyze as analyze_leads
from .services.llm_provider import enhance_result, is_enabled, provider_status, rewrite_text
from .services.store import get_vehicle, vehicles
from .services.workspace import (
    add_followup_event,
    advisors,
    campaigns,
    decide_review,
    followups,
    get_advisor,
    get_campaign,
    get_opportunity,
    normalize_workspace_id,
    opportunities,
    reset as reset_workspace,
    reviews,
    save_draft,
    snapshot,
    submit_review,
    toggle_memory,
    update_advisor,
    update_campaign_run,
    update_campaign_task,
    update_opportunity,
    workspace_stats,
)

APP_VERSION = "0.3.1"
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
    expose_headers=["X-Workspace-Id"],
)


def resolve_workspace_id(
    response: Response,
    x_workspace_id: Annotated[str | None, Header(alias="X-Workspace-Id")] = None,
) -> str:
    workspace_id = normalize_workspace_id(x_workspace_id)
    response.headers["X-Workspace-Id"] = workspace_id
    return workspace_id


WorkspaceId = Annotated[str, Depends(resolve_workspace_id)]


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
    scheduled_at: str = Field(default="", max_length=100)
    items: list[str] = Field(default_factory=list, max_length=30)
    notes: str = Field(default="", max_length=1000)


class MemoryToggleRequest(BaseModel):
    active: bool


class ReviewDecisionRequest(BaseModel):
    decision: str
    reason: str = Field(default="", max_length=1000)
    body: str | None = Field(default=None, max_length=20000)
    call_to_action: str | None = Field(default=None, max_length=2000)
    risk_annotations: list[dict[str, Any]] | None = None


class DraftRequest(BaseModel):
    id: str | None = None
    task_id: str
    variant_id: str
    platform: str
    title: str
    body: str
    call_to_action: str
    claims: list[dict[str, Any]] = Field(default_factory=list)
    risk_annotations: list[dict[str, Any]] = Field(default_factory=list)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "draft"


class ReviewSubmitRequest(DraftRequest):
    campaign_name: str = "内容任务"
    advisor_id: str
    advisor_name: str
    vehicle_id: str
    risk_level: str = "low"
    reason: str = "事实与风险已完成自动预检，等待门店经理确认。"
    evidence_status: str = "已绑定"


class AdvisorUpdateRequest(BaseModel):
    audience: str = Field(min_length=2, max_length=500)
    style: str = Field(min_length=2, max_length=300)
    platforms: list[str] | None = None
    model_focus: str | None = None


def _safe_get_advisor(workspace_id: str, advisor_id: str) -> dict[str, Any]:
    try:
        return get_advisor(workspace_id, advisor_id)
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


def _task_from_variant(
    *,
    campaign_id: str,
    result: dict[str, Any],
    variant: dict[str, Any],
    advisor: dict[str, Any],
    retry_count: int = 0,
    task_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": task_id or f"campaign-task-{uuid4().hex[:10]}",
        "campaign_id": campaign_id,
        "advisor_id": advisor["id"],
        "advisor_name": advisor["name"],
        "platform": variant["platform"],
        "status": "ready" if variant.get("status") == "ready_for_human_review" else "needs_review",
        "failure_reason": "",
        "retry_count": retry_count,
        "generated_at": result.get("audit", {}).get("generated_at", ""),
        "result": {
            "task_id": result["task_id"],
            "campaign_name": result["campaign_name"],
            "vehicle": result["vehicle"],
            "variant": variant,
            "evidence": result["evidence"],
            "video_package": result["video_package"],
            "audit": result["audit"],
        },
        "review_id": "",
    }


async def _generate_campaign_task(
    workspace_id: str,
    campaign: dict[str, Any],
    *,
    advisor_id: str,
    platform: str,
    use_llm: bool,
    retry_count: int = 0,
    task_id: str | None = None,
) -> dict[str, Any]:
    advisor = _safe_get_advisor(workspace_id, advisor_id)
    vehicle = _safe_get_vehicle(campaign["vehicle_id"])
    try:
        result = generate_content(
            advisor=advisor,
            vehicle=vehicle,
            campaign_name=campaign["name"],
            campaign_brief=campaign["brief"],
            platforms=[platform],
        )
        result["audit"].update({"ai_used": False, "provider": "规则引擎", "model": "grounded-template"})
        if use_llm and is_enabled():
            result = await enhance_result(
                result,
                advisor=advisor,
                vehicle=vehicle,
                campaign_name=campaign["name"],
                campaign_brief=campaign["brief"],
            )
        return _task_from_variant(
            campaign_id=campaign["id"],
            result=result,
            variant=result["variants"][0],
            advisor=advisor,
            retry_count=retry_count,
            task_id=task_id,
        )
    except Exception as exc:  # Task-level failures must be visible and retryable.
        return {
            "id": task_id or f"campaign-task-{uuid4().hex[:10]}",
            "campaign_id": campaign["id"],
            "advisor_id": advisor["id"],
            "advisor_name": advisor["name"],
            "platform": platform,
            "status": "failed",
            "failure_reason": str(exc),
            "retry_count": retry_count,
            "generated_at": "",
            "result": None,
            "review_id": "",
        }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "mode": "demo-adapter",
        "version": APP_VERSION,
        "knowledge_version": KNOWLEDGE_VERSION,
        "provider": provider_status(),
        "workspace_store": workspace_stats(),
    }


@app.get("/api/bootstrap")
def bootstrap(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {
        "advisors": advisors(workspace_id),
        "vehicles": [{key: value for key, value in item.items() if key != "verified_facts"} for item in vehicles()],
        "defaults": {
            "campaign_name": "L80 家庭空间体验周",
            "campaign_brief": "围绕二孩家庭满员乘坐、儿童用品收纳和周末出行，邀请客户携带真实物品到店体验。",
            "platforms": ["私聊跟进", "朋友圈", "小红书"],
        },
        "data_notice": "顾问、客户和活动为当前浏览器工作区中的脱敏演示数据；车型事实来自公开官方页面并保留核验日期。",
    }


@app.get("/api/workspace")
def workspace_overview(workspace_id: WorkspaceId) -> dict[str, Any]:
    state = snapshot(workspace_id)
    return {
        "opportunities": state["opportunities"],
        "followups": state["followups"],
        "reviews": state["reviews"],
        "campaigns": state["campaigns"],
        "data_mode": "demo",
    }


@app.get("/api/opportunities")
def list_opportunities(workspace_id: WorkspaceId, include_done: bool = True) -> dict[str, Any]:
    return {"items": opportunities(workspace_id, include_done=include_done), "data_mode": "demo"}


@app.get("/api/opportunities/{opportunity_id}")
def read_opportunity(opportunity_id: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return get_opportunity(workspace_id, opportunity_id)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/opportunities/{opportunity_id}/status")
def set_opportunity_status(opportunity_id: str, request: OpportunityStatusRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return update_opportunity(workspace_id, opportunity_id, request.status)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.patch("/api/advisors/{advisor_id}")
def advisor_update(advisor_id: str, request: AdvisorUpdateRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return update_advisor(workspace_id, advisor_id, request.model_dump(exclude_none=True))
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/followups")
def list_followups(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": followups(workspace_id), "data_mode": "demo"}


@app.post("/api/followups/{customer_id}/events")
def append_followup_event(customer_id: str, request: FollowupEventRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return add_followup_event(workspace_id, customer_id, request.model_dump())
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/followups/{customer_id}/memories/{memory_id}")
def set_memory_active(customer_id: str, memory_id: str, request: MemoryToggleRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return toggle_memory(workspace_id, customer_id, memory_id, request.active)
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/reviews")
def list_reviews(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": reviews(workspace_id), "data_mode": "demo"}


@app.post("/api/reviews/{review_id}/decision")
def review_decision(review_id: str, request: ReviewDecisionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return decide_review(
            workspace_id,
            review_id,
            request.decision,
            request.reason,
            {"body": request.body, "call_to_action": request.call_to_action, "risk_annotations": request.risk_annotations},
        )
    except Exception as exc:
        raise _http_error(exc) from exc


@app.get("/api/campaigns")
def list_campaigns(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": campaigns(workspace_id), "data_mode": "demo"}


@app.post("/api/campaigns/{campaign_id}/tasks/{task_id}/retry")
async def retry_campaign_task(campaign_id: str, task_id: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        campaign = get_campaign(workspace_id, campaign_id)
        task = next(item for item in campaign.get("tasks", []) if item["id"] == task_id)
    except (KeyError, StopIteration) as exc:
        raise HTTPException(status_code=404, detail="未找到批量任务") from exc
    retried = await _generate_campaign_task(
        workspace_id,
        campaign,
        advisor_id=task["advisor_id"],
        platform=task["platform"],
        use_llm=False,
        retry_count=int(task.get("retry_count", 0)) + 1,
        task_id=task_id,
    )
    return update_campaign_task(workspace_id, campaign_id, task_id, retried)


@app.post("/api/campaigns/{campaign_id}/retry-failed")
async def retry_failed_campaign_tasks(campaign_id: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        campaign = get_campaign(workspace_id, campaign_id)
    except Exception as exc:
        raise _http_error(exc) from exc
    failed = [task for task in campaign.get("tasks", []) if task.get("status") == "failed"]
    for task in failed:
        retried = await _generate_campaign_task(
            workspace_id,
            campaign,
            advisor_id=task["advisor_id"],
            platform=task["platform"],
            use_llm=False,
            retry_count=int(task.get("retry_count", 0)) + 1,
            task_id=task["id"],
        )
        campaign = update_campaign_task(workspace_id, campaign_id, task["id"], retried)
    return campaign


@app.post("/api/campaigns/{campaign_id}/tasks/{task_id}/submit-review")
def submit_campaign_task_review(campaign_id: str, task_id: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        campaign = get_campaign(workspace_id, campaign_id)
        task = next(item for item in campaign.get("tasks", []) if item["id"] == task_id)
        result = task.get("result")
        if not result:
            raise ValueError("失败任务没有可提交的内容")
        variant = result["variant"]
        review = submit_review(workspace_id, {
            "task_id": result["task_id"],
            "variant_id": variant["id"],
            "platform": variant["platform"],
            "title": variant["title"],
            "body": variant["body"],
            "call_to_action": variant["call_to_action"],
            "claims": variant.get("claims", []),
            "risk_annotations": variant.get("risk_annotations", []),
            "evidence": result.get("evidence", []),
            "campaign_name": campaign["name"],
            "advisor_id": task["advisor_id"],
            "advisor_name": task["advisor_name"],
            "vehicle_id": campaign["vehicle_id"],
            "risk_level": "high" if any(risk.get("level") == "block" for risk in variant.get("risk_annotations", [])) else "medium" if variant.get("risk_annotations") else "low",
            "reason": variant.get("risk_annotations", [{}])[0].get("reason", "批量内容抽样进入门店审核。") if variant.get("risk_annotations") else "批量内容抽样进入门店审核。",
            "evidence_status": "已绑定" if result.get("evidence") else "缺少事实",
        })
        updated = {**task, "status": "submitted", "review_id": review["id"]}
        update_campaign_task(workspace_id, campaign_id, task_id, updated)
        return review
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/drafts/save")
def draft_save(request: DraftRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    return save_draft(workspace_id, request.model_dump())


@app.post("/api/drafts/submit-review")
def draft_submit_review(request: ReviewSubmitRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    return submit_review(workspace_id, request.model_dump())


@app.post("/api/demo/reset")
def demo_reset(workspace_id: WorkspaceId) -> dict[str, Any]:
    state = reset_workspace(workspace_id)
    return {
        "opportunities": state["opportunities"],
        "followups": state["followups"],
        "reviews": state["reviews"],
        "campaigns": state["campaigns"],
        "data_mode": "demo",
    }


@app.post("/api/content/generate")
async def content_generate(request: GenerateRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    advisor = _safe_get_advisor(workspace_id, request.advisor_id)
    vehicle = _safe_get_vehicle(request.vehicle_id)
    customer_context = request.customer_context
    if request.opportunity_id and not customer_context:
        try:
            customer_context = get_opportunity(workspace_id, request.opportunity_id).get("customer")
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
async def content_rewrite(request: RewriteRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    advisor = _safe_get_advisor(workspace_id, request.advisor_id)
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
async def content_batch_generate(request: BatchGenerateRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    if len(set(request.advisor_ids)) != len(request.advisor_ids):
        raise HTTPException(status_code=422, detail="advisor_ids must not contain duplicates")
    vehicle = _safe_get_vehicle(request.vehicle_id)
    results: list[dict[str, Any]] = []
    warnings: list[str] = []
    tasks: list[dict[str, Any]] = []
    campaign_id = request.campaign_id or f"ad-hoc-{uuid4().hex[:8]}"

    for advisor_id in request.advisor_ids:
        advisor = _safe_get_advisor(workspace_id, advisor_id)
        try:
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
            tasks.extend(_task_from_variant(campaign_id=campaign_id, result=result, variant=variant, advisor=advisor) for variant in result["variants"])
        except Exception as exc:
            warnings.append(f"{advisor['name']}：{exc}")
            tasks.extend({
                "id": f"campaign-task-{uuid4().hex[:10]}",
                "campaign_id": campaign_id,
                "advisor_id": advisor["id"],
                "advisor_name": advisor["name"],
                "platform": platform,
                "status": "failed",
                "failure_reason": str(exc),
                "retry_count": 0,
                "generated_at": "",
                "result": None,
                "review_id": "",
            } for platform in request.platforms)

    personalization_scores = [variant["personalization_score"] for result in results for variant in result["variants"]]
    compliance_scores = [variant["compliance_score"] for result in results for variant in result["variants"]]
    summary = {
        "total": len(tasks),
        "ready": sum(1 for task in tasks if task["status"] == "ready"),
        "pending_review": sum(1 for task in tasks if task["status"] == "needs_review"),
        "failed": sum(1 for task in tasks if task["status"] == "failed"),
    }
    campaign = None
    if request.campaign_id:
        try:
            campaign = update_campaign_run(workspace_id, request.campaign_id, tasks)
        except KeyError:
            warnings.append("活动状态未更新：未找到对应 campaign_id")
    return {
        "batch_id": f"batch-{uuid4().hex[:12]}",
        "advisor_count": len(request.advisor_ids),
        "variant_count": len(tasks),
        "results": results,
        "tasks": tasks,
        "campaign": campaign,
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
async def video_start(request: VideoRequest, workspace_id: WorkspaceId) -> dict[str, str]:
    backend_url = os.getenv("VIDEO_BACKEND_URL", "").rstrip("/")
    if not backend_url:
        return {
            "job_id": f"demo-video-{uuid4().hex[:10]}",
            "status": "preview",
            "mode": "preview",
            "message": "当前仅保存脚本和分镜，尚未配置视频渲染服务，未生成成片。",
        }

    payload = {
        "title": request.video_package.get("hook", "购车顾问短视频"),
        "script": request.video_package.get("voiceover", ""),
        "manual_shot_plan": request.video_package.get("shots", []),
        "metadata": {
            "source": "weijian-workspace",
            "workspace_id": workspace_id,
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
        "message": "短视频任务已提交，成片状态以独立视频服务返回为准。",
    }
