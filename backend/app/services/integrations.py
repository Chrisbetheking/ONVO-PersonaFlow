from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol
from uuid import uuid4


class IntegrationAdapter(Protocol):
    name: str
    mode: str

    def status(self) -> dict[str, Any]: ...
    def sync(self, payload: dict[str, Any] | None = None) -> dict[str, Any]: ...


@dataclass
class DemoAdapter:
    name: str
    label: str
    records: list[dict[str, Any]]
    mode: str = "demo"

    def status(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "mode": self.mode,
            "connected": False,
            "ready": True,
            "notice": "演示连接器，未连接生产系统",
            "record_count": len(self.records),
        }

    def sync(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "id": f"sync-{self.name}-{uuid4().hex[:8]}",
            "integration": self.name,
            "mode": "demo",
            "status": "completed",
            "summary": f"模拟同步 {len(self.records)} 条{self.label}数据",
            "created_at": datetime.now().isoformat(timespec="seconds"),
            "details": {"created": 0, "updated": len(self.records), "conflicts": 1 if self.name == "crm" else 0},
            "records": self.records,
        }


FEISHU_DEMO = DemoAdapter("feishu", "飞书知识", [
    {"knowledge_id": "knowledge-l80-positioning", "field": "活动结束日期", "before": "2026-07-31", "after": "2026-07-28"},
    {"knowledge_id": "knowledge-l80-space", "field": "体验建议", "before": "空车体验", "after": "真实物品试装"},
])
CRM_DEMO = DemoAdapter("crm", "CRM 客户", [
    {"customer_id": "customer-chen", "stage": "试驾前", "advisor_id": "advisor-hz-02", "source": "CRM Demo Adapter"},
    {"customer_id": "customer-xu", "stage": "预约中", "advisor_id": "advisor-sh-01", "source": "CRM Demo Adapter"},
])
MESSAGING_DEMO = DemoAdapter("messaging", "授权沟通渠道", [
    {"customer_id": "customer-chen", "direction": "inbound", "text": "周日可以到店，希望带儿童推车一起试装。", "channel": "授权私聊 Demo"},
])
TRENDS_DEMO = DemoAdapter("trends", "公开趋势", [
    {"topic": "真实家庭物品试装", "source": "模拟公开趋势", "trend": "上升", "notice": "不代表真实平台统计"},
])

ADAPTERS: dict[str, DemoAdapter] = {
    item.name: item for item in (FEISHU_DEMO, CRM_DEMO, MESSAGING_DEMO, TRENDS_DEMO)
}


def adapter_statuses() -> list[dict[str, Any]]:
    return [adapter.status() for adapter in ADAPTERS.values()]


def run_demo_sync(name: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        return ADAPTERS[name].sync(payload)
    except KeyError as exc:
        raise KeyError(f"Unknown integration: {name}") from exc
