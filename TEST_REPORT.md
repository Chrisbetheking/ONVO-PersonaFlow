# ONVO PersonaFlow v0.3.1 测试报告

## 唯一基线

本轮唯一基线为用户上传的 `ONVO-PersonaFlow-main.zip`。没有复用此前会话的旧工作目录，也没有假设任何旧输出已进入 GitHub。

逐文件审查发现，该 ZIP 中的 `FollowUpPage.tsx`、`AdvisorsPage.tsx`、`ReviewPage.tsx` 和 `CampaignPage.tsx` 已经包含 v0.3.1 主要功能实现；真实不一致集中在仓库文档缺失、README 死链接、CI 未运行 Playwright、E2E 断言不足、lock 版本与发布清单不一致。本补丁只修改真实存在的差异，没有无意义重写正确页面。

## 第一轮：修复工作区

| 命令 | 结果 |
|---|---|
| `python3 -m compileall -q backend/app` | 通过 |
| `cd backend && PYTHONPATH=. python3 -m pytest -q` | 通过，12 passed |
| `cd frontend && npm ci` | 通过，61 packages，0 vulnerabilities |
| `npm run typecheck` | 通过 |
| `npm test` | 通过，3 files / 10 tests |
| `npx playwright install chromium` | 已真实执行；沙箱 DNS 无法解析 `cdn.playwright.dev`，返回 `EAI_AGAIN` |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 通过，9 个隔离场景测试 |
| `npm audit --audit-level=moderate` | 通过，0 vulnerabilities |
| `npm run build` | 通过，1587 modules transformed |
| `python3 scripts/release_integrity.py` | 通过，补丁与 Manifest 均为 19 个文件 |

## 第二轮：全新 GitHub main 基线覆盖补丁后

重新解压用户上传的 `ONVO-PersonaFlow-main.zip`，再覆盖 `ONVO-PersonaFlow-V0.3.1-INTEGRITY-PATCH.zip`，没有复制修复工作区的其他文件。

| 命令 | 结果 |
|---|---|
| `python3 -m compileall -q backend/app` | 通过 |
| `cd backend && PYTHONPATH=. python3 -m pytest -q` | 通过，12 passed |
| `cd frontend && npm ci` | 通过，61 packages，0 vulnerabilities |
| `npm run typecheck` | 通过 |
| `npm test` | 通过，3 files / 10 tests |
| `npx playwright install chromium` | 已真实执行；同样因当前沙箱外网 DNS 限制失败，非仓库代码错误 |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 通过，9/9 场景 |
| `npm audit --audit-level=moderate` | 通过，0 vulnerabilities |
| `npm run build` | 通过，CSS 45.23 kB；JS 243.35 kB |
| `ONVO_PATCH_ARCHIVE=... python3 scripts/release_integrity.py` | 通过 |

本地沙箱使用预装 `/usr/bin/chromium` 完成真实浏览器测试。GitHub Actions 中保留标准命令 `npx playwright install --with-deps chromium`，并在失败时上传 `playwright-report` 和 `test-results`；截图、trace 与失败视频均位于这些工件中。

## E2E 真实行为覆盖

1. 今日机会进入内容作战台。
2. 生成私聊、朋友圈、小红书三个平台内容。
3. 点击事实陈述定位证据。
4. 点击风险表达并应用替换建议。
5. 保存草稿并提交完整正文、CTA、claims、risk annotations 和 evidence。
6. 经理查看完整审核内容，应用建议并批准或退回。
7. 客户回复进入时间线并生成记忆。
8. 陈女士预约记录使用周辰；许先生预约记录使用其实际负责顾问林悦。
9. 预约时间、携带物品和备注进入时间线。
10. 顾问画像保存、刷新、重置和保存失败状态均有断言。
11. 批量任务单项重试、全部失败项重试和抽样送审均产生状态变化。
12. 视频 preview 与 API failure 均有明确状态，未误报成片。
13. 两个浏览器 Workspace 互不影响，Hash 路由刷新不丢失。
14. 断网下规则生成、审核、回复、记忆、预约和批量任务可走通并标记为本地演示。
15. 主要按钮除可访问名称检查外，还分别具有机会完成、审核退回、预检结果等状态变化断言。

## 环境限制

唯一未能在本沙箱完成的是从 Playwright CDN 下载浏览器二进制，原因是 DNS `EAI_AGAIN`。这项命令已真实执行并如实记录；E2E 本身已使用系统 Chromium 两轮全部通过。CI 在正常 GitHub Runner 网络中执行官方安装命令。
