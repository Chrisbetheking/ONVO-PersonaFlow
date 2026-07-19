from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import RLock
from typing import Any


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class ModelAccessDecision:
    allowed: bool
    reason: str
    status_code: int = 200
    retry_after: int = 0
    mode: str = "rules"


class DemoQuotaManager:
    """In-memory guardrail for the public demo model connector.

    The public demo remains usable without a model token because callers fall back
    to the deterministic rule engine. A valid short-lived token is required before
    any configured paid model can be used.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._minute_calls: dict[str, deque[float]] = defaultdict(deque)
        self._daily_calls: dict[tuple[str, str], int] = defaultdict(int)
        self._global_daily_calls: dict[str, int] = defaultdict(int)
        self._audit: deque[dict[str, Any]] = deque(maxlen=500)

    @staticmethod
    def public_demo_mode() -> bool:
        return _env_bool("PUBLIC_DEMO_MODE", True)

    @staticmethod
    def token_configured() -> bool:
        return bool(os.getenv("PUBLIC_DEMO_TOKEN", "").strip())

    @staticmethod
    def batch_limit() -> int:
        return max(1, min(100, int(os.getenv("PUBLIC_DEMO_BATCH_LIMIT", "12"))))

    @staticmethod
    def _minute_limit() -> int:
        return max(1, int(os.getenv("PUBLIC_DEMO_MODEL_CALLS_PER_MINUTE", "3")))

    @staticmethod
    def _daily_limit() -> int:
        return max(1, int(os.getenv("PUBLIC_DEMO_MODEL_CALLS_PER_DAY", "20")))

    @staticmethod
    def _daily_budget() -> int:
        return max(1, int(os.getenv("PUBLIC_DEMO_MODEL_DAILY_BUDGET", "100")))

    @staticmethod
    def _today() -> str:
        return datetime.now(timezone.utc).date().isoformat()

    def check(self, *, workspace_id: str, client_ip: str, token: str | None, units: int = 1) -> ModelAccessDecision:
        if not self.public_demo_mode():
            return ModelAccessDecision(True, "非公开演示模式，允许使用已配置模型。", mode="model")

        expected = os.getenv("PUBLIC_DEMO_TOKEN", "").strip()
        if not expected:
            return ModelAccessDecision(False, "公开演示默认使用规则引擎；未配置短期模型令牌。", mode="rules")
        if not token or token.strip() != expected:
            return ModelAccessDecision(False, "未提供有效的短期 Demo Token，已使用规则引擎。", status_code=403, mode="rules")

        now = time.time()
        day = self._today()
        key = f"{client_ip}:{workspace_id}"
        units = max(1, int(units))
        with self._lock:
            minute = self._minute_calls[key]
            while minute and now - minute[0] >= 60:
                minute.popleft()
            if len(minute) + units > self._minute_limit():
                retry_after = max(1, int(60 - (now - minute[0]))) if minute else 60
                self._record(key, workspace_id, client_ip, "rate_limited_minute", units)
                return ModelAccessDecision(False, "模型调用过于频繁，请稍后重试。", 429, retry_after, "blocked")

            if self._daily_calls[(day, key)] + units > self._daily_limit():
                self._record(key, workspace_id, client_ip, "rate_limited_daily", units)
                return ModelAccessDecision(False, "当前浏览器工作区今日模型额度已用完，请明日再试或继续使用规则生成。", 429, 3600, "blocked")

            if self._global_daily_calls[day] + units > self._daily_budget():
                self._record(key, workspace_id, client_ip, "budget_exhausted", units)
                return ModelAccessDecision(False, "公开演示今日模型预算已达到上限，系统仍可使用规则引擎。", 429, 3600, "blocked")

            for _ in range(units):
                minute.append(now)
            self._daily_calls[(day, key)] += units
            self._global_daily_calls[day] += units
            self._record(key, workspace_id, client_ip, "allowed", units)
            return ModelAccessDecision(True, "短期 Demo Token 有效，模型调用已计入公开演示额度。", mode="model")

    def _record(self, key: str, workspace_id: str, client_ip: str, outcome: str, units: int) -> None:
        self._audit.appendleft({
            "key": key,
            "workspace_id": workspace_id,
            "client_ip": client_ip,
            "outcome": outcome,
            "units": units,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        })

    def stats(self) -> dict[str, Any]:
        day = self._today()
        with self._lock:
            return {
                "public_demo_mode": self.public_demo_mode(),
                "token_configured": self.token_configured(),
                "calls_per_minute": self._minute_limit(),
                "calls_per_workspace_day": self._daily_limit(),
                "global_daily_budget": self._daily_budget(),
                "global_daily_used": self._global_daily_calls[day],
                "batch_limit": self.batch_limit(),
                "audit_entries": len(self._audit),
            }

    def reset_for_tests(self) -> None:
        with self._lock:
            self._minute_calls.clear()
            self._daily_calls.clear()
            self._global_daily_calls.clear()
            self._audit.clear()


QUOTA_MANAGER = DemoQuotaManager()
