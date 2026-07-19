# TEST_REPORT｜v0.4.2 UI/UX 专项

## 基线与范围

唯一代码基线为本轮上传的 `ONVO-PersonaFlow-main(1).zip`。本轮只修改前端 UI/UX、交互一致性、响应式、可访问性、UI 自动化与仓库文档；未新增业务范围，未改写后端业务逻辑。

## 最终工作区验证

| 顺序 | 命令 | 实际结果 |
|---:|---|---|
| 1 | `python3 -m compileall -q backend/app` | 通过 |
| 2 | `cd backend && PYTHONPATH=. python3 -m pytest -q` | **20 passed** |
| 3 | `cd frontend && npm ci` | **61 packages 安装成功** |
| 4 | `npm run typecheck` | 通过 |
| 5 | `npm test` | **4 test files / 14 tests passed** |
| 6 | `npx playwright install --with-deps chromium` | 已真实执行；环境无法解析 `deb.debian.org`，命令超时，未完成系统依赖下载 |
| 7 | `npm run test:e2e` | 使用环境内 Chromium 执行，**19/19 scenarios passed** |
| 8 | `npm audit --audit-level=moderate` | **0 vulnerabilities** |
| 9 | `npm run build` | 通过 |
| 10 | `npm run ui:review` | **1/1 passed，生成 11 张验收截图** |
| 11 | `python3 scripts/release_integrity.py` | **PASSED** |

本地 E2E 使用：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

GitHub Actions 仍使用标准安装与执行路径：

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

## 生产构建

```text
1601 modules transformed
dist/assets/index-es-ELBbk.css  76.43 kB / gzip 13.84 kB
dist/assets/index-C3REBOR2.js  352.33 kB / gzip 105.13 kB
```

## E2E 新增 UI 验收

- 1366×768 无页面级横向溢出；
- 内容作战台事实与合规侧栏可折叠；
- 中文界面不出现裸 `pending`、`recommended`；
- stale 时不出现绿色“已核验”，提交保持禁用；
- 重新核验后恢复提交；
- 当前会话和客户档案对象写入 URL，刷新后保留；
- 承诺不同状态只呈现一个主操作，Demo 工具独立分区；
- 主要图标操作具有可访问名称。

## 截图验收

`npm run ui:review` 生成：

```text
artifacts/ui-review/advisor-today-1440.png
artifacts/ui-review/advisor-messages-1440.png
artifacts/ui-review/advisor-studio-1440.png
artifacts/ui-review/advisor-promises-1440.png
artifacts/ui-review/advisor-customer-1440.png
artifacts/ui-review/manager-radar-1440.png
artifacts/ui-review/manager-quality-1440.png
artifacts/ui-review/ops-hotspots-1440.png
artifacts/ui-review/ops-knowledge-1440.png
artifacts/ui-review/advisor-studio-1366.png
artifacts/ui-review/advisor-messages-1366.png
```

## 保留的业务真实性测试

原有 E2E 继续覆盖：完整顾问链路、批量任务重试、顾问画像持久化、Workspace 隔离、离线演示、视频失败状态、知识变更、核验失效与恢复、客户承诺、质量辅导、优秀案例和角色空间切换。页面改造未通过修改测试来掩盖功能缺失。

## 环境限制

Playwright 官方依赖安装命令在当前沙箱因 Debian 软件源 DNS 解析失败而未完成；这不等同于命令通过。浏览器测试使用环境内 `/usr/bin/chromium` 真实执行并全部通过。
