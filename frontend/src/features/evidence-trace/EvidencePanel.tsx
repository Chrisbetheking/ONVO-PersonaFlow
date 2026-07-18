import { ExternalLink, FileCheck2 } from 'lucide-react'
import type { Evidence } from '../../types'
import { EmptyState, StatusPill } from '../../shared/ui'

export function EvidencePanel({ evidence, activeId, onSelect }: { evidence: Evidence[]; activeId: string; onSelect: (id: string) => void }) {
  if (!evidence.length) return <EmptyState title="没有绑定事实依据" description="发布前需要补充可追溯的官方来源。" />
  return (
    <div className="trust-list">
      {evidence.map(item => (
        <button data-testid={`evidence-${item.id}`} id={`evidence-${item.id}`} className={activeId === item.id ? 'trust-item active' : 'trust-item'} key={item.id} onClick={() => onSelect(item.id)}>
          <span className="trust-icon"><FileCheck2 size={17} /></span>
          <span className="trust-copy"><span className="trust-title"><strong>{item.field}</strong><StatusPill tone="success">已核验</StatusPill></span><span className="trust-value">{item.value}</span><small>{item.source_title} · {item.verified_at}</small></span>
          <a href={item.source_url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} aria-label={`打开${item.source_title}`}><ExternalLink size={15} /></a>
        </button>
      ))}
    </div>
  )
}
