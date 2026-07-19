import type { StatusTone } from "./ui";

const LABELS: Record<string, string> = {
  open: "待处理",
  pending: "待处理",
  pending_review: "待审核",
  needs_review: "待审核",
  current: "当前有效",
  superseded: "已被替代",
  manager_assigned: "已分配经理",
  published: "已发布",
  high: "高风险",
  medium: "中风险",
  low: "低风险",
  ready: "可执行",
  submitted: "已提交",
  failed: "失败",
  success: "成功",
  syncing: "同步中",
  sync_failed: "同步失败",
  draft: "草稿",
  verified: "已核验",
  needs_revalidation: "待重新核验",
  blocked: "已阻断",
  approved: "已批准",
  returned: "已退回",
  rejected: "已退回",
  completed: "已完成",
  in_progress: "进行中",
  pending_confirmation: "待确认",
  pending_execution: "待执行",
  delayed: "已延期",
  overdue: "已超时",
  cancelled: "已取消",
  recommended: "系统建议",
  accepted: "已接受",
  modified: "已修改",
  escalated: "已转经理",
  ignored: "已忽略",
  active: "启用",
  inactive: "停用",
  preview: "预览",
  queued: "排队中",
  local_demo: "本地演示",
  stale_online: "在线数据暂时陈旧",
  live: "在线演示",
  demo: "Demo",
  advisor: "顾问空间",
  manager: "门店经理空间",
  hq: "总部运营空间",
  employee_responded: "员工已说明",
  decided: "经理已确认",
  resolved: "已解决",
  closed: "已关闭",
  false_positive: "已标记误报",
  assign_manager: "已转经理",
  assign_advisor: "已分配顾问",
  create_followup: "已创建解释任务",
  create_promise: "已创建承诺",
  snooze: "稍后处理",
  training_reference: "培训参考",
  published_to_selected_stores: "已发布到选定门店",
  tracking: "跟踪采纳中",
  revalidate: "重新核验中",
  assign: "已分配",
  ignore: "已忽略",
  preview_only: "仅预览",
  role_audit_failed: "角色审计同步失败",
};

const TONES: Record<string, StatusTone> = {
  verified: "success",
  approved: "success",
  completed: "success",
  published: "success",
  current: "success",
  success: "success",
  needs_revalidation: "warning",
  pending: "warning",
  pending_review: "warning",
  needs_review: "warning",
  pending_confirmation: "warning",
  pending_execution: "warning",
  delayed: "warning",
  syncing: "info",
  submitted: "info",
  in_progress: "info",
  manager_assigned: "info",
  blocked: "danger",
  rejected: "danger",
  returned: "danger",
  failed: "danger",
  sync_failed: "danger",
  overdue: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
  draft: "neutral",
  superseded: "neutral",
  demo: "demo",
  local_demo: "demo",
  stale_online: "warning",
  live: "success",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "未设置";
  return LABELS[status] || status.split("_").join(" ");
}

export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  return TONES[status] || "neutral";
}

export function entityDisplayName(
  id: string | null | undefined,
  entities: Array<{
    id: string;
    name?: string;
    customer_name?: string;
    label?: string;
  }> = [],
): string {
  if (!id) return "未分配";
  const match = entities.find((item) => item.id === id);
  return match?.name || match?.customer_name || match?.label || "未识别对象";
}

export const internalStatusValues = Object.keys(LABELS);
