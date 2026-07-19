import type {
  Advisor,
  BootstrapResponse,
  Campaign,
  ComplianceResult,
  Followup,
  GenerationResponse,
  HealthResponse,
  LeadAnalysis,
  Opportunity,
  ReviewItem,
  VideoJobState,
  WorkspaceResponse,
  EnterpriseWorkspace,
  RevalidationResponse,
  Hotspot,
  KnowledgeItem,
  CustomerProfile,
  PromiseItem,
  QualitySignal,
  BestPractice,
  CustomerRisk,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const DEFAULT_TIMEOUT = 30000
const WORKSPACE_KEY = 'weijian:workspace-id:v1'

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getWorkspaceId() {
  try {
    const current = window.localStorage.getItem(WORKSPACE_KEY)
    if (current) return current
    const created = createUuid()
    window.localStorage.setItem(WORKSPACE_KEY, created)
    return created
  } catch {
    return createUuid()
  }
}

export const workspaceId = getWorkspaceId()

async function request<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspaceId,
        ...(options?.headers || {}),
      },
      ...options,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时。后端可能正在冷启动，请稍后重试。')
    }
    throw new Error(`无法连接后端服务。请检查部署地址和服务状态。${error instanceof Error ? ` ${error.message}` : ''}`)
  } finally {
    window.clearTimeout(timeout)
  }
  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    let detail = raw
    try {
      const parsed = JSON.parse(raw) as { detail?: string }
      detail = parsed.detail || raw
    } catch {
      // Keep plain text response.
    }
    throw new Error(detail || `请求失败：${response.status}`)
  }
  return response.json() as Promise<T>
}

const post = <T>(path: string, payload: unknown, timeoutMs?: number) => request<T>(path, {
  method: 'POST',
  body: JSON.stringify(payload),
  timeoutMs,
})

const patch = <T>(path: string, payload: unknown) => request<T>(path, {
  method: 'PATCH',
  body: JSON.stringify(payload),
})

