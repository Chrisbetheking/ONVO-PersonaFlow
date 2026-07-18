#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path(os.getenv("ONVO_PATCH_MANIFEST", str(ROOT / "PATCH_MANIFEST.md")))
PATCH_NAME = "ONVO-PersonaFlow-V0.3.1-INTEGRITY-PATCH.zip"
REQUIRE_PATCH_MANIFEST = os.getenv("ONVO_REQUIRE_PATCH_MANIFEST", "0") == "1"

errors: list[str] = []
warnings: list[str] = []
checks: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def ok(message: str) -> None:
    checks.append(message)


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        fail(f"缺少文件：{path}")
        return ""
    return target.read_text(encoding="utf-8")


package_path = ROOT / "frontend/package.json"
try:
    package = json.loads(package_path.read_text(encoding="utf-8"))
    if package.get("version") != "0.3.1":
        fail(f"frontend/package.json 版本不是 0.3.1：{package.get('version')}")
    else:
        ok("frontend/package.json 版本为 0.3.1")
except Exception as exc:  # pragma: no cover - integrity failure path
    fail(f"无法读取 frontend/package.json：{exc}")

api_source = read("frontend/src/api.ts")
if "X-Workspace-Id" not in api_source:
    fail("frontend/src/api.ts 缺少 X-Workspace-Id")
else:
    ok("API 请求携带 X-Workspace-Id")

followup_source = read("frontend/src/pages/FollowUpPage.tsx")
if re.search(r"actor\s*:\s*['\"]周辰['\"]", followup_source):
    fail("FollowUpPage 仍写死 actor: '周辰'")
for token in ("booking-dialog", "booking-time", "booking-items", "booking-notes", "confirm-booking", "advisor.name"):
    if token not in followup_source:
        fail(f"FollowUpPage 缺少预约实现标记：{token}")
else:
    if not any(f"FollowUpPage 缺少预约实现标记：{token}" in errors for token in ("booking-dialog", "booking-time", "booking-items", "booking-notes", "confirm-booking", "advisor.name")):
        ok("FollowUpPage 使用实际顾问并包含完整预约字段")

advisors_source = read("frontend/src/pages/AdvisorsPage.tsx")
for token in ("updateAdvisor", "advisor-audience", "advisor-style", "save-advisor"):
    if token not in advisors_source:
        fail(f"AdvisorsPage 缺少真实保存实现：{token}")
else:
    if not any("AdvisorsPage 缺少真实保存实现" in item for item in errors):
        ok("AdvisorsPage 调用 updateAdvisor 并具有保存测试标记")

review_source = read("frontend/src/pages/ReviewPage.tsx")
if "selected.content_excerpt" in review_source:
    fail("ReviewPage 仍直接使用 selected.content_excerpt")
for token in ("review-body", "review-detail", "review-mark-${segment.type}", "review-cta", "applyRiskSuggestion", "selected.evidence"):
    if token not in review_source:
        fail(f"ReviewPage 缺少完整审核实现：{token}")
else:
    if not any("ReviewPage 缺少完整审核实现" in item for item in errors):
        ok("ReviewPage 使用完整正文、CTA、逐句标注和证据")

# Ensure literal E2E test IDs resolve either to a static source ID or a dynamic source prefix.
e2e_source = read("frontend/e2e/personaflow.spec.ts")
source_text = "\n".join(
    path.read_text(encoding="utf-8")
    for path in (ROOT / "frontend/src").rglob("*")
    if path.suffix in {".ts", ".tsx"}
)
static_ids = set(re.findall(r"(?:data-testid|testId)=[\"']([^\"']+)[\"']", source_text))
dynamic_prefixes = set(re.findall(r"data-testid=\{`([^`$]*)\$\{", source_text))
e2e_ids = set(re.findall(r"getByTestId\(['\"]([^'\"]+)['\"]\)", e2e_source))
missing_test_ids: list[str] = []
for test_id in sorted(e2e_ids):
    if test_id in static_ids:
        continue
    if any(test_id.startswith(prefix) for prefix in dynamic_prefixes):
        continue
    missing_test_ids.append(test_id)
if missing_test_ids:
    fail("E2E 关键 data-testid 在源码中不存在：" + ", ".join(missing_test_ids))
