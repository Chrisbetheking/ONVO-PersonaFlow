from __future__ import annotations

import os
from datetime import datetime, timezone
from statistics import mean
from typing import Annotated, Any
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .services.annotations import annotate_variant
from .services.compliance import check_content
from .services.content_engine import generate_content
from .services.lead_engine import analyze as analyze_leads
from .services.llm_provider import enhance_result, is_enabled, provider_status, rewrite_text
from .services.quota import QUOTA_MANAGER, ModelAccessDecision
from .services.verification import issue_verification_token
from .services.store import get_vehicle, vehicles
from .services.enterprise import (
    create_promise, customer_action, customer_risk_action, employee_response, enterprise_snapshot,
    get_hotspot, get_knowledge, hotspot_action, impact_action, integration_sync, list_customers,
    list_hotspots, list_knowledge, list_promises, list_quality, manager_quality_decision,
    publish_best_practice, best_practice_action, convert_followup_event, reset_scenario, retry_sync_event,
    simulate_feishu_change, simulate_promise_time, switch_role, update_promise,
)
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
    mutate_state,
    append_audit,
)

APP_VERSION = "0.4.3"
API_SCHEMA_VERSION = "1"
KNOWLEDGE_VERSION = "onvo-cn-2026.07.18"
BUILD_TIME = os.getenv("BUILD_TIME", "").strip() or datetime.now(timezone.utc).isoformat(timespec="seconds")
GIT_COMMIT = next((
    os.getenv(name, "").strip()
    for name in ("RENDER_GIT_COMMIT", "VERCEL_GIT_COMMIT_SHA", "GIT_COMMIT", "SOURCE_VERSION")
    if os.getenv(name, "").strip()
), "unknown")

