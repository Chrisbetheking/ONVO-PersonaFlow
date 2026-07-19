# 部署检查清单｜v0.4.3

## 1. 运行版本

- Node.js：22.x。
- Python：3.12。
- 前端版本：0.4.3。
- 后端应用版本：0.4.3。
- API schema：1。
- 前端唯一 lock 文件：`frontend/package-lock.json`。

## 2. 覆盖后本地验证

```bash
python3 -m compileall -q backend/app
cd backend && PYTHONPATH=. python3 -m pytest -q
cd ../frontend
npm ci
npm run typecheck
npm test
npm run lint
npm run format:check
npx playwright install --with-deps chromium
npm run test:e2e
npm audit --audit-level=moderate
npm run build
cd ..
python3 scripts/release_integrity.py
```

## 3. Render 后端

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check: /api/health
```

至少配置：

```env
CORS_ORIGINS=https://实际-vercel-域名
LLM_PROVIDER_MODE=demo
INTEGRATION_MODE=demo
MAX_WORKSPACES=300
MAX_AUDIT_EVENTS=200
PUBLIC_DEMO_MODE=true
PUBLIC_DEMO_MODEL_CALLS_PER_MINUTE=3
PUBLIC_DEMO_MODEL_CALLS_PER_DAY=20
PUBLIC_DEMO_MODEL_DAILY_BUDGET=100
PUBLIC_DEMO_BATCH_LIMIT=12
PUBLIC_DEMO_TOKEN=短期随机令牌
VERIFICATION_SIGNING_KEY=随机长密钥
```

真实密钥只放 Render Secret。

部署后 `/api/health` 必须返回：

- `app_version: 0.4.3`；
- `api_schema_version: 1`；
- `git_commit` 不是 `unknown`；
- `build_time` 有值；
- Workspace 数量和淘汰统计；
- 公开 Demo 额度配置。

## 4. Vercel 前端

```text
Framework: Vite
Root Directory: frontend
Install: npm ci
Build: npm run build
Output: dist
Node: 22.x
```

```env
VITE_API_BASE=https://实际-render-域名
```

检查：

- 页面标题是“蔚见 · 客户经营与销售质量智能中枢”；
- 前端没有 API schema 不兼容提示；
- 请求携带 `X-Workspace-Id`；
- 角色切换立即更新页面，不等待网络；
- 单接口失败显示“在线数据暂时陈旧”，不自动切本地数据；
- 客户沟通文本不竖排；
- 收起导航不显示竖排品牌文字；
- 中文界面不显示内部英文枚举。

## 5. GitHub Actions CI

`PersonaFlow CI` 必须执行：

- backend compileall 和 pytest；
- frontend `npm ci`、typecheck、unit tests；
- lint 和 format check；
- Playwright Chromium 与本地 E2E；
- npm audit；
- production build；
- release integrity。

Playwright 失败时上传 `frontend/playwright-report` 和 `frontend/test-results`。

## 6. Production Smoke

在 GitHub Actions Variables 配置：

```text
PRODUCTION_WEB_URL
PRODUCTION_API_URL
```

等待 Vercel 和 Render 部署同一 Commit 后运行 `PersonaFlow Production Smoke`。必须下载工件并核对：

- 首页；
- 三角色路由；
- 客户沟通截图；
- 收起导航截图；
- console error；
- health 版本、schema 和 Commit。

未运行该工作流时不得写“线上已验证”。

## 7. 安全与额度

详见 [SECURITY_AND_QUOTA.md](./SECURITY_AND_QUOTA.md)。公开 Demo 默认规则生成；只有有效短期 Token 且未超额时才调用收费模型。

## 8. 回滚

1. 保留覆盖前 Git Commit；
2. Vercel 与 Render 回滚到同一 Commit；
3. 不只回滚一端；
4. 模型或 Adapter 异常时优先切回规则/Demo 模式；
5. 回滚后重新检查 `/api/health`、schema 和生产 Smoke。