else:
    ok(f"E2E 的 {len(e2e_ids)} 个字面 data-testid 均能映射到源码")

readme_source = read("README.md")
local_links = sorted(set(re.findall(r"\]\((?:\./)?([^)#]+\.md)(?:#[^)]+)?\)", readme_source)))
missing_links = [link for link in local_links if not (ROOT / link).is_file()]
if missing_links:
    fail("README 本地 Markdown 死链接：" + ", ".join(missing_links))
else:
    ok(f"README 的 {len(local_links)} 个本地 Markdown 链接均存在")

ci_source = read(".github/workflows/ci.yml")
for token in (
    "npx playwright install --with-deps chromium",
    "npm run test:e2e",
    "actions/upload-artifact@v4",
    "frontend/playwright-report",
    "frontend/test-results",
):
    if token not in ci_source:
        fail(f"CI 缺少 Playwright 完整性配置：{token}")
else:
    if not any("CI 缺少 Playwright 完整性配置" in item for item in errors):
        ok("CI 运行 Playwright 并在失败时上传报告、截图和 trace 所在目录")

manifest_entries: list[str] = []
if not MANIFEST.is_file():
    if REQUIRE_PATCH_MANIFEST:
        fail(f"缺少 PATCH_MANIFEST：{MANIFEST}")
    else:
        warnings.append("当前为公开仓库源码校验模式：未提供 PATCH_MANIFEST，已跳过补丁文件数量核验。")
else:
    manifest_source = MANIFEST.read_text(encoding="utf-8")
    declared_match = re.search(r"补丁文件总数：\s*(\d+)", manifest_source)
    for line in manifest_source.splitlines():
        match = re.match(r"\|\s*(?:ADD|MODIFY)\s*\|\s*`?([^|`]+?)`?\s*\|", line)
        if match:
            manifest_entries.append(match.group(1).strip())
    if len(manifest_entries) != len(set(manifest_entries)):
        fail("PATCH_MANIFEST.md 包含重复路径")
    for relative in manifest_entries:
        if not (ROOT / relative).is_file():
            fail(f"PATCH_MANIFEST 路径不存在：{relative}")
    if declared_match and int(declared_match.group(1)) != len(manifest_entries):
        fail(f"PATCH_MANIFEST 声明数量 {declared_match.group(1)} 与条目数量 {len(manifest_entries)} 不一致")
    elif not declared_match:
        fail("PATCH_MANIFEST 缺少“补丁文件总数”")
    else:
        ok(f"PATCH_MANIFEST 的 {len(manifest_entries)} 个文件均存在")

archive_candidates: list[Path] = []
if os.getenv("ONVO_PATCH_ARCHIVE"):
    archive_candidates.append(Path(os.environ["ONVO_PATCH_ARCHIVE"]))
archive_candidates.extend([ROOT / PATCH_NAME, ROOT.parent / PATCH_NAME, Path("/mnt/data") / PATCH_NAME])
archive = next((path for path in archive_candidates if path.is_file()), None)
if archive and manifest_entries:
    with zipfile.ZipFile(archive) as handle:
        archive_files = sorted(
            name.rstrip("/")
            for name in handle.namelist()
            if not name.endswith("/") and not name.startswith("__MACOSX/")
        )
    expected = sorted(manifest_entries)
    if archive_files != expected:
        only_archive = sorted(set(archive_files) - set(expected))
        only_manifest = sorted(set(expected) - set(archive_files))
        fail(
            "补丁 ZIP 与 PATCH_MANIFEST 不一致；"
            f"仅 ZIP：{only_archive or '无'}；仅 Manifest：{only_manifest or '无'}"
        )
    else:
        ok(f"补丁 ZIP 文件数量与 Manifest 完全一致：{len(archive_files)}")
else:
    warnings.append("未发现补丁 ZIP，已完成公开仓库源码一致性检查。")

print("ONVO PersonaFlow v0.3.1 release integrity")
for item in checks:
    print(f"[OK] {item}")
for item in warnings:
    print(f"[WARN] {item}")
for item in errors:
    print(f"[FAIL] {item}")

if errors:
    sys.exit(1)
print("Release integrity passed.")
