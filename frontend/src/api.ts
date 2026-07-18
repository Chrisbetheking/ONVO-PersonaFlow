import type {
  BootstrapResponse,
  Campaign,
  ComplianceResult,
  Followup,
  GenerationResponse,
  HealthResponse,
  LeadAnalysis,
  Opportunity,
  ReviewItem,
  WorkspaceResponse,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const DEFAULT_TIMEOUT = 30000

async function request<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
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

export const api = {
  baseUrl: API_BASE,
  health: () => request<HealthResponse>('/api/health'),
  bootstrap: () => request<BootstrapResponse>('/api/bootstrap'),
  workspace: () => request<WorkspaceResponse>('/api/workspace'),
  opportunities: () => request<{ items: Opportunity[]; data_mode: string }>('/api/opportunities'),
  updateOpportunity: (id: string, status: Opportunity['status']) => post<Opportunity>(`/api/opportunities/${id}/status`, { status }),
  generate: (payload: Record<string, unknown>) => post<GenerationResponse>('/api/content/generate', payload, 90000),
  rewrite: (payload: Record<string, unknown>) => post<{ text: string; provider: string; ai_used: boolean }>('/api/content/rewrite', payload, 90000),
  batchGenerate: (payload: Record<string, unknown>) => post<{ batch_id: string; advisor_count: number; variant_count: number; results: GenerationResponse[]; warnings: string[]; summary: Record<string, number> }>('/api/content/batch-generate', payload, 120000),
  compliance: (payload: Record<string, unknown>) => post<ComplianceResult>('/api/compliance/check', payload),
  analyzeLeads: (messages: string[]) => post<LeadAnalysis>('/api/leads/analyze', { messages }),
  followups: () => request<{ items: Followup[]; data_mode: string }>('/api/followups'),
  addFollowupEvent: (customerId: string, payload: Record<string, unknown>) => post<Followup>(`/api/followups/${customerId}/events`, payload),
  toggleMemory: (customerId: string, memoryId: string, active: boolean) => post(`/api/followups/${customerId}/memories/${memoryId}`, { active }),
  reviews: () => request<{ items: ReviewItem[]; data_mode: string }>('/api/reviews'),
  decideReview: (id: string, decision: 'approved' | 'returned', reason: string) => post<ReviewItem>(`/api/reviews/${id}/decision`, { decision, reason }),
  campaigns: () => request<{ items: Campaign[]; data_mode: string }>('/api/campaigns'),
  saveDraft: (payload: Record<string, unknown>) => post('/api/drafts/save', payload),
  submitReview: (payload: Record<string, unknown>) => post<ReviewItem>('/api/drafts/submit-review', payload),
  startVideo: (payload: Record<string, unknown>) => post<{ job_id: string; status: string; mode: string; message: string }>('/api/video/start', payload, 90000),
  resetDemo: () => post<WorkspaceResponse>('/api/demo/reset', {}),
}
