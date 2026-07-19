# SECURITY_AND_QUOTA｜公开演示安全与模型额度

## 目标

公开 Demo 未实现企业登录和正式鉴权，因此默认不允许匿名请求无限消耗生产模型密钥。v0.4.3 在 FastAPI 网关层增加工作区和客户端组合额度，并保留规则引擎兜底。

## 公开演示模式

```env
PUBLIC_DEMO_MODE=true
PUBLIC_DEMO_TOKEN=
PUBLIC_DEMO_MODEL_CALLS_PER_MINUTE=3
PUBLIC_DEMO_MODEL_CALLS_PER_DAY=20
PUBLIC_DEMO_MODEL_DAILY_BUDGET=100
PUBLIC_DEMO_BATCH_LIMIT=12
```

- `PUBLIC_DEMO_MODE=true`：启用公开演示保护。
- 未配置短期 Token，或浏览器未提供有效 `X-Demo-Token`：请求继续使用规则引擎，不调用收费模型。
- Token 有效且额度未耗尽：允许模型调用并写入模型调用审计。
- 分钟、工作区每日或全局每日额度耗尽：返回 HTTP `429`、中文原因和 `Retry-After`。
- 批量任务超过硬上限：服务端拒绝，不依赖前端限制。

## 额度维度

分钟和每日额度使用以下组合键：

```text
客户端 IP + X-Workspace-Id
```

全局每日预算用于限制整个公开实例的模型调用总量。内存计数适用于竞赛 Demo；正式生产应迁移到 Redis 或数据库，并使用原子计数和统一时间窗口。

## 短期 Demo Token

- Token 只配置在 Render Secret，不提交到 GitHub，也不写入前端源码。
- 前端可通过部署环境或现场临时输入将 Token 保存在当前浏览器 localStorage。
- Token 泄露时应立即轮换。
- 该机制只是公开 Demo 的费用闸门，不等同于用户认证或企业授权。

## 模型调用审计

每次允许、降级或阻断均记录：

- workspace；
- 客户端 IP；
- 调用结果；
- 消耗单位；
- 时间；
- 规则或模型模式。

审计记录受长度上限保护，避免公开实例无限增长。

## Workspace 资源边界

默认：

```env
MAX_WORKSPACES=300
MAX_AUDIT_EVENTS=200
```

WorkspaceStore 同时执行 TTL 清理和超限淘汰，并在 `/api/health` 中返回当前数量、上限、过期清理量和容量淘汰量。承诺、通知、同步事件、任务和客户时间线也分别限长。

## 生产接入前仍需完成

- 正式身份认证和 RBAC；
- 网关/WAF 级 IP 限流；
- Redis 分布式额度；
- Secret 定期轮换；
- 告警与预算监控；
- 客户数据授权、脱敏和保留策略；
- 模型供应商账单告警。
