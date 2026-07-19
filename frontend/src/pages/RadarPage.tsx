import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  GraduationCap,
  MessageSquareText,
  UsersRound,
} from "lucide-react";
import { api } from "../api";
import { useApp } from "../app/AppContext";
import { navigate } from "../app/router";
import { ActionMenu, Button, EmptyState, StatusPill } from "../shared/ui";
import { entityDisplayName, statusLabel } from "../shared/display";

const secondaryActions = [
  ["customer_outreach", "创建客户触达"],
  ["knowledge_draft", "创建知识更新草稿"],
  ["coaching", "创建顾问培训"],
  ["manager_review", "创建门店复核"],
  ["campaign", "创建活动"],
  ["customer_segment", "创建客户分群"],
  ["ignore", "忽略并记录"],
] as const;

type ManagerSignal = {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  owner: string;
  due: string;
  route:
    | "review"
    | "customer-risks"
    | "quality"
    | "promises"
    | "campaigns"
    | "knowledge";
  ref?: string;
  tone: "danger" | "warning" | "info";
};

export function RadarPage({ mode }: { mode: "manager" | "hq" }) {
  const {
    workspace,
    boot,
    dataMode,
    refreshWorkspace,
    updateEnterpriseLocal,
    showToast,
  } = useApp();
  const items = workspace.enterprise.hotspots;
  const managerItems = useMemo<ManagerSignal[]>(
    () => [
      ...workspace.reviews
        .filter(
          (item) =>
            item.status === "pending" ||
            item.verification_status !== "verified",
        )
        .map((item) => ({
          id: `review-${item.id}`,
          type:
            item.verification_status !== "verified" ? "内容失效" : "内容审核",
          title: item.title,
          detail: item.reason,
          status:
            item.verification_status !== "verified"
              ? "needs_revalidation"
              : "pending_review",
          owner: item.advisor_name,
          due: "今天",
          route: "review" as const,
          ref: item.id,
          tone:
            item.verification_status !== "verified"
              ? ("danger" as const)
              : ("warning" as const),
        })),
      ...workspace.enterprise.customer_risks
        .filter(
          (item) => item.status !== "resolved" && item.status !== "closed",
        )
        .map((item) => ({
          id: `risk-${item.id}`,
          type: "客户风险",
          title: item.reason,
          detail: item.recommended_action,
          status: item.status,
          owner: entityDisplayName(
            item.customer_id,
            workspace.enterprise.customer_profiles,
          ),
          due: item.due_at,
          route: "customer-risks" as const,
          ref: item.id,
          tone: "danger" as const,
        })),
      ...workspace.enterprise.promises
        .filter((item) => item.overdue || item.manager_attention)
        .map((item) => ({
          id: `promise-${item.id}`,
          type: item.overdue ? "承诺已超时" : "承诺需协助",
          title: item.commitment,
          detail: item.original_message,
          status: item.overdue ? "overdue" : item.status,
          owner: entityDisplayName(item.advisor_id, boot.advisors),
          due: item.due_at,
          route: "promises" as const,
          ref: item.id,
          tone: item.overdue ? ("danger" as const) : ("warning" as const),
        })),
      ...workspace.enterprise.quality_signals
        .filter((item) => item.status === "pending_review")
        .map((item) => ({
          id: `quality-${item.id}`,
          type: "辅导机会",
          title: item.category,
          detail: item.system_explanation,
          status: item.status,
          owner: entityDisplayName(item.advisor_id, boot.advisors),
          due: "7 天内",
          route: "quality" as const,
          ref: item.id,
          tone: "warning" as const,
        })),
      ...workspace.campaigns.flatMap((campaign) =>
        campaign.tasks
          .filter((task) => task.status === "failed")
          .map((task) => ({
            id: `campaign-${task.id}`,
            type: "批量任务失败",
            title: `${campaign.name} · ${task.advisor_name} · ${task.platform}`,
            detail: task.failure_reason,
            status: "failed",
            owner: task.advisor_name,
            due: "尽快重试",
            route: "campaigns" as const,
            ref: task.id,
            tone: "danger" as const,
          })),
      ),
      ...workspace.enterprise.knowledge_impacts
        .filter((item) => item.status === "pending")
        .map((item) => ({
          id: `impact-${item.id}`,
          type: "知识变化影响",
          title: item.summary,
          detail: `待发布内容 ${item.affected.pending_contents} 条，客户任务 ${item.affected.customers} 个`,
          status: "pending",
          owner: "门店经理",
          due: "24 小时内",
          route: "knowledge" as const,
          ref: item.id,
          tone: "info" as const,
        })),
    ],
    [workspace, boot.advisors],
  );
  const [selectedId, setSelectedId] = useState(
    (mode === "manager" ? managerItems[0]?.id : items[0]?.id) || "",
  );
  const [working, setWorking] = useState("");
  const [filter, setFilter] = useState("all");

  if (mode === "manager") {
    const selected =
      managerItems.find((item) => item.id === selectedId) || managerItems[0];
    if (!selected) {
      return (
        <EmptyState
          title="今天没有需要经理判断的事项"
          description="审核、风险、承诺、辅导、知识影响和失败任务会进入这里。"
        />
      );
    }
    return (
      <section
        className="enterprise-three-column manager-radar"
        data-testid="manager-radar"
      >
        <aside className="enterprise-list-pane">
          <div className="pane-toolbar">
            <strong>今天需要判断</strong>
            <span>{managerItems.length}</span>
          </div>
          <div className="compact-queue">
            {managerItems.map((item) => (
              <button
                key={item.id}
                data-testid={`manager-signal-${item.id}`}
                className={
                  selected.id === item.id ? "compact-row active" : "compact-row"
                }
                onClick={() => setSelectedId(item.id)}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.type} · {item.owner}
                  </small>
                </span>
                <StatusPill tone={item.tone}>{item.status}</StatusPill>
              </button>
            ))}
          </div>
        </aside>
        <main className="enterprise-detail-pane">
          <header className="detail-heading">
            <div>
              <p className="eyebrow">{selected.type}</p>
              <h2>{selected.title}</h2>
              <p>{selected.detail}</p>
            </div>
            <StatusPill tone={selected.tone}>{selected.status}</StatusPill>
          </header>
          <section className="manager-context">
            <AlertTriangle size={18} />
            <div>
              <strong>为什么需要经理处理</strong>
              <p>{selected.detail}</p>
              <small>
                负责人：{selected.owner} · 建议完成：{selected.due}
              </small>
            </div>
          </section>
          <div className="demo-notice">
            这里不展示装饰性 KPI，只聚合需要经理人工判断的真实工作区状态。
          </div>
        </main>
        <aside className="enterprise-action-pane">
          <section>
            <strong>经理操作</strong>
            <p>进入对应业务页面查看原始证据、员工说明和完整上下文后再决定。</p>
            <Button
              data-testid="open-manager-signal"
              onClick={() =>
                navigate(
                  selected.route,
                  selected.ref ? { id: selected.ref } : undefined,
                )
              }
            >
              进入处理页面 <ArrowUpRight size={15} />
            </Button>
          </section>
        </aside>
      </section>
    );
  }

  const filtered = items.filter(
    (item) => filter === "all" || item.source_type === filter,
  );
  const selected = items.find((item) => item.id === selectedId) || filtered[0];

  async function runAction(action: string) {
    if (!selected) return;
    setWorking(action);
    try {
      if (dataMode === "local_demo") {
        const createdId = `${action}-local-${Date.now()}`;
        updateEnterpriseLocal((current) => ({
          ...current,
          hotspots: current.hotspots.map((item) =>
            item.id === selected.id
              ? {
                  ...item,
                  status: action === "ignore" ? "ignored" : "submitted",
                  created_task_ids: [...item.created_task_ids, createdId],
                  last_action: {
                    action,
                    reason: "本地演示操作",
                    created_id: createdId,
                    at: new Date().toISOString(),
                  },
                }
              : item,
          ),
        }));
      } else {
        await api.hotspotAction(
          selected.id,
          action,
          "由热点与洞察页面人工确认",
        );
        await refreshWorkspace();
      }
      showToast("热点处理已记录");
      if (action === "content_task") navigate("today");
    } finally {
      setWorking("");
    }
  }

  if (!items.length) {
    return (
      <EmptyState
        title="当前没有热点"
        description="客户咨询、审核退回和知识变化会在这里形成可追溯的经营信号。"
      />
    );
  }

  return (
    <section
      className="enterprise-three-column radar-page"
      data-testid="hotspot-radar"
    >
      <aside className="enterprise-list-pane">
        <div className="pane-toolbar">
          <strong>经营热点队列</strong>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">全部来源</option>
            {Array.from(new Set(items.map((item) => item.source_type))).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </div>
        <div className="compact-queue">
          {filtered.map((item) => (
            <button
              data-testid={`hotspot-${item.id}`}
              key={item.id}
              className={
                selected?.id === item.id ? "compact-row active" : "compact-row"
              }
              onClick={() => setSelectedId(item.id)}
            >
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.source_label} · {item.last_seen}
                </small>
              </span>
              <StatusPill>{item.status}</StatusPill>
            </button>
          ))}
        </div>
      </aside>
      {selected ? (
        <main className="enterprise-detail-pane">
          <header className="detail-heading">
            <div>
              <p className="eyebrow">
                {selected.demo_flag ? "演示信号" : "业务信号"}
              </p>
              <h2>{selected.title}</h2>
              <p>{selected.recommended_action}</p>
            </div>
            <StatusPill tone="warning">{selected.trend}</StatusPill>
          </header>
          <section className="evidence-stream">
            <div className="section-heading">
              <strong>为什么成为热点</strong>
              <span>{selected.evidence_count} 条证据</span>
            </div>
            {selected.evidence.map((item) => (
              <article key={item.id}>
                <MessageSquareText size={17} />
                <div>
                  <strong>{item.summary}</strong>
                  <p>
                    {item.store} · {item.advisor}
                  </p>
                  <small>{item.occurred_at}</small>
                </div>
              </article>
            ))}
          </section>
          <div className="demo-notice">
            {selected.source_type === "模拟公开趋势"
              ? "模拟公开趋势，不代表真实平台统计。"
              : "脱敏演示样本，不代表生产环境真实数量。"}
          </div>
        </main>
      ) : null}
      {selected ? (
        <aside className="enterprise-action-pane hotspot-action-pane">
          <section>
            <strong>影响范围</strong>
            <dl className="impact-grid">
              <div>
                <dt>客户</dt>
                <dd>{selected.impact.customers}</dd>
              </div>
              <div>
                <dt>顾问</dt>
                <dd>{selected.impact.advisors}</dd>
              </div>
              <div>
                <dt>内容</dt>
                <dd>{selected.impact.contents}</dd>
              </div>
              <div>
                <dt>门店</dt>
                <dd>{selected.impact.stores}</dd>
              </div>
            </dl>
          </section>
          <section>
            <strong>负责人</strong>
            <p>{selected.owner}</p>
            <small>当前状态：{statusLabel(selected.status)}</small>
          </section>
          <section className="action-stack">
            <strong>系统推荐动作</strong>
            <Button
              data-testid="hotspot-action-content_task"
              loading={working === "content_task"}
              onClick={() => void runAction("content_task")}
            >
              <ArrowUpRight size={15} /> 创建内容任务
            </Button>
            <ActionMenu label="其他转化动作">
              {secondaryActions.map(([value, label]) => (
                <button
                  key={value}
                  data-testid={`hotspot-action-${value}`}
                  onClick={() => void runAction(value)}
                >
                  {value === "knowledge_draft" ? (
                    <BookOpenCheck size={15} />
                  ) : value === "coaching" ? (
                    <GraduationCap size={15} />
                  ) : (
                    <UsersRound size={15} />
                  )}
                  {label}
                </button>
              ))}
            </ActionMenu>
          </section>
        </aside>
      ) : null}
    </section>
  );
}
