import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, Film, LoaderCircle, MessageCircleReply, Sparkles, UserRound, UsersRound } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { navigate } from '../app/router'
import { ContentEditor } from '../features/content-generation/ContentEditor'
import { EvidencePanel } from '../features/evidence-trace/EvidencePanel'
import { RiskPanel } from '../features/inline-compliance/RiskPanel'
import { Button, EmptyState, ErrorState, StatusPill } from '../shared/ui'
import type { ContentVariant, Opportunity, RiskAnnotation } from '../types'

export function StudioPage({ params }: { params: URLSearchParams }) {
  const {
    boot,
    workspace,
    generation,
    setGeneration,
    generateFromOpportunity,
    regenerateVariant,
    saveVariant,
    submitVariant,
    addFollowupEvent,
    updateOpportunityStatus,
    showToast,
  } = useApp()
  const requestedId = params.get('opportunity')
  const defaultOpportunity = workspace.opportunities.find(item => item.id === requestedId)
    || workspace.opportunities.find(item => item.id === generation?.opportunity_id)
    || workspace.opportunities.find(item => item.status !== 'done')
    || workspace.opportunities[0]
  const [opportunityId, setOpportunityId] = useState(defaultOpportunity?.id || '')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [activeVariantId, setActiveVariantId] = useState(generation?.variants[0]?.id || '')
  const [variants, setVariants] = useState<ContentVariant[]>(generation?.variants || [])
  const [histories, setHistories] = useState<Record<string, ContentVariant[]>>({})
  const [historyIndexes, setHistoryIndexes] = useState<Record<string, number>>({})
  const [activeEvidenceId, setActiveEvidenceId] = useState('')
  const [activeRiskId, setActiveRiskId] = useState('')
  const [showVideo, setShowVideo] = useState(false)
  const [error, setError] = useState('')

  const opportunity = workspace.opportunities.find(item => item.id === opportunityId) || defaultOpportunity
  const advisor = boot.advisors.find(item => item.id === opportunity?.advisor_id) || boot.advisors[0]
  const vehicle = boot.vehicles.find(item => item.id === opportunity?.vehicle_id) || boot.vehicles[0]
  const campaign = workspace.campaigns.find(item => item.id === opportunity?.campaign_id)
  const activeVariant = variants.find(item => item.id === activeVariantId) || variants[0]

  useEffect(() => {
    if (requestedId && requestedId !== opportunityId && workspace.opportunities.some(item => item.id === requestedId)) setOpportunityId(requestedId)
  }, [requestedId, workspace.opportunities])

  useEffect(() => {
    if (!generation) return
    setVariants(generation.variants)
    setActiveVariantId(current => generation.variants.some(item => item.id === current) ? current : generation.variants[0]?.id || '')
    const nextHistories: Record<string, ContentVariant[]> = {}
    const nextIndexes: Record<string, number> = {}
    generation.variants.forEach(item => { nextHistories[item.id] = [item]; nextIndexes[item.id] = 0 })
    setHistories(nextHistories)
    setHistoryIndexes(nextIndexes)
  }, [generation?.task_id, generation?.audit.generated_at])

  useEffect(() => {
    if (!activeVariant) return
    setActiveEvidenceId(activeVariant.claims[0]?.evidence_id || '')
    setActiveRiskId(activeVariant.risk_annotations[0]?.id || '')
  }, [activeVariantId])

  const contextReady = Boolean(opportunity && advisor && vehicle)
  const generationMatches = generation?.opportunity_id === opportunity?.id

  async function startGeneration() {
    if (!opportunity) return
    setGenerating(true)
    setError('')
    try {
      await generateFromOpportunity(opportunity)
      showToast('沟通方案已生成，先校对事实和风险再提交')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  function updateVariant(patch: Partial<Pick<ContentVariant, 'title' | 'body' | 'call_to_action'>>) {
    if (!activeVariant) return
    const updated = { ...activeVariant, ...patch }
    setVariants(current => current.map(item => item.id === activeVariant.id ? updated : item))
    const currentHistory = histories[activeVariant.id] || [activeVariant]
    const currentIndex = historyIndexes[activeVariant.id] ?? currentHistory.length - 1
    const nextHistory = [...currentHistory.slice(0, currentIndex + 1), updated].slice(-30)
    setHistories(current => ({ ...current, [activeVariant.id]: nextHistory }))
    setHistoryIndexes(current => ({ ...current, [activeVariant.id]: nextHistory.length - 1 }))
  }

  function applyHistory(direction: -1 | 1) {
    if (!activeVariant) return
    const history = histories[activeVariant.id] || [activeVariant]
    const index = historyIndexes[activeVariant.id] ?? history.length - 1
    const nextIndex = Math.max(0, Math.min(history.length - 1, index + direction))
    const restored = history[nextIndex]
    setHistoryIndexes(current => ({ ...current, [activeVariant.id]: nextIndex }))
    setVariants(current => current.map(item => item.id === activeVariant.id ? restored : item))
  }

  async function save() {
    if (!activeVariant || !generation) return
    setSaving(true)
    try {
      await saveVariant(activeVariant)
      setGeneration({ ...generation, variants })
      const history = histories[activeVariant.id] || [activeVariant]
      setHistories(current => ({ ...current, [activeVariant.id]: [history[history.length - 1]] }))
      setHistoryIndexes(current => ({ ...current, [activeVariant.id]: 0 }))
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!activeVariant || !generation) return
    setSubmitting(true)
    try {
      setGeneration({ ...generation, variants })
      await submitVariant(activeVariant)
      navigate('review')
    } finally {
      setSubmitting(false)
    }
  }

  async function regenerate() {
    if (!opportunity || !activeVariant) return
    setGenerating(true)
    try {
      await regenerateVariant(opportunity, activeVariant.platform)
      showToast('当前平台版本已重新生成')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重新生成失败')
    } finally {
      setGenerating(false)
    }
  }

  function applyRiskSuggestion(risk: RiskAnnotation) {
    if (!activeVariant || !risk.text) return
    const replacement = risk.suggestion.includes('具体配置') ? '具体配置、价格与权益以乐道官方最新信息为准。' : risk.suggestion
    updateVariant({ body: activeVariant.body.replace(risk.text, replacement) })
    showToast('已应用建议，请再读一遍上下文')
  }

  async function rewriteParagraph(paragraphIndex: number, instruction: string) {
    if (!activeVariant || !advisor || !vehicle) return
    const paragraphs = activeVariant.body.split(/\n{2,}/).filter(Boolean)
    const paragraph = paragraphs[paragraphIndex]
    if (!paragraph) return
    setRewriting(true)
    try {
      const response = await api.rewrite({
        text: paragraph,
        instruction,
        advisor_id: advisor.id,
        vehicle_id: vehicle.id,
        customer_context: opportunity?.customer,
      })
      paragraphs[paragraphIndex] = response.text
      updateVariant({ body: paragraphs.join('\n\n') })
      showToast(response.ai_used ? '已使用内容模型完成局部改写' : '模型未配置，已使用规则完成局部改写')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '局部改写失败')
    } finally {
      setRewriting(false)
    }
  }

  async function markSent() {
    if (!opportunity?.customer || !activeVariant) return
    await addFollowupEvent(opportunity.customer.id, {
      type: 'advisor_sent',
      actor: advisor?.name || '顾问',
      title: `已发送${activeVariant.platform}内容`,
      content: activeVariant.body,
      status: 'completed',
    })
    await updateOpportunityStatus(opportunity.id, 'done')
    showToast('已记录发送，并进入客户跟进时间线')
    navigate('followup', { customer: opportunity.customer.id })
  }

  const history = activeVariant ? histories[activeVariant.id] || [] : []
  const historyIndex = activeVariant ? historyIndexes[activeVariant.id] ?? 0 : 0
  const dirty = history.length > 1

  if (!contextReady) return <EmptyState title="没有可处理的机会" description="请先在今日机会中选择一个客户、活动或高频问题。" action={<Button onClick={() => navigate('today')}>返回今日机会</Button>} />

  return (
    <section className="studio-page">
      <div className="studio-switcher">
        <button className="back-link" onClick={() => navigate('today')}><ArrowLeft size={16} />今日机会</button>
        <label>当前任务<select value={opportunityId} onChange={event => { setOpportunityId(event.target.value); navigate('studio', { opportunity: event.target.value }) }}>{workspace.opportunities.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <StatusPill tone={opportunity?.status === 'done' ? 'success' : 'info'}>{opportunity?.status === 'done' ? '已处理' : opportunity?.due_label}</StatusPill>
      </div>

      {!generationMatches ? (
        <div className="studio-start-layout">
          <aside className="context-panel">
            <ContextDetails opportunity={opportunity!} advisor={advisor!} vehicle={vehicle!} campaignName={campaign?.name} />
          </aside>
          <div className="start-generation">
            <p className="eyebrow">沟通准备</p>
            <h2>先把这次机会的上下文带进内容，再决定发什么</h2>
            <p>系统会同时生成私聊、朋友圈和小红书版本。客户身份只用于一对一内容，公开平台不会泄露客户信息。</p>
            <div className="start-checklist"><span><CheckCircle2 size={17} />已读取顾问表达习惯</span><span><CheckCircle2 size={17} />已关联车型官方事实</span><span><CheckCircle2 size={17} />已带入客户顾虑与最近消息</span></div>
            {error ? <ErrorState description={error} /> : null}
            <Button loading={generating} onClick={() => void startGeneration()}><Sparkles size={17} />生成沟通方案</Button>
            <small>模型不可用时会自动保留有明确标记的规则兜底版本，不会伪装成模型结果。</small>
          </div>
        </div>
      ) : activeVariant && generation ? (
        <div className="studio-grid">
          <aside className="context-panel">
            <ContextDetails opportunity={opportunity!} advisor={advisor!} vehicle={vehicle!} campaignName={generation.campaign_name} />
            <div className="persona-explain"><div className="panel-title"><UserRound size={17} /><strong>为什么这样写</strong></div>{activeVariant.personalization_reasons.map(reason => <p key={reason}>{reason}</p>)}</div>
          </aside>

          <div className="content-column">
            <div className="platform-tabs" role="tablist">{variants.map(item => <button role="tab" aria-selected={activeVariant.id === item.id} className={activeVariant.id === item.id ? 'active' : ''} key={item.id} onClick={() => setActiveVariantId(item.id)}>{item.platform}<span>{item.version > 1 ? `v${item.version}` : ''}</span></button>)}</div>
            {generation.audit.ai_warning ? <div className="model-warning">{generation.audit.ai_warning}</div> : null}
            <ContentEditor
              variant={activeVariant}
              evidence={generation.evidence}
              dirty={dirty}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              saving={saving}
              submitting={submitting}
              onChange={updateVariant}
              onSelectEvidence={id => { setActiveEvidenceId(id); document.getElementById(`evidence-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }}
              onSelectRisk={id => { setActiveRiskId(id); document.getElementById(`risk-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }}
              onSave={() => void save()}
              onSubmit={() => void submit()}
              onUndo={() => applyHistory(-1)}
              onRedo={() => applyHistory(1)}
              onRegenerate={() => void regenerate()}
              onRewrite={(paragraphIndex, instruction) => void rewriteParagraph(paragraphIndex, instruction)}
              rewriting={rewriting}
            />
            <div className="studio-lower-actions">
              <button onClick={() => setShowVideo(value => !value)}><Film size={17} />{showVideo ? '收起短视频方案' : '查看短视频方案'}<ChevronRight className={showVideo ? 'rotate-90' : ''} size={15} /></button>
              {opportunity?.customer ? <Button variant="secondary" onClick={() => void markSent()}><MessageCircleReply size={16} />记录为已发送并进入跟进</Button> : null}
            </div>
            {showVideo ? <VideoPackage generation={generation} /> : null}
          </div>

          <aside className="trust-panel">
            <section><div className="panel-title"><strong>事实依据</strong><span>{generation.evidence.length} 条</span></div><EvidencePanel evidence={generation.evidence} activeId={activeEvidenceId} onSelect={setActiveEvidenceId} /></section>
            <section><div className="panel-title"><strong>风险与发布检查</strong><span>{activeVariant.risk_annotations.length} 项</span></div><RiskPanel risks={activeVariant.risk_annotations} activeId={activeRiskId} onSelect={setActiveRiskId} onApplySuggestion={applyRiskSuggestion} /></section>
          </aside>
        </div>
      ) : <div className="loading-stage"><LoaderCircle className="spin" />正在准备内容工作区</div>}
    </section>
  )
}

function ContextDetails({ opportunity, advisor, vehicle, campaignName }: { opportunity: Opportunity; advisor: NonNullable<ReturnType<typeof useApp>['boot']['advisors'][number]>; vehicle: NonNullable<ReturnType<typeof useApp>['boot']['vehicles'][number]>; campaignName?: string }) {
  return (
    <div className="context-details">
      <div className="panel-title"><UsersRound size={17} /><strong>这次沟通的上下文</strong></div>
      {opportunity.customer ? <div className="context-block"><span>客户</span><strong>{opportunity.customer.name} · {opportunity.customer.stage}</strong><p>{opportunity.customer.family}</p><blockquote>{opportunity.customer.recent_message}</blockquote></div> : <div className="context-block"><span>机会类型</span><strong>{opportunity.kind === 'segment' ? '潜客分组' : '高频内容问题'}</strong><p>{opportunity.why_now}</p></div>}
      <div className="context-block"><span>关键顾虑</span><div className="tag-row">{opportunity.customer?.concerns.map(item => <em key={item}>{item}</em>) || <em>{opportunity.signal}</em>}</div></div>
      <div className="context-block"><span>顾问</span><strong>{advisor.name} · {advisor.store}</strong><p>{advisor.audience} · {advisor.style}</p></div>
      <div className="context-block"><span>车型与活动</span><strong>{vehicle.name}</strong><p>{campaignName || opportunity.title}</p></div>
    </div>
  )
}

function VideoPackage({ generation }: { generation: NonNullable<ReturnType<typeof useApp>['generation']> }) {
  return (
    <div className="video-package">
      <div><p className="eyebrow">短视频草稿</p><h3>{generation.video_package.hook}</h3><p>{generation.video_package.voiceover}</p></div>
      <ol>{generation.video_package.shots.map(shot => <li key={shot.index}><span>{shot.index.toString().padStart(2, '0')}</span><div><strong>{shot.visual}</strong><p>{shot.subtitle}</p><small>{shot.duration}s · {shot.asset_hint}</small></div></li>)}</ol>
    </div>
  )
}
