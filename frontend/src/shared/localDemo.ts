import type {
  Advisor,
  Campaign,
  CampaignTask,
  ContentVariant,
  Followup,
  GenerationResponse,
  Opportunity,
  ReviewItem,
  Vehicle,
} from '../types'

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function createLocalGeneration({
  advisor,
  vehicle,
  opportunity,
  campaignName,
  campaignBrief,
  platforms,
}: {
  advisor: Advisor
  vehicle: Vehicle
  opportunity?: Opportunity
  campaignName: string
  campaignBrief: string
  platforms: string[]
}): GenerationResponse {
  const evidence = [
    { id: 'evidence-positioning', field: '车型定位', value: vehicle.positioning, source_title: vehicle.source_title, source_url: vehicle.source_url, verified_at: vehicle.verified_at, source_type: '官方产品页' },
    { id: 'evidence-price-full', field: '整车购买起价', value: vehicle.full_purchase_from, source_title: vehicle.source_title, source_url: vehicle.source_url, verified_at: vehicle.verified_at, source_type: '官方产品页' },
  ]
  const customer = opportunity?.customer
  const variants = platforms.map((platform, index): ContentVariant => {
    const title = platform === '小红书' ? `${vehicle.name} 家庭试驾，先按真实物品做一次装载` : `${vehicle.name} 家庭场景体验邀请`
    const claimText = `${vehicle.name} 定位为${vehicle.positioning}，当前官方页面显示整车购买${vehicle.full_purchase_from}。`
    const body = platform === '私聊跟进'
      ? `${customer?.name || '你好'}，我是${advisor.store}的${advisor.name}。你关心的${customer?.concerns?.[0] || '家庭用车场景'}我记下了。${claimText}建议按真实家庭人数和常带物品到店体验。具体配置、价格与权益以乐道官方最新信息为准。`
      : `${advisor.city}最近不少${advisor.audience}都在问同一个问题：满员以后，日常物品到底怎么放。\n\n${claimText}\n\n${campaignBrief}\n\n具体配置、价格与权益以乐道官方最新信息为准。`
    const riskText = '具体配置、价格与权益以乐道官方最新信息为准。'
    return {
      id: `local-variant-${index + 1}-${Math.random().toString(16).slice(2, 7)}`,
      advisor_id: advisor.id,
      advisor_name: advisor.name,
      platform,
      title,
      body,
      call_to_action: '把家庭人数和最常带的物品告诉我，我按你的真实场景准备体验。',
      hashtags: ['乐道汽车', vehicle.name.replace('乐道 ', ''), `${advisor.city}看车`],
      personalization_score: 84,
      grounding_score: 92,
      compliance_score: 94,
      status: 'ready_for_human_review',
      personalization_reasons: [`使用${advisor.style}表达。`, `优先回应${advisor.audience}的真实场景。`, customer ? `带入${customer.name}的最新顾虑。` : '使用活动客群上下文。'],
      claims: [{ id: `local-claim-${index}`, text: claimText, evidence_id: 'evidence-positioning', field: '车型定位与价格' }],
      risk_annotations: [{ id: `local-risk-${index}`, text: riskText, level: 'info', rule: '动态事实复核', reason: '价格可能随时间和地区变化，发布前需要再次核验。', suggestion: '具体配置、价格与权益以发布当天官方页面为准。' }],
      version: 1,
      verification_status: 'verified',
      compliance_status: 'verified',
      knowledge_version: 'local-demo-2026.07.19',
      verification_version: 1,
      verified_at: new Date().toISOString(),
      verification_token: `local-token-${index + 1}`,
      version_history: [{ type: 'generated', at: new Date().toISOString(), version: 1 }],
    }
  })
  return {
    task_id: id('local-content'),
    opportunity_id: opportunity?.id,
    campaign_name: campaignName,
    customer_context: customer,
    vehicle,
    variants,
    video_package: {
      hook: `家庭试 ${vehicle.name}，不要只看空车状态。`,
      voiceover: variants[0]?.body.replace(/\n/g, ' ') || '',
      shots: [
        { index: 1, duration: 3, visual: '家庭常用物品摆在车旁', subtitle: '把真实物品带进试驾', asset_hint: '本地演示分镜' },
        { index: 2, duration: 5, visual: '顾问说明体验顺序', subtitle: '先满员乘坐，再真实装载', asset_hint: '本地演示分镜' },
      ],
      cover_titles: ['满员以后，行李怎么放？', '把真实物品带进试驾'],
    },
    compliance: { passed: true, score: 94, findings: [] },
    evidence,
    audit: {
      generated_at: new Date().toISOString(),
      knowledge_version: 'local-demo-2026.07.18',
      human_review_required: true,
      generator_mode: 'local-rules-fallback',
      provider: '本地规则演示',
      model: '未调用模型',
      ai_used: false,
      demo_data: true,
      ai_warning: '当前为离线本地演示，未调用 DeepSeek 或生产系统。',
    },
  }
}

