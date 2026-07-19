# TEST_REPORT｜v0.4.3 稳定性与部署一致性

## 基线与范围

- 公开仓库：`Chrisbetheking/ONVO-PersonaFlow`。
- 本轮开始时 `main` 最新 Commit：`fb0a785de6498c1a128f1b2a91d2e4b3d4223680`。
- 本地代码基线由用户上传的完整 main ZIP 与已进入 main 的 v0.4.2 替换文件重建。
- 本轮没有新增业务模块，只修复版本一致性、角色切换、网络状态、客户沟通布局、状态中文化、公开模型额度、CI 和生产 Smoke 缺口。

## 实际执行结果

| 顺序 | 命令 | 结果 |
|---:|---|---|
| 1 | `python3 -m compileall -q backend/app` | 通过 |
| 2 | `cd backend && PYTHONPATH=. python3 -m pytest -q` | **23 passed** |
| 3 | `cd frontend && npm ci` | **62 packages installed；0 vulnerabilities** |
| 4 | `npm run typecheck` | 通过 |
| 5 | `npm test` | **7 files / 19 tests passed** |
| 6 | `npm run lint` | 通过 |
| 7 | `npm run format:check` | 通过 |
| 8 | `npx playwright install --with-deps chromium` | 已执行；当前沙箱无法解析 `deb.debian.org`，未完成下载 |
| 9 | `npm run test:e2e` | **27/27 passed（Production Smoke 使用独立配置）** |
| 10 | `npm audit --audit-level=moderate` | **0 vulnerabilities** |
| 11 | `npm run build` | 通过 |
| 12 | `python3 scripts/release_integrity.py` | 发布包生成前最终执行 |

本地 E2E 使用环境已有 Chromium：

```bash
E2E_HOST=localhost \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
npm run test:e2e
```

官方安装命令仍保留在 GitHub Actions；当前沙箱的 DNS 限制不等同于命令通过。

## 稳定性测试结果

- 角色空间点击后不等待角色审计和完整 Workspace 下载；实测导航变化 **25.00 ms**，低于 150 ms 目标。
- 角色审计请求失败后保持当前数据，并显示可重试错误；不会静默进入本地演示。
- 1366×768、1440×900、1920×1080 下每个可见 `.timeline-body` 宽度不低于 240 px。
- 客户与顾问消息保持 `horizontal-tb`，页面无横向溢出。
- 收起侧栏后 `.brand-copy` 的 computed style 为 `display:none` 且宽度为 0。
- 页面不暴露 `open`、`pending_review`、`high`、`current`、`superseded`、`manager_assigned`、`published` 等内部枚举。
- 单个网络请求失败进入 `stale_online`，只有用户明确选择后才进入 `local_demo`。
- 公开模型分钟额度超限返回 HTTP 429 和中文提示。
- 客户沟通 `toHaveScreenshot` 视觉回归通过。
- UI Review 截图流程通过并生成 11 张本地验收图。

## 后端新增覆盖

- `/api/health` 返回 v0.4.3、Git Commit、构建时间和 API schema；
- IP + workspace 的分钟和每日额度；
- 全局每日模型预算；
- 批量任务硬上限；
- 429 与模型调用审计；
- Workspace、审计、承诺、通知、任务和事件限长；
- 达到 Workspace 上限后的优雅淘汰与统计。

## 生产 Smoke

测试代码和 GitHub Actions 工作流已经加入，但本次没有生产 URL 和部署权限，因此 3 条 Production Smoke 与本地 E2E 分离，未在无生产 URL 的环境执行，未伪装为线上通过。部署后的操作见 [PRODUCTION_SMOKE_REPORT.md](./PRODUCTION_SMOKE_REPORT.md)。

## 生产构建

```text
1604 modules transformed
dist/assets/index-B5oxnVvn.css  77.15 kB / gzip 14.04 kB
dist/assets/index-CG6yXQSu.js  357.63 kB / gzip 106.93 kB
```
