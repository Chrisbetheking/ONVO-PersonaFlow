import { useState } from 'react'
import { BookOpenCheck, Building2, Share2 } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { Button, EmptyState, StatusPill } from '../shared/ui'
import { statusLabel } from '../shared/display'

export function BestPracticesPage() {
  const { workspace, dataMode, refreshWorkspace, updateEnterpriseLocal, showToast } = useApp()
  const items = workspace.enterprise.best_practices
  const [selectedId, setSelectedId] = useState(items[0]?.id || '')
  const [working, setWorking] = useState('')
  const selected = items.find(item => item.id === selectedId) || items[0]

  async function publish() {
    if (!selected) return
    setWorking('publish')
    try {
      if (dataMode === 'local_demo') {
        updateEnterpriseLocal(current => ({
          ...current,
          best_practices: current.best_practices.map(item => item.id === selected.id ? {
            ...item,
            status: 'published',
            published_at: new Date().toISOString(),
            reviewer: item.reviewer || '门店经理 Demo',
          } : item),
        }))
      } else {
        await api.publishBestPractice(selected.id)
        await refreshWorkspace()
      }
      showToast('优秀案例已由经理确认发布')
    } finally { setWorking('') }
  }

  async function action(value: 'training_reference' | 'cross_store_publish') {
    if (!selected) return
    setWorking(value)
    try {
      if (dataMode === 'local_demo') {
        updateEnterpriseLocal(current => ({
          ...current,
          best_practices: current.best_practices.map(item => item.id === selected.id ? value === 'training_reference' ? {
            ...item,
            uses: Array.from(new Set([...(item.uses || []), 'training_reference'])),
            training_status: 'ready',
          } : {
            ...item,
            cross_store_status: 'published_to_selected_stores',
            target_stores: ['杭州城西体验店', '上海浦东体验店'],
            adoption_status: 'tracking',
          } : item),
        }))
      } else {
        await api.bestPracticeAction(selected.id, value)
        await refreshWorkspace()
      }
      showToast(value === 'training_reference' ? '案例已转为培训参考' : '案例已发布到选定门店并开始跟踪采纳')
    } finally { setWorking('') }
  }

  if (!selected) return <EmptyState title="暂无案例" description="候选案例必须经过经理确认后才能进入组织学习。" />

  return <section className="enterprise-split-layout best-practice-page" data-testid="best-practices">
    <aside className="enterprise-list-pane">
      <div className="pane-toolbar"><strong>案例候选与已发布</strong><span>{items.length}</span></div>
      <div className="compact-queue">{items.map(item => <button key={item.id} className={selected.id === item.id ? 'compact-row active' : 'compact-row'} onClick={() => setSelectedId(item.id)}><span><strong>{item.scenario}</strong><small>{item.source}</small></span><StatusPill tone={item.status === 'published' ? 'success' : 'warning'}>{item.status}</StatusPill></button>)}</div>
    </aside>
    <main className="enterprise-detail-pane">
      <header className="detail-heading"><div><p className="eyebrow">{selected.demo_flag ? '脱敏演示案例' : '业务案例'}</p><h2>{selected.scenario}</h2><p>{selected.customer_question}</p></div><StatusPill tone={selected.status === 'published' ? 'success' : 'warning'}>{selected.status}</StatusPill></header>
      <section className="case-story">
        <div><strong>顾问处理方式</strong><p>{selected.advisor_approach}</p></div>
        <div><strong>为什么有效</strong><p>{selected.why_effective}</p></div>
        <div><strong>结果</strong><p>{selected.result}</p></div>
        <div><strong>不适用情况</strong><p>{selected.not_for.join('、') || '需结合具体客户情况人工判断'}</p></div>
      </section>
      <div className="demo-notice">系统只提名候选，案例必须匿名化并由经理确认后才能发布。</div>
    </main>
    <aside className="enterprise-action-pane">
      <section><strong>适用范围</strong><p>客群：{selected.audiences.join('、') || '待补充'}</p><p>车型：{selected.vehicle_ids.join('、') || '待补充'}</p><p>审核人：{selected.reviewer || '待确认'}</p></section>
      <section className="action-stack">
        <Button data-testid="publish-best-practice" loading={working === 'publish'} disabled={selected.status === 'published'} onClick={() => void publish()}><BookOpenCheck size={16}/>经理确认并发布</Button>
        <Button data-testid="best-practice-training" variant="secondary" loading={working === 'training_reference'} disabled={selected.status !== 'published' || selected.training_status === 'ready'} onClick={() => void action('training_reference')}><Share2 size={16}/>转为培训参考</Button>
        <Button data-testid="best-practice-cross-store" variant="secondary" loading={working === 'cross_store_publish'} disabled={selected.status !== 'published' || selected.cross_store_status === 'published_to_selected_stores'} onClick={() => void action('cross_store_publish')}><Building2 size={16}/>发布到选定门店</Button>
      </section>
      {selected.training_status ? <section><strong>培训状态</strong><p>{statusLabel(selected.training_status)}</p></section> : null}
      {selected.cross_store_status ? <section><strong>跨门店采纳</strong><p>{statusLabel(selected.cross_store_status)}</p><small>{selected.target_stores?.join('、')} · {statusLabel(selected.adoption_status)}</small></section> : null}
    </aside>
  </section>
}
