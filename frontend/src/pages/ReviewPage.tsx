import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, RotateCcw, UserRound, XCircle } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { Button, EmptyState, StatusPill } from '../shared/ui'
import { statusLabel } from '../shared/workflow'

export function ReviewPage() {
  const { workspace, decideReview } = useApp()
  const [status, setStatus] = useState<'all' | 'pending' | 'needs_revision' | 'approved' | 'returned'>('all')
  const filtered = useMemo(() => workspace.reviews.filter(item => status === 'all' || item.status === status), [workspace.reviews, status])
  const [selectedId, setSelectedId] = useState(workspace.reviews[0]?.id || '')
  const selected = workspace.reviews.find(item => item.id === selectedId) || filtered[0]
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)

  async function decide(decision: 'approved' | 'returned') {
    if (!selected) return
    setWorking(true)
    try {
      await decideReview(selected.id, decision, reason || (decision === 'approved' ? '事实来源与风险表达已确认。' : '请根据审核意见修改后重新提交。'))
      setReason('')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="review-page">
      <div className="review-filter">
        {(['all', 'pending', 'needs_revision', 'approved', 'returned'] as const).map(value => <button className={status === value ? 'active' : ''} key={value} onClick={() => setStatus(value)}>{value === 'all' ? '全部' : statusLabel(value)}</button>)}
      </div>
      {!filtered.length ? <EmptyState title="当前没有对应审核项" description="内容任务提交审核后，会按风险和事实状态进入这里。" /> : (
        <div className="review-layout">
          <div className="review-queue">
            {filtered.map(item => <button key={item.id} className={selected?.id === item.id ? 'review-row active' : 'review-row'} onClick={() => { setSelectedId(item.id); setReason('') }}>
              <span className={`review-risk risk-${item.risk_level}`}><AlertTriangle size={16} /></span>
              <span><strong>{item.title}</strong><small><UserRound size={13} />{item.advisor_name} · <Clock3 size={13} />{item.submitted_at}</small><p>{item.reason}</p></span>
              <StatusPill tone={item.status === 'approved' ? 'success' : item.status === 'needs_revision' || item.status === 'returned' ? 'danger' : 'warning'}>{statusLabel(item.status)}</StatusPill>
            </button>)}
          </div>
          {selected ? <article className="review-detail">
            <header><div><p className="eyebrow">逐句审核</p><h2>{selected.title}</h2><p>{selected.advisor_name}提交于{selected.submitted_at}</p></div><StatusPill tone={selected.risk_level === 'high' ? 'danger' : selected.risk_level === 'medium' ? 'warning' : 'success'}>{selected.risk_level === 'high' ? '高风险' : selected.risk_level === 'medium' ? '需确认' : '低风险'}</StatusPill></header>
            <section className="review-context"><div><FileCheck2 size={18} /><span><strong>事实状态</strong><p>{selected.evidence_status}</p></span></div><div><AlertTriangle size={18} /><span><strong>审核原因</strong><p>{selected.reason}</p></span></div></section>
            <blockquote>{selected.content_excerpt}</blockquote>
            {selected.decision_reason ? <div className="decision-note"><strong>上次处理意见</strong><p>{selected.decision_reason}</p></div> : null}
            <label className="field-label">审核意见<textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="批准时可以记录复核结论；退回时请给出可执行的修改说明。" /></label>
            <div className="review-actions"><Button variant="danger" loading={working} onClick={() => void decide('returned')}><XCircle size={16} />退回修改</Button><Button loading={working} onClick={() => void decide('approved')}><CheckCircle2 size={16} />批准发布</Button></div>
            <small className="review-boundary"><RotateCcw size={14} />当前原型不自动发布，批准只改变任务状态并保留审核记录。</small>
          </article> : null}
        </div>
      )}
    </section>
  )
}
