# 蔚见｜客户经营与销售质量智能中枢

> 把企业知识、客户沟通和门店人工判断连成可追溯的经营闭环；既帮助顾问推进客户下一步，也帮助组织及时发现知识变化和服务质量信号。

ONVO PersonaFlow v0.4.2 延续 v0.3.x 的今日机会、内容作战台、跟进、审核和批量任务，在同一 React / TypeScript / Vite + FastAPI 工程中增加企业知识、热点雷达、客户 360、承诺台账、质量辅导、优秀案例和 Demo Adapter。它不是自动处罚系统，也不把演示数据伪装成生产数据。

## 三个闭环

```text
知识更新：模拟飞书知识变化 → 新版本 → 影响分析 → 重新核验任务 → 通知与审计
客户经营：客户咨询 → 下一最佳行动 → 可信内容 → 审核 → 跟进/试驾/承诺 → 记忆更新
组织学习：沟通证据 → 待复核信号 → 员工说明 → 经理确认 → 辅导或优秀案例
```

## 角色空间

- **顾问空间**：今日机会、客户沟通、内容作战台、跟进与承诺、客户档案。
- **门店经理空间**：门店雷达、审核队列、客户风险、质量与辅导、承诺履约、活动执行。
- **总部运营空间**：热点与洞察、知识中心、政策与权益、活动编排、优秀案例、效果验证、系统治理。

公开演示允许同一身份切换三个空间，并明确标记“角色演示”；这不代表已实现企业 RBAC。


## v0.4.2 UI/UX 专项升级

- 保留顾问、门店经理和总部运营三个空间及全部既有业务能力，不新增业务范围；
- 建立统一设计 Token、共享按钮、状态、标签、浮层、命令栏和可访问焦点规则；
- 今日机会、客户沟通、内容作战台、承诺、客户档案和顾问画像改为高密度列表—详情—上下文工作台；
- 每个业务状态只保留一个主操作，次级操作进入菜单，Demo 工具与真实业务操作分区；
- 1366×768 下不产生页面级横向溢出，客户上下文和事实合规侧栏可折叠；
- stale 内容不显示绿色“已核验”，提交、发送和批准继续遵守原有服务端核验阻断。

## 90 秒演示路径

1. 在右上角切换到“总部运营空间”，打开“知识中心”。
2. 点击“模拟飞书知识变更”，查看新知识版本、diff、影响对象和重新核验任务。
3. 切换“顾问空间”，进入内容作战台；编辑正文后，事实与合规状态立即变为“需要重新核验”，提交被禁用。
4. 执行重新核验后提交审核。
5. 切换“门店经理空间”，查看完整内容、证据和风险后人工批准。
6. 打开“跟进与承诺”，将客户沟通中的承诺确认、提醒并标记完成。
7. 在“质量与辅导”查看原始证据、员工说明，由经理创建辅导计划；不自动处罚。

完整路径见 [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)。

## 已真实实现

- 浏览器 UUID + `X-Workspace-Id` 工作区隔离、TTL、线程安全清理和当前会话独立重置。
- 内容编辑后 claims、evidence、compliance 失效；重新核验后才能提交或批准。
- 服务端根据 `customer_id` 获取负责顾问，不信任客户端随意指定 actor。
- 企业知识版本、变化 diff、影响对象、重新核验任务、模拟通知和审计记录。
- 客户 360、判断依据、下一最佳行动及其接受/延后/转经理状态。
- 客户承诺确认、提醒、延期、完成、超时模拟和时间线更新。
- 销售质量待复核队列、原始沟通证据、员工补充说明、经理决定和辅导计划。
- 经理确认后的优秀案例发布。
- 热点转内容、触达、知识草稿或辅导任务。
- DeepSeek 可选增强、规则 fallback、短视频连接器、批量任务和离线演示。

## Demo / 真实边界

- 当前公开仓库使用脱敏固定样本和当前 workspace 内的真实状态变更。
- 飞书、CRM、企业沟通渠道和外部趋势使用结构化 Demo Adapter，并在界面标记“模拟同步”“演示数据”或“未连接生产系统”。
- 当前没有连接真实飞书企业应用、CRM、企业微信、真实试驾系统、HR 处罚系统或舆情爬虫。
- 模型不可用时使用规则 fallback，不能显示为 DeepSeek 结果。
- 所有质量信号都需要员工补充和经理人工确认；系统不自动处罚或扣分。

