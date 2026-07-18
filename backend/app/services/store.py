from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(name: str) -> Any:
    with (DATA_DIR / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def vehicles() -> list[dict[str, Any]]:
    return _load_json("vehicles.json")


@lru_cache(maxsize=1)
def advisors() -> list[dict[str, Any]]:
    return _load_json("advisors.json")


@lru_cache(maxsize=1)
def compliance_rules() -> dict[str, Any]:
    return _load_json("compliance_rules.json")


def get_vehicle(vehicle_id: str) -> dict[str, Any]:
    for item in vehicles():
        if item["id"] == vehicle_id:
            return item
    raise KeyError(f"Unknown vehicle_id: {vehicle_id}")


def get_advisor(advisor_id: str) -> dict[str, Any]:
    for item in advisors():
        if item["id"] == advisor_id:
            return item
    raise KeyError(f"Unknown advisor_id: {advisor_id}")
