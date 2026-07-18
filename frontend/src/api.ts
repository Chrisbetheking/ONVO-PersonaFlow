export type Advisor = {
  id: string
  name: string
  city: string
  store: string
  model_focus: string
  audience: string
  style: string
  platforms: string[]
  experience_years: number
  private_domain_size: number
}

export type Vehicle = {
  id: string
  name: string
  positioning: string
  full_purchase_from: string
  baas_from: string
  scenarios: string[]
  source_title: string
  source_url: string
  verified_at: string
}

export type ContentVariant = {
  id: string
  advisor_id: string
  advisor_name: string
  platform: string
  title: string
  body: string
  call_to_action: string
  hashtags: string[]
  personalization_score: number
  grounding_score: number
  compliance_score: number
  status: string
}

export type GenerationResponse = {
  task_id: string
  campaign_name: string
  vehicle: Vehicle
  variants: ContentVariant[]
  video_package: {
    hook: string
    voiceover: string
    shots: Array<{ index: number; duration: number; visual: string; subtitle: string; asset_hint: string }>
    cover_titles: string[]
  }
  compliance: {
    passed: boolean
    score: number
    findings: Array<{ level: string; rule: string; message: string; suggestion: string }>
  }
  evidence: Array<{ field: string; value: string; source_title: string; source_url: string; verified_at: string }>
  audit: { generated_at: string; knowledge_version: string; human_review_required: boolean; generator_mode: string }
}

export type LeadAnalysis = {
  total: number
  high_intent: number
  medium_intent: number
  low_intent: number
  top_concerns: Array<{ topic: string; count: number }>
  leads: Array<{ id: string; text: string; intent: string; concern: string; next_action: string; recommended_reply: string }>
  next_content_topics: string[]
}

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `请求失败：${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; mode: string; version: string }>('/api/health'),
  bootstrap: () => request<{ advisors: Advisor[]; vehicles: Vehicle[]; metrics: Record<string, number>; campaigns: Array<Record<string, string | number>> }>('/api/bootstrap'),
  generate: (payload: Record<string, unknown>) => request<GenerationResponse>('/api/content/generate', { method: 'POST', body: JSON.stringify(payload) }),
  batchGenerate: (payload: Record<string, unknown>) => request<{ batch_id: string; advisor_count: number; variant_count: number; results: GenerationResponse[]; summary: Record<string, number> }>('/api/content/batch-generate', { method: 'POST', body: JSON.stringify(payload) }),
  compliance: (payload: Record<string, unknown>) => request<GenerationResponse['compliance']>('/api/compliance/check', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeLeads: (messages: string[]) => request<LeadAnalysis>('/api/leads/analyze', { method: 'POST', body: JSON.stringify({ messages }) }),
  startVideo: (payload: Record<string, unknown>) => request<{ job_id: string; status: string; mode: string; message: string }>('/api/video/start', { method: 'POST', body: JSON.stringify(payload) }),
}
