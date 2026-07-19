# 部署检查清单

## 1. 包管理器和版本

- 前端：npm，唯一 lock 文件为 `frontend/package-lock.json`。
- Node.js：22.x。
- Python：3.12。
- 前端版本：0.4.0。

## 2. 本地覆盖后验证

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

## 3. Render

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check: /api/health
```

环境变量至少设置：

```env
CORS_ORIGINS=https://你的-vercel-域名
LLM_PROVIDER_MODE=demo
INTEGRATION_MODE=demo
```

接入 DeepSeek 或企业系统时，密钥只放 Render Secret。

部署后检查：

- `/api/health` 返回 0.4.0；
- `/api/bootstrap` 和 `/api/enterprise` 接受 `X-Workspace-Id`；
- 不同 workspace 状态隔离；
- 当前 workspace reset 不影响其他会话。

## 4. Vercel

```text
Framework: Vite
Root Directory: frontend
Install: npm ci
Build: npm run build
Output: dist
Node: 22.x
```

环境变量：

```env
VITE_API_BASE=https://你的-render-地址
```

检查：

- 刷新 hash 路由不丢失；
- Network 中请求带 `X-Workspace-Id`；
- 角色空间和 Demo 标签正常；
- 后端失败时明确切换本地演示。

## 5. GitHub Actions

CI 必须依次执行后端编译/测试、前端安装、类型检查、单测、Playwright 安装/E2E、audit、build 和 release integrity。Playwright 失败时上传：

```text
frontend/playwright-report
frontend/test-results
```

## 6. Secret 检查

不得提交：

- `.env`；
- DeepSeek、飞书、CRM、消息、趋势或视频密钥；
- 真实客户或员工数据；
- 生产 Webhook 签名；
- Playwright 报告、截图或 trace 中的敏感内容。

## 7. 演示验收

- 五个场景均可重置当前 workspace；
- 知识变更产生版本和影响；
- 内容编辑后提交禁用；
- 重新核验后可提交；
- 经理编辑后再次需要核验；
- 承诺可提醒和完成；
- 员工说明和经理辅导均留痕；
- 双浏览器会话隔离。

## 8. 回滚

1. 在 GitHub 保留部署前 commit/tag；
2. Render 和 Vercel 回滚到同一 commit；
3. 不只回滚前端或后端；
4. 若生产 Adapter 异常，先将 `INTEGRATION_MODE=demo` 或关闭对应连接器；
5. 检查知识版本和审计记录后再恢复。