app = FastAPI(
    title="蔚见 API",
    version=APP_VERSION,
    description="客户经营、企业知识、销售质量与可信沟通工作流。",
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
DemoToken = Annotated[str | None, Header(alias="X-Demo-Token")]


def _client_ip(request: Request) -> str:
    # Render and common reverse proxies append the edge-observed client address.
    # Use the right-most non-empty value so a caller cannot bypass the quota by
    # prepending an arbitrary X-Forwarded-For entry.
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
    if forwarded:
        return forwarded[-1]
    return request.client.host if request.client else "unknown"


def _model_access(
    *,
    request: Request,
    workspace_id: str,
    token: str | None,
    units: int = 1,
) -> ModelAccessDecision:
    return QUOTA_MANAGER.check(
        workspace_id=workspace_id,
        client_ip=_client_ip(request),
        token=token,
        units=units,
    )


def _raise_quota_error(decision: ModelAccessDecision) -> None:
    if decision.status_code != 429:
        return
    raise HTTPException(
        status_code=429,
        detail=decision.reason,
        headers={"Retry-After": str(decision.retry_after or 60)},
    )


def _audit_model_access(workspace_id: str, decision: ModelAccessDecision, *, object_id: str) -> None:
    append_audit(
        workspace_id,
        actor="公开演示网关",
        role="系统治理",
        action=f"模型调用：{decision.mode}",
        object_type="model_call",
        object_id=object_id,
        after={"allowed": decision.allowed, "reason": decision.reason, "status_code": decision.status_code},
        demo_flag=True,
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
    scheduled_at: str = Field(default="", max_length=100)
    items: list[str] = Field(default_factory=list, max_length=30)
    notes: str = Field(default="", max_length=1000)
    source_label: str = Field(default="", max_length=200)
    sync_status: str = Field(default="", max_length=100)
    task_id: str = Field(default="", max_length=200)
    variant_id: str = Field(default="", max_length=200)
    verification_version: int = 0
    verification_token: str = Field(default="", max_length=300)


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
    verification_status: str = "verified"
    compliance_status: str = "verified"
    knowledge_version: str = KNOWLEDGE_VERSION
    verification_version: int = 1
    verified_at: str = ""
    verification_token: str = ""
    version_history: list[dict[str, Any]] = Field(default_factory=list)


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


class ContentRevalidateRequest(BaseModel):
    task_id: str
    variant_id: str
    advisor_id: str
    vehicle_id: str
    platform: str
    title: str
    body: str = Field(min_length=1, max_length=20000)
    call_to_action: str = Field(default="", max_length=2000)
    version: int = 1


class ReviewRevalidateRequest(BaseModel):
    body: str | None = Field(default=None, max_length=20000)
    call_to_action: str | None = Field(default=None, max_length=2000)
    risk_annotations: list[dict[str, Any]] | None = None


class RoleSwitchRequest(BaseModel):
    role: str
    actor_id: str | None = None


class HotspotActionRequest(BaseModel):
    action: str
    reason: str = ""


class FeishuChangeRequest(BaseModel):
    change_type: str


class ImpactActionRequest(BaseModel):
    object_id: str
    action: str
    reason: str = ""
    owner: str = ""


class CustomerActionRequest(BaseModel):
    action_id: str
    action: str
    note: str = ""


class PromiseCreateRequest(BaseModel):
    customer_id: str
    advisor_id: str
    original_message: str = ""
    commitment: str
    due_at: str
    completion_criteria: str = "顾问确认完成"
    remind_at: str = ""
    source: str = "手动创建 Demo"


class PromiseActionRequest(BaseModel):
    action: str
    due_at: str = ""
    reason: str = ""
    evidence: str = ""


class QualityResponseRequest(BaseModel):
    response: str
    improvement_plan: str = ""


class QualityDecisionRequest(BaseModel):
    decision: str
    reason: str = ""


class BestPracticeActionRequest(BaseModel):
    action: str


class RiskActionRequest(BaseModel):
    action: str
    note: str = ""


class ConversationConvertRequest(BaseModel):
    action: str
    note: str = ""


class SyncRetryRequest(BaseModel):
    reason: str = "手动重试"


class ScenarioRequest(BaseModel):
    scenario_id: str


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


def _stamp_variant_verification(task_id: str, variant: dict[str, Any], knowledge_version: str, verified_at: str) -> dict[str, Any]:
    verification_version = int(variant.get("verification_version") or 1)
    variant.update({
        "verification_status": "verified",
        "compliance_status": "verified",
        "knowledge_version": knowledge_version,
        "verification_version": verification_version,
        "verified_at": verified_at,
        "verification_token": issue_verification_token(
            task_id=task_id, variant_id=variant.get("id", ""), platform=variant.get("platform", ""),
            title=variant.get("title", ""), body=variant.get("body", ""),
            call_to_action=variant.get("call_to_action", ""), verification_version=verification_version,
            knowledge_version=knowledge_version,
        ),
        "version_history": variant.get("version_history") or [{"type": "generated", "at": verified_at, "version": verification_version}],
    })
    return variant


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
        for variant in result.get("variants", []):
            _stamp_variant_verification(result["task_id"], variant, result["audit"].get("knowledge_version", KNOWLEDGE_VERSION), result["audit"].get("generated_at", ""))
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
        "app_version": APP_VERSION,
        "git_commit": GIT_COMMIT,
        "build_time": BUILD_TIME,
        "api_schema_version": API_SCHEMA_VERSION,
        "knowledge_version": KNOWLEDGE_VERSION,
        "provider": provider_status(),
        "public_demo_quota": QUOTA_MANAGER.stats(),
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
        "enterprise": enterprise_snapshot(workspace_id),
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

@app.post("/api/followups/{customer_id}/events/{event_id}/convert")
def convert_customer_event(customer_id: str, event_id: str, request: ConversationConvertRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return convert_followup_event(workspace_id, customer_id, event_id, request.action, request.note)
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
        if not variant.get("verification_token"):
            _stamp_variant_verification(
                result.get("task_id") or task_id,
                variant,
                result.get("audit", {}).get("knowledge_version", KNOWLEDGE_VERSION),
                result.get("audit", {}).get("generated_at", ""),
            )
        draft_payload = {
            "task_id": result["task_id"], "variant_id": variant["id"], "platform": variant["platform"],
            "title": variant["title"], "body": variant["body"], "call_to_action": variant["call_to_action"],
            "claims": variant.get("claims", []), "risk_annotations": variant.get("risk_annotations", []),
            "evidence": result.get("evidence", []), "status": "draft",
            "verification_status": variant.get("verification_status", "verified"),
            "compliance_status": variant.get("compliance_status", "verified"),
            "knowledge_version": variant.get("knowledge_version", KNOWLEDGE_VERSION),
            "verification_version": variant.get("verification_version", 1),
            "verified_at": variant.get("verified_at", ""), "verification_token": variant.get("verification_token", ""),
            "version_history": variant.get("version_history", []),
        }
        save_draft(workspace_id, draft_payload)
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
            "verification_status": variant.get("verification_status", "verified"),
            "compliance_status": variant.get("compliance_status", "verified"),
            "knowledge_version": variant.get("knowledge_version", KNOWLEDGE_VERSION),
            "verification_version": variant.get("verification_version", 1),
            "verified_at": variant.get("verified_at", ""),
            "verification_token": variant.get("verification_token", ""),
            "version_history": variant.get("version_history", []),
        })
        updated = {**task, "status": "submitted", "review_id": review["id"]}
        update_campaign_task(workspace_id, campaign_id, task_id, updated)
        return review
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/drafts/save")
def draft_save(request: DraftRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return save_draft(workspace_id, request.model_dump())
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/drafts/submit-review")
def draft_submit_review(request: ReviewSubmitRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        return submit_review(workspace_id, request.model_dump())
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/demo/reset")
def demo_reset(workspace_id: WorkspaceId) -> dict[str, Any]:
    state = reset_workspace(workspace_id)
    return {
        "opportunities": state["opportunities"],
        "followups": state["followups"],
        "reviews": state["reviews"],
        "campaigns": state["campaigns"],
        "enterprise": enterprise_snapshot(workspace_id),
        "data_mode": "demo",
    }


@app.post("/api/content/generate")
async def content_generate(
    payload: GenerateRequest,
    http_request: Request,
    workspace_id: WorkspaceId,
    x_demo_token: DemoToken = None,
) -> dict[str, Any]:
    advisor = _safe_get_advisor(workspace_id, payload.advisor_id)
    vehicle = _safe_get_vehicle(payload.vehicle_id)
    customer_context = payload.customer_context
    if payload.opportunity_id and not customer_context:
        try:
            customer_context = get_opportunity(workspace_id, payload.opportunity_id).get("customer")
        except KeyError:
            customer_context = None
    result = generate_content(
        advisor=advisor,
        vehicle=vehicle,
        campaign_name=payload.campaign_name,
        campaign_brief=payload.campaign_brief,
        platforms=payload.platforms,
        customer_context=customer_context,
        opportunity_id=payload.opportunity_id,
    )
    result["audit"].update({"ai_used": False, "provider": "规则引擎", "model": "grounded-template"})

    if payload.use_llm and is_enabled():
        decision = _model_access(
            request=http_request,
            workspace_id=workspace_id,
            token=x_demo_token,
            units=1,
        )
        _audit_model_access(workspace_id, decision, object_id=result.get("task_id", "content-generate"))
        _raise_quota_error(decision)
        if decision.allowed:
            try:
                result = await enhance_result(
                    result,
                    advisor=advisor,
                    vehicle=vehicle,
                    campaign_name=payload.campaign_name,
                    campaign_brief=payload.campaign_brief,
                    customer_context=customer_context,
                )
            except (httpx.HTTPError, RuntimeError, ValueError) as exc:
                result["audit"]["ai_warning"] = f"模型调用失败，已保留可审核的基础版本：{exc}"
        else:
            result["audit"]["ai_warning"] = decision.reason
        result["audit"]["quota_mode"] = decision.mode
        result["audit"]["quota_notice"] = decision.reason
    elif payload.use_llm:
        result["audit"]["ai_warning"] = "尚未配置可用的大模型，已使用规则与事实库生成基础版本。"
        result["audit"]["quota_mode"] = "rules"

    for variant in result.get("variants", []):
        _stamp_variant_verification(
            result.get("task_id", ""),
            variant,
            result.get("audit", {}).get("knowledge_version", KNOWLEDGE_VERSION),
            result.get("audit", {}).get("generated_at", ""),
        )
    return result


@app.post("/api/content/rewrite")
async def content_rewrite(
    payload: RewriteRequest,
    http_request: Request,
    workspace_id: WorkspaceId,
    x_demo_token: DemoToken = None,
) -> dict[str, Any]:
    advisor = _safe_get_advisor(workspace_id, payload.advisor_id)
    vehicle = _safe_get_vehicle(payload.vehicle_id)
    decision = _model_access(
        request=http_request,
        workspace_id=workspace_id,
        token=x_demo_token,
        units=1,
    ) if is_enabled() else ModelAccessDecision(False, "尚未配置可用的大模型，已使用规则改写。", mode="rules")
    _audit_model_access(workspace_id, decision, object_id="content-rewrite")
    _raise_quota_error(decision)
    try:
        result = await rewrite_text(
            payload.text,
            instruction=payload.instruction,
            advisor=advisor,
            vehicle=vehicle,
            customer_context=payload.customer_context,
            allow_model=decision.allowed,
        )
        result["quota_mode"] = decision.mode
        result["quota_notice"] = decision.reason
        return result
    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"局部改写失败：{exc}") from exc


@app.post("/api/content/batch-generate")
async def content_batch_generate(
    payload: BatchGenerateRequest,
    http_request: Request,
    workspace_id: WorkspaceId,
    x_demo_token: DemoToken = None,
) -> dict[str, Any]:
    if len(set(payload.advisor_ids)) != len(payload.advisor_ids):
        raise HTTPException(status_code=422, detail="顾问列表不能包含重复项。")
    task_count = len(payload.advisor_ids) * len(payload.platforms)
    if QUOTA_MANAGER.public_demo_mode() and task_count > QUOTA_MANAGER.batch_limit():
        raise HTTPException(
            status_code=422,
            detail=f"公开演示单次批量任务最多 {QUOTA_MANAGER.batch_limit()} 项，当前为 {task_count} 项。",
        )

    model_allowed = False
    quota_notice = "批量任务使用规则引擎。"
    quota_mode = "rules"
    if payload.use_llm and is_enabled():
        decision = _model_access(
            request=http_request,
            workspace_id=workspace_id,
            token=x_demo_token,
            units=task_count,
        )
        _audit_model_access(workspace_id, decision, object_id=payload.campaign_id or "batch-generate")
        _raise_quota_error(decision)
        model_allowed = decision.allowed
        quota_notice = decision.reason
        quota_mode = decision.mode

    vehicle = _safe_get_vehicle(payload.vehicle_id)
    results: list[dict[str, Any]] = []
    warnings: list[str] = []
    tasks: list[dict[str, Any]] = []
    campaign_id = payload.campaign_id or f"ad-hoc-{uuid4().hex[:8]}"

    if payload.use_llm and not model_allowed:
        warnings.append(quota_notice)

    for advisor_id in payload.advisor_ids:
        advisor = _safe_get_advisor(workspace_id, advisor_id)
        try:
            result = generate_content(
                advisor=advisor,
                vehicle=vehicle,
                campaign_name=payload.campaign_name,
                campaign_brief=payload.campaign_brief,
                platforms=payload.platforms,
            )
            result["audit"].update({
                "ai_used": False,
                "provider": "规则引擎",
                "model": "grounded-template",
                "quota_mode": quota_mode,
                "quota_notice": quota_notice,
            })
            if model_allowed:
                try:
                    result = await enhance_result(
                        result,
                        advisor=advisor,
                        vehicle=vehicle,
                        campaign_name=payload.campaign_name,
                        campaign_brief=payload.campaign_brief,
                    )
                except (httpx.HTTPError, RuntimeError, ValueError) as exc:
                    warnings.append(f"{advisor['name']}：{exc}")
            for variant in result.get("variants", []):
                _stamp_variant_verification(
                    result["task_id"],
                    variant,
                    result["audit"].get("knowledge_version", KNOWLEDGE_VERSION),
                    result["audit"].get("generated_at", ""),
                )
            results.append(result)
            tasks.extend(
                _task_from_variant(
                    campaign_id=campaign_id,
                    result=result,
                    variant=variant,
                    advisor=advisor,
                )
                for variant in result["variants"]
            )
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
            } for platform in payload.platforms)

    personalization_scores = [variant["personalization_score"] for result in results for variant in result["variants"]]
    compliance_scores = [variant["compliance_score"] for result in results for variant in result["variants"]]
    summary = {
        "total": len(tasks),
        "ready": sum(1 for task in tasks if task["status"] == "ready"),
        "pending_review": sum(1 for task in tasks if task["status"] == "needs_review"),
        "failed": sum(1 for task in tasks if task["status"] == "failed"),
    }
    campaign = None
    if payload.campaign_id:
        try:
            campaign = update_campaign_run(workspace_id, payload.campaign_id, tasks)
        except KeyError:
            warnings.append("活动状态未更新：未找到对应 campaign_id")
    return {
        "batch_id": f"batch-{uuid4().hex[:12]}",
        "advisor_count": len(payload.advisor_ids),
        "variant_count": len(tasks),
        "results": results,
        "tasks": tasks,
        "campaign": campaign,
        "warnings": warnings,
        "quota_mode": quota_mode,
        "quota_notice": quota_notice,
        "summary": {
            **summary,
            "avg_personalization": round(mean(personalization_scores), 1) if personalization_scores else 0,
            "avg_compliance": round(mean(compliance_scores), 1) if compliance_scores else 0,
            "human_review_required": 1,
        },
    }


