# 数据模型

## 通用字段

企业对象使用稳定 ID，并尽量包含：

```text
id / workspace_id / created_at / updated_at / source_type / demo_flag / created_by / version
```

当前 Demo 模板存储在 JSON 中，运行时深复制到独立 workspace。

## 核心对象

### Hotspot / HotspotEvidence

热点包含标题、来源、车型、客群、门店、证据数量、趋势、状态、负责人和推荐动作；证据保留消息摘要、时间范围、门店和顾问。

### KnowledgeItem / KnowledgeVersion / KnowledgeImpact

知识包含类型、内容、来源、适用车型/区域、生效失效时间、版本、状态和关联对象。版本变化保存 diff；影响对象区分内容、客户、活动和顾问任务，并记录重新核验、更新、分配或忽略动作。

### CustomerProfile / CustomerState / NextBestAction

客户 360 包含家庭结构、目标车型、预算、购车时间、渠道、负责人、授权和同步信息。状态维度不使用黑盒总分，每一项保存判断依据。下一最佳行动保存原因、截止时间、责任人、风险、资料、经理协助和执行状态。

### Promise

```text
promise_id / customer_id / advisor_id / original_message / item / due_at /
completion_condition / status / source / remind_at / overdue / manager_attention
```

状态：待确认、待执行、已完成、已延期、已取消、已超时。

### QualitySignal / EmployeeResponse / ManagerDecision / CoachingPlan

质量信号保存员工、客户、原始沟通、触发规则、解释、事实、风险、重复情况和处理状态。员工说明与经理决定分开保存。辅导计划包含目标、负责人、周期和复查状态。

### BestPractice

案例包含场景、客户问题、顾问处理方式、有效原因、结果、适用/不适用范围、审核人、来源和匿名化状态。必须经理确认后发布。

### CustomerRisk

保存风险原因、证据、影响、推荐动作、是否需经理介入、截止时间和人工处理状态，不使用无法解释的百分比。

### AuditEvent / SyncEvent

审计记录谁、何时、在哪个 workspace、以什么角色执行了何种操作，以及变更前后、知识版本和 Demo 标记。同步事件记录 Adapter、来源、时间、结果和冲突。

### Experiment / DemoScenario

实验只描述指标、样本、周期、验证方法和 Demo 状态。演示场景提供固定工作区故事，每次切换只重置当前 workspace。

## 内容核验对象

内容版本保存：

- 正文和 CTA；
- claims；
- evidence；
- risk annotations；
- verification status；
- verification version / knowledge version / time / method；
- 原始生成、顾问编辑、重新核验、经理编辑和最终批准版本。

正文或 CTA 修改后，claims 标记 stale，evidence/compliance 标记 needs_revalidation；后端重新核验前禁止提交和批准。
