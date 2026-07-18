import { useMemo, useState } from 'react'
import { Filter, RotateCcw } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { navigate } from '../app/router'
import { OpportunityList } from '../features/opportunity-inbox/OpportunityList'
import { Button, SkeletonLines } from '../shared/ui'
import type { Opportunity } from '../types'

export function TodayPage() {
  const { workspace, loading, updateOpportunityStatus, showToast } = useApp()
  const [priority, setPriority] = useState<'all' | Opportunity['priority']>('all')
  const [showDone, setShowDone] = useState(false)

  const items = useMemo(() => workspace.opportunities.filter(item => {
    if (!showDone && item.status === 'done') return false
    if (priority !== 'all' && item.priority !== priority) return false
    return true
  }), [workspace.opportunities, priority, showDone])

  function open(item: Opportunity) {
    navigate('studio', { opportunity: item.id })
  }

  async function later(item: Opportunity) {
    await updateOpportunityStatus(item.id, 'later')
    showToast('已放入稍后处理')
  }

  async function done(item: Opportunity) {
    await updateOpportunityStatus(item.id, 'done')
    showToast('机会已标记完成')
  }

  return (
    <section className="today-page">
      <div className="section-intro">
        <div><p className="eyebrow">今天先做什么</p><h2>按客户信号，而不是按消息数量排优先级</h2><p>每个机会都说明触发来源、现在值得处理的原因和推荐动作。演示数据不会伪装成实时 CRM。</p></div>
        <div className="today-summary"><strong>{workspace.opportunities.filter(item => item.status !== 'done').length}</strong><span>项待处理</span><small>{workspace.opportunities.filter(item => item.priority === 'high' && item.status !== 'done').length} 项需要今天回应</small></div>
      </div>

      <div className="filter-bar" aria-label="机会筛选">
        <Filter size={16} />
        {(['all', 'high', 'medium', 'low'] as const).map(value => <button key={value} className={priority === value ? 'active' : ''} onClick={() => setPriority(value)}>{value === 'all' ? '全部优先级' : value === 'high' ? '优先处理' : value === 'medium' ? '建议处理' : '普通'}</button>)}
        <label><input type="checkbox" checked={showDone} onChange={event => setShowDone(event.target.checked)} />显示已完成</label>
      </div>

      {loading ? <SkeletonLines rows={6} /> : <OpportunityList items={items} onOpen={open} onLater={item => void later(item)} onDone={item => void done(item)} />}

      <div className="today-footnote"><RotateCcw size={15} /><span>机会来源在原型中由脱敏演示适配层提供；接入真实 CRM 后可替换为客户消息、活动和历史反馈事件。</span><Button variant="ghost" onClick={() => navigate('about')}>查看数据边界</Button></div>
    </section>
  )
}
