# 蔚见｜购车顾问私域经营 Agent

> 把客户真实问题转化成有事实依据、可审核、能推动试驾的沟通行动，并把后续反馈沉淀为下一次更准确的顾问记忆。

ONVO PersonaFlow（产品名：**蔚见**）面向一线购车顾问、门店经理和总部运营。它不是单纯的文案生成器，而是覆盖“机会发现—客户理解—多平台内容—事实溯源—风险审核—客户跟进—试驾预约—记忆更新”的工作流原型。

## 业务问题

购车顾问每天面对大量私聊、朋友圈活动和车型问题。统一素材难以匹配不同城市、客群和顾问表达方式；顾问自行创作又容易出现车型事实过期、价格权益表述不严谨、客户反馈无法沉淀等问题。蔚见将每一次内容任务放回具体客户、顾问、车型和活动上下文中，并要求事实与风险在发布前可定位、可修改、可追溯。

## 主要用户

- **购车顾问**：处理今日机会、生成和编辑沟通内容、记录客户回复与试驾。
- **门店经理**：查看完整正文和逐句依据，批准或退回内容。
- **总部/门店运营**：执行活动批量任务、查看失败明细、重试和抽样审核。

## 完整闭环

```text
总部活动 / 客户消息 / 历史反馈
              ↓
          今日机会
              ↓
     客户、顾问与场景理解
              ↓
     私聊 / 朋友圈 / 小红书
              ↓
       事实依据与风险定位
              ↓
          门店逐句审核
              ↓
       客户回复与试驾预约
              ↓
        客户和顾问记忆更新
              ↓
        下一轮推荐更加准确
```

## 90 秒演示路径

1. 在“今日机会”选择“陈女士 · L80 家庭空间咨询”。
2. 进入内容作战台，生成私聊、朋友圈和小红书三个版本。
3. 点击正文中的事实陈述和风险表达，查看右侧来源、核验日期、原因和替换建议。
4. 应用建议、保存并提交门店审核。
5. 经理查看完整正文并批准。
6. 在“跟进与记忆”补录客户回复，确认新增记忆。
7. 打开试驾预约，编辑时间、携带物品和备注后确认。
8. 在“活动与批量任务”查看单任务明细、失败原因、重试和抽样审核。

完整讲解见 [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)。

## 核心能力

- 按浏览器 UUID 隔离公开演示工作区，所有 API 携带 `X-Workspace-Id`。
- 工作区状态具有 TTL、线程安全清理和当前会话独立重置。
- 顾问画像、客户阶段、顾虑、活动 Brief 和车型事实共同参与生成。
- 三个平台内容可编辑、撤销、保存、提交审核和局部改写。
- 完整正文、CTA、claims、risk annotations 和 evidence 在审核中不丢失。
- 批量任务保存顾问、平台、状态、失败原因、重试次数和生成结果。
- 客户回复自动形成时间线事件和新记忆。
- 试驾预约记录真实负责顾问、时间、地点、携带物品和备注。
- 短视频区可提交已有 `/api/video/start`；未配置渲染服务时只保存脚本和分镜，不宣称已生成成片。
- 后端或模型不可用时提供明确标记的本地规则演示闭环。

## 真实数据与演示数据边界

- 顾问、客户、活动、审核和跟进均为脱敏演示数据，界面会明确显示“脱敏演示数据”或“离线演示数据”。
- 车型事实来自仓库内的公开资料适配层，保留来源标题、链接和核验日期；发布前仍需核验最新官方信息。
- DeepSeek 仅在后端配置密钥后调用；模型不可用时使用规则和事实库兜底，不能伪装成 AI 结果。
- 当前没有接入真实 CRM、企业微信、平台发布或试驾系统，不会自动联系客户或创建真实预约。
- 公开演示状态保存在服务进程内，并非生产数据库；服务重启或 TTL 到期后会恢复初始状态。

## 系统架构

```text
Vercel / Vite React 前端
  ├─ localStorage workspace UUID
  ├─ 今日机会 / 内容作战台 / 跟进 / 审核 / 批量任务
  └─ 离线演示适配层
                 │ X-Workspace-Id
                 ▼
Render / FastAPI 后端
  ├─ WorkspaceStore：会话隔离、深复制、TTL、RLock
  ├─ 规则内容引擎 + 车型事实
  ├─ DeepSeek / OpenAI-compatible 可选增强
  ├─ 逐句标注与合规检查
  └─ 可选视频后端连接器
```

详细说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)。设计参考边界见 [DESIGN_REFERENCE_MATRIX.md](./DESIGN_REFERENCE_MATRIX.md)。

## 本地运行

要求：Python 3.12+、Node.js 22+、npm。

```bash
# 后端
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

```bash
# 前端（另一个终端）
cd frontend
npm ci
npm run dev
```

打开 `http://localhost:5173`。Vite 开发服务器会把 `/api` 代理到 `http://localhost:8000`。

## 环境变量

复制 `.env.example`，真实密钥只放后端部署环境：

```env
CORS_ORIGINS=http://localhost:5173
LLM_PROVIDER_MODE=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
VIDEO_BACKEND_URL=
VIDEO_BACKEND_TOKEN=
```

前端部署只需要：

```env
VITE_API_BASE=https://你的-render-后端地址
```

## 部署

### Render 后端

仓库已提供 `render.yaml`。也可以手动配置：

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check: /api/health
```

在 Render 设置 `CORS_ORIGINS` 为正式 Vercel 域名，并按需设置 DeepSeek 和视频服务密钥。

### Vercel 前端

```text
Framework: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

设置 `VITE_API_BASE` 为 Render 基础地址。`frontend/vercel.json` 已包含 SPA 路由重写。

完整检查见 [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)。

## 验证

```bash
python3 -m compileall -q backend/app
cd backend && PYTHONPATH=. python3 -m pytest -q
cd ../frontend
npm ci
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=moderate
npm run build
```

## 当前限制与后续接入

- **CRM**：以 `customer_id`、`advisor_id`、`campaign_id` 为稳定键，将演示适配层替换为 CRM 事件和客户资料 API。
- **企业微信**：增加 OAuth、员工身份映射、会话回调与发送前人工确认；敏感字段需分级授权和审计。
- **试驾系统**：将当前预约确认 payload 映射到真实可用时段、门店、车辆和参与人接口，并支持改约/取消状态回写。
- **生产持久化**：将内存 WorkspaceStore 替换为 PostgreSQL/Redis，保留 workspace/session 边界、TTL 和审计记录。
- **企业合规**：接入品牌规范、法务规则版本和人工审批权限，不能仅依赖模型判断。
- **内容发布**：当前只生成、复制、导出和审核；生产环境需通过平台官方接口并保留用户确认。

## 文档

- [FEATURE_PARITY.md](./FEATURE_PARITY.md)：旧功能保留与新入口。
- [TEST_REPORT.md](./TEST_REPORT.md)：实际执行的测试、环境限制和手工验收。
- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)：Render、Vercel、CI 和上线检查。
- [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)：90 秒、3 分钟和断网备用脚本。
- [ARCHITECTURE.md](./ARCHITECTURE.md)：前后端模块、数据流和会话隔离。
- [JUDGE_QA.md](./JUDGE_QA.md)：评委常见问题与真实回答。
- [DESIGN_REFERENCE_MATRIX.md](./DESIGN_REFERENCE_MATRIX.md)：已完成页面的交互参考边界。