export function createLocalReview(generation: GenerationResponse, variant: ContentVariant): ReviewItem {
  return {
    id: id('local-review'),
    task_id: generation.task_id,
    variant_id: variant.id,
    title: `${generation.campaign_name} · ${variant.platform}`,
    content_title: variant.title,
    advisor_id: variant.advisor_id,
    advisor_name: variant.advisor_name,
    vehicle_id: generation.vehicle.id,
    platform: variant.platform,
    status: 'pending',
    risk_level: variant.risk_annotations.some(item => item.level === 'block') ? 'high' : variant.risk_annotations.length ? 'medium' : 'low',
    reason: variant.risk_annotations[0]?.reason || '本地演示内容等待门店审核。',
    body: variant.body,
    call_to_action: variant.call_to_action,
    claims: variant.claims,
    risk_annotations: variant.risk_annotations,
    evidence: generation.evidence,
    reviewed_body: variant.body,
    reviewed_call_to_action: variant.call_to_action,
    evidence_status: generation.evidence.length ? '已绑定 · 本地演示' : '缺少事实',
    submitted_at: '刚刚',
    decision_reason: '',
    change_log: [],
    verification_status: variant.verification_status,
    compliance_status: variant.compliance_status,
    knowledge_version: variant.knowledge_version,
    verification_version: variant.verification_version,
    verified_at: variant.verified_at,
    version_history: variant.version_history,
  }
}

export function addLocalFollowupEvent(followup: Followup, payload: Record<string, unknown>): Followup {
  const type = String(payload.type || 'advisor_note')
  const content = String(payload.content || '')
  const event = {
    id: id('local-event'),
    type,
    actor: String(payload.actor || '顾问'),
    time: '刚刚',
    title: String(payload.title || '新增记录'),
    content,
    status: String(payload.status || 'completed'),
    scheduled_at: String(payload.scheduled_at || ''),
    items: Array.isArray(payload.items) ? payload.items.map(String) : [],
    notes: String(payload.notes || ''),
  }
  const memories = [...followup.memories]
  let stage = followup.stage
  let nextAction = followup.next_action
  let nextActionDue = followup.next_action_due
  if (type === 'customer_message' && content) {
    memories.push({ id: id('local-memory'), scope: 'customer', title: '最新客户反馈', value: content, source: '本地演示手动补录', updated_at: new Date().toLocaleString('zh-CN'), active: true })
    nextAction = '根据客户最新回复确认具体问题，并推动下一步到店或试驾。'
    nextActionDue = '24 小时内'
  }
  if (type === 'test_drive_booked') {
    stage = '已预约试驾'
    nextAction = '试驾前确认到店人数、携带物品与体验路线。'
    nextActionDue = String(payload.scheduled_at || '预约时间前')
  }
  return { ...followup, stage, next_action: nextAction, next_action_due: nextActionDue, memories, events: [...followup.events, event] }
}

export function createLocalCampaignTasks(campaign: Campaign, advisors: Advisor[], vehicle: Vehicle): CampaignTask[] {
  return campaign.target_advisors.flatMap(advisorId => {
    const advisor = advisors.find(item => item.id === advisorId)
    if (!advisor) return []
    const generation = createLocalGeneration({ advisor, vehicle, campaignName: campaign.name, campaignBrief: campaign.brief, platforms: campaign.channels })
    return generation.variants.map((variant): CampaignTask => ({
      id: id('local-campaign-task'),
      campaign_id: campaign.id,
      advisor_id: advisor.id,
      advisor_name: advisor.name,
      platform: variant.platform,
      status: 'ready',
      failure_reason: '',
      retry_count: 0,
      generated_at: generation.audit.generated_at,
      result: { task_id: generation.task_id, campaign_name: generation.campaign_name, vehicle, variant, evidence: generation.evidence, video_package: generation.video_package, audit: generation.audit },
      review_id: '',
    }))
  })
}
