# ONVO PersonaFlow Design System v0.4.2

## 目标

为顾问、门店经理和总部运营三个空间建立同一套高密度企业工作台语言。设计优先保证主任务可识别、投屏可读、状态不矛盾和操作可追踪，不使用营销 Hero、无依据 KPI 或装饰性图表。

## Token

源文件：`frontend/src/styles/tokens.css`。

- 应用背景：`#F4F6F3`
- 表面：`#FFFFFF`
- 选中背景：`#EAF2EE`
- 主文字：`#17231F`
- 主品牌色：`#143F34`
- 极少量强调色：`#B6F23A`
- 已核验：绿色；待重新核验：黄色；阻断或失败：红色；Demo：蓝灰色。
- 间距只使用 4、8、12、16、20、24、32、40。
- 控件圆角 8px，面板圆角 10px，浮层圆角 12px。

## 字体层级

页面标题 22–28px；区域标题 18px；组件标题 15px；正文 14px；辅助信息不低于 12px。表格和紧凑列表使用 13px。

## 基础组件

统一组件位于 `frontend/src/shared/ui/`：Button、IconButton、StatusBadge、SourceBadge、DemoBadge、Tabs、Field、SplitPane、ListPane、DetailPane、ContextRail、StickyCommandBar、ActionMenu、Dialog、ConfirmDialog、EmptyState、ErrorState、LoadingSkeleton、AuditTrail。

所有 IconButton 必须提供 `aria-label`。Dialog 支持 Escape、焦点进入、Tab 循环和关闭后焦点恢复。

## 工作台规则

- 列表、详情、上下文栏独立滚动。
- 每个状态只保留一个主要 CTA，次级动作进入“更多”。
- 编辑器底部使用 StickyCommandBar，主操作不被推到长页面底部。
- Demo 工具与业务操作分区。
- 右栏在 1366 宽度仍可折叠，主流程不依赖右栏常驻。
- 状态不能只依赖颜色，必须同时显示中文文本。

## 响应式

目标分辨率：1366×768、1440×900、1920×1080。1366 下不得产生页面级水平滚动；1160 以下右栏转为可滑出的上下文面板；900 以下转为纵向布局。
