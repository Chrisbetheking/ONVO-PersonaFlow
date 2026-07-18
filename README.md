# 蔚见千面 · ONVO PersonaFlow

> 面向乐道购车顾问的“千人千面”AI 社交内容与线索增长平台  
> 2026 AI 先锋未来人才大赛｜蔚来公司命题参赛项目

## 项目简介

ONVO PersonaFlow 面向购车顾问日常社交媒体经营场景，将顾问画像、城市门店、车型知识和总部活动信息转化为差异化内容，并通过合规审校、评论私信分析和选题反馈形成增长闭环。

```text
顾问画像 + 车型知识 + 活动 Brief
              ↓
朋友圈 / 小红书 / 短视频口播 / 私聊跟进
              ↓
事实核验 + 品牌合规 + 人工审核
              ↓
评论私信意图识别 + 顾虑聚类
              ↓
下一轮选题与内容策略优化
```

## 核心能力

- **顾问画像中心**：城市、门店、主推车型、目标家庭、表达风格和平台偏好。
- **千人千面内容生成**：同一活动为不同顾问生成差异化朋友圈、小红书、短视频口播和私聊内容。
- **规模化内容编排**：支持总部 Brief 面向多名顾问批量生产内容。
- **车型事实约束**：车型定位、价格信息和来源证据随内容一起输出。
- **品牌合规审校**：检查绝对化宣传、价格时效、辅助驾驶边界、虚假见证和事实来源。
- **短视频生产包**：生成口播、分镜、字幕建议、素材提示和封面标题。
- **人工发布闸门**：生成内容必须经过人工确认，不自动外发。
- **线索增长闭环**：识别评论与私信意向、用户顾虑和建议跟进动作，并回流下一轮选题。
- **效果评估**：展示内容生产效率、个性化程度、合规率、事实引用率和线索转化指标。

## 技术架构

- Frontend：React 18 + TypeScript + Vite
- Backend：FastAPI + Pydantic
- Tests：Pytest + FastAPI TestClient
- CI：GitHub Actions
- Deployment：Docker Compose / Render

## 快速启动

### 1. 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

接口文档：`http://localhost:8000/docs`

### 2. 启动前端

另开一个终端：

```bash
cd frontend
npm ci
npm run dev
```

访问：`http://localhost:5173`

### 3. 一键启动

```bash
bash scripts/run_demo.sh
```

## 项目验证

```bash
bash scripts/validate.sh
```

验证内容包括 Python 编译、后端 API 测试、前端依赖审计和生产构建。

## 可选配置

复制环境变量模板：

```bash
cp .env.example .env
```

默认使用无密钥演示模式。接入经过授权的 OpenAI-compatible 服务时配置：

```bash
LLM_PROVIDER_MODE=openai-compatible
LLM_BASE_URL=https://your-provider.example.com/v1
LLM_API_KEY=replace-with-secret
LLM_MODEL=your-model-id
```

接入独立视频渲染服务时配置：

```bash
VIDEO_BACKEND_URL=https://your-video-service.example.com
VIDEO_BACKEND_TOKEN=replace-with-secret
```

## 数据说明

- 本项目为学生竞赛原型，不代表蔚来或乐道官方产品。
- 顾问、门店、线索和运营指标均为虚构演示数据。
- 不内置官方 Logo、客户数据、真实账号信息或生产密钥。
- 车型动态价格、配置和权益在正式展示前应再次核验。
- 所有生成内容默认需要人工复核后方可发布。

## 目录结构

```text
ONVO-PersonaFlow/
├── .github/workflows/ci.yml
├── backend/
├── frontend/
├── scripts/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── render.yaml
└── README.md
```
