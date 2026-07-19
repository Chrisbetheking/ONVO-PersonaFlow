import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, RotateCcw, UserRound, XCircle } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { EvidencePanel } from '../features/evidence-trace/EvidencePanel'
import { RiskPanel } from '../features/inline-compliance/RiskPanel'
import { Button, EmptyState, StatusPill } from '../shared/ui'
import { annotateText, statusLabel } from '../shared/workflow'
import type { RiskAnnotation } from '../types'

export function ReviewPage({ params }: { params: URLSearchParams }) {
  const { workspace, decideReview, revalidateReview, showToast } = useApp()
  const [status, setStatus] = useState<'all' | 'pending' | 'needs_revision' | 'approved' | 'returned'>('all')
  const filtered = useMemo(() => workspace.reviews.filter(item => status === 'all' || item.status === status), [workspace.reviews, status])
  const requestedId = params.get('review')
  const [selectedId, setSelectedId] = useState(requestedId || workspace.reviews[0]?.id || '')
  const selected = workspace.reviews.find(item => item.id === selectedId) || filtered[0]
  const [reason, setReason] = useState('')
  const [body, setBody] = useState(selected?.reviewed_body || selected?.body || '')
  const [callToAction, setCallToAction] = useState(selected?.reviewed_call_to_action || selected?.call_to_action || '')
  const [activeEvidenceId, setActiveEvidenceId] = useState('')
  const [activeRiskId, setActiveRiskId] = useState('')
  const [riskAnnotations, setRiskAnnotations] = useState(selected?.risk_annotations || [])
  const [working, setWorking] = useState(false)
  const [revalidating, setRevalidating] = useState(false)
  const [edited, setEdited] = useState(false)

  useEffect(() => {
    if (!selected) return
    setBody(selected.reviewed_body || selected.body)
    setCallToAction(selected.reviewed_call_to_action || selected.call_to_action)
    setReason('')
    setActiveEvidenceId(selected.claims[0]?.evidence_id || '')
    setRiskAnnotations(selected.risk_annotations)
    setActiveRiskId(selected.risk_annotations[0]?.id || '')
    setEdited(false)
  }, [selected?.id, selected?.verification_version])

  const preview = selected ? `${selected.content_title}\n\n${body}\n\n${callToAction}` : ''
  const segments = selected ? annotateText(preview, selected.claims, riskAnnotations) : []

  async function runRevalidation() {
    if (!selected) return
    setRevalidating(true)
    try {
      await revalidateReview(selected.id, { body, call_to_action: callToAction, risk_annotations: riskAnnotations })
      setEdited(false)
      showToast('经理修改内容已完成事实与合规重新核验')
    } finally {
      setRevalidating(false)
    }
  }

  async function decide(decision: 'approved' | 'returned') {
    if (!selected) return
    setWorking(true)
    try {
      await decideReview(selected.id, decision, reason || (decision === 'approved' ? '事实来源与风险表达已确认。' : '请根据审核意见修改后重新提交。'), body, callToAction, riskAnnotations)
      setReason('')
    } finally {
      setWorking(false)
    }
  }

  function applyRiskSuggestion(risk: RiskAnnotation) {
    if (!risk.text || !body.includes(risk.text)) return
    setBody(current => current.replace(risk.text, risk.suggestion))
    setEdited(true)
    setRiskAnnotations(current => current.map(item => item.id === risk.id ? { ...item, text: risk.suggestion, level: 'info', reason: '经理已应用替换建议，发布前完成最终人工确认。' } : item))
    setActiveRiskId(risk.id)
  }

  return (
    <section className="review-page">
      <div className="review-filter">
        {(['all', 'pending', 'needs_revision', 'approved', 'returned'] as const).map(value => <button className={status === value ? 'active' : ''} key={value} onClick={() => setStatus(value)}>{value === 'all' ? '全部' : statusLabel(value)}</button>)}
      </div>
      {!filtered.length ? <EmptyState title="当前没有对应审核项" description="内容任务提交审核后，会按风险和事实状态进入这里。" /> : (
        <div className="review-layout">
          <div className="review-queue">
            {filtered.map(item => <button data-testid={`review-row-${item.id}`} key={item.id} className={selected?.id === item.id ? 'review-row active' : 'review-row'} onClick={() => setSelectedId(item.id)}>
              <span className={`review-risk risk-${item.risk_level}`}><AlertTriangle size={16} /></span>
              <span><strong>{item.title}</strong><small><UserRound size={13} />{item.advisor_name} · <Clock3 size={13} />{item.submitted_at}</small><p>{item.reason}</p></span>
              <StatusPill tone={item.status === 'approved' ? 'success' : item.status === 'needs_revision' || item.status === 'returned' ? 'danger' : 'warning'}>{statusLabel(item.status)}</StatusPill>
            </button>)}
          </div>
          {selected ? <article className="review-detail" data-testid="review-detail">
            <header><div><p className="eyebrow">逐句审核</p><h2>{selected.title}</h2><p>{selected.advisor_name}提交于{selected.submitted_at}</p></div><StatusPill tone={selected.risk_level === 'high' ? 'danger' : selected.risk_level === 'medium' ? 'warning' : 'success'}>{selected.risk_level === 'high' ? '高风险' : selected.risk_level === 'medium' ? '需确认' : '低风险'}</StatusPill></header>
            <section className="review-context"><div><FileCheck2 size={18} /><span><strong>事实状态</strong><p>{selected.evidence_status}</p></span></div><div><AlertTriangle size={18} /><span><strong>审核原因</strong><p>{selected.reason}</p></span></div></section>

            <div className="review-content-grid">
              <section className="review-content-editor">
                <label className="field-label">完整正文<textarea data-testid="review-body" value={body} onChange={event => { setBody(event.target.value); setEdited(true) }} /></label>
                <label className="field-label">行动引导<input data-testid="review-cta" value={callToAction} onChange={event => { setCallToAction(event.target.value); setEdited(true) }} /></label>
                <div className={selected.verification_status === 'verified' && !edited ? "annotated-preview review-preview" : "annotated-preview review-preview stale"}>
                  <div className="preview-heading"><strong>逐句定位</strong><span>{selected.verification_status === 'verified' && !edited ? '点击高亮陈述查看依据或风险' : '以下为上次核验结果，经理修改后需要重新核验'}</span></div>
                  <div className="annotation-shortcuts">{selected.claims.map(claim => <button data-testid="review-mark-claim" key={claim.id} onClick={() => setActiveEvidenceId(claim.evidence_id)}>事实：{claim.field}</button>)}{riskAnnotations.map(risk => <button data-testid="review-mark-risk" key={risk.id} onClick={() => setActiveRiskId(risk.id)}>风险：{risk.rule}</button>)}</div>
                  <p>{segments.map((segment, index) => segment.type === 'plain' ? <span key={index}>{segment.text}</span> : <button data-testid={`review-mark-${segment.type}`} key={index} className={`inline-mark inline-${segment.type}`} onClick={() => segment.type === 'claim' ? setActiveEvidenceId(segment.refId || '') : setActiveRiskId(segment.refId || '')}>{segment.text}</button>)}</p>
                </div>
              </section>
              <aside className="review-trust-panel">
                <section><div className="panel-title"><strong>事实依据</strong><span>{selected.evidence.length} 条</span></div><EvidencePanel evidence={selected.evidence} activeId={activeEvidenceId} onSelect={setActiveEvidenceId} verificationStatus={selected.verification_status === 'verified' && !edited ? 'verified' : 'needs_revalidation'} /></section>
                <section><div className="panel-title"><strong>风险与建议</strong><span>{riskAnnotations.length} 项</span></div><RiskPanel risks={riskAnnotations} activeId={activeRiskId} onSelect={setActiveRiskId} onApplySuggestion={applyRiskSuggestion} /></section>
              </aside>
            </div>

            <div className={`verification-banner ${selected.verification_status === 'verified' && !edited ? 'verified' : 'stale'}`} data-testid="review-verification-status">
              <div>
                <strong>{selected.verification_status === 'verified' && !edited ? '事实与合规已核验' : '经理修改后需要重新核验'}</strong>
                <p>{selected.verification_status === 'verified' && !edited ? `知识版本 ${selected.knowledge_version} · 核验版本 ${selected.verification_version}` : '当前修改会使原有事实与合规结论失效，重新核验前不能批准。'}</p>
              </div>
              {selected.verification_status !== 'verified' || edited ? <Button data-testid="revalidate-review" loading={revalidating} onClick={() => void runRevalidation()}><RotateCcw size={16} />重新核验</Button> : null}
            </div>
            {selected.decision_reason ? <div className="decision-note"><strong>上次处理意见</strong><p>{selected.decision_reason}</p></div> : null}
            <label className="field-label">审核意见<textarea data-testid="review-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="批准时可以记录复核结论；退回时请给出可执行的修改说明。" /></label>
            <div className="review-actions"><Button data-testid="return-review" variant="danger" loading={working} onClick={() => void decide('returned')}><XCircle size={16} />退回修改</Button><Button data-testid="approve-review" disabled={selected.verification_status !== 'verified' || edited} loading={working} onClick={() => void decide('approved')}><CheckCircle2 size={16} />批准发布</Button></div>
            <small className="review-boundary"><RotateCcw size={14} />当前原型不自动发布，批准只改变任务状态并保留审核内容和意见。</small>
          </article> : null}
        </div>
      )}
    </section>
  )
}
