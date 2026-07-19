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
  updated_at?: string
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
  workspace_store?: { active_workspaces: number; ttl_seconds: number }
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
  source_type?: string
  owner?: string
  due_at?: string
  impact_label?: string
  manager_help?: boolean
  segment_customers?: Array<{ id: string; name: string; stage: string; concern?: string }>
}

export type Evidence = {
  id: string
  field: string
  value: string
  source_title: string
  source_url: string
  verified_at: string
  source_type: string
  status?: 'verified' | 'needs_revalidation' | 'stale' | string
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
  verification_status: 'verified' | 'needs_revalidation' | string
  compliance_status: 'verified' | 'needs_revalidation' | string
  knowledge_version: string
  verification_version: number
  verified_at: string
  version_history: Array<Record<string, unknown>>
  verification_token: string
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
  scheduled_at?: string
  items?: string[]
  notes?: string
  source_label?: string
  sync_status?: string
  source_detail?: string
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
  variant_id?: string
  title: string
  content_title: string
  advisor_id: string
  advisor_name: string
  vehicle_id: string
  platform: string
  status: string
  risk_level: string
  reason: string
  body: string
  call_to_action: string
  claims: Claim[]
  risk_annotations: RiskAnnotation[]
  evidence: Evidence[]
  reviewed_body: string
  reviewed_call_to_action: string
  evidence_status: string
  submitted_at: string
  decision_reason: string
  decision_at?: string
  change_log?: Array<{ at: string; decision: string; reason: string; body_changed: boolean; cta_changed: boolean }>
  verification_status: 'verified' | 'needs_revalidation' | string
  compliance_status: 'verified' | 'needs_revalidation' | string
  knowledge_version: string
  verification_version: number
  verified_at: string
  version_history: Array<Record<string, unknown>>
  verification_token?: string
}

export type CampaignTaskResult = {
  task_id: string
  campaign_name: string
  vehicle: Vehicle
  variant: ContentVariant
  evidence: Evidence[]
  video_package: GenerationResponse['video_package']
  audit: GenerationResponse['audit']
}

