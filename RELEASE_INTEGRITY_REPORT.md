# RELEASE_INTEGRITY_REPORT｜v0.4.2

## 基线与修改边界

- 唯一基线：本轮上传的 `ONVO-PersonaFlow-main(1).zip`；
- 未重新创建项目；
- 未更换 React、TypeScript、Vite 或 FastAPI；
- 未新增业务范围，后端业务源码未修改；
- 保留顾问、门店经理和总部运营三个空间；
- 交付包仅包含本轮新增或修改文件，不包含完整仓库、依赖或构建产物。

## 自动一致性检查

`scripts/release_integrity.py` 检查：

- `frontend/package.json` 与 `package-lock.json` 版本为 `0.4.2`；
- UI Token、v0.4.2 一致性样式和共享组件存在；
- `ui:review` 截图命令存在；
- Workspace Header、真实顾问预约、顾问画像保存、完整审核与重新核验能力仍存在；
- 企业页面和原有服务端重新核验接口未丢失；
- README 本地 Markdown 链接均存在；
- CI 继续执行后端、前端、Playwright、审计、构建和发布检查；
- E2E literal `data-testid` 可在源码中找到；
- 提供 Manifest 与 ZIP 时，两者文件列表严格一致。

## 验证摘要

```text
backend compileall       passed
backend pytest           20 passed
frontend npm ci          61 packages
frontend typecheck       passed
frontend unit tests      14 passed
Playwright E2E           19/19 passed
UI screenshot review     1/1 passed, 11 screenshots
npm audit                0 vulnerabilities
production build         passed
release integrity        PASSED
```

## UI/UX 一致性

- 使用统一设计 Token 和共享 Button、IconButton、StatusBadge、Tabs、ActionMenu、Dialog、StickyCommandBar；
- 主工作台采用内部滚动，关键工具栏和命令栏保持可见；
- 同一状态只保留一个主要 CTA，次要动作进入菜单；
- Demo 工具与业务操作分离；
- 1366 宽度下无页面级横向溢出；
- 状态同时使用中文文本和颜色，不仅依赖颜色；
- stale 与绿色“已核验”不会同时出现。

## 环境限制

`npx playwright install --with-deps chromium` 已执行，但当前沙箱无法解析 Debian 软件源并最终超时。E2E 和截图验收使用环境内 Chromium 完成；GitHub Actions 仍保留标准 Chromium 安装步骤。

## 文件统计

```text
新增：17
修改：20
删除：0
替换包文件：37
```