@app.post("/api/content/revalidate")
def content_revalidate(request: ContentRevalidateRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    advisor = _safe_get_advisor(workspace_id, request.advisor_id)
    vehicle = _safe_get_vehicle(request.vehicle_id)
    evidence = [
        {"id": "evidence-positioning", "field": "车型定位", "value": vehicle["positioning"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"], "source_type": "官方产品页"},
        {"id": "evidence-price-full", "field": "整车购买起价", "value": vehicle["full_purchase_from"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"], "source_type": "官方产品页"},
        {"id": "evidence-price-baas", "field": "BaaS 起价", "value": vehicle["baas_from"], "source_title": vehicle["source_title"], "source_url": vehicle["source_url"], "verified_at": vehicle["verified_at"], "source_type": "官方产品页"},
    ]
    combined = "\n".join([request.title, request.body, request.call_to_action])
    compliance = check_content(combined, has_evidence=True)
    variant = annotate_variant({
        "id": request.variant_id,
        "advisor_id": advisor["id"], "advisor_name": advisor["name"], "platform": request.platform,
        "title": request.title, "body": request.body, "call_to_action": request.call_to_action,
        "hashtags": [], "personalization_score": 0, "grounding_score": 100,
        "compliance_score": compliance["score"], "status": "ready_for_human_review" if compliance["passed"] else "needs_revision",
        "personalization_reasons": [], "version": request.version + 1,
    }, evidence, compliance)
    if not variant.get("risk_annotations") and variant.get("claims"):
        claim_text = variant["claims"][0].get("text", "")
        variant["risk_annotations"] = [{
            "id": f"risk-dynamic-{uuid4().hex[:8]}", "text": claim_text, "level": "info",
            "rule": "动态事实发布前复核", "reason": "价格、活动和权益可能随时间或地区变化。",
            "suggestion": "具体配置、价格与权益以发布当天乐道官方最新信息为准。",
        }]
    verified_at = datetime.now().isoformat(timespec="seconds")
    verification_version = request.version + 1
    variant.update({
        "verification_status": "verified", "compliance_status": "verified", "knowledge_version": KNOWLEDGE_VERSION,
        "verification_version": verification_version, "verified_at": verified_at,
        "verification_token": issue_verification_token(
            task_id=request.task_id, variant_id=request.variant_id, platform=request.platform, title=request.title,
            body=request.body, call_to_action=request.call_to_action, verification_version=verification_version,
            knowledge_version=KNOWLEDGE_VERSION,
        ),
        "version_history": [{"type": "revalidated", "at": verified_at, "knowledge_version": KNOWLEDGE_VERSION}],
    })
    return {"variant": variant, "evidence": evidence, "compliance": compliance, "verification": {"status": "verified", "at": verified_at, "knowledge_version": KNOWLEDGE_VERSION, "method": "规则 + 官方事实"}}


@app.post("/api/reviews/{review_id}/revalidate")
def review_revalidate(review_id: str, request_update: ReviewRevalidateRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    state = snapshot(workspace_id)
    review = next((item for item in state.get("reviews", []) if item.get("id") == review_id), None)
    if not review:
        raise HTTPException(status_code=404, detail="未找到审核任务")
    request = ContentRevalidateRequest(
        task_id=review["task_id"], variant_id=review.get("variant_id") or review["task_id"], advisor_id=review["advisor_id"],
        vehicle_id=review["vehicle_id"], platform=review["platform"], title=review.get("content_title") or review["title"],
        body=request_update.body if request_update.body is not None else (review.get("reviewed_body") or review.get("body", "")), call_to_action=request_update.call_to_action if request_update.call_to_action is not None else (review.get("reviewed_call_to_action") or review.get("call_to_action", "")),
        version=int(review.get("verification_version") or 1),
    )
    checked = content_revalidate(request, workspace_id)
    def mutation(current: dict[str, Any]) -> dict[str, Any]:
        target = next(item for item in current["reviews"] if item["id"] == review_id)
        if request_update.body is not None:
            target["reviewed_body"] = request_update.body
        if request_update.call_to_action is not None:
            target["reviewed_call_to_action"] = request_update.call_to_action
        target["claims"] = checked["variant"]["claims"]
        target["risk_annotations"] = checked["variant"]["risk_annotations"] if request_update.risk_annotations is None else request_update.risk_annotations
        target["evidence"] = checked["evidence"]
        target["verification_status"] = "verified"
        target["compliance_status"] = "verified"
        target["evidence_status"] = "已重新核验"
        target["knowledge_version"] = checked["verification"]["knowledge_version"]
        target["verification_version"] = checked["variant"]["verification_version"]
        target["verified_at"] = checked["verification"]["at"]
        target["verification_token"] = checked["variant"].get("verification_token", "")
        target.setdefault("version_history", []).append({"type": "manager_revalidated", "at": checked["verification"]["at"], "body": target["reviewed_body"]})
        current.setdefault("audit_log", []).insert(0, {
            "id": f"audit-{uuid4().hex[:10]}",
            "actor": "门店经理 Demo",
            "role": "门店经理空间",
            "action": "经理重新核验审核内容",
            "object_type": "review",
            "object_id": review_id,
            "before": {"verification_status": review.get("verification_status"), "verification_version": review.get("verification_version")},
            "after": {"verification_status": "verified", "verification_version": target["verification_version"]},
            "knowledge_version": target["knowledge_version"],
            "verification_version": target["verification_version"],
            "demo_flag": True,
            "workspace_id": workspace_id,
            "created_at": checked["verification"]["at"],
        })
        return target
    return mutate_state(workspace_id, mutation)


@app.get("/api/enterprise")
def enterprise_get(workspace_id: WorkspaceId) -> dict[str, Any]:
    return enterprise_snapshot(workspace_id)


@app.post("/api/enterprise/role")
def enterprise_role(request: RoleSwitchRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    return switch_role(workspace_id, request.role, request.actor_id)


@app.get("/api/hotspots")
def hotspots_get(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": list_hotspots(workspace_id), "data_mode": "demo"}


@app.get("/api/hotspots/{hotspot_id}")
def hotspot_get(hotspot_id: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return get_hotspot(workspace_id, hotspot_id)
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/hotspots/{hotspot_id}/actions")
def hotspot_create_action(hotspot_id: str, request: HotspotActionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return hotspot_action(workspace_id, hotspot_id, request.action, request.reason)
    except Exception as exc: raise _http_error(exc) from exc


@app.get("/api/knowledge")
def knowledge_list(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": list_knowledge(workspace_id), "data_mode": "demo"}


@app.get("/api/knowledge/{knowledge_id}")
def knowledge_get(knowledge_id: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return get_knowledge(workspace_id, knowledge_id)
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/integrations/feishu/simulate-change")
def feishu_simulate_change(request: FeishuChangeRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return simulate_feishu_change(workspace_id, request.change_type)
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/integrations/{name}/sync")
def integration_demo_sync(name: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return integration_sync(workspace_id, name)
    except Exception as exc: raise _http_error(exc) from exc

@app.post("/api/sync-events/{event_id}/retry")
def sync_event_retry(event_id: str, request: SyncRetryRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try:
        result = retry_sync_event(workspace_id, event_id)
        result["retry_reason"] = request.reason
        return result
    except Exception as exc:
        raise _http_error(exc) from exc


@app.post("/api/knowledge-impacts/{impact_id}/actions")
def knowledge_impact_action(impact_id: str, request: ImpactActionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return impact_action(workspace_id, impact_id, request.object_id, request.action, request.reason, request.owner)
    except Exception as exc: raise _http_error(exc) from exc


@app.get("/api/customers")
def customers_get(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": list_customers(workspace_id), "data_mode": "demo"}


@app.post("/api/customers/{customer_id}/next-actions")
def customer_next_action(customer_id: str, request: CustomerActionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return customer_action(workspace_id, customer_id, request.action_id, request.action, request.note)
    except Exception as exc: raise _http_error(exc) from exc


@app.get("/api/promises")
def promises_get(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": list_promises(workspace_id), "data_mode": "demo"}


@app.post("/api/promises")
def promises_create(request: PromiseCreateRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return create_promise(workspace_id, request.model_dump())
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/promises/{promise_id}/actions")
def promises_action(promise_id: str, request: PromiseActionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return update_promise(workspace_id, promise_id, request.action, request.model_dump())
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/promises/{promise_id}/simulate/{state_name}")
def promise_simulate(promise_id: str, state_name: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return simulate_promise_time(workspace_id, promise_id, state_name)
    except Exception as exc: raise _http_error(exc) from exc


@app.get("/api/quality-signals")
def quality_get(workspace_id: WorkspaceId) -> dict[str, Any]:
    return {"items": list_quality(workspace_id), "data_mode": "demo"}


@app.post("/api/quality-signals/{signal_id}/employee-response")
def quality_employee(signal_id: str, request: QualityResponseRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return employee_response(workspace_id, signal_id, request.response, request.improvement_plan)
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/quality-signals/{signal_id}/manager-decision")
def quality_manager(signal_id: str, request: QualityDecisionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return manager_quality_decision(workspace_id, signal_id, request.decision, request.reason)
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/best-practices/{practice_id}/publish")
def best_practice_publish(practice_id: str, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return publish_best_practice(workspace_id, practice_id)
    except Exception as exc: raise _http_error(exc) from exc




@app.post("/api/best-practices/{practice_id}/actions")
def best_practice_update(practice_id: str, request: BestPracticeActionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return best_practice_action(workspace_id, practice_id, request.action)
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/customer-risks/{risk_id}/actions")
def customer_risk_update(risk_id: str, request: RiskActionRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return customer_risk_action(workspace_id, risk_id, request.action, request.note)
    except Exception as exc: raise _http_error(exc) from exc


@app.post("/api/demo/scenario")
def demo_scenario(request: ScenarioRequest, workspace_id: WorkspaceId) -> dict[str, Any]:
    try: return reset_scenario(workspace_id, request.scenario_id)
    except Exception as exc: raise _http_error(exc) from exc


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
