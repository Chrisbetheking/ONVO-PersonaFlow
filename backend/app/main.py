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
from .services.llm_provider import enhance_result, is_enabled, provider_mode
from .services.store import advisors, get_advisor, get_vehicle, vehicles

APP_VERSION = "0.1.0"
KNOWLEDGE_VERSION = "onvo-cn-2026.07.18"

app = FastAPI(
    title="ONVO PersonaFlow API",
    version=APP_VERSION,
    description="Competition prototype for advisor-personalized, grounded and compliant social content.",
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


class BatchGenerateRequest(BaseModel):
    advisor_ids: list[str] = Field(min_length=1, max_length=1000)
    vehicle_id: str
    campaign_name: str = Field(min_length=2, max_length=100)
    campaign_brief: str = Field(min_length=5, max_length=1000)
    platforms: list[str] = Field(min_length=1, max_length=4)
    use_llm: bool = False


class ComplianceRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    has_evidence: bool = True


class LeadRequest(BaseModel):
    messages: list[str] = Field(min_length=1, max_length=500)


class VideoRequest(BaseModel):
    task_id: str
    advisor_id: str
    video_package: dict[str, Any]


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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "mode": "llm-assisted" if is_enabled() else "competition-demo",
        "llm_provider_mode": provider_mode(),
        "version": APP_VERSION,
        "knowledge_version": KNOWLEDGE_VERSION,
    }


@app.get("/api/bootstrap")
def bootstrap() -> dict[str, Any]:
    return {
        "advisors": advisors(),
        "vehicles": [{key: value for key, value in item.items() if key != "verified_facts"} for item in vehicles()],
        "metrics": {
            "content_generated": 1286,
            "advisors_activated": 186,
            "compliance_pass_rate": 98.6,
            "high_intent_leads": 73,
        },
        "campaigns": [
            {"name": "L80 二孩家庭空间季", "advisors": 42, "variants": 168, "compliance": 99.1},
            {"name": "L60 城市通勤种草", "advisors": 36, "variants": 144, "compliance": 98.4},
            {"name": "L90 三代同堂体验日", "advisors": 28, "variants": 112, "compliance": 97.8},
        ],
    }


@app.post("/api/content/generate")
async def content_generate(request: GenerateRequest) -> dict[str, Any]:
    advisor = _safe_get_advisor(request.advisor_id)
    vehicle = _safe_get_vehicle(request.vehicle_id)
    result = generate_content(
        advisor=advisor,
        vehicle=vehicle,
        campaign_name=request.campaign_name,
        campaign_brief=request.campaign_brief,
        platforms=request.platforms,
    )
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
            raise HTTPException(status_code=502, detail=f"Configured LLM generation failed: {exc}") from exc
    return result


@app.post("/api/content/batch-generate")
async def content_batch_generate(request: BatchGenerateRequest) -> dict[str, Any]:
    if len(set(request.advisor_ids)) != len(request.advisor_ids):
        raise HTTPException(status_code=422, detail="advisor_ids must not contain duplicates")
    vehicle = _safe_get_vehicle(request.vehicle_id)
    results: list[dict[str, Any]] = []
    for advisor_id in request.advisor_ids:
        advisor = _safe_get_advisor(advisor_id)
        result = generate_content(
            advisor=advisor,
            vehicle=vehicle,
            campaign_name=request.campaign_name,
            campaign_brief=request.campaign_brief,
            platforms=request.platforms,
        )
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
                raise HTTPException(status_code=502, detail=f"Configured LLM batch generation failed for {advisor_id}: {exc}") from exc
        results.append(result)
    personalization_scores = [variant["personalization_score"] for result in results for variant in result["variants"]]
    compliance_scores = [variant["compliance_score"] for result in results for variant in result["variants"]]
    return {
        "batch_id": f"batch-{uuid4().hex[:12]}",
        "advisor_count": len(results),
        "variant_count": sum(len(result["variants"]) for result in results),
        "results": results,
        "summary": {
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
            "mode": "safe-demo",
            "message": "已创建演示视频任务；配置 VIDEO_BACKEND_URL 后可连接独立的视频渲染服务。",
        }

    payload = {
        "title": request.video_package.get("hook", "ONVO PersonaFlow competition video"),
        "script": request.video_package.get("voiceover", ""),
        "manual_shot_plan": request.video_package.get("shots", []),
        "metadata": {
            "source": "onvo-personaflow-competition",
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
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(f"{backend_url}/api/video/full-ai/tts-first/start", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Video backend unavailable: {exc}") from exc
    return {
        "job_id": str(data.get("job_id") or data.get("id") or uuid4().hex),
        "status": str(data.get("status") or "submitted"),
        "mode": "external-sanitized-connector",
        "message": "视频任务已提交到独立渲染服务。",
    }