export const api = {
  baseUrl: API_BASE,
  workspaceId,
  health: () => request<HealthResponse>('/api/health'),
  bootstrap: () => request<BootstrapResponse>('/api/bootstrap'),
  workspace: () => request<WorkspaceResponse>('/api/workspace'),
  opportunities: () => request<{ items: Opportunity[]; data_mode: string }>('/api/opportunities'),
  updateOpportunity: (id: string, status: Opportunity['status']) => post<Opportunity>(`/api/opportunities/${id}/status`, { status }),
  updateAdvisor: (id: string, payload: Pick<Advisor, 'audience' | 'style'> & Partial<Pick<Advisor, 'platforms' | 'model_focus'>>) => patch<Advisor>(`/api/advisors/${id}`, payload),
  generate: (payload: Record<string, unknown>) => post<GenerationResponse>('/api/content/generate', payload, 90000),
  rewrite: (payload: Record<string, unknown>) => post<{ text: string; provider: string; ai_used: boolean }>('/api/content/rewrite', payload, 90000),
  batchGenerate: (payload: Record<string, unknown>) => post<{ batch_id: string; advisor_count: number; variant_count: number; results: GenerationResponse[]; tasks: Campaign['tasks']; campaign: Campaign | null; warnings: string[]; summary: Record<string, number> }>('/api/content/batch-generate', payload, 120000),
  retryCampaignTask: (campaignId: string, taskId: string) => post<Campaign>(`/api/campaigns/${campaignId}/tasks/${taskId}/retry`, {}, 90000),
  retryFailedCampaignTasks: (campaignId: string) => post<Campaign>(`/api/campaigns/${campaignId}/retry-failed`, {}, 120000),
  submitCampaignTaskReview: (campaignId: string, taskId: string) => post<ReviewItem>(`/api/campaigns/${campaignId}/tasks/${taskId}/submit-review`, {}),
  compliance: (payload: Record<string, unknown>) => post<ComplianceResult>('/api/compliance/check', payload),
  analyzeLeads: (messages: string[]) => post<LeadAnalysis>('/api/leads/analyze', { messages }),
  followups: () => request<{ items: Followup[]; data_mode: string }>('/api/followups'),
  addFollowupEvent: (customerId: string, payload: Record<string, unknown>) => post<Followup>(`/api/followups/${customerId}/events`, payload),
  convertFollowupEvent: (customerId: string, eventId: string, action: string, note = '') => post(`/api/followups/${customerId}/events/${eventId}/convert`, { action, note }),
  toggleMemory: (customerId: string, memoryId: string, active: boolean) => post(`/api/followups/${customerId}/memories/${memoryId}`, { active }),
  reviews: () => request<{ items: ReviewItem[]; data_mode: string }>('/api/reviews'),
  decideReview: (id: string, decision: 'approved' | 'returned', reason: string, body: string, callToAction: string, riskAnnotations: ReviewItem['risk_annotations']) => post<ReviewItem>(`/api/reviews/${id}/decision`, { decision, reason, body, call_to_action: callToAction, risk_annotations: riskAnnotations }),
  campaigns: () => request<{ items: Campaign[]; data_mode: string }>('/api/campaigns'),
  saveDraft: (payload: Record<string, unknown>) => post('/api/drafts/save', payload),
  submitReview: (payload: Record<string, unknown>) => post<ReviewItem>('/api/drafts/submit-review', payload),
  startVideo: (payload: Record<string, unknown>) => post<VideoJobState>('/api/video/start', payload, 90000),
  resetDemo: () => post<WorkspaceResponse>('/api/demo/reset', {}),
  enterprise: () => request<EnterpriseWorkspace>('/api/enterprise'),
  switchRole: (role: string, actorId?: string) => post('/api/enterprise/role', { role, actor_id: actorId }),
  revalidateContent: (payload: Record<string, unknown>) => post<RevalidationResponse>('/api/content/revalidate', payload),
  revalidateReview: (reviewId: string, payload: Record<string, unknown> = {}) => post<ReviewItem>(`/api/reviews/${reviewId}/revalidate`, payload),
  hotspots: () => request<{ items: Hotspot[]; data_mode: string }>('/api/hotspots'),
  hotspotAction: (id: string, action: string, reason = '') => post(`/api/hotspots/${id}/actions`, { action, reason }),
  knowledge: () => request<{ items: KnowledgeItem[]; data_mode: string }>('/api/knowledge'),
  simulateFeishuChange: (changeType: string) => post('/api/integrations/feishu/simulate-change', { change_type: changeType }),
  syncIntegration: (name: string) => post(`/api/integrations/${name}/sync`, {}),
  retrySyncEvent: (eventId: string, reason = '手动重试') => post(`/api/sync-events/${eventId}/retry`, { reason }),
  impactAction: (impactId: string, objectId: string, action: string, reason = '', owner = '') => post(`/api/knowledge-impacts/${impactId}/actions`, { object_id: objectId, action, reason, owner }),
  customers: () => request<{ items: CustomerProfile[]; data_mode: string }>('/api/customers'),
  customerAction: (customerId: string, actionId: string, action: string, note = '') => post(`/api/customers/${customerId}/next-actions`, { action_id: actionId, action, note }),
  promises: () => request<{ items: PromiseItem[]; data_mode: string }>('/api/promises'),
  createPromise: (payload: Record<string, unknown>) => post<PromiseItem>('/api/promises', payload),
  promiseAction: (id: string, action: string, payload: Record<string, unknown> = {}) => post<PromiseItem>(`/api/promises/${id}/actions`, { action, ...payload }),
  simulatePromise: (id: string, state: string) => post(`/api/promises/${id}/simulate/${state}`, {}),
  qualitySignals: () => request<{ items: QualitySignal[]; data_mode: string }>('/api/quality-signals'),
  employeeQualityResponse: (id: string, response: string, improvementPlan = '') => post<QualitySignal>(`/api/quality-signals/${id}/employee-response`, { response, improvement_plan: improvementPlan }),
  managerQualityDecision: (id: string, decision: string, reason = '') => post(`/api/quality-signals/${id}/manager-decision`, { decision, reason }),
  publishBestPractice: (id: string) => post<BestPractice>(`/api/best-practices/${id}/publish`, {}),
  bestPracticeAction: (id: string, action: string) => post<BestPractice>(`/api/best-practices/${id}/actions`, { action }),
  customerRiskAction: (id: string, action: string, note = '') => post<CustomerRisk>(`/api/customer-risks/${id}/actions`, { action, note }),
  resetScenario: (scenarioId: string) => post<EnterpriseWorkspace>('/api/demo/scenario', { scenario_id: scenarioId }),
}
