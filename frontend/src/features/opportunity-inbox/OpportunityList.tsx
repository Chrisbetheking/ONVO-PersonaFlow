import { useEffect, useState } from 'react'
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
  const [selectedId, setSelectedId] = useState(items[0]?.id || '')
  useEffect(() => {
    if (!items.some(item => item.id === selectedId)) setSelectedId(items[0]?.id || '')
  }, [items, selectedId])

  if (!items.length) return <EmptyState title="当前筛选下没有机会" description="切换筛选条件，或查看已经完成的事项。" />
  const selected = items.find(item => item.id === selectedId) || items[0]
  const Icon = kindIcon[selected.kind]

  return (
    <div className="opportunity-workbench">
      <div className="opportunity-queue" aria-label="今日机会队列">
        <div className="queue-columns"><span>机会</span><span>时限</span></div>
        {items.map(item => {
          const RowIcon = kindIcon[item.kind]
          return (
            <button
              data-testid={`opportunity-row-${item.id}`}
              className={selected.id === item.id ? `opportunity-queue-row priority-${item.priority} active` : `opportunity-queue-row priority-${item.priority}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="queue-icon"><RowIcon size={17} /></span>
              <span className="queue-copy"><strong>{item.title}</strong><small>{item.source} · {item.signal}</small></span>
              <span className="queue-due"><Clock3 size={13} />{item.due_label}</span>
            </button>
          )
        })}
      </div>

      <article className="opportunity-detail" data-testid="opportunity-detail">
        <header>
          <span className="opportunity-detail-icon"><Icon size={21} /></span>
          <div><p className="eyebrow">{selected.source}</p><h2>{selected.title}</h2></div>
          <div className="detail-statuses"><StatusPill tone={priorityTone[selected.priority]}>{selected.priority === 'high' ? '优先处理' : selected.priority === 'medium' ? '建议处理' : '普通'}</StatusPill>{selected.status === 'done' ? <StatusPill tone="success">已处理</StatusPill> : null}</div>
        </header>
        <dl className="opportunity-properties">
          <div><dt>为什么现在处理</dt><dd>{selected.why_now}</dd></div>
          <div><dt>关键意向 / 顾虑</dt><dd>{selected.signal}</dd></div>
          <div><dt>推荐行动</dt><dd>{selected.recommended_action}</dd></div>
          {selected.customer ? <><div><dt>客户阶段</dt><dd>{selected.customer.stage}</dd></div><div><dt>最近消息</dt><dd>“{selected.customer.recent_message}”</dd></div></> : null}
        </dl>
        <footer>
          <span><Clock3 size={15} />建议在{selected.due_label}完成</span>
          <div className="opportunity-actions">
            {selected.status !== 'done' ? <Button data-testid="start-opportunity" onClick={() => onOpen(selected)}>开始处理 <ArrowRight size={16} /></Button> : <Button variant="secondary" onClick={() => onOpen(selected)}>查看记录</Button>}
            {selected.status !== 'done' ? <div className="row-secondary-actions"><button onClick={() => onLater(selected)}>稍后</button><button onClick={() => onDone(selected)}><Check size={14} />标记完成</button></div> : null}
          </div>
        </footer>
      </article>
    </div>
  )
}
