import { AlertTriangle, ExternalLink, FileCheck2 } from 'lucide-react'
import type { Evidence } from '../../types'
import { EmptyState, StatusPill } from '../../shared/ui'

export function EvidencePanel({ evidence, activeId, onSelect, verificationStatus = 'verified' }: { evidence: Evidence[]; activeId: string; onSelect: (id: string) => void; verificationStatus?: string }) {
  if (!evidence.length) return <EmptyState title="没有绑定事实依据" description="发布前需要补充可追溯的官方来源。" />
  const stale = verificationStatus !== 'verified'
  return (
    <div className={stale ? 'trust-list trust-list-stale' : 'trust-list'} data-testid="evidence-list" data-verification-status={verificationStatus}>
      {evidence.map(item => (
        <button data-testid={`evidence-${item.id}`} id={`evidence-${item.id}`} className={`${activeId === item.id ? 'trust-item active' : 'trust-item'}${stale ? ' stale' : ''}`} key={item.id} onClick={() => onSelect(item.id)}>
          <span className="trust-icon">{stale ? <AlertTriangle size={17} /> : <FileCheck2 size={17} />}</span>
          <span className="trust-copy"><span className="trust-title"><strong>{item.field}</strong><StatusPill tone={stale ? 'warning' : 'success'}>{stale ? '待重新核验' : '已核验'}</StatusPill></span><span className="trust-value">{item.value}</span><small>{item.source_title} · {item.verified_at}{stale ? ' · 上次核验记录' : ''}</small></span>
          <a href={item.source_url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} aria-label={`打开${item.source_title}`}><ExternalLink size={15} /></a>
        </button>
      ))}
    </div>
  )
}
