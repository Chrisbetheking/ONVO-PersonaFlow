import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import { fallbackBootstrap, fallbackWorkspace } from '../shared/demoData'
import {
  addLocalFollowupEvent,
  createLocalCampaignTasks,
  createLocalGeneration,
  createLocalReview,
} from '../shared/localDemo'
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
  VideoJobState,
  WorkspaceResponse,
} from '../types'

const GENERATION_KEY = `weijian:last-generation:${api.workspaceId}`
const FALLBACK_WORKSPACE_KEY = `weijian:fallback-workspace:${api.workspaceId}`
const FALLBACK_BOOT_KEY = `weijian:fallback-bootstrap:${api.workspaceId}`

type GenerateOptions = {
  platforms?: string[]
  campaignName?: string
  campaignBrief?: string
  useAi?: boolean
}

type AppContextValue = {
  boot: BootstrapResponse
  health: HealthResponse | null
  workspace: WorkspaceResponse
  generation: GenerationResponse | null
  loading: boolean
  refreshing: boolean
  connectionError: string
  dataMode: 'demo' | 'live' | 'fallback'
  toast: string
  setGeneration: (value: GenerationResponse | null) => void
  showToast: (message: string) => void
  refreshAll: () => Promise<void>
  refreshWorkspace: () => Promise<void>
  generateFromOpportunity: (opportunity: Opportunity, options?: GenerateOptions) => Promise<GenerationResponse>
  regenerateVariant: (opportunity: Opportunity, platform: string) => Promise<ContentVariant>
  createGeneralTask: (payload: Record<string, unknown>) => Promise<GenerationResponse>
  updateOpportunityStatus: (id: string, status: Opportunity['status']) => Promise<void>
  saveVariant: (variant: ContentVariant) => Promise<void>
  submitVariant: (variant: ContentVariant) => Promise<ReviewItem>
  addFollowupEvent: (customerId: string, payload: Record<string, unknown>) => Promise<Followup>
  toggleMemory: (customerId: string, memoryId: string, active: boolean) => Promise<void>
  decideReview: (id: string, decision: 'approved' | 'returned', reason: string, body: string, callToAction: string, riskAnnotations: ReviewItem['risk_annotations']) => Promise<void>
  runCampaign: (campaign: Campaign) => Promise<Campaign>
  retryCampaignTask: (campaignId: string, taskId: string) => Promise<Campaign>
  retryFailedCampaignTasks: (campaignId: string) => Promise<Campaign>
  submitCampaignTaskReview: (campaignId: string, taskId: string) => Promise<ReviewItem>
  updateAdvisor: (id: string, patch: Pick<Advisor, 'audience' | 'style'>) => Promise<Advisor>
  startVideo: (payload: Record<string, unknown>) => Promise<VideoJobState>
  resetDemo: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function restoreJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function restoreGeneration(): GenerationResponse | null {
  return restoreJson<GenerationResponse | null>(GENERATION_KEY, null)
}

function campaignSummary(tasks: CampaignTask[]) {
  return {
    total: tasks.length,
    ready: tasks.filter(task => task.status === 'ready' || task.status === 'submitted').length,
    pending_review: tasks.filter(task => task.status === 'needs_review').length,
    failed: tasks.filter(task => task.status === 'failed').length,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<BootstrapResponse>(() => restoreJson(FALLBACK_BOOT_KEY, fallbackBootstrap))
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceResponse>(() => restoreJson(FALLBACK_WORKSPACE_KEY, fallbackWorkspace))
  const [generation, setGenerationState] = useState<GenerationResponse | null>(restoreGeneration)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [usingFallback, setUsingFallback] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    if (!usingFallback) return
    try {
      window.localStorage.setItem(FALLBACK_WORKSPACE_KEY, JSON.stringify(workspace))
      window.localStorage.setItem(FALLBACK_BOOT_KEY, JSON.stringify(boot))
    } catch {
      // Private mode can deny storage.
    }
  }, [workspace, boot, usingFallback])

  function setGeneration(value: GenerationResponse | null) {
    setGenerationState(value)
    try {
      if (value) window.localStorage.setItem(GENERATION_KEY, JSON.stringify(value))
      else window.localStorage.removeItem(GENERATION_KEY)
    } catch {
      // localStorage can be unavailable in privacy mode.
    }
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  async function refreshAll() {
    setRefreshing(true)
    setConnectionError('')
    try {
      const [healthData, bootData, workspaceData] = await Promise.all([api.health(), api.bootstrap(), api.workspace()])
      setHealth(healthData)
      setBoot(bootData)
      setWorkspace(workspaceData)
      setUsingFallback(false)
    } catch (error) {
      setHealth(null)
      setUsingFallback(true)
      setConnectionError(error instanceof Error ? error.message : '后端连接失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function refreshWorkspace() {
    if (usingFallback) return
    try {
      setWorkspace(await api.workspace())
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : '工作区刷新失败')
      setUsingFallback(true)
    }
  }

  async function generateFromOpportunity(opportunity: Opportunity, options?: GenerateOptions) {
    const advisor = boot.advisors.find(item => item.id === opportunity.advisor_id) || boot.advisors[0]
    const vehicle = boot.vehicles.find(item => item.id === opportunity.vehicle_id) || boot.vehicles[0]
    if (!advisor || !vehicle) throw new Error('缺少顾问或车型信息')
    const campaign = workspace.campaigns.find(item => item.id === opportunity.campaign_id)
    const campaignName = options?.campaignName || campaign?.name || opportunity.title
    const campaignBrief = options?.campaignBrief || campaign?.brief || opportunity.recommended_action
    const platforms = options?.platforms || (opportunity.kind === 'customer' ? ['私聊跟进', '朋友圈', '小红书'] : ['朋友圈', '小红书'])
    const result = usingFallback
      ? createLocalGeneration({ advisor, vehicle, opportunity, campaignName, campaignBrief, platforms })
      : await api.generate({
        advisor_id: advisor.id,
        vehicle_id: vehicle.id,
        campaign_name: campaignName,
        campaign_brief: campaignBrief,
        platforms,
        objective: '预约试驾',
        use_llm: options?.useAi ?? true,
        opportunity_id: opportunity.id,
        customer_context: opportunity.customer,
      })
    setGeneration(result)
    await updateOpportunityStatus(opportunity.id, 'in_progress')
    return result
  }

  async function regenerateVariant(opportunity: Opportunity, platform: string) {
    const advisor = boot.advisors.find(item => item.id === opportunity.advisor_id) || boot.advisors[0]
    const vehicle = boot.vehicles.find(item => item.id === opportunity.vehicle_id) || boot.vehicles[0]
    if (!advisor || !vehicle) throw new Error('缺少顾问或车型信息')
    const campaign = workspace.campaigns.find(item => item.id === opportunity.campaign_id)
    const response = usingFallback
      ? createLocalGeneration({ advisor, vehicle, opportunity, campaignName: campaign?.name || opportunity.title, campaignBrief: campaign?.brief || opportunity.recommended_action, platforms: [platform] })
      : await api.generate({
        advisor_id: advisor.id,
        vehicle_id: vehicle.id,
        campaign_name: campaign?.name || opportunity.title,
        campaign_brief: campaign?.brief || opportunity.recommended_action,
        platforms: [platform],
        objective: '预约试驾',
        use_llm: true,
        opportunity_id: opportunity.id,
        customer_context: opportunity.customer,
      })
    const replacement = response.variants[0]
    if (!replacement) throw new Error('没有生成可用版本')
    if (generation) {
      setGeneration({
        ...generation,
        variants: generation.variants.map(item => item.platform === platform ? { ...replacement, id: item.id, version: item.version + 1 } : item),
        audit: response.audit,
      })
    } else {
      setGeneration(response)
    }
    return replacement
  }

  async function createGeneralTask(payload: Record<string, unknown>) {
    if (usingFallback) {
      const advisor = boot.advisors.find(item => item.id === payload.advisor_id) || boot.advisors[0]
      const vehicle = boot.vehicles.find(item => item.id === payload.vehicle_id) || boot.vehicles[0]
      if (!advisor || !vehicle) throw new Error('缺少顾问或车型信息')
      const result = createLocalGeneration({ advisor, vehicle, campaignName: String(payload.campaign_name || '本地演示任务'), campaignBrief: String(payload.campaign_brief || '按真实场景生成内容。'), platforms: Array.isArray(payload.platforms) ? payload.platforms.map(String) : ['朋友圈'] })
      setGeneration(result)
      return result
    }
    const result = await api.generate(payload)
    setGeneration(result)
    return result
  }

  async function updateOpportunityStatus(id: string, status: Opportunity['status']) {
    if (usingFallback) {
      setWorkspace(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id ? { ...item, status } : item) }))
      return
    }
    const updated = await api.updateOpportunity(id, status)
    setWorkspace(current => ({ ...current, opportunities: current.opportunities.map(item => item.id === id ? updated : item) }))
  }

  async function saveVariant(variant: ContentVariant) {
    if (!generation) return
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
        status: 'draft',
      })
    }
    showToast(usingFallback ? '已保存到当前浏览器的本地演示工作区' : '草稿已保存')
  }

  async function submitVariant(variant: ContentVariant) {
    if (!generation) throw new Error('当前没有可提交的内容任务')
    const advisor = boot.advisors.find(item => item.id === variant.advisor_id)
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
        status: 'submitted',
        campaign_name: generation.campaign_name,
        advisor_id: variant.advisor_id,
        advisor_name: variant.advisor_name,
        vehicle_id: generation.vehicle.id,
        risk_level: variant.risk_annotations.some(item => item.level === 'block') ? 'high' : variant.risk_annotations.length ? 'medium' : 'low',
        reason: variant.risk_annotations[0]?.reason || '事实依据已绑定，等待门店经理确认。',
        evidence_status: generation.evidence.length ? '已绑定' : '缺少事实',
        store: advisor?.store,
      })
    if (usingFallback) setWorkspace(current => ({ ...current, reviews: [result, ...current.reviews] }))
    else await refreshWorkspace()
    showToast('已提交门店审核')
    return result
  }

  async function addFollowupEvent(customerId: string, payload: Record<string, unknown>) {
    const current = workspace.followups.find(item => item.customer_id === customerId)
    if (!current) throw new Error('未找到客户跟进记录')
    const updated = usingFallback ? addLocalFollowupEvent(current, payload) : await api.addFollowupEvent(customerId, payload)
    setWorkspace(value => ({
      ...value,
      followups: value.followups.map(item => item.customer_id === customerId ? updated : item),
      opportunities: payload.type === 'test_drive_booked'
        ? value.opportunities.map(item => item.customer?.id === customerId ? { ...item, status: 'done', customer: item.customer ? { ...item.customer, stage: '已预约试驾' } : null } : item)
        : value.opportunities,
    }))
    return updated
  }

  async function toggleMemoryAction(customerId: string, memoryId: string, active: boolean) {
    if (!usingFallback) await api.toggleMemory(customerId, memoryId, active)
    setWorkspace(current => ({
      ...current,
      followups: current.followups.map(item => item.customer_id === customerId ? { ...item, memories: item.memories.map(memory => memory.id === memoryId ? { ...memory, active } : memory) } : item),
    }))
  }

  async function decideReviewAction(id: string, decision: 'approved' | 'returned', reason: string, body: string, callToAction: string, riskAnnotations: ReviewItem['risk_annotations']) {
    const existing = workspace.reviews.find(item => item.id === id)
    if (!existing) throw new Error('未找到审核任务')
    const updated = usingFallback
      ? { ...existing, status: decision, decision_reason: reason, reviewed_body: body, reviewed_call_to_action: callToAction, risk_annotations: riskAnnotations, decision_at: new Date().toISOString(), change_log: [...(existing.change_log || []), { at: new Date().toISOString(), decision, reason, body_changed: body !== existing.reviewed_body, cta_changed: callToAction !== existing.reviewed_call_to_action }] }
      : await api.decideReview(id, decision, reason, body, callToAction, riskAnnotations)
    setWorkspace(current => ({ ...current, reviews: current.reviews.map(item => item.id === id ? updated : item) }))
    showToast(decision === 'approved' ? '内容已批准' : '已退回顾问修改')
  }

  async function runCampaign(campaign: Campaign) {
    if (usingFallback) {
      const vehicle = boot.vehicles.find(item => item.id === campaign.vehicle_id)
      if (!vehicle) throw new Error('缺少车型信息')
      const tasks = createLocalCampaignTasks(campaign, boot.advisors, vehicle)
      const updated = { ...campaign, status: 'completed', tasks, task_summary: campaignSummary(tasks), last_run: '刚刚 · 本地规则演示' }
      setWorkspace(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaign.id ? updated : item) }))
      return updated
    }
    const response = await api.batchGenerate({ advisor_ids: campaign.target_advisors, vehicle_id: campaign.vehicle_id, campaign_name: campaign.name, campaign_brief: campaign.brief, platforms: campaign.channels, use_llm: false, campaign_id: campaign.id })
    const updated = response.campaign || { ...campaign, tasks: response.tasks, task_summary: campaignSummary(response.tasks), status: 'completed', last_run: '刚刚' }
    setWorkspace(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaign.id ? updated : item) }))
    return updated
  }

  async function retryCampaignTask(campaignId: string, taskId: string) {
    const campaign = workspace.campaigns.find(item => item.id === campaignId)
    if (!campaign) throw new Error('未找到活动')
    if (usingFallback) {
      const task = campaign.tasks.find(item => item.id === taskId)
      const advisor = boot.advisors.find(item => item.id === task?.advisor_id)
      const vehicle = boot.vehicles.find(item => item.id === campaign.vehicle_id)
      if (!task || !advisor || !vehicle) throw new Error('未找到可重试任务')
      const generated = createLocalCampaignTasks({ ...campaign, target_advisors: [advisor.id], channels: [task.platform] }, [advisor], vehicle)[0]
      const replacement = { ...generated, id: task.id, retry_count: task.retry_count + 1 }
      const tasks = campaign.tasks.map(item => item.id === task.id ? replacement : item)
      const updated = { ...campaign, tasks, task_summary: campaignSummary(tasks), last_run: '刚刚 · 本地重试' }
      setWorkspace(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaignId ? updated : item) }))
      return updated
    }
    const updated = await api.retryCampaignTask(campaignId, taskId)
    setWorkspace(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaignId ? updated : item) }))
    return updated
  }

  async function retryFailedCampaignTasks(campaignId: string) {
    const campaign = workspace.campaigns.find(item => item.id === campaignId)
    if (!campaign) throw new Error('未找到活动')
    if (usingFallback) {
      const vehicle = boot.vehicles.find(item => item.id === campaign.vehicle_id)
      if (!vehicle) throw new Error('缺少车型信息')
      const tasks = campaign.tasks.map(task => {
        if (task.status !== 'failed') return task
        const advisor = boot.advisors.find(item => item.id === task.advisor_id)
        if (!advisor) return { ...task, retry_count: task.retry_count + 1, failure_reason: '未找到顾问，无法重试' }
        const generated = createLocalCampaignTasks({ ...campaign, target_advisors: [advisor.id], channels: [task.platform] }, [advisor], vehicle)[0]
        return { ...generated, id: task.id, retry_count: task.retry_count + 1 }
      })
      const updated = { ...campaign, tasks, task_summary: campaignSummary(tasks), last_run: '刚刚 · 本地批量重试' }
      setWorkspace(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaignId ? updated : item) }))
      return updated
    }
    const updated = await api.retryFailedCampaignTasks(campaignId)
    setWorkspace(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaignId ? updated : item) }))
    return updated
  }

  async function submitCampaignTaskReview(campaignId: string, taskId: string) {
    const campaign = workspace.campaigns.find(item => item.id === campaignId)
    const task = campaign?.tasks.find(item => item.id === taskId)
    if (!campaign || !task?.result) throw new Error('该任务没有可审核内容')
    const review = usingFallback
      ? createLocalReview({
        task_id: task.result.task_id,
        campaign_name: task.result.campaign_name,
        vehicle: task.result.vehicle,
        variants: [task.result.variant],
        evidence: task.result.evidence,
        video_package: task.result.video_package,
        compliance: { passed: true, score: task.result.variant.compliance_score, findings: [] },
        audit: task.result.audit,
      }, task.result.variant)
      : await api.submitCampaignTaskReview(campaignId, taskId)
    if (usingFallback) {
      const tasks = campaign.tasks.map(item => item.id === taskId ? { ...item, status: 'submitted' as const, review_id: review.id } : item)
      setWorkspace(current => ({ ...current, reviews: [review, ...current.reviews], campaigns: current.campaigns.map(item => item.id === campaignId ? { ...campaign, tasks, task_summary: campaignSummary(tasks) } : item) }))
    } else await refreshWorkspace()
    return review
  }

  async function updateAdvisorAction(id: string, patch: Pick<Advisor, 'audience' | 'style'>) {
    const existing = boot.advisors.find(item => item.id === id)
    if (!existing) throw new Error('未找到顾问')
    const updated = usingFallback ? { ...existing, ...patch, updated_at: new Date().toISOString() } : await api.updateAdvisor(id, patch)
    setBoot(current => ({ ...current, advisors: current.advisors.map(item => item.id === id ? updated : item) }))
    return updated
  }

  async function startVideo(payload: Record<string, unknown>) {
    if (usingFallback) return { job_id: `local-video-${Date.now()}`, status: 'preview', mode: 'preview', message: '当前为本地演示，仅保存脚本和分镜，未生成成片。' }
    return api.startVideo(payload)
  }

  async function resetDemo() {
    if (!usingFallback) {
      const reset = await api.resetDemo()
      setWorkspace(reset)
      setBoot(await api.bootstrap())
    } else {
      setWorkspace(fallbackWorkspace)
      setBoot(fallbackBootstrap)
      try {
        window.localStorage.removeItem(FALLBACK_WORKSPACE_KEY)
        window.localStorage.removeItem(FALLBACK_BOOT_KEY)
      } catch {
        // Ignore storage errors.
      }
    }
    setGeneration(null)
    showToast('当前浏览器工作区已重置')
  }

  const dataMode: AppContextValue['dataMode'] = usingFallback ? 'fallback' : workspace.data_mode === 'live' ? 'live' : 'demo'

  const value = useMemo<AppContextValue>(() => ({
    boot,
    health,
    workspace,
    generation,
    loading,
    refreshing,
    connectionError,
    dataMode,
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
    resetDemo,
  }), [boot, health, workspace, generation, loading, refreshing, connectionError, dataMode, toast, usingFallback])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}
