# TEST_REPORT｜v0.4.1

## 基线

唯一基线：`ONVO-PersonaFlow-v0.4.0-DIRECT-UPLOAD.zip`。

基线修改前已实际执行：

| 检查 | 结果 |
|---|---|
| 后端 pytest | 16 passed |
| 前端 typecheck | 通过 |
| 前端单元测试 | 13 passed |
| npm audit | 0 vulnerabilities |
| production build | 通过 |

## v0.4.1 最终工作区验证

| 顺序 | 命令 | 实际结果 |
|---:|---|---|
| 1 | `python3 -m compileall -q backend/app` | 通过 |
| 2 | `cd backend && PYTHONPATH=. python3 -m pytest -q` | **20 passed** |
| 3 | `cd frontend && npm ci` | **61 packages 安装成功** |
| 4 | `npm run typecheck` | 通过 |
| 5 | `npm test` | **4 test files / 14 tests passed** |
| 6 | `npx playwright install --with-deps chromium` | 已真实执行；当前沙箱 DNS 无法解析 `deb.debian.org`，依赖下载未完成 |
| 7 | `npm run test:e2e` | 使用环境内 Chromium 执行，**15/15 scenarios passed** |
| 8 | `npm audit --audit-level=moderate` | **0 vulnerabilities** |
| 9 | `npm run build` | 通过 |
| 10 | `python3 scripts/release_integrity.py` | **PASSED** |

生产构建：

```text
1598 modules transformed
dist/assets/index-C6byaXdS.css  56.87 kB / gzip 10.50 kB
dist/assets/index-CT_Eocxh.js  340.09 kB / gzip 101.88 kB
```

本地 E2E 使用：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

GitHub Actions 仍按正式流程执行：

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright 失败工件由 CI 上传 `frontend/playwright-report` 与 `frontend/test-results`；截图、trace 和失败视频均位于这些目录中。

## 干净基线应用补丁复验

重新解压基线 ZIP，将本轮 46 个新增/修改文件覆盖后，再次执行：

| 检查 | 复验结果 |
|---|---|
| backend compileall | 通过 |
| backend pytest | **20 passed** |
| frontend npm ci | 61 packages |
| typecheck | 通过 |
| unit tests | **14 passed** |
| Playwright E2E | **15/15 passed** |
| npm audit | **0 vulnerabilities** |
| production build | 通过 |
| release integrity | **PASSED** |

## P0 核验完整性覆盖

- 标题修改后，当前版本和证据进入 `needs_revalidation`；
- 正文修改后，提交审核被禁用；
- CTA 修改后，旧核验凭证失效；
- 应用合规建议与局部改写复用同一失效逻辑；
- 重新核验后生成新的 `verification_version` 和签名 token；
- 服务端拒绝伪造 token；
- 未保存最新核验版本时拒绝送审和发送；
- 经理修改正文或 CTA 后不能直接批准；
- 重新核验后才可批准。

## 业务真实性覆盖

- 两个 workspace 隔离和独立重置；
- 顾问画像保存、刷新和重置；
- 客户消息转记忆、顾虑、承诺和下一行动；
- 预约使用客户实际负责顾问；
- 承诺确认、改期、延期、超时、经理协助和完成证据；
- 门店审核完整正文、claim、evidence、risk 和经理修改；
- 批量任务单条重试、全部失败重试和抽样送审；
- 飞书 Demo 知识新版本、diff、影响对象和重新核验任务；
- 质量信号、员工说明、经理决定和辅导计划；
- 优秀案例人工发布；
- 角色空间、场景重置和刷新持久化；
- 离线规则 Demo 主链路。

## 页面交互参考验收

| 页面 | 最终参考的交互 | 适合购车顾问场景的原因 |
|---|---|---|
| 今日机会 | Plane 的紧凑待处理队列 + Twenty 的客户属性层级 | 顾问先判断今天处理什么，再进入具体客户上下文 |
| 内容作战台 | 自定义三段式上下文/编辑/可信性工作区 | 内容、客户和证据需要同时可见，不能拆成孤立页面 |
| 客户沟通 | Chatwoot 的会话列表与联系人上下文 | 适合连续处理客户回复、来源、动作和下一步 |
| 跟进与承诺 | Twenty 的活动记录 + Cal.com 的预约确认 | 承诺与预约必须有时间、负责人、原因和状态 |
| 门店审核 | Chatwoot 的队列/上下文 + 逐句核验 | 经理需要基于完整正文和证据做人工决定 |
| 批量任务 | Plane 的紧凑任务明细与失败重试 | 总部活动要落到每位顾问、每个平台的可追踪任务 |
| 客户 360 | Twenty 的列表详情和属性依据 | 不使用黑盒分数，每个客户状态都可解释 |
| 质量与辅导 | Chatwoot 的原始会话上下文 + Plane 的处理状态 | 系统只发现信号，员工说明和经理确认不可省略 |
| 试驾预约 | Cal.com 的时间、参与物品和确认流程 | 避免点击即写死预约，确保记录可修改和追溯 |
| 系统治理 | shadcn/ui 的 Dialog、状态和焦点原则 | 保持现有技术栈，同时让 Demo Adapter 和审计操作明确 |

## 未接入的生产能力

下列能力仍为 Demo Adapter 或生产接口占位，测试结果不代表已接入真实企业系统：

- 飞书企业应用；
- CRM；
- 企业微信或其他授权沟通平台；
- 真实试驾系统；
- 真实舆情抓取；
- HR / 合规处罚系统；
- 生产数据库与 RBAC。
