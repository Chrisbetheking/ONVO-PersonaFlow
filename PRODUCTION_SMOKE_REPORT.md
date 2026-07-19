# PRODUCTION_SMOKE_REPORT｜v0.4.3

## 当前状态

**未执行 v0.4.3 生产 Smoke。**

原因：本次修复工作区没有 Vercel Production URL、Render Production URL，也不能代替仓库所有者上传补丁或触发生产部署。因此不声称线上版本、线上 Commit 或线上截图已经通过。

## 已确认的公开仓库基线

- GitHub 仓库：`Chrisbetheking/ONVO-PersonaFlow`
- 本轮开始时公开 `main` 最新 Commit：`fb0a785de6498c1a128f1b2a91d2e4b3d4223680`
- v0.4.3 修复 Commit：尚未创建，需用户上传替换包并提交后产生
- Vercel Production Commit：未验证
- Render Production Commit：未验证
- 生产 `/api/health`：未验证

## 已加入的自动化

`.github/workflows/production-smoke.yml` 支持：

- `workflow_dispatch`；
- 成功的 `deployment_status` 事件；
- GitHub Actions Variables：`PRODUCTION_WEB_URL`、`PRODUCTION_API_URL`；
- 当前 GitHub SHA 与后端 `git_commit` 对比；
- 生产 Smoke 失败或成功工件上传。

生产测试检查：

1. 首页加载和产品标题；
2. 顾问、经理、总部三个角色空间路由；
3. 客户沟通消息宽度与水平排版；
4. 收起导航后品牌文案隐藏；
5. `/api/health` 的 `app_version=0.4.3`；
6. `api_schema_version=1`；
7. `git_commit` 非空且与部署 Commit 一致；
8. 页面 console/page error；
9. 生产客户沟通截图；
10. 生产收起导航截图。

## 部署后执行方式

在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加：

```text
PRODUCTION_WEB_URL=https://实际-vercel-域名
PRODUCTION_API_URL=https://实际-render-域名
```

上传并提交补丁，等待 Vercel 和 Render 都部署同一 Commit，再手动运行 `PersonaFlow Production Smoke`。下载 `production-smoke-<run_id>` 工件核对截图、trace 和错误信息。

## 通过标准

只有工作流真实执行并全部通过后，才可以填写：

```text
修复前端 Commit
修复后端 Commit
Vercel Production Commit
Render Production Commit
/api/health 版本
生产截图工件
```
