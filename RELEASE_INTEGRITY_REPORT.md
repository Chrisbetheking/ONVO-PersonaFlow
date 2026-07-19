# RELEASE_INTEGRITY_REPORT｜v0.4.1

## 基线与范围

- 唯一基线：`ONVO-PersonaFlow-v0.4.0-DIRECT-UPLOAD.zip`
- 未重新创建项目；
- 未更换 React、TypeScript、Vite 或 FastAPI；
- 未删除现有顾问空间和 v0.4.0 企业模块；
- 本轮新增 2 个文件，修改 44 个文件，删除 0 个文件。

## 自动一致性检查

`scripts/release_integrity.py` 已更新并检查：

- `frontend/package.json` 与 `package-lock.json` 均为 `0.4.1`；
- API 全部携带 `X-Workspace-Id`；
- 试驾预约未写死顾问；
- 顾问画像调用真实更新 API；
- 审核页使用完整正文并支持重新核验；
- `PolicyPage` 与全部企业页面存在；
- 内容失效、证据警告和服务端重新核验路由存在；
- 客户承诺由服务端根据客户档案确认负责顾问；
- README 引用的本地 Markdown 文件全部存在；
- CI 执行 compileall、pytest、npm ci、typecheck、unit、Playwright、audit、build 和 release integrity；
- CI 在失败时上传 Playwright 报告与测试结果；
- E2E 使用的 65 个 literal `data-testid` 均可在源码中解析；
- PATCH_MANIFEST 与 ZIP 文件列表可进行严格一一校验。

## 双工作区验证

### 最终工作区

```text
backend pytest        20 passed
frontend unit tests   14 passed
Playwright E2E        15/15 passed
npm audit             0 vulnerabilities
production build      passed
release integrity     PASSED
```

### 干净基线覆盖后

```text
backend pytest        20 passed
frontend unit tests   14 passed
Playwright E2E        15/15 passed
npm audit             0 vulnerabilities
production build      passed
release integrity     PASSED
```

## P0 状态一致性

正文、标题、CTA、局部改写和风险建议修改共用同一失效机制。失效后：

```text
claim              stale
evidence           needs_revalidation
compliance         needs_revalidation
submit / send      blocked
manager approve    blocked after manager edit
```

重新核验成功后才生成新的签名凭证并恢复“已核验”。

## Demo / 真实边界

真实运行的是当前 workspace 内的状态机、签名核验、审计、知识版本、影响、承诺、质量复核、辅导、案例和隔离。

Feishu、CRM、Messaging 和 Trends 仍为明确标记的 Demo Adapter。真实企业应用、生产权限、真实客户和真实业务提升结论均未伪造。

## 环境限制

`npx playwright install --with-deps chromium` 已执行，但当前沙箱 DNS 无法解析 Debian 软件源。最终和干净基线 E2E 均使用环境内 Chromium 完成。CI 中保留正式 Playwright Chromium 安装步骤。
