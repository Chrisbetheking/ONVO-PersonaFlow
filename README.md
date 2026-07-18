# 蔚见

面向购车顾问的个性化内容工作台。它把顾问画像、车型事实、活动 Brief 和客户反馈放进同一条工作流，生成适合朋友圈、小红书、短视频口播和私聊跟进的不同版本，并在发布前完成事实引用与风险预检。

## 为什么做这个项目

购车顾问需要长期经营社交媒体，但现实中通常面临三件事：总部素材容易同质化，个人创作耗时且不稳定，车型价格与辅助驾驶等内容又存在较高的事实和合规风险。

蔚见的处理方式是：

```text
顾问画像 + 车型事实 + 活动 Brief
              ↓
按平台分别生成内容
              ↓
事实引用 + 风险预检 + 人工确认
              ↓
评论与私信意向分析
              ↓
下一轮选题
```

## 已实现

- 顾问画像：城市、门店、主要客群、表达方式和常用平台。
- 多平台内容：朋友圈、小红书、抖音/视频号口播、私聊跟进。
- 车型事实卡：价格、定位、来源链接和核验日期随内容一起输出。
- DeepSeek 接入：密钥只保存在后端，前端不会接触 API Key。
- 规则兜底：模型未配置或临时失败时，仍能生成可审核的基础版本。
- 发布前预检：绝对化表达、价格时效、辅助驾驶边界、虚假见证与事实来源。
- 批量生成：一份活动 Brief 为多位顾问生成不同版本。
- 客户反馈：识别意向、主要顾虑、建议回复和下一轮选题。
- 短视频草稿：输出口播、分镜、字幕和素材方向，可连接独立渲染服务。

## 技术栈

- React 18 + TypeScript + Vite
- FastAPI + Pydantic + HTTPX
- Pytest + FastAPI TestClient
- Vercel（前端）+ Render（后端）

## 本地运行

后端：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

前端：

```bash
cd frontend
npm ci
VITE_API_BASE=http://localhost:8000 npm run dev
```

访问 `http://localhost:5173`。

## 接入 DeepSeek

后端环境变量：

```bash
LLM_PROVIDER_MODE=deepseek
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING=disabled
```

建议把内容生成设为非思考模式，以降低等待时间；复杂分析任务可以再切换思考模式。

## 部署

Render 后端：

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check: /api/health
```

Vercel 前端：

```text
Framework: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Environment: VITE_API_BASE=https://your-render-service.onrender.com
```

## 数据边界

- 当前顾问与门店均为脱敏示例，不包含真实客户资料。
- 车型事实来自公开官方页面，并记录核验日期。
- 生成内容不会自动发布，默认需要顾问或门店确认。
- 这是学生团队开发的产品原型，不代表蔚来或乐道官方系统。
