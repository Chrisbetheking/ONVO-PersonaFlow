import { useMemo, useState } from 'react'
import { ArrowRight, BellRing, GitCompareArrows, RefreshCw } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { Button, EmptyState, StatusPill } from '../shared/ui'
import type { KnowledgeImpact, KnowledgeItem } from '../types'

const changes = [
  ['campaign_end','调整 L80 活动结束日期'],['l80_price','调整 L80 价格口径'],['regional_benefit','新增区域权益'],
  ['retire_script','废止旧销售口径'],['compliance','修改合规要求'],
] as const

export function KnowledgePage() {
  const { workspace, dataMode, refreshWorkspace, updateEnterpriseLocal, showToast } = useApp()
  const items = workspace.enterprise.knowledge_items
  const impacts = workspace.enterprise.knowledge_impacts
  const [selectedId, setSelectedId] = useState(items[0]?.id || '')
  const [impactId, setImpactId] = useState(impacts[0]?.id || '')
  const [changeType, setChangeType] = useState('campaign_end')
  const [working, setWorking] = useState(false)
  const selected = items.find(item=>item.id===selectedId) || items[0]
  const impact = impacts.find(item=>item.id===impactId) || impacts[0]

  async function simulate() {
    setWorking(true)
    try {
      if (dataMode === 'fallback') {
        const now = new Date().toISOString()
        const target = selected || items[0]
        if (!target) return
        const nextVersion = `${target.version}.1`
        const localImpact: KnowledgeImpact = {
          id:`impact-local-${Date.now()}`,knowledge_id:target.id,knowledge_title:target.title,from_version:target.version,to_version:nextVersion,
          change_field:'活动结束日期',before:'2026-07-31',after:'2026-07-28',summary:'活动结束时间从 7 月 31 日调整为 7 月 28 日',
          affected:{pending_contents:12,pending_reviews:3,customers:18,advisor_tasks:4,campaigns:1},
          objects:[{id:'review-l80-001',type:'待审核内容',title:'L80 家庭体验内容',status:'needs_revalidation',owner:'周辰'},{id:'customer-chen',type:'客户任务',title:'陈女士活动更新',status:'pending',owner:'周辰'}],
          status:'pending',created_at:now,demo_flag:true,
        }
        updateEnterpriseLocal(current=>({...current,knowledge_items:current.knowledge_items.map(item=>item.id===target.id?{...item,version:nextVersion,updated_at:now,versions:[{id:`kv-${Date.now()}`,version:nextVersion,content:item.content+'\n\n变更：活动结束日期调整为 2026-07-28。',status:'current',created_at:now,source:'飞书 Demo Adapter',created_by:'总部运营 Demo'},...item.versions.map(v=>({...v,status:'superseded'}))]}:item),knowledge_impacts:[localImpact,...current.knowledge_impacts],notifications:[{id:`notice-${Date.now()}`,channel:'飞书机器人 Demo',title:`知识版本已更新：${target.title}`,body:'发现待发布内容和客户任务需要重新核验。',status:'preview',created_at:now,demo_flag:true},...current.notifications]}))
        setImpactId(localImpact.id)
      } else {
        const response:any = await api.simulateFeishuChange(changeType)
        await refreshWorkspace()
        if (response?.impact?.id) setImpactId(response.impact.id)
      }
      showToast('模拟飞书知识变更已创建新版本和影响任务')
    } finally { setWorking(false) }
  }

  async function objectAction(currentImpact: KnowledgeImpact, objectId: string, action: string) {
    if (dataMode === 'fallback') updateEnterpriseLocal(current=>({...current,knowledge_impacts:current.knowledge_impacts.map(item=>item.id===currentImpact.id?{...item,objects:item.objects.map(obj=>obj.id===objectId?{...obj,status:action}:obj)}:item)}))
    else { await api.impactAction(currentImpact.id,objectId,action,'人工确认'); await refreshWorkspace() }
    showToast('影响对象处理状态已更新')
  }

  if (!selected) return <EmptyState title="暂无知识" description="车型、价格、权益和合规口径将在这里按版本管理。" />
  return <section className="enterprise-three-column knowledge-page" data-testid="knowledge-center">
    <aside className="enterprise-list-pane"><div className="pane-toolbar"><strong>知识目录</strong><span>{items.length} 条</span></div><div className="compact-queue">{items.map(item=><button data-testid={`knowledge-${item.id}`} key={item.id} className={selected.id===item.id?'compact-row active':'compact-row'} onClick={()=>setSelectedId(item.id)}><span><strong>{item.title}</strong><small>{item.type} · v{item.version}</small></span><StatusPill tone={item.status==='current'?'success':'warning'}>{item.status}</StatusPill></button>)}</div></aside>
    <main className="enterprise-detail-pane">
      <header className="detail-heading"><div><p className="eyebrow">{selected.demo_flag?'演示知识':'企业知识'}</p><h2>{selected.title}</h2><p>{selected.source} · {selected.updated_at}</p></div><StatusPill tone="success">v{selected.version}</StatusPill></header>
      <article className="knowledge-body">{selected.content.split('\n').map((line,i)=><p key={i}>{line}</p>)}</article>
      <section className="version-history"><div className="section-heading"><strong>版本记录</strong><span>{selected.versions.length}</span></div>{selected.versions.map(version=><div key={version.id}><span>v{version.version}</span><strong>{version.status}</strong><small>{version.created_at} · {version.source}</small></div>)}</section>
      <div className="demo-notice">当前使用 Demo Adapter 模拟飞书知识变化，未连接真实飞书企业应用。</div>
    </main>
    <aside className="enterprise-action-pane">
      <section><strong>模拟飞书知识变更</strong><select data-testid="feishu-change-select" value={changeType} onChange={e=>setChangeType(e.target.value)}>{changes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><Button data-testid="simulate-feishu-change" loading={working} onClick={()=>void simulate()}><RefreshCw size={16}/>执行模拟同步</Button></section>
      {impact ? <section className="impact-detail" data-testid="knowledge-impact"><strong>影响分析</strong><h3>{impact.summary}</h3><div className="impact-numbers"><span>{impact.affected.pending_contents} 条待发布内容</span><span>{impact.affected.pending_reviews} 条待审核内容</span><span>{impact.affected.customers} 位客户</span><span>{impact.affected.campaigns} 个活动</span></div>{impact.objects.map(obj=><article key={obj.id}><div><strong>{obj.title}</strong><small>{obj.type} · {obj.owner}</small></div><StatusPill tone={obj.status.includes('revalidation')?'warning':'info'}>{obj.status}</StatusPill><div className="row-actions"><button onClick={()=>void objectAction(impact,obj.id,'revalidate')}>重新核验</button><button onClick={()=>void objectAction(impact,obj.id,'assign')}>分配</button><button onClick={()=>void objectAction(impact,obj.id,'ignore')}>忽略</button></div></article>)}</section> : <section><GitCompareArrows size={20}/><strong>尚无影响分析</strong><p>执行一次模拟飞书变更后，这里会显示受影响的内容、客户和活动。</p></section>}
      {workspace.enterprise.notifications[0] ? <section className="notification-preview"><BellRing size={18}/><strong>{workspace.enterprise.notifications[0].title}</strong><p>{workspace.enterprise.notifications[0].body}</p><small>模拟通知预览</small></section> : null}
    </aside>
  </section>
}
