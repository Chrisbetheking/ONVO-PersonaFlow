# 发布一致性报告

> 本文件在补丁生成和干净基线复验后填写最终统计。

## 自动检查

`scripts/release_integrity.py` 检查：

- 前端版本和 lock 版本均为 0.4.0；
- API 携带 `X-Workspace-Id`；
- 原有预约、顾问保存和完整审核实现未回退；
- 企业页面和后端重新核验路由存在；
- README 引用的本地 Markdown 文件真实存在；
- CI 包含后端、前端、Playwright、audit、build、release integrity 和失败工件上传；
- E2E 使用的 literal `data-testid` 在源码中存在；
- 可选校验 PATCH_MANIFEST 与 ZIP 文件列表完全一致。

## 最终结果

- 最终工作区 `python3 scripts/release_integrity.py`：通过。
- 相对用户上传 GitHub main 基线：新增 29、修改 23、删除 0。
- 企业补丁包含 52 个项目文件，PATCH_MANIFEST 与 ZIP 将由同一文件列表生成并再次校验。
- 将补丁应用到重新解压的 GitHub main 基线后：后端 16 passed、前端单测 13 passed、Playwright 15 passed、audit 0 vulnerabilities、production build 和 release integrity 均通过。
- Playwright 官方安装命令已执行；当前沙箱 DNS 受限，实际 E2E 使用系统 Chromium 完成。
