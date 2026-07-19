import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, assertApiCompatibility } from "../api";
import { fallbackBootstrap, fallbackWorkspace } from "../shared/demoData";
import {
  applyOptimisticRole,
  connectionModeAfterRequestFailure,
} from "../shared/roleState";
import {
  addLocalFollowupEvent,
  createLocalCampaignTasks,
  createLocalGeneration,
  createLocalReview,
} from "../shared/localDemo";
import type {
  Advisor,
  BootstrapResponse,
  Campaign,
  CampaignTask,
  ContentVariant,
  Followup,
  GenerationResponse,
  HealthResponse,
  Opportunity,
  ReviewItem,
  RoleSpace,
  RevalidationResponse,
  VideoJobState,
  WorkspaceResponse,
  EnterpriseWorkspace,
  ConnectionMode,
} from "../types";

const GENERATION_KEY = `weijian:last-generation:${api.workspaceId}`;
const FALLBACK_WORKSPACE_KEY = `weijian:fallback-workspace:${api.workspaceId}`;
const FALLBACK_BOOT_KEY = `weijian:fallback-bootstrap:${api.workspaceId}`;
const ROLE_KEY = `weijian:role-space:${api.workspaceId}`;

type GenerateOptions = {
  platforms?: string[];
  campaignName?: string;
  campaignBrief?: string;
  useAi?: boolean;
};

