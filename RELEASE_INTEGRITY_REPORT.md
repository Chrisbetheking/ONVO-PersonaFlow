# RELEASE_INTEGRITY_REPORT｜v0.4.3

## 基线

- 公开 GitHub main 基线：`fb0a785de6498c1a128f1b2a91d2e4b3d4223680`。
- 未创建新项目，未更换 React、TypeScript、Vite 或 FastAPI。
- 未新增业务模块。
- 最终交付只包含新增和修改文件，并保持仓库相对路径。

## 发布一致性

v0.4.3 统一：

- `frontend/package.json` 和 lock 文件版本；
- FastAPI 应用版本；
- `/api/health.app_version`；
- API schema 版本；
- 页面标题；
- Render 环境变量模板；
- CI 和 Production Smoke 检查。

健康接口返回：

```json
{
  "app_version": "0.4.3",
  "git_commit": "<deployment commit>",
  "build_time": "<UTC timestamp>",
  "api_schema_version": "1"
}
```

前端在读取健康接口时验证 schema 兼容性，前后端版本不匹配时显示明确错误。

## 自动一致性检查

`scripts/release_integrity.py` 检查：

- 前端和 lock 版本为 0.4.3；
- 健康接口四个部署字段；
- `X-Workspace-Id`、短期 Demo Token 和 API schema 校验；
- 乐观角色切换、三态网络模式和单一切换入口；
- 时间线不存在多层冲突样式；
- 收起侧栏品牌隐藏规则；
- 集中状态映射；
- 公开模型额度和 Workspace 限长；
- CI 的 lint、format、Playwright、audit、build 和发布校验；
- Production Smoke 工作流、版本检查和截图工件；
- 视觉回归 Snapshot；
- README 所有本地 Markdown 链接；
- Manifest 与替换 ZIP 文件列表完全一致。

## 验证摘要

```text
backend compileall       passed
backend pytest           23 passed
frontend npm ci          passed, 0 vulnerabilities
frontend typecheck       passed
frontend unit tests      19 passed
frontend lint            passed
frontend format check    passed
Playwright local E2E     27/27 passed
npm audit                0 vulnerabilities
production build         passed
production smoke         NOT RUN: production URLs/deployment unavailable
```

## Commit 与线上状态

```text
GitHub main baseline        fb0a785de6498c1a128f1b2a91d2e4b3d4223680
v0.4.3 fix commit           尚未创建，等待用户上传替换包
Vercel Production Commit   未验证
Render Production Commit   未验证
Production /api/health     未验证
```

不能在替换包尚未提交和生产部署尚未完成时宣布线上一致。
