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

export type ProviderStatus = {
  mode: string
  label: string
  ready: boolean
  model: string
  thinking: string
}

export type HealthResponse = {
  status: string
  mode: string
  version: string
  knowledge_version: string
  provider: ProviderStatus
}

export type CustomerContext = {
  id: string
  name: string
  city: string
  stage: string
  family: string
  concerns: string[]
  recent_message: string
  last_contact: string
}

export type Opportunity = {
  id: string
  kind: 'customer' | 'segment' | 'topic'
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'later' | 'in_progress' | 'done'
  title: string
  source: string
  why_now: string
  signal: string
  recommended_action: string
  due_label: string
  advisor_id: string
  vehicle_id: string
  campaign_id: string | null
  customer: CustomerContext | null
}

export type Evidence = {
  id: string
  field: string
  value: string
  source_title: string
  source_url: string
  verified_at: string
  source_type: string
}

export type Claim = {
  id: string
  text: string
  evidence_id: string
  field: string
}

export type RiskAnnotation = {
  id: string
  text: string
  level: 'info' | 'warning' | 'block' | string
  rule: string
  reason: string
  suggestion: string
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
  personalization_reasons: string[]
  claims: Claim[]
  risk_annotations: RiskAnnotation[]
  version: number
}

export type ComplianceResult = {
  passed: boolean
  score: number
  findings: Array<{ level: string; rule: string; message: string; suggestion: string }>
}

export type GenerationResponse = {
  task_id: string
  opportunity_id?: string | null
  campaign_name: string
  customer_context?: CustomerContext | null
  vehicle: Vehicle
  variants: ContentVariant[]
  video_package: {
    hook: string
    voiceover: string
    shots: Array<{ index: number; duration: number; visual: string; subtitle: string; asset_hint: string }>
    cover_titles: string[]
  }
  compliance: ComplianceResult
  evidence: Evidence[]
  audit: {
    generated_at: string
    knowledge_version: string
    human_review_required: boolean
    generator_mode: string
    provider?: string
    model?: string
    ai_used?: boolean
    ai_warning?: string
    demo_data?: boolean
  }
}

export type FollowupMemory = {
  id: string
  scope: 'customer' | 'advisor'
  title: string
  value: string
  source: string
  updated_at: string
  active: boolean
}

export type FollowupEvent = {
  id: string
  type: string
  actor: string
  time: string
  title: string
  content: string
  status: string
}

export type Followup = {
  customer_id: string
  customer_name: string
  advisor_id: string
  vehicle_id: string
  stage: string
  next_action: string
  next_action_due: string
  memories: FollowupMemory[]
  events: FollowupEvent[]
}

export type ReviewItem = {
  id: string
  task_id: string
  title: string
  advisor_id: string
  advisor_name: string
  vehicle_id: string
  status: string
  risk_level: string
  reason: string
  content_excerpt: string
  evidence_status: string
  submitted_at: string
  decision_reason: string
}

export type Campaign = {
  id: string
  name: string
  vehicle_id: string
  brief: string
  channels: string[]
  target_advisors: string[]
  status: string
  created_by: string
  task_summary: { total: number; ready: number; pending_review: number; failed: number }
  last_run: string
}

export type BootstrapResponse = {
  advisors: Advisor[]
  vehicles: Vehicle[]
  defaults: { campaign_name: string; campaign_brief: string; platforms: string[] }
  data_notice: string
}

export type WorkspaceResponse = {
  opportunities: Opportunity[]
  followups: Followup[]
  reviews: ReviewItem[]
  campaigns: Campaign[]
  data_mode: 'demo' | 'live'
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
