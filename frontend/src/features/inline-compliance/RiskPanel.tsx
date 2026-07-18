import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { RiskAnnotation } from '../../types'
import { EmptyState, StatusPill } from '../../shared/ui'

export function RiskPanel({ risks, activeId, onSelect, onApplySuggestion }: { risks: RiskAnnotation[]; activeId: string; onSelect: (id: string) => void; onApplySuggestion: (risk: RiskAnnotation) => void }) {
  if (!risks.length) return <div className="risk-clear"><CheckCircle2 size={22} /><div><strong>未发现需要修改的风险表达</strong><p>发布前仍需确认本地活动、价格和权益的最新状态。</p></div></div>
  return (
    <div className="trust-list">
      {risks.map(item => {
        const Icon = item.level === 'info' ? Info : AlertTriangle
        const tone = item.level === 'block' ? 'danger' : item.level === 'warning' ? 'warning' : 'info'
        return (
          <div id={`risk-${item.id}`} className={activeId === item.id ? `trust-item risk-item ${tone} active` : `trust-item risk-item ${tone}`} key={item.id} onClick={() => onSelect(item.id)}>
            <span className="trust-icon"><Icon size={17} /></span>
            <span className="trust-copy"><span className="trust-title"><strong>{item.rule}</strong><StatusPill tone={tone}>{item.level === 'block' ? '阻断' : item.level === 'warning' ? '需修改' : '发布前确认'}</StatusPill></span><span className="trust-value">{item.reason}</span><small>建议：{item.suggestion}</small></span>
            {item.level !== 'info' ? <button className="text-action" onClick={event => { event.stopPropagation(); onApplySuggestion(item) }}>应用建议</button> : null}
          </div>
        )
      })}
    </div>
  )
}
