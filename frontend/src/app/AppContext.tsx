import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import { fallbackBootstrap, fallbackWorkspace } from '../shared/demoData'
import type {
  BootstrapResponse,
  Campaign,
  ContentVariant,
  Followup,
  GenerationResponse,
  HealthResponse,
  Opportunity,
  ReviewItem,
  WorkspaceResponse,
} from '../types'

const GENERATION_KEY = 'weijian:last-generation:v1'

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
  decideReview: (id: string, decision: 'approved' | 'returned', reason: string) => Promise<void>
  runCampaign: (campaign: Campaign) => Promise<Record<string, number>>
  resetDemo: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function restoreGeneration(): GenerationResponse | null {
  try {
    const raw = window.localStorage.getItem(GENERATION_KEY)
    return raw ? JSON.parse(raw) as GenerationResponse : null
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<BootstrapResponse>(fallbackBootstrap)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceResponse>(fallbackWorkspace)
  const [generation, setGenerationState] = useState<GenerationResponse | null>(restoreGeneration)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [usingFallback, setUsingFallback] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    void refreshAll()
  }, [])

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
      setBoot(fallbackBootstrap)
      setWorkspace(fallbackWorkspace)
      setUsingFallback(true)
      setConnectionError(error instanceof Error ? error.message : '后端连接失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function refreshWorkspace() {
    try {
      setWorkspace(await api.workspace())
      setUsingFallback(false)
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : '工作区刷新失败')
    }
  }

  async function generateFromOpportunity(opportunity: Opportunity, options?: GenerateOptions) {
    const advisor = boot.advisors.find(item => item.id === opportunity.advisor_id) || boot.advisors[0]
    const vehicle = boot.vehicles.find(item => item.id === opportunity.vehicle_id) || boot.vehicles[0]
    if (!advisor || !vehicle) throw new Error('缺少顾问或车型信息')
    const campaign = workspace.campaigns.find(item => item.id === opportunity.campaign_id)
    const result = await api.generate({
      advisor_id: advisor.id,
      vehicle_id: vehicle.id,
      campaign_name: options?.campaignName || campaign?.name || opportunity.title,
      campaign_brief: options?.campaignBrief || campaign?.brief || opportunity.recommended_action,
      platforms: options?.platforms || (opportunity.kind === 'customer' ? ['私聊跟进', '朋友圈', '小红书'] : ['朋友圈', '小红书']),
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
    const response = await api.generate({
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
    const result = await api.generate(payload)
    setGeneration(result)
    return result
  }

  async function updateOpportunityStatus(id: string, status: Opportunity['status']) {
    if (usingFallback) {
      setWorkspace(current => ({
        ...current,
        opportunities: current.opportunities.map(item => item.id === id ? { ...item, status } : item),
      }))
      return
    }
    const updated = await api.updateOpportunity(id, status)
    setWorkspace(current => ({
      ...current,
      opportunities: current.opportunities.map(item => item.id === id ? updated : item),
    }))
  }

  async function saveVariant(variant: ContentVariant) {
    if (!generation) return
    await api.saveDraft({
      task_id: generation.task_id,
      variant_id: variant.id,
      platform: variant.platform,
      title: variant.title,
      body: variant.body,
      call_to_action: variant.call_to_action,
      status: 'draft',
    })
    showToast('草稿已保存')
  }

  async function submitVariant(variant: ContentVariant) {
    if (!generation) throw new Error('当前没有可提交的内容任务')
    const advisor = boot.advisors.find(item => item.id === variant.advisor_id)
    const result = await api.submitReview({
      task_id: generation.task_id,
      variant_id: variant.id,
      platform: variant.platform,
      title: variant.title,
      body: variant.body,
      call_to_action: variant.call_to_action,
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
    await refreshWorkspace()
    showToast('已提交门店审核')
    return result
  }

  async function addFollowupEvent(customerId: string, payload: Record<string, unknown>) {
    const updated = usingFallback
      ? null
      : await api.addFollowupEvent(customerId, payload)
    if (updated) {
      setWorkspace(current => ({ ...current, followups: current.followups.map(item => item.customer_id === customerId ? updated : item) }))
      return updated
    }
    const fallback = workspace.followups.find(item => item.customer_id === customerId)
    if (!fallback) throw new Error('未找到客户跟进记录')
    const local = {
      ...fallback,
      events: [...fallback.events, {
        id: `local-${Date.now()}`,
        type: String(payload.type || 'advisor_note'),
        actor: String(payload.actor || '顾问'),
        time: '刚刚',
        title: String(payload.title || '新增记录'),
        content: String(payload.content || ''),
        status: String(payload.status || 'completed'),
      }],
    }
    setWorkspace(current => ({ ...current, followups: current.followups.map(item => item.customer_id === customerId ? local : item) }))
    return local
  }

  async function toggleMemoryAction(customerId: string, memoryId: string, active: boolean) {
    if (!usingFallback) await api.toggleMemory(customerId, memoryId, active)
    setWorkspace(current => ({
      ...current,
      followups: current.followups.map(item => item.customer_id === customerId ? {
        ...item,
        memories: item.memories.map(memory => memory.id === memoryId ? { ...memory, active } : memory),
      } : item),
    }))
  }

  async function decideReviewAction(id: string, decision: 'approved' | 'returned', reason: string) {
    const updated = usingFallback
      ? { ...workspace.reviews.find(item => item.id === id)!, status: decision, decision_reason: reason }
      : await api.decideReview(id, decision, reason)
    setWorkspace(current => ({ ...current, reviews: current.reviews.map(item => item.id === id ? updated : item) }))
    showToast(decision === 'approved' ? '内容已批准' : '已退回顾问修改')
  }

  async function runCampaign(campaign: Campaign) {
    const response = await api.batchGenerate({
      advisor_ids: campaign.target_advisors,
      vehicle_id: campaign.vehicle_id,
      campaign_name: campaign.name,
      campaign_brief: campaign.brief,
      platforms: campaign.channels,
      use_llm: false,
      campaign_id: campaign.id,
    })
    await refreshWorkspace()
    return response.summary
  }

  async function resetDemo() {
    if (!usingFallback) await api.resetDemo()
    setGeneration(null)
    await refreshAll()
    showToast('演示数据已重置')
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
    resetDemo,
  }), [boot, health, workspace, generation, loading, refreshing, connectionError, dataMode, toast])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}
