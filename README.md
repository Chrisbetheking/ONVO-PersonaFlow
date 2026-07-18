# 蔚见

> 面向购车顾问的私域经营 Agent：把客户问题转化为有事实依据的沟通内容、跟进行动与试驾机会。

蔚见不是单纯的文案生成器。它从“今天最值得处理什么”出发，结合客户阶段、顾问表达习惯、活动 Brief 与已核验车型事实，完成多渠道内容生成、逐句事实溯源、风险处理、门店审核、客户回复与记忆更新。

## 业务问题

一线购车顾问每天同时面对总部活动、客户私聊、朋友圈运营和试驾跟进。常见问题是：

- 总部素材统一，但不同城市、门店和客户需要不同表达；
- 顾问知道客户在问什么，却很难持续产出可信内容；
- 价格、车型能力与辅助驾驶表述容易过期或越界；
- 内容发出后，客户回复没有沉淀成下一次沟通依据；
- 门店经理需要审核风险，但不应重复阅读所有低风险内容。

## 主要用户

- **购车顾问**：处理今日机会、生成和编辑内容、跟进客户、沉淀记忆。
- **门店经理**：只查看待审核、高风险、事实可能过期和未跟进事项。
- **总部运营 / 管理员**：维护活动、顾问画像、车型事实、批量任务与系统连接。

## 完整业务闭环

```text
总部活动 / 客户消息 / 历史反馈
                ↓
             今日机会
                ↓
       客户、顾问与场景理解
                ↓
      多渠道内容生成与局部编辑
                ↓
      逐句事实依据 + 风险替换建议
                ↓
          人工确认 / 门店审核
                ↓
          客户回复与试驾跟进
                ↓
       客户记忆与顾问客群记忆
                ↓
          下一轮机会推荐更准确
```

## 核心功能

### 今日机会

- 汇总客户私聊、总部活动匹配和高频问题；
- 展示为什么现在值得处理、意向信号、时间敏感性和推荐动作；
- 支持优先级、来源、车型、状态筛选及稍后处理。

### 内容作战台

- 左侧保留客户、顾问、活动和车型上下文；
- 中间编辑私聊、朋友圈、小红书和短视频口播；
- 支持局部改写、撤销/恢复、保存草稿、复制、导出和提交审核；
- 右侧把正文陈述与事实依据、更新时间和风险建议关联起来；
- 输出短视频口播、分镜、字幕和素材方向。

### 跟进与记忆

- 以客户为中心展示发送、回复、意向识别、顾问补录和试驾预约时间线；
- 支持修改、停用错误记忆；
- 展示客户记忆与顾问客群记忆如何影响下一次生成；
- 保留批量导入评论/私信并识别下一轮选题的能力。

### 门店审核与批量任务

- 逐条批准或退回，查看风险原因和事实状态；
- 总部活动可选择多位顾问和渠道批量生成；
- 展示任务状态、失败原因、重试和抽样审核入口。

### 模型与可靠性

- 支持 DeepSeek 或其他 OpenAI-compatible 接口；
- API Key 只保存在后端；
- 模型未配置、超时或失败时保留基于规则与事实库的可审核版本；
- 演示数据明确标记，不伪装成真实生产数据。

## 技术架构

- 前端：React 18、TypeScript、Vite、Vitest；
- 后端：FastAPI、Pydantic、HTTPX、Pytest；
- 部署：Vercel（前端）+ Render（后端）；
- 数据：当前原型使用集中式脱敏演示适配层，接口结构可替换为 CRM、活动和内容服务。


## 本地运行

### 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

健康检查：`http://localhost:8000/api/health`

### 前端

```bash
cd frontend
npm ci
VITE_API_BASE=http://localhost:8000 npm run dev
```

访问：`http://localhost:5173`

### 全量验证

```bash
./scripts/validate.sh
```

## 环境变量

复制根目录 `.env.example`，不要提交真实密钥。

```bash
# 前端
VITE_API_BASE=http://localhost:8000

# 后端跨域
CORS_ORIGINS=http://localhost:5173

# DeepSeek
LLM_PROVIDER_MODE=deepseek
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING=disabled
LLM_TIMEOUT_SECONDS=75
LLM_MAX_TOKENS=2600
```

未配置模型时可使用：

```bash
LLM_PROVIDER_MODE=demo
```

## 部署

### Render 后端

仓库根目录已有 `render.yaml`，也可手工填写：

```text
Runtime: Python
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check: /api/health
```

至少配置：`CORS_ORIGINS`。使用 DeepSeek 时再配置 `DEEPSEEK_API_KEY` 等变量。

### Vercel 前端

```text
Framework Preset: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
Environment Variable: VITE_API_BASE=https://你的后端地址
```

`frontend/vercel.json` 已处理单页应用刷新重写。

## 90 秒演示路径

1. 打开“今日机会”，选择“陈女士 · L80 家庭空间咨询”；
2. 说明系统根据客户最近消息判断“为什么现在值得处理”；
3. 进入内容作战台，生成私聊、朋友圈和小红书版本；
4. 点击正文陈述，展示对应车型事实、来源和核验时间；
5. 展示风险表达的定位与替换建议，保存并提交门店审核；
6. 在“跟进与记忆”补录客户回复并登记试驾；
7. 展示该顾虑如何沉淀为客户记忆和顾问客群记忆。

完整脚本见 [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)。

## 当前边界

- 顾问、客户、活动和转化记录均为脱敏演示数据；
- 当前工作区状态保存在后端进程内存中，生产环境应接数据库；
- 车型事实使用仓库内的核验快照，正式接入需建立持续更新和审批机制；
- 当前不自动发布内容，也不自动向客户发送消息；
- 当前不直接连接真实 CRM、微信、小红书或试驾系统；
- 生成与合规结果是辅助判断，最终由顾问或门店负责人确认；
- 本项目为学生团队独立开发的产品原型，不代表蔚来或乐道官方系统。
