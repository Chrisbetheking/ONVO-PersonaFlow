from __future__ import annotations

import hashlib
import hmac
import os
from typing import Any

_SIGNING_KEY = os.getenv("VERIFICATION_SIGNING_KEY", "personaflow-demo-verification-key").encode("utf-8")


def content_signature(*, task_id: str, variant_id: str, platform: str, title: str, body: str, call_to_action: str, verification_version: int, knowledge_version: str) -> str:
    normalized = "\n".join([
        str(task_id).strip(), str(variant_id).strip(), str(platform).strip(), str(title).strip(),
        str(body).strip(), str(call_to_action).strip(), str(int(verification_version)), str(knowledge_version).strip(),
    ])
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def issue_verification_token(**payload: Any) -> str:
    digest = content_signature(**payload)
    return hmac.new(_SIGNING_KEY, digest.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_verification_token(token: str | None, **payload: Any) -> bool:
    if not token:
        return False
    expected = issue_verification_token(**payload)
    return hmac.compare_digest(str(token), expected)