完整边界见 [REAL_DEMO_BOUNDARY.md](./REAL_DEMO_BOUNDARY.md)。

## 技术架构

```text
Vercel / Vite React
  ├─ 角色空间、客户经营、知识、质量与审核工作区
  ├─ localStorage workspace UUID
  └─ 明确标记的离线 Demo Adapter
                  │ X-Workspace-Id
                  ▼
Render / FastAPI
  ├─ WorkspaceStore：深复制、隔离、TTL、RLock
  ├─ 内容/事实/合规/审核/跟进服务
  ├─ 企业知识、热点、承诺、质量、案例服务
  ├─ Feishu / CRM / Messaging / Trends Demo Adapter
  └─ DeepSeek 与视频服务可选连接器
```

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)、[DATA_MODEL.md](./DATA_MODEL.md) 和 [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)。

## 本地运行

要求：Python 3.12+、Node.js 22+、npm。

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

另开终端：

```bash
cd frontend
npm ci
npm run dev
```

打开 `http://localhost:5173`。

## 环境变量

复制 `.env.example`。真实密钥只放后端部署环境，不提交 GitHub。

最小配置：

```env
CORS_ORIGINS=http://localhost:5173
LLM_PROVIDER_MODE=demo
INTEGRATION_MODE=demo
```

DeepSeek 可选配置：

```env
LLM_PROVIDER_MODE=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

生产连接器占位变量及映射见 [.env.example](./.env.example) 和 [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)。

## Vercel 与 Render

### Render 后端

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check: /api/health
```

### Vercel 前端

```text
Framework: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

前端环境变量：

```env
VITE_API_BASE=https://你的-render-后端地址
```

完整上线检查见 [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)。

## 验证

```bash
python3 -m compileall -q backend/app
cd backend && PYTHONPATH=. python3 -m pytest -q
cd ../frontend
npm ci
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm audit --audit-level=moderate
npm run build
cd ..
python3 scripts/release_integrity.py
```

CI 执行同样的检查，并在 Playwright 失败时上传 `playwright-report` 和 `test-results`。

## 当前限制与生产接入

- 当前状态存于进程内 workspace；生产环境需迁移到 PostgreSQL / Redis 并保留审计和隔离语义。
- Demo Adapter 仅模拟同步、差异、审批和通知；生产接入必须完成 OAuth、Webhook 验签、字段映射、冲突策略和权限审计。
- 当前不自动发布内容、不自动联系客户、不创建真实试驾预约。
- 当前效果验证页只提供实验设计与样本边界，不声称已经获得真实转化提升。

## 仓库文档

- [FEATURE_PARITY.md](./FEATURE_PARITY.md)：v0.3.x 功能保留与 v0.4.0 新入口。
- [ENTERPRISE_PRODUCT_MAP.md](./ENTERPRISE_PRODUCT_MAP.md)：角色、页面与业务闭环。
- [REAL_DEMO_BOUNDARY.md](./REAL_DEMO_BOUNDARY.md)：真实实现、Demo Adapter 和接口占位。
- [DATA_MODEL.md](./DATA_MODEL.md)：核心对象和稳定 ID。
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)：飞书、CRM、沟通和趋势接入方式。
- [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)：90 秒、3 分钟和 8 分钟演示。
- [JUDGE_QA.md](./JUDGE_QA.md)：评委问答。
- [TEST_REPORT.md](./TEST_REPORT.md)：实际测试结果。
- [DESIGN_REFERENCE_MATRIX.md](./DESIGN_REFERENCE_MATRIX.md)：交互参考和明确拒绝的模式。
- [RELEASE_INTEGRITY_REPORT.md](./RELEASE_INTEGRITY_REPORT.md)：发布一致性检查。
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)：v0.4.2 设计 Token、组件和工作台规则。
- [UI_REVIEW.md](./UI_REVIEW.md)：逐页布局、交互、响应式和遗留问题。