export type CampaignTask = {
  id: string
  campaign_id: string
  advisor_id: string
  advisor_name: string
  platform: string
  status: 'ready' | 'needs_review' | 'failed' | 'submitted'
  failure_reason: string
  retry_count: number
  generated_at: string
  result: CampaignTaskResult | null
  review_id: string
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
  tasks: CampaignTask[]
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
  enterprise: EnterpriseWorkspace
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

export type VideoJobState = {
  job_id: string
  status: 'preview' | 'queued' | 'submitted' | 'failed' | string
  mode: string
  message: string
}


export type RoleSpace = 'advisor' | 'manager' | 'hq'

export type EnterpriseMeta = {
  current_role: RoleSpace
  current_actor_id: string
  demo_scenario: string
  data_mode: 'demo' | 'live'
  role_demo: boolean
  last_sync_at: string
  updated_at?: string
}

export type HotspotEvidence = {
  id: string
  type: string
  summary: string
  store: string
  advisor: string
  occurred_at: string
}

export type Hotspot = {
  id: string
  title: string
  source_type: string
  vehicle_ids: string[]
  audiences: string[]
  stores: string[]
  evidence_count: number
  last_seen: string
  trend: string
  status: string
  owner: string
  recommended_action: string
  demo_flag: boolean
  source_label: string
  evidence: HotspotEvidence[]
  impact: { customers: number; advisors: number; contents: number; campaigns: number; knowledge: number; stores: number }
  created_task_ids: string[]
  last_action?: { action: string; reason: string; created_id: string; at: string }
}

export type KnowledgeVersion = {
  id: string
  version: string
  content: string
  status: string
  created_at: string
  source: string
  created_by: string
}

export type KnowledgeItem = {
  id: string
  title: string
  type: string
  content: string
  source: string
  source_url: string
  vehicle_ids: string[]
  regions: string[]
  effective_at: string
  expires_at: string
  version: string
  status: string
  created_by: string
  reviewed_by: string
  updated_at: string
  replacement_id: string
  linked_content_count: number
  linked_customer_count: number
  demo_flag: boolean
  versions: KnowledgeVersion[]
}

export type KnowledgeImpactObject = {
  id: string
  type: string
  title: string
  status: string
  owner: string
  last_action?: string
  ignore_reason?: string
}

export type KnowledgeImpact = {
  id: string
  knowledge_id: string
  knowledge_title: string
  from_version: string
  to_version: string
  change_field: string
  before: string
  after: string
  summary: string
  affected: { pending_contents: number; pending_reviews: number; customers: number; advisor_tasks: number; campaigns: number }
  objects: KnowledgeImpactObject[]
  status: string
  created_at: string
  demo_flag: boolean
}

export type NextBestAction = {
  id: string
  action: string
  reason: string
  due_at: string
  owner: string
  risk: string
  required_materials: string[]
  manager_help: boolean
  status: string
  note?: string
  updated_at?: string
}

export type CustomerStateEvidence = { text: string; source: string; occurred_at: string; channel: string; method: '规则' | '模型' | '人工' | string; demo_flag: boolean }
export type CustomerStateDimension = { level: string; evidence: Array<string | CustomerStateEvidence> }
export type CustomerProfile = {
  id: string
  name: string
  city: string
  family: string
  current_vehicle: string
  target_vehicle_ids: string[]
  budget: string
  purchase_window: string
  channel_source: string
  advisor_id: string
  data_source: string
  last_synced_at: string
  consent_status: string
  allowed_scope: string
  retention_until: string
  model_analysis_allowed: boolean
  delete_request_status: string
  demo_flag: boolean
  state: {
    need_clarity: CustomerStateDimension
    product_fit: CustomerStateDimension
    price_acceptance: CustomerStateDimension
    family_decision: CustomerStateDimension
    urgency: CustomerStateDimension
    relationship: CustomerStateDimension
    concerns: string[]
    blocker: string
    next_best_action: string
  }
  next_best_actions: NextBestAction[]
}

export type PromiseItem = {
  id: string
  customer_id: string
  advisor_id: string
  original_message: string
  commitment: string
  due_at: string
  completion_criteria: string
  status: string
  source: string
  created_at: string
  remind_at: string
  overdue: boolean
  manager_attention: boolean
  evidence: string[]
  demo_flag: boolean
  completed_at?: string
  delay_reason?: string
  source_event_id?: string
  manager_reason?: string
}

export type QualitySignal = {
  id: string
  advisor_id: string
  customer_id: string
  category: string
  risk_level: string
  status: string
  original_message: string
  trigger_rule: string
  system_explanation: string
  fact_ids: string[]
  repeat_count: number
  employee_response: string
  improvement_plan?: string
  manager_decision: string
  decision_reason: string
  created_at: string
  demo_flag: boolean
}

export type CoachingPlan = { id: string; signal_id: string; advisor_id: string; type: string; title: string; status: string; due_at: string; reason: string; created_at: string; demo_flag: boolean }
export type BestPractice = { id: string; scenario: string; customer_question: string; advisor_approach: string; why_effective: string; result: string; audiences: string[]; vehicle_ids: string[]; not_for: string[]; reviewer: string; source: string; anonymous: boolean; status: string; demo_flag: boolean; published_at?: string; uses?: string[]; training_status?: string; cross_store_status?: string; target_stores?: string[]; adoption_status?: string }
export type CustomerRisk = { id: string; customer_id: string; level: string; reason: string; evidence: string[]; impact: string; recommended_action: string; manager_help: boolean; due_at: string; status: string; demo_flag: boolean; updated_at?: string }
export type Experiment = { id: string; name: string; metric: string; manual_process: string; personaflow_process: string; validation: string; sample_size: number; period: string; demo_flag: boolean; status: string; conclusion: string }
export type SyncEvent = { id: string; integration: string; mode: string; status: string; summary: string; created_at: string; details: Record<string, number>; retry_count?: number; last_error?: string; retried_at?: string }
export type IntegrationStatus = { name: string; label: string; mode: string; connected: boolean; ready: boolean; notice: string; record_count: number }
export type NotificationPreview = { id: string; channel: string; title: string; body: string; status: string; created_at: string; demo_flag: boolean }
export type ApprovalPreview = { id: string; type: string; title: string; status: string; requester: string; created_at: string; demo_flag: boolean }
export type AuditEvent = { id: string; actor: string; role: string; action: string; object_type: string; object_id: string; before: unknown; after: unknown; knowledge_version: string; verification_version?: number; demo_flag: boolean; workspace_id: string; created_at: string }
export type DemoScenario = { id: string; name: string; description: string }

export type EnterpriseWorkspace = {
  enterprise_meta: EnterpriseMeta
  hotspots: Hotspot[]
  knowledge_items: KnowledgeItem[]
  knowledge_impacts: KnowledgeImpact[]
  sync_events: SyncEvent[]
  customer_profiles: CustomerProfile[]
  promises: PromiseItem[]
  quality_signals: QualitySignal[]
  coaching_plans: CoachingPlan[]
  best_practices: BestPractice[]
  customer_risks: CustomerRisk[]
  experiments: Experiment[]
  notifications: NotificationPreview[]
  approvals: ApprovalPreview[]
  revalidation_tasks: Array<Record<string, unknown>>
  audit_log: AuditEvent[]
  demo_scenarios: DemoScenario[]
  integrations: IntegrationStatus[]
  data_mode: 'demo' | 'live'
}

export type RevalidationResponse = {
  variant: ContentVariant
  evidence: Evidence[]
  compliance: ComplianceResult
  verification: { status: string; at: string; knowledge_version: string; method: string }
}
