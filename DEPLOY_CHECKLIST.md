# 部署检查清单

## 包管理器与版本

- 前端：npm，锁文件 `frontend/package-lock.json`。
- Node.js：22.x。
- Python：3.12。
- 前端版本：0.3.1。

## Render 后端

- Root Directory：`backend`
- Build Command：`pip install -r requirements.txt`
- Start Command：`uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check：`/api/health`
- 环境变量：`CORS_ORIGINS`、可选 DeepSeek 配置、可选视频服务配置。
- 不将 API Key 写入 GitHub 或 Vercel。

## Vercel 前端

- Framework：Vite
- Root Directory：`frontend`
- Install Command：`npm ci`
- Build Command：`npm run build`
- Output Directory：`dist`
- 环境变量：`VITE_API_BASE=https://<render-host>`
- `frontend/vercel.json` 保持 SPA 重写。

## GitHub Actions

CI 应依次执行：后端安装和 pytest、前端 npm ci、typecheck、unit tests、Playwright Chromium 安装、E2E、audit、build、release integrity。Playwright 失败时上传 `playwright-report` 和 `test-results`；截图、trace 和失败视频包含在 `test-results` 中。

## 上线后检查

1. `/api/health` 返回版本 0.3.1。
2. 两个无痕浏览器的机会、审核和跟进状态互不影响。
3. 重置演示只影响当前浏览器。
4. Vercel 页面刷新后 Hash 路由保持。
5. DeepSeek 未配置时内容明确标记规则兜底。
6. 视频服务未配置时不显示成片已生成。
7. 运行 `python3 scripts/release_integrity.py`。

## 回滚

在覆盖补丁前创建 Git 分支或 Tag。出现部署异常时回滚到上一个成功提交，并保留 Render 和 Vercel 的上一部署记录。
