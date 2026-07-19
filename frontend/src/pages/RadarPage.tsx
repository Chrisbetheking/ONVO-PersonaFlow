import { useMemo, useState } from 'react'
import { ArrowUpRight, BookOpenCheck, GraduationCap, MessageSquareText, RefreshCw, UsersRound } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { navigate } from '../app/router'
import { Button, EmptyState, StatusPill } from '../shared/ui'
import type { Hotspot } from '../types'

const actions = [
  ['content_task','创建内容任务'],['customer_outreach','创建客户触达'],['knowledge_draft','创建知识草稿'],
  ['coaching','创建顾问辅导'],['manager_review','创建经理复核'],['ignore','忽略并记录'],
] as const

export function RadarPage({ mode }: { mode: 'manager' | 'hq' }) {
  const { workspace, dataMode, refreshWorkspace, updateEnterpriseLocal, showToast } = useApp()
  const items = workspace.enterprise.hotspots
  const [selectedId, setSelectedId] = useState(items[0]?.id || '')
  const [working, setWorking] = useState('')
  const [filter, setFilter] = useState('all')
  const filtered = useMemo(() => items.filter(item => filter === 'all' || item.source_type === filter), [items, filter])
  const selected = items.find(item => item.id === selectedId) || filtered[0]

  async function runAction(action: string) {
    if (!selected) return
    setWorking(action)
    try {
      if (dataMode === 'fallback') {
        const createdId = `${action}-local-${Date.now()}`
        updateEnterpriseLocal(current => ({
          ...current,
          hotspots: current.hotspots.map(item => item.id === selected.id ? { ...item, status: action === 'ignore' ? '已忽略' : '已转任务', created_task_ids: [...item.created_task_ids, createdId], last_action: { action, reason: '本地演示操作', created_id: createdId, at: new Date().toISOString() } } : item),
        }))
      } else {
        await api.hotspotAction(selected.id, action, '由雷达页面人工确认')
        await refreshWorkspace()
      }
      showToast('热点处理已记录')
      if (action === 'content_task') navigate('today')
    } finally { setWorking('') }
  }

  if (!items.length) return <EmptyState title="当前没有热点" description="客户咨询、审核退回和知识变化会在这里形成可追溯的经营信号。" />
  return <section className="enterprise-three-column radar-page" data-testid="hotspot-radar">
    <aside className="enterprise-list-pane">
      <div className="pane-toolbar"><strong>{mode === 'manager' ? '门店待处理信号' : '经营热点队列'}</strong><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部来源</option>{Array.from(new Set(items.map(i=>i.source_type))).map(v=><option key={v}>{v}</option>)}</select></div>
      <div className="compact-queue">{filtered.map(item=><button data-testid={`hotspot-${item.id}`} key={item.id} className={selected?.id===item.id?'compact-row active':'compact-row'} onClick={()=>setSelectedId(item.id)}><span><strong>{item.title}</strong><small>{item.source_label} · {item.last_seen}</small></span><StatusPill tone={item.status==='待处理'?'warning':'info'}>{item.status}</StatusPill></button>)}</div>
    </aside>
    {selected ? <main className="enterprise-detail-pane">
      <header className="detail-heading"><div><p className="eyebrow">{selected.demo_flag?'演示信号':'业务信号'}</p><h2>{selected.title}</h2><p>{selected.recommended_action}</p></div><StatusPill tone="warning">{selected.trend}</StatusPill></header>
      <section className="evidence-stream"><div className="section-heading"><strong>为什么成为热点</strong><span>{selected.evidence_count} 条证据</span></div>{selected.evidence.map(item=><article key={item.id}><MessageSquareText size={17}/><div><strong>{item.summary}</strong><p>{item.store} · {item.advisor}</p><small>{item.occurred_at}</small></div></article>)}</section>
      <div className="demo-notice">演示样本：最近 7 天的脱敏模拟咨询与运营信号，不代表真实平台抓取量。</div>
    </main> : null}
    {selected ? <aside className="enterprise-action-pane">
      <section><strong>影响范围</strong><dl className="impact-grid"><div><dt>客户</dt><dd>{selected.impact.customers}</dd></div><div><dt>顾问</dt><dd>{selected.impact.advisors}</dd></div><div><dt>内容</dt><dd>{selected.impact.contents}</dd></div><div><dt>门店</dt><dd>{selected.impact.stores}</dd></div></dl></section>
      <section><strong>负责人</strong><p>{selected.owner}</p><small>当前状态：{selected.status}</small></section>
      <section className="action-stack"><strong>人工确认后转任务</strong>{actions.map(([value,label])=><Button key={value} data-testid={`hotspot-action-${value}`} variant={value==='ignore'?'secondary':'primary'} loading={working===value} onClick={()=>void runAction(value)}>{value==='content_task'?<ArrowUpRight size={15}/>:value==='knowledge_draft'?<BookOpenCheck size={15}/>:value==='coaching'?<GraduationCap size={15}/>:<UsersRound size={15}/>} {label}</Button>)}</section>
      {selected.last_action ? <section className="last-action"><strong>最近处理</strong><p>{selected.last_action.action}</p><small>{selected.last_action.at}</small></section> : null}
    </aside> : null}
  </section>
}