type AppContextValue = {
  boot: BootstrapResponse;
  health: HealthResponse | null;
  workspace: WorkspaceResponse;
  generation: GenerationResponse | null;
  loading: boolean;
  refreshing: boolean;
  connectionError: string;
  dataMode: ConnectionMode;
  switchingRole: boolean;
  roleSyncError: string;
  toast: string;
  setGeneration: (value: GenerationResponse | null) => void;
  showToast: (message: string) => void;
  refreshAll: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  generateFromOpportunity: (
    opportunity: Opportunity,
    options?: GenerateOptions,
  ) => Promise<GenerationResponse>;
  regenerateVariant: (
    opportunity: Opportunity,
    platform: string,
  ) => Promise<ContentVariant>;
  createGeneralTask: (
    payload: Record<string, unknown>,
  ) => Promise<GenerationResponse>;
  updateOpportunityStatus: (
    id: string,
    status: Opportunity["status"],
  ) => Promise<void>;
  saveVariant: (variant: ContentVariant) => Promise<void>;
  submitVariant: (variant: ContentVariant) => Promise<ReviewItem>;
  addFollowupEvent: (
    customerId: string,
    payload: Record<string, unknown>,
  ) => Promise<Followup>;
  toggleMemory: (
    customerId: string,
    memoryId: string,
    active: boolean,
  ) => Promise<void>;
  decideReview: (
    id: string,
    decision: "approved" | "returned",
    reason: string,
    body: string,
    callToAction: string,
    riskAnnotations: ReviewItem["risk_annotations"],
  ) => Promise<void>;
  runCampaign: (campaign: Campaign) => Promise<Campaign>;
  retryCampaignTask: (campaignId: string, taskId: string) => Promise<Campaign>;
  retryFailedCampaignTasks: (campaignId: string) => Promise<Campaign>;
  submitCampaignTaskReview: (
    campaignId: string,
    taskId: string,
  ) => Promise<ReviewItem>;
  updateAdvisor: (
    id: string,
    patch: Pick<Advisor, "audience" | "style">,
  ) => Promise<Advisor>;
  startVideo: (payload: Record<string, unknown>) => Promise<VideoJobState>;
  switchRole: (role: RoleSpace) => void;
  retryRoleSync: () => Promise<void>;
  enterLocalDemo: () => void;
  revalidateVariant: (variant: ContentVariant) => Promise<RevalidationResponse>;
  revalidateReview: (
    reviewId: string,
    changes?: {
      body: string;
      call_to_action: string;
      risk_annotations: ReviewItem["risk_annotations"];
    },
  ) => Promise<ReviewItem>;
  resetDemo: () => Promise<void>;
  updateEnterpriseLocal: (
    updater: (current: EnterpriseWorkspace) => EnterpriseWorkspace,
  ) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function restoreJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function restoreGeneration(): GenerationResponse | null {
  return restoreJson<GenerationResponse | null>(GENERATION_KEY, null);
}

function campaignSummary(tasks: CampaignTask[]) {
  return {
    total: tasks.length,
    ready: tasks.filter(
      (task) => task.status === "ready" || task.status === "submitted",
    ).length,
    pending_review: tasks.filter((task) => task.status === "needs_review")
      .length,
    failed: tasks.filter((task) => task.status === "failed").length,
  };
}

function restoreRole(): RoleSpace | null {
  try {
    const value = window.localStorage.getItem(ROLE_KEY);
    return value === "advisor" || value === "manager" || value === "hq"
      ? value
      : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<BootstrapResponse>(() =>
    restoreJson(FALLBACK_BOOT_KEY, fallbackBootstrap),
  );
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceResponse>(() =>
    restoreJson(FALLBACK_WORKSPACE_KEY, fallbackWorkspace),
  );
  const [generation, setGenerationState] = useState<GenerationResponse | null>(
    restoreGeneration,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [connectionMode, setConnectionMode] =
    useState<ConnectionMode>("stale_online");
  const [switchingRole, setSwitchingRole] = useState(false);
  const [roleSyncError, setRoleSyncError] = useState("");
  const pendingRoleRef = useRef<RoleSpace | null>(null);
  const switchingRoleRef = useRef(false);
  const [toast, setToast] = useState("");
  const usingFallback = connectionMode === "local_demo";

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (!usingFallback) return;
    try {
      window.localStorage.setItem(
        FALLBACK_WORKSPACE_KEY,
        JSON.stringify(workspace),
      );
      window.localStorage.setItem(FALLBACK_BOOT_KEY, JSON.stringify(boot));
    } catch {
      // Private mode can deny storage.
    }
  }, [workspace, boot, usingFallback]);

  function setGeneration(value: GenerationResponse | null) {
    setGenerationState(value);
    try {
      if (value)
        window.localStorage.setItem(GENERATION_KEY, JSON.stringify(value));
      else window.localStorage.removeItem(GENERATION_KEY);
    } catch {
      // localStorage can be unavailable in privacy mode.
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function refreshAll() {
    setRefreshing(true);
    setConnectionError("");
    const results = await Promise.allSettled([
      api.health(),
      api.bootstrap(),
      api.workspace(),
    ] as const);
    const [healthResult, bootResult, workspaceResult] = results;
    const errors: string[] = [];

    if (healthResult.status === "fulfilled") {
      try {
        assertApiCompatibility(healthResult.value);
        setHealth(healthResult.value);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "API 版本不兼容");
      }
    } else {
      errors.push("后端健康检查暂时不可用");
    }

    if (bootResult.status === "fulfilled") setBoot(bootResult.value);
    else errors.push("基础资料暂时无法刷新");

    if (workspaceResult.status === "fulfilled") {
      const storedRole = restoreRole();
      setWorkspace(
        storedRole
          ? applyOptimisticRole(workspaceResult.value, storedRole)
          : workspaceResult.value,
      );
    } else {
      errors.push("工作区暂时无法刷新");
    }

    const fullyLive = errors.length === 0;
    if (connectionMode !== "local_demo")
      setConnectionMode(fullyLive ? "live" : "stale_online");
    setConnectionError(errors.join("；"));
    setLoading(false);
    setRefreshing(false);
  }

  async function refreshWorkspace() {
    if (usingFallback) return;
    try {
      const latest = await api.workspace();
      const storedRole = restoreRole();
      setWorkspace(
        storedRole ? applyOptimisticRole(latest, storedRole) : latest,
      );
      setConnectionMode("live");
      setConnectionError("");
    } catch (error) {
      setConnectionError(
        error instanceof Error
          ? error.message
          : "工作区刷新失败，继续使用最近成功数据",
      );
      setConnectionMode("stale_online");
    }
  }

  function enterLocalDemo() {
    setConnectionMode("local_demo");
    setConnectionError("");
    showToast("已进入明确标记的本地演示模式");
  }

  async function generateFromOpportunity(
    opportunity: Opportunity,
    options?: GenerateOptions,
  ) {
    const advisor =
      boot.advisors.find((item) => item.id === opportunity.advisor_id) ||
      boot.advisors[0];
    const vehicle =
      boot.vehicles.find((item) => item.id === opportunity.vehicle_id) ||
      boot.vehicles[0];
    if (!advisor || !vehicle) throw new Error("缺少顾问或车型信息");
    const campaign = workspace.campaigns.find(
      (item) => item.id === opportunity.campaign_id,
    );
    const campaignName =
      options?.campaignName || campaign?.name || opportunity.title;
    const campaignBrief =
      options?.campaignBrief ||
      campaign?.brief ||
      opportunity.recommended_action;
    const platforms =
      options?.platforms ||
      (opportunity.kind === "customer"
        ? ["私聊跟进", "朋友圈", "小红书"]
        : ["朋友圈", "小红书"]);
    const result = usingFallback
      ? createLocalGeneration({
          advisor,
          vehicle,
          opportunity,
          campaignName,
          campaignBrief,
          platforms,
        })
      : await api.generate({
          advisor_id: advisor.id,
          vehicle_id: vehicle.id,
          campaign_name: campaignName,
          campaign_brief: campaignBrief,
          platforms,
          objective: "预约试驾",
          use_llm: options?.useAi ?? true,
          opportunity_id: opportunity.id,
          customer_context: opportunity.customer,
        });
    setGeneration(result);
    await updateOpportunityStatus(opportunity.id, "in_progress");
    return result;
  }

  async function regenerateVariant(opportunity: Opportunity, platform: string) {
    const advisor =
      boot.advisors.find((item) => item.id === opportunity.advisor_id) ||
      boot.advisors[0];
    const vehicle =
      boot.vehicles.find((item) => item.id === opportunity.vehicle_id) ||
      boot.vehicles[0];
    if (!advisor || !vehicle) throw new Error("缺少顾问或车型信息");
    const campaign = workspace.campaigns.find(
      (item) => item.id === opportunity.campaign_id,
    );
    const response = usingFallback
      ? createLocalGeneration({
          advisor,
          vehicle,
          opportunity,
          campaignName: campaign?.name || opportunity.title,
          campaignBrief: campaign?.brief || opportunity.recommended_action,
          platforms: [platform],
        })
      : await api.generate({
          advisor_id: advisor.id,
          vehicle_id: vehicle.id,
          campaign_name: campaign?.name || opportunity.title,
          campaign_brief: campaign?.brief || opportunity.recommended_action,
          platforms: [platform],
          objective: "预约试驾",
          use_llm: true,
          opportunity_id: opportunity.id,
          customer_context: opportunity.customer,
        });
    const replacement = response.variants[0];
    if (!replacement) throw new Error("没有生成可用版本");
    if (generation) {
      setGeneration({
        ...generation,
        variants: generation.variants.map((item) =>
          item.platform === platform
            ? { ...replacement, id: item.id, version: item.version + 1 }
            : item,
        ),
        audit: response.audit,
      });
    } else {
      setGeneration(response);
    }
    return replacement;
  }

  async function createGeneralTask(payload: Record<string, unknown>) {
    if (usingFallback) {
      const advisor =
        boot.advisors.find((item) => item.id === payload.advisor_id) ||
        boot.advisors[0];
      const vehicle =
        boot.vehicles.find((item) => item.id === payload.vehicle_id) ||
        boot.vehicles[0];
      if (!advisor || !vehicle) throw new Error("缺少顾问或车型信息");
      const result = createLocalGeneration({
        advisor,
        vehicle,
        campaignName: String(payload.campaign_name || "本地演示任务"),
        campaignBrief: String(payload.campaign_brief || "按真实场景生成内容。"),
        platforms: Array.isArray(payload.platforms)
          ? payload.platforms.map(String)
          : ["朋友圈"],
      });
      setGeneration(result);
      return result;
    }
    const result = await api.generate(payload);
    setGeneration(result);
    return result;
  }

  async function updateOpportunityStatus(
    id: string,
    status: Opportunity["status"],
  ) {
    if (usingFallback) {
      setWorkspace((current) => ({
        ...current,
        opportunities: current.opportunities.map((item) =>
          item.id === id ? { ...item, status } : item,
        ),
      }));
      return;
    }
    const updated = await api.updateOpportunity(id, status);
    setWorkspace((current) => ({
      ...current,
      opportunities: current.opportunities.map((item) =>
        item.id === id ? updated : item,
      ),
    }));
  }

  async function saveVariant(variant: ContentVariant) {
    if (!generation) return;
    if (!usingFallback) {
      await api.saveDraft({
        task_id: generation.task_id,
        variant_id: variant.id,
        platform: variant.platform,
        title: variant.title,
        body: variant.body,
        call_to_action: variant.call_to_action,
        claims: variant.claims,
        risk_annotations: variant.risk_annotations,
        evidence: generation.evidence,
        status: "draft",
        verification_status: variant.verification_status,
        compliance_status: variant.compliance_status,
        knowledge_version: variant.knowledge_version,
        verification_version: variant.verification_version,
        verified_at: variant.verified_at,
        verification_token: variant.verification_token,
        version_history: variant.version_history,
      });
    }
    showToast(
      usingFallback ? "已保存到当前浏览器的本地演示工作区" : "草稿已保存",
    );
  }

  async function submitVariant(variant: ContentVariant) {
    if (!generation) throw new Error("当前没有可提交的内容任务");
    if (variant.verification_status !== "verified")
      throw new Error("内容已发生变化，请重新核验后再提交审核");
    const advisor = boot.advisors.find(
      (item) => item.id === variant.advisor_id,
    );
    if (!usingFallback) await saveVariant(variant);
    const result = usingFallback
      ? createLocalReview(generation, variant)
      : await api.submitReview({
          task_id: generation.task_id,
          variant_id: variant.id,
          platform: variant.platform,
          title: variant.title,
          body: variant.body,
          call_to_action: variant.call_to_action,
          claims: variant.claims,
          risk_annotations: variant.risk_annotations,
          evidence: generation.evidence,
          status: "submitted",
          campaign_name: generation.campaign_name,
          advisor_id: variant.advisor_id,
          advisor_name: variant.advisor_name,
          vehicle_id: generation.vehicle.id,
          risk_level: variant.risk_annotations.some(
            (item) => item.level === "block",
          )
            ? "high"
            : variant.risk_annotations.length
              ? "medium"
              : "low",
          reason:
            variant.risk_annotations[0]?.reason ||
            "事实依据已绑定，等待门店经理确认。",
          evidence_status: generation.evidence.length ? "已绑定" : "缺少事实",
          verification_status: variant.verification_status,
          compliance_status: variant.compliance_status,
          knowledge_version: variant.knowledge_version,
          verification_version: variant.verification_version,
          verified_at: variant.verified_at,
          verification_token: variant.verification_token,
          version_history: variant.version_history,
          store: advisor?.store,
        });
    if (usingFallback)
      setWorkspace((current) => ({
        ...current,
        reviews: [result, ...current.reviews],
      }));
    else await refreshWorkspace();
    showToast("已提交门店审核");
    return result;
  }

  async function addFollowupEvent(
    customerId: string,
    payload: Record<string, unknown>,
  ) {
    const current = workspace.followups.find(
      (item) => item.customer_id === customerId,
    );
    if (!current) throw new Error("未找到客户跟进记录");
    const updated = usingFallback
      ? addLocalFollowupEvent(current, payload)
      : await api.addFollowupEvent(customerId, payload);
    setWorkspace((value) => ({
      ...value,
      followups: value.followups.map((item) =>
        item.customer_id === customerId ? updated : item,
      ),
      opportunities:
        payload.type === "test_drive_booked"
          ? value.opportunities.map((item) =>
              item.customer?.id === customerId
                ? {
                    ...item,
                    status: "done",
                    customer: item.customer
                      ? { ...item.customer, stage: "已预约试驾" }
                      : null,
                  }
                : item,
            )
          : value.opportunities,
    }));
    return updated;
  }

  async function toggleMemoryAction(
    customerId: string,
    memoryId: string,
    active: boolean,
  ) {
    if (!usingFallback) await api.toggleMemory(customerId, memoryId, active);
    setWorkspace((current) => ({
      ...current,
      followups: current.followups.map((item) =>
        item.customer_id === customerId
          ? {
              ...item,
              memories: item.memories.map((memory) =>
                memory.id === memoryId ? { ...memory, active } : memory,
              ),
            }
          : item,
      ),
    }));
  }

  async function decideReviewAction(
    id: string,
    decision: "approved" | "returned",
    reason: string,
    body: string,
    callToAction: string,
    riskAnnotations: ReviewItem["risk_annotations"],
  ) {
    const existing = workspace.reviews.find((item) => item.id === id);
    if (!existing) throw new Error("未找到审核任务");
    const contentChanged =
      body !== existing.reviewed_body ||
      callToAction !== existing.reviewed_call_to_action ||
      JSON.stringify(riskAnnotations) !==
        JSON.stringify(existing.risk_annotations);
    if (
      decision === "approved" &&
      (existing.verification_status !== "verified" || contentChanged)
    )
      throw new Error("经理修改后的内容必须重新核验，不能直接批准");
    const updated = usingFallback
      ? {
          ...existing,
          status: decision,
          decision_reason: reason,
          reviewed_body: body,
          reviewed_call_to_action: callToAction,
          risk_annotations: riskAnnotations,
          decision_at: new Date().toISOString(),
          verification_status: contentChanged
            ? "needs_revalidation"
            : existing.verification_status,
          compliance_status: contentChanged
            ? "needs_revalidation"
            : existing.compliance_status,
          evidence_status: contentChanged
            ? "需要重新核验"
            : existing.evidence_status,
          change_log: [
            ...(existing.change_log || []),
            {
              at: new Date().toISOString(),
              decision,
              reason,
              body_changed: body !== existing.reviewed_body,
              cta_changed: callToAction !== existing.reviewed_call_to_action,
            },
          ],
        }
      : await api.decideReview(
          id,
          decision,
          reason,
          body,
          callToAction,
          riskAnnotations,
        );
    setWorkspace((current) => ({
      ...current,
      reviews: current.reviews.map((item) => (item.id === id ? updated : item)),
    }));
    showToast(decision === "approved" ? "内容已批准" : "已退回顾问修改");
  }

  async function runCampaign(campaign: Campaign) {
    if (usingFallback) {
      const vehicle = boot.vehicles.find(
        (item) => item.id === campaign.vehicle_id,
      );
      if (!vehicle) throw new Error("缺少车型信息");
      const tasks = createLocalCampaignTasks(campaign, boot.advisors, vehicle);
      const updated = {
        ...campaign,
        status: "completed",
        tasks,
        task_summary: campaignSummary(tasks),
        last_run: "刚刚 · 本地规则演示",
      };
      setWorkspace((current) => ({
        ...current,
        campaigns: current.campaigns.map((item) =>
          item.id === campaign.id ? updated : item,
        ),
      }));
      return updated;
    }
    const response = await api.batchGenerate({
      advisor_ids: campaign.target_advisors,
      vehicle_id: campaign.vehicle_id,
      campaign_name: campaign.name,
      campaign_brief: campaign.brief,
      platforms: campaign.channels,
      use_llm: false,
      campaign_id: campaign.id,
    });
    const updated = response.campaign || {
      ...campaign,
      tasks: response.tasks,
      task_summary: campaignSummary(response.tasks),
      status: "completed",
      last_run: "刚刚",
    };
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.map((item) =>
        item.id === campaign.id ? updated : item,
      ),
    }));
    return updated;
  }

  async function retryCampaignTask(campaignId: string, taskId: string) {
    const campaign = workspace.campaigns.find((item) => item.id === campaignId);
    if (!campaign) throw new Error("未找到活动");
    if (usingFallback) {
      const task = campaign.tasks.find((item) => item.id === taskId);
      const advisor = boot.advisors.find(
        (item) => item.id === task?.advisor_id,
      );
      const vehicle = boot.vehicles.find(
        (item) => item.id === campaign.vehicle_id,
      );
      if (!task || !advisor || !vehicle) throw new Error("未找到可重试任务");
      const generated = createLocalCampaignTasks(
        {
          ...campaign,
          target_advisors: [advisor.id],
          channels: [task.platform],
        },
        [advisor],
        vehicle,
      )[0];
      const replacement = {
        ...generated,
        id: task.id,
        retry_count: task.retry_count + 1,
      };
      const tasks = campaign.tasks.map((item) =>
        item.id === task.id ? replacement : item,
      );
      const updated = {
        ...campaign,
        tasks,
        task_summary: campaignSummary(tasks),
        last_run: "刚刚 · 本地重试",
      };
      setWorkspace((current) => ({
        ...current,
        campaigns: current.campaigns.map((item) =>
          item.id === campaignId ? updated : item,
        ),
      }));
      return updated;
    }
    const updated = await api.retryCampaignTask(campaignId, taskId);
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.map((item) =>
        item.id === campaignId ? updated : item,
      ),
    }));
    return updated;
  }

  async function retryFailedCampaignTasks(campaignId: string) {
    const campaign = workspace.campaigns.find((item) => item.id === campaignId);
    if (!campaign) throw new Error("未找到活动");
    if (usingFallback) {
      const vehicle = boot.vehicles.find(
        (item) => item.id === campaign.vehicle_id,
      );
      if (!vehicle) throw new Error("缺少车型信息");
      const tasks = campaign.tasks.map((task) => {
        if (task.status !== "failed") return task;
        const advisor = boot.advisors.find(
          (item) => item.id === task.advisor_id,
        );
        if (!advisor)
          return {
            ...task,
            retry_count: task.retry_count + 1,
            failure_reason: "未找到顾问，无法重试",
          };
        const generated = createLocalCampaignTasks(
          {
            ...campaign,
            target_advisors: [advisor.id],
            channels: [task.platform],
          },
          [advisor],
          vehicle,
        )[0];
        return { ...generated, id: task.id, retry_count: task.retry_count + 1 };
      });
      const updated = {
        ...campaign,
        tasks,
        task_summary: campaignSummary(tasks),
        last_run: "刚刚 · 本地批量重试",
      };
      setWorkspace((current) => ({
        ...current,
        campaigns: current.campaigns.map((item) =>
          item.id === campaignId ? updated : item,
        ),
      }));
      return updated;
    }
    const updated = await api.retryFailedCampaignTasks(campaignId);
    setWorkspace((current) => ({
      ...current,
      campaigns: current.campaigns.map((item) =>
        item.id === campaignId ? updated : item,
      ),
    }));
    return updated;
  }

  async function submitCampaignTaskReview(campaignId: string, taskId: string) {
    const campaign = workspace.campaigns.find((item) => item.id === campaignId);
    const task = campaign?.tasks.find((item) => item.id === taskId);
    if (!campaign || !task?.result) throw new Error("该任务没有可审核内容");
    const review = usingFallback
      ? createLocalReview(
          {
            task_id: task.result.task_id,
            campaign_name: task.result.campaign_name,
            vehicle: task.result.vehicle,
            variants: [task.result.variant],
            evidence: task.result.evidence,
            video_package: task.result.video_package,
            compliance: {
              passed: true,
              score: task.result.variant.compliance_score,
              findings: [],
            },
            audit: task.result.audit,
          },
          task.result.variant,
        )
      : await api.submitCampaignTaskReview(campaignId, taskId);
    if (usingFallback) {
      const tasks = campaign.tasks.map((item) =>
        item.id === taskId
          ? { ...item, status: "submitted" as const, review_id: review.id }
          : item,
      );
      setWorkspace((current) => ({
        ...current,
        reviews: [review, ...current.reviews],
        campaigns: current.campaigns.map((item) =>
          item.id === campaignId
            ? { ...campaign, tasks, task_summary: campaignSummary(tasks) }
            : item,
        ),
      }));
    } else await refreshWorkspace();
    return review;
  }

  async function updateAdvisorAction(
    id: string,
    patch: Pick<Advisor, "audience" | "style">,
  ) {
    const existing = boot.advisors.find((item) => item.id === id);
    if (!existing) throw new Error("未找到顾问");
    const updated = usingFallback
      ? { ...existing, ...patch, updated_at: new Date().toISOString() }
      : await api.updateAdvisor(id, patch);
    setBoot((current) => ({
      ...current,
      advisors: current.advisors.map((item) =>
        item.id === id ? updated : item,
      ),
    }));
    return updated;
  }

  async function startVideo(payload: Record<string, unknown>) {
    if (usingFallback)
      return {
        job_id: `local-video-${Date.now()}`,
        status: "preview",
        mode: "preview",
        message: "当前为本地演示，仅保存脚本和分镜，未生成成片。",
      };
    return api.startVideo(payload);
  }

  function switchRoleAction(role: RoleSpace) {
    if (
      switchingRoleRef.current ||
      workspace.enterprise.enterprise_meta.current_role === role
    )
      return;
    switchingRoleRef.current = true;
    pendingRoleRef.current = role;
    setSwitchingRole(true);
    setRoleSyncError("");
    setWorkspace((current) => applyOptimisticRole(current, role));
    try {
      window.localStorage.setItem(ROLE_KEY, role);
    } catch {
      // Role persistence is best-effort in privacy mode.
    }
    showToast(
      `已切换到${role === "advisor" ? "顾问空间" : role === "manager" ? "门店经理空间" : "总部运营空间"}`,
    );

    if (usingFallback) {
      switchingRoleRef.current = false;
      pendingRoleRef.current = null;
      setSwitchingRole(false);
      return;
    }

    void api
      .switchRole(role, workspace.enterprise.enterprise_meta.current_actor_id)
      .then(() => {
        pendingRoleRef.current = null;
        setRoleSyncError("");
      })
      .catch((error) => {
        setConnectionMode((current) =>
          connectionModeAfterRequestFailure(current),
        );
        setRoleSyncError(
          error instanceof Error ? error.message : "角色切换审计同步失败",
        );
      })
      .finally(() => {
        switchingRoleRef.current = false;
        setSwitchingRole(false);
      });
  }

  async function retryRoleSync() {
    const role =
      pendingRoleRef.current ||
      workspace.enterprise.enterprise_meta.current_role;
    setSwitchingRole(true);
    try {
      await api.switchRole(
        role,
        workspace.enterprise.enterprise_meta.current_actor_id,
      );
      pendingRoleRef.current = null;
      setRoleSyncError("");
      showToast("角色切换审计已同步");
    } catch (error) {
      setRoleSyncError(
        error instanceof Error ? error.message : "角色切换审计同步失败",
      );
    } finally {
      switchingRoleRef.current = false;
      setSwitchingRole(false);
    }
  }

  async function revalidateVariantAction(
    variant: ContentVariant,
  ): Promise<RevalidationResponse> {
    if (!generation) throw new Error("当前没有可重新核验的内容");
    const response = usingFallback
      ? ({
          variant: {
            ...variant,
            verification_status: "verified",
            compliance_status: "verified",
            verification_version: variant.verification_version + 1,
            verified_at: new Date().toISOString(),
            version: variant.version + 1,
            verification_token: `local-${variant.id}-${variant.verification_version + 1}`,
            version_history: [
              ...variant.version_history,
              { type: "local_revalidated", at: new Date().toISOString() },
            ],
          },
          evidence: generation.evidence,
          compliance: generation.compliance,
          verification: {
            status: "verified",
            at: new Date().toISOString(),
            knowledge_version: variant.knowledge_version,
            method: "本地规则演示",
          },
        } as RevalidationResponse)
      : await api.revalidateContent({
          task_id: generation.task_id,
          variant_id: variant.id,
          advisor_id: variant.advisor_id,
          vehicle_id: generation.vehicle.id,
          platform: variant.platform,
          title: variant.title,
          body: variant.body,
          call_to_action: variant.call_to_action,
          version: variant.verification_version,
        });
    setGeneration({
      ...generation,
      variants: generation.variants.map((item) =>
        item.id === variant.id ? response.variant : item,
      ),
      evidence: response.evidence,
      compliance: response.compliance,
    });
    showToast("事实与合规已重新核验");
    return response;
  }

  async function revalidateReviewAction(
    reviewId: string,
    changes?: {
      body: string;
      call_to_action: string;
      risk_annotations: ReviewItem["risk_annotations"];
    },
  ) {
    const existing = workspace.reviews.find((item) => item.id === reviewId);
    if (!existing) throw new Error("未找到审核任务");
    const updated = usingFallback
      ? {
          ...existing,
          reviewed_body: changes?.body ?? existing.reviewed_body,
          reviewed_call_to_action:
            changes?.call_to_action ?? existing.reviewed_call_to_action,
          risk_annotations:
            changes?.risk_annotations ?? existing.risk_annotations,
          verification_status: "verified",
          compliance_status: "verified",
          evidence_status: "已重新核验 · 本地演示",
          verification_version: existing.verification_version + 1,
          verified_at: new Date().toISOString(),
          verification_token: `local-review-${existing.id}-${existing.verification_version + 1}`,
          version_history: [
            ...existing.version_history,
            { type: "manager_revalidated", at: new Date().toISOString() },
          ],
        }
      : await api.revalidateReview(reviewId, changes || {});
    setWorkspace((current) => ({
      ...current,
      reviews: current.reviews.map((item) =>
        item.id === reviewId ? updated : item,
      ),
    }));
    showToast("经理修改后的内容已重新核验");
    return updated;
  }

  function updateEnterpriseLocal(
    updater: (current: EnterpriseWorkspace) => EnterpriseWorkspace,
  ) {
    setWorkspace((current) => ({
      ...current,
      enterprise: updater(current.enterprise),
    }));
  }

  async function resetDemo() {
    if (!usingFallback) {
      const reset = await api.resetDemo();
      setWorkspace(reset);
      setBoot(await api.bootstrap());
    } else {
      setWorkspace(fallbackWorkspace);
      setBoot(fallbackBootstrap);
      try {
        window.localStorage.removeItem(FALLBACK_WORKSPACE_KEY);
        window.localStorage.removeItem(FALLBACK_BOOT_KEY);
      } catch {
        // Ignore storage errors.
      }
    }
    setGeneration(null);
    showToast("当前浏览器工作区已重置");
  }

  const dataMode: AppContextValue["dataMode"] = connectionMode;

  const value = useMemo<AppContextValue>(
    () => ({
      boot,
      health,
      workspace,
      generation,
      loading,
      refreshing,
      connectionError,
      dataMode,
      switchingRole,
      roleSyncError,
      toast,
      setGeneration,
      showToast,
      refreshAll,
      refreshWorkspace,
      generateFromOpportunity,
      regenerateVariant,
      createGeneralTask,
      updateOpportunityStatus,
      saveVariant,
      submitVariant,
      addFollowupEvent,
      toggleMemory: toggleMemoryAction,
      decideReview: decideReviewAction,
      runCampaign,
      retryCampaignTask,
      retryFailedCampaignTasks,
      submitCampaignTaskReview,
      updateAdvisor: updateAdvisorAction,
      startVideo,
      switchRole: switchRoleAction,
      retryRoleSync,
      enterLocalDemo,
      revalidateVariant: revalidateVariantAction,
      revalidateReview: revalidateReviewAction,
      resetDemo,
      updateEnterpriseLocal,
    }),
    [
      boot,
      health,
      workspace,
      generation,
      loading,
      refreshing,
      connectionError,
      dataMode,
      switchingRole,
      roleSyncError,
      toast,
      usingFallback,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
