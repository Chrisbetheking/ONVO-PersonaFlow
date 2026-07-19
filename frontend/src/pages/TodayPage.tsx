import { useMemo, useState } from 'react'
import { Filter, RotateCcw } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { navigate } from '../app/router'
import { OpportunityList } from '../features/opportunity-inbox/OpportunityList'
import { Button, SkeletonLines } from '../shared/ui'
import type { Opportunity } from '../types'

const sourceOptions = ['all','客户信号','总部活动','热点机会','知识变更','承诺到期','客户风险'] as const
export function TodayPage() {
  const { workspace, loading, updateOpportunityStatus, showToast } = useApp()
  const [priority, setPriority] = useState<'all' | Opportunity['priority']>('all')
  const [source,setSource]=useState<(typeof sourceOptions)[number]>('all')
  const [showDone, setShowDone] = useState(false)
  const items = useMemo(() => workspace.opportunities.filter(item => {
    if (!showDone && item.status === 'done') return false
    if (priority !== 'all' && item.priority !== priority) return false
    if(source!=='all' && (item.source_type||item.source)!==source) return false
    return true
  }), [workspace.opportunities, priority, source, showDone])
  function open(item: Opportunity) { navigate('studio', { opportunity: item.id }) }
  async function later(item: Opportunity) { await updateOpportunityStatus(item.id, 'later'); showToast('已放入稍后处理') }
  async function done(item: Opportunity) { await updateOpportunityStatus(item.id, 'done'); showToast('机会已标记完成') }
  return <section className="today-page"><div className="section-intro"><div><p className="eyebrow">今天先做什么</p><h2>按客户信号，而不是按消息数量排优先级</h2><p>队列同时接收客户、活动、热点、知识变化、承诺和风险信号；所有数量均为明确标记的演示样本。</p></div></div>
    <div className="filter-bar" aria-label="机会筛选"><Filter size={16}/>{(['all','high','medium','low'] as const).map(value=><button key={value} className={priority===value?'active':''} onClick={()=>setPriority(value)}>{value==='all'?'全部优先级':value==='high'?'优先处理':value==='medium'?'建议处理':'普通'}</button>)}<select data-testid="opportunity-source-filter" value={source} onChange={event=>setSource(event.target.value as typeof source)}>{sourceOptions.map(value=><option key={value} value={value}>{value==='all'?'全部来源':value}</option>)}</select><label><input type="checkbox" checked={showDone} onChange={event=>setShowDone(event.target.checked)}/>显示已完成</label></div>
    {loading?<SkeletonLines rows={6}/>:<OpportunityList items={items} onOpen={open} onLater={item=>void later(item)} onDone={item=>void done(item)} onOpenHotspot={()=>navigate('hotspots')}/>}<div className="today-footnote"><RotateCcw size={15}/><span>当前机会由脱敏演示适配层提供；生产接入时可替换为 CRM、授权沟通、知识和承诺事件。</span><Button variant="ghost" onClick={()=>navigate('about')}>查看数据边界</Button></div></section>
}
