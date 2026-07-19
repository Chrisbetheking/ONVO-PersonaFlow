# 测试报告

> 本文件在 v0.4.0 最终发布验证后更新。所有数字必须来自实际命令，不以设计要求代替执行结果。

## 基线

基线：用户上传的 GitHub main 完整 ZIP（v0.3.1）。基线实际结果：后端 12 passed；前端单测 10 passed；Playwright 8 passed；audit 0 vulnerabilities；production build 通过。

## v0.4.0 验证项目

| 检查 | 命令 | 最终结果 |
|---|---|---|
| 后端编译 | `python3 -m compileall -q backend/app` | 通过 |
| 后端测试 | `cd backend && PYTHONPATH=. python3 -m pytest -q` | 16 passed |
| 前端安装 | `cd frontend && npm ci` | 61 packages，0 vulnerabilities |
| 类型检查 | `npm run typecheck` | 通过 |
| 前端单测 | `npm test` | 13 passed |
| Playwright 安装 | `npx playwright install --with-deps chromium` | 已执行；当前沙箱 DNS 无法解析 deb.debian.org，未完成下载 |
| E2E | `npm run test:e2e` | 使用系统 Chromium 完整执行，15 passed |
| 依赖审计 | `npm audit --audit-level=moderate` | 0 vulnerabilities |
| 生产构建 | `npm run build` | 通过；CSS 54.68 kB，JS 316.46 kB |
| 发布一致性 | `python3 scripts/release_integrity.py` | 通过 |

## 后端覆盖

- 双 workspace 隔离和独立场景重置；
- 飞书 Demo 变更创建知识版本、diff 和影响；
- 编辑后核验失效，未核验不能提交；
- 经理修改后不能直接批准，重新核验后可批准；
- 服务端根据 customer_id 确认负责顾问；
- 承诺创建、提醒、完成；
- 质量信号、员工说明和经理辅导；
- 优秀案例发布。

## 前端单元覆盖

- 角色空间和企业工作流纯函数；
- 知识 diff 和影响；
- 客户状态解释；
- 承诺状态；
- 质量复核；
- 编辑后核验失效；
- Demo 标签和原有路由/工作流。

## Playwright 覆盖

- 原 v0.3.1 顾问生成、审核、跟进、试驾、视频和批量任务；
- 飞书知识变更和影响分析；
- 内容编辑后重新核验；
- 客户 360 和下一最佳行动；
- 承诺状态；
- 员工说明与经理辅导；
- 优秀案例发布；
- 角色/场景刷新保留和 workspace 隔离；
- 主要企业操作产生真实状态变化。

## 设计参考落实

- 今日机会/批量队列：参考 Plane 的紧凑队列和状态变化，适合顾问按优先级处理工作。
- 客户档案/知识：参考 Twenty 的列表详情和属性层级，适合高信息密度客户与知识对象。
- 客户沟通/审核：参考 Chatwoot 的会话与上下文并列，适合查看原始沟通后做下一步判断。
- 试驾预约：参考 Cal.com 的时间、地点、参与人和确认流程，避免一键写死记录。
- 交互基础：借鉴 shadcn/ui 的 focus、disabled、dialog 和 toast 原则，但未引入其 Dashboard。
- 全局气质：保持明亮、温和、克制和服务导向，不复制品牌页面或 Token。

## 已知环境边界

公开沙箱可能无法从 Playwright CDN 下载浏览器。若安装命令受网络限制，必须如实记录；E2E 仍需使用可用 Chromium 执行。GitHub Actions 使用官方 `--with-deps chromium`。

## 干净基线复验

将补丁覆盖到重新解压的 `ONVO-PersonaFlow-main.zip` 后，重新执行：

- 后端 compileall：通过；
- 后端 pytest：16 passed；
- `npm ci`：通过；
- TypeScript：通过；
- 前端单测：13 passed；
- Playwright E2E：15 passed；
- npm audit：0 vulnerabilities；
- production build：通过；
- release integrity + Manifest/ZIP 一致性：通过。
