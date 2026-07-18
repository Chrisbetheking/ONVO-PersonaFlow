import { ArrowRight, Check, Clock3, MessageSquareText, UsersRound, WandSparkles } from 'lucide-react'
import type { Opportunity } from '../../types'
import { Button, EmptyState, StatusPill } from '../../shared/ui'

const kindIcon = {
  customer: MessageSquareText,
  segment: UsersRound,
  topic: WandSparkles,
}

const priorityTone = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
} as const

export function OpportunityList({
  items,
  onOpen,
  onLater,
  onDone,
}: {
  items: Opportunity[]
  onOpen: (item: Opportunity) => void
  onLater: (item: Opportunity) => void
  onDone: (item: Opportunity) => void
}) {
  if (!items.length) return <EmptyState title="当前筛选下没有机会" description="切换筛选条件，或查看已经完成的事项。" />
  return (
    <div className="opportunity-list">
      {items.map(item => {
        const Icon = kindIcon[item.kind]
        return (
          <article className={`opportunity-row priority-${item.priority}`} key={item.id}>
            <div className="opportunity-icon"><Icon size={20} /></div>
            <div className="opportunity-main">
              <div className="opportunity-title-line">
                <h3>{item.title}</h3>
                <StatusPill tone={priorityTone[item.priority]}>{item.priority === 'high' ? '优先处理' : item.priority === 'medium' ? '建议处理' : '普通'}</StatusPill>
                {item.status === 'done' ? <StatusPill tone="success">已处理</StatusPill> : null}
              </div>
              <p className="opportunity-reason">{item.why_now}</p>
              <div className="opportunity-meta"><span>{item.source}</span><span>{item.signal}</span><span><Clock3 size={14} />{item.due_label}</span></div>
              <div className="recommended-action"><strong>建议下一步</strong><span>{item.recommended_action}</span></div>
            </div>
            <div className="opportunity-actions">
              {item.status !== 'done' ? <Button onClick={() => onOpen(item)}>开始处理 <ArrowRight size={16} /></Button> : <Button variant="secondary" onClick={() => onOpen(item)}>查看记录</Button>}
              {item.status !== 'done' ? <div className="row-secondary-actions"><button onClick={() => onLater(item)}>稍后</button><button onClick={() => onDone(item)}><Check size={14} />标记完成</button></div> : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
