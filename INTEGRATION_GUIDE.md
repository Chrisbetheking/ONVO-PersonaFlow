# 企业集成指南

## 1. Adapter 原则

Demo Adapter 与生产连接器共享结构化输出，但生产连接器必须额外完成：企业授权、Webhook 验签、最小权限、字段映射、冲突处理、幂等、审计和隐私评审。

## 2. 飞书

### Demo

“模拟飞书知识变更”会创建知识新版本、diff、影响对象、重新核验任务、模拟通知、模拟审批和审计事件。

### 生产环境变量

```env
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
FEISHU_ENCRYPT_KEY=
FEISHU_WEBHOOK_SECRET=
FEISHU_KNOWLEDGE_BASE_ID=
```

### 建议接入

1. 企业管理员创建飞书应用并分配最小权限；
2. OAuth / tenant token 只保存在后端；
3. Wiki、文档或多维表格映射到 KnowledgeItem；
4. 事件回调先验签，再进入版本与影响分析；
5. 通知卡片只包含必要信息和内部链接；
6. 审批结果写入 AuditEvent。

建议 Webhook：`POST /api/webhooks/feishu/events`（当前为生产占位，不宣称已启用）。

## 3. CRM

```env
CRM_BASE_URL=
CRM_API_TOKEN=
CRM_WEBHOOK_SECRET=
CRM_CUSTOMER_MAPPING_PROFILE=default
```

字段建议：

| CRM | PersonaFlow |
|---|---|
| customer/contact id | customer_id |
| owner id | advisor_id |
| stage | customer stage |
| vehicle interest | target_vehicle |
| last interaction | timeline event |
| test drive | booking status |
| consent | authorization status |

同步冲突时，CRM 不得自动覆盖顾问人工确认的客户顾虑、承诺和记忆；应生成冲突项供人工选择。

建议 Webhook：`POST /api/webhooks/crm/customer-updated`。

## 4. 授权企业沟通渠道

```env
MESSAGING_PROVIDER=demo
MESSAGING_BASE_URL=
MESSAGING_API_TOKEN=
MESSAGING_WEBHOOK_SECRET=
```

只接入企业授权渠道。消息需保存来源、发送者、客户、时间、同步状态和授权范围。个人微信或未经授权平台不在当前范围。

建议 Webhook：`POST /api/webhooks/messaging/events`。

## 5. 外部趋势

```env
TRENDS_PROVIDER=demo
TRENDS_BASE_URL=
TRENDS_API_TOKEN=
TRENDS_WEBHOOK_SECRET=
```

生产趋势需要记录公开来源、采集时间、授权/条款、去重和证据链接。不能把估算值显示为真实平台统计。

建议 Webhook：`POST /api/webhooks/trends/events`。

## 6. 试驾与视频

- 试驾：需要真实门店、车辆、时间段、参与人、改约/取消和回写接口。
- 视频：设置 `VIDEO_BACKEND_URL` 和 `VIDEO_BACKEND_TOKEN` 后提交；未配置时只保存脚本与分镜。

## 7. 安全

- 密钥只放服务端 Secret 管理；
- Webhook 必须验签和防重放；
- 所有写操作带幂等键；
- 客户数据按授权范围和保留期限处理；
- 关键动作写不可变审计日志；
- 生产 RBAC 替代公开 Demo 的角色切换。
