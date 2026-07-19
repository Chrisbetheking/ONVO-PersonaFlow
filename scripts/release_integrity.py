#!/usr/bin/env python3
"""Release integrity checks for ONVO PersonaFlow.

Run from the repository root:
    python3 scripts/release_integrity.py

Patch verification:
    python3 scripts/release_integrity.py --manifest PATCH_MANIFEST.md --zip patch.zip
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

REQUIRED_DOCS = [
    "README.md",
    "ARCHITECTURE.md",
    "FEATURE_PARITY.md",
    "REAL_DEMO_BOUNDARY.md",
    "ENTERPRISE_PRODUCT_MAP.md",
    "DATA_MODEL.md",
    "INTEGRATION_GUIDE.md",
    "DEMO_SCRIPT.md",
    "JUDGE_QA.md",
    "TEST_REPORT.md",
    "DEPLOY_CHECKLIST.md",
    "DESIGN_REFERENCE_MATRIX.md",
    "RELEASE_INTEGRITY_REPORT.md",
]

REQUIRED_PAGES = [
    "frontend/src/pages/RadarPage.tsx",
    "frontend/src/pages/KnowledgePage.tsx",
    "frontend/src/pages/PolicyPage.tsx",
    "frontend/src/pages/Customer360Page.tsx",
    "frontend/src/pages/PromisesPage.tsx",
    "frontend/src/pages/QualityPage.tsx",
    "frontend/src/pages/BestPracticesPage.tsx",
    "frontend/src/pages/CustomerRiskPage.tsx",
    "frontend/src/pages/ExperimentsPage.tsx",
    "frontend/src/pages/GovernancePage.tsx",
]


def read(root: Path, rel: str) -> str:
    path = root / rel
    if not path.is_file():
        raise AssertionError(f"missing file: {rel}")
    return path.read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def local_markdown_links(text: str) -> set[str]:
    links: set[str] = set()
    for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
        target = target.strip().split("#", 1)[0].split("?", 1)[0]
        if not target or "://" in target or target.startswith(("mailto:", "#")):
            continue
        if target.lower().endswith(".md"):
            links.add(target)
    return links


def manifest_paths(text: str) -> list[str]:
    paths: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        match = re.match(r"^(?:ADD|MODIFY|DELETE)\s*\|\s*([^|]+?)(?:\s*\||$)", line)
        if match and not line.startswith("DELETE"):
            paths.append(match.group(1).strip().replace("\\", "/"))
    return paths


def run_checks(root: Path, manifest: Path | None, archive: Path | None) -> list[str]:
    passed: list[str] = []

    package = json.loads(read(root, "frontend/package.json"))
    lock = json.loads(read(root, "frontend/package-lock.json"))
    require(package.get("version") == "0.4.1", "frontend/package.json version must be 0.4.1")
    require(lock.get("version") == "0.4.1", "package-lock top version must be 0.4.1")
    require(lock.get("packages", {}).get("", {}).get("version") == "0.4.1", "package-lock root version must be 0.4.1")
    passed.append("frontend version is 0.4.1")

    api = read(root, "frontend/src/api.ts")
    require("X-Workspace-Id" in api, "api.ts must send X-Workspace-Id")
    passed.append("workspace header exists")

    followup = read(root, "frontend/src/pages/FollowUpPage.tsx")
    require("actor: '周辰'" not in followup and 'actor: "周辰"' not in followup, "FollowUpPage must not hard-code 周辰")
    for marker in ["booking-dialog", "booking-time", "booking-items", "booking-notes", "confirm-booking"]:
        require(marker in followup, f"FollowUpPage missing {marker}")
    passed.append("follow-up booking is data-driven")

    advisors = read(root, "frontend/src/pages/AdvisorsPage.tsx")
    require("updateAdvisor" in advisors, "AdvisorsPage must call updateAdvisor")
    passed.append("advisor persistence hook exists")

    review = read(root, "frontend/src/pages/ReviewPage.tsx")
    require("review-body" in review and "review-detail" in review, "ReviewPage must render full review detail")
    require("content_excerpt" not in review or "full_body" in review or "body" in review, "ReviewPage cannot rely only on content_excerpt")
    require("revalidate" in review.lower(), "manager edits must support revalidation")
    passed.append("review detail and revalidation exist")

    for rel in REQUIRED_PAGES:
        require((root / rel).is_file(), f"missing enterprise page: {rel}")
    passed.append("enterprise pages exist")

    workspace = read(root, "backend/app/services/workspace.py")
    main = read(root, "backend/app/main.py")
    content_editor = read(root, "frontend/src/features/content-generation/ContentEditor.tsx")
    require("needs_revalidation" in workspace and "content-revalidation-warning" in content_editor, "stale verification state missing")
    evidence_panel = read(root, "frontend/src/features/evidence-trace/EvidencePanel.tsx")
    require("待重新核验" in evidence_panel and "verificationStatus" in evidence_panel, "stale evidence presentation missing")
    enterprise_service = read(root, "backend/app/services/enterprise.py")
    require('customer.get("advisor_id")' in enterprise_service and "create_promise" in enterprise_service, "promise advisor must be resolved server-side")
    require("/api/content/revalidate" in main and "/api/reviews/{review_id}/revalidate" in main, "revalidation APIs missing")
    require("enterprise" in main and "/api/integrations/feishu/simulate-change" in main, "enterprise routes missing")
    passed.append("server-side revalidation and enterprise routes exist")

    for rel in REQUIRED_DOCS:
        require((root / rel).is_file(), f"missing required document: {rel}")
    readme = read(root, "README.md")
    for target in local_markdown_links(readme):
        require((root / target).is_file(), f"README dead local Markdown link: {target}")
    passed.append("required documents and README links exist")

    ci = read(root, ".github/workflows/ci.yml")
    for command in [
        "python -m compileall -q app",
        "python -m pytest -q",
        "npm ci",
        "npm run typecheck",
        "npm test",
        "playwright install --with-deps chromium",
        "npm run test:e2e",
        "npm audit --audit-level=moderate",
        "npm run build",
        "python3 scripts/release_integrity.py",
        "actions/upload-artifact@v4",
    ]:
        require(command in ci, f"CI missing: {command}")
    require("if: failure()" in ci and "if-no-files-found: ignore" in ci, "CI failure artifact conditions missing")
    passed.append("CI runs full validation and uploads E2E artifacts")

    e2e = read(root, "frontend/e2e/personaflow.spec.ts")
    source_text = "\n".join(
        p.read_text(encoding="utf-8", errors="ignore")
        for p in (root / "frontend/src").rglob("*.tsx")
    )
    testids = set(re.findall(r"getByTestId\(['\"]([^'\"]+)['\"]\)", e2e))
    dynamic_prefixes = set(re.findall(r"data-testid=\{`([^`$]+)\$\{", source_text))
    missing_testids = sorted(
        testid for testid in testids
        if testid not in source_text and not any(testid.startswith(prefix) for prefix in dynamic_prefixes)
    )
    require(not missing_testids, f"E2E testids absent from source: {missing_testids}")
    passed.append(f"{len(testids)} literal E2E testids exist in source")

    if manifest or archive:
        require(manifest is not None and archive is not None, "--manifest and --zip must be supplied together")
        manifest_text = manifest.read_text(encoding="utf-8")
        paths = manifest_paths(manifest_text)
        require(paths, "manifest contains no ADD/MODIFY entries")
        with zipfile.ZipFile(archive) as zf:
            zip_files = sorted(name for name in zf.namelist() if not name.endswith("/"))
        require(sorted(paths) == zip_files, f"manifest/ZIP mismatch: manifest={len(paths)} zip={len(zip_files)}")
        for rel in paths:
            require((root / rel).is_file(), f"manifest file missing in final workspace: {rel}")
        passed.append(f"patch manifest exactly matches {len(paths)} ZIP files")

    return passed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--manifest")
    parser.add_argument("--zip", dest="archive")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    try:
        passed = run_checks(root, Path(args.manifest).resolve() if args.manifest else None, Path(args.archive).resolve() if args.archive else None)
    except (AssertionError, OSError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        print(f"RELEASE INTEGRITY: FAILED\n- {exc}", file=sys.stderr)
        return 1
    print("RELEASE INTEGRITY: PASSED")
    for item in passed:
        print(f"- {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
