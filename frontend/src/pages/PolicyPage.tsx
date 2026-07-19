import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, MapPin, UserRoundCheck } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { EmptyState, StatusPill } from '../shared/ui'

export function PolicyPage(){
  const {workspace}=useApp()
  const items=useMemo(()=>workspace.enterprise.knowledge_items.filter(item=>['价格','权益','活动','区域政策','销售口径','合规规则'].includes(item.type)||/价格|权益|活动|政策|口径|合规/.test(item.title)),[workspace.enterprise.knowledge_items])
  const [selectedId,setSelectedId]=useState(items[0]?.id||'')
  const selected=items.find(item=>item.id===selectedId)||items[0]
  if(!selected)return <EmptyState title="暂无政策与权益记录" description="知识中心中的价格、权益、活动和区域政策会在这里按有效期聚合。"/>
  const now='2026-07-19'
  const freshness=selected.expires_at&&selected.expires_at<now?'已失效':selected.expires_at&&selected.expires_at<='2026-08-15'?'即将失效':'当前有效'
  return <section className="enterprise-three-column policy-page" data-testid="policy-center"><aside className="enterprise-list-pane"><div className="pane-toolbar"><strong>政策与权益</strong><span>{items.length}</span></div><div className="compact-queue">{items.map(item=><button key={item.id} className={selected.id===item.id?'compact-row active':'compact-row'} onClick={()=>setSelectedId(item.id)}><span><strong>{item.title}</strong><small>{item.type} · v{item.version}</small></span><StatusPill tone={item.expires_at&&item.expires_at<now?'danger':'warning'}>{item.status}</StatusPill></button>)}</div></aside><main className="enterprise-detail-pane"><header className="detail-heading"><div><p className="eyebrow">{selected.demo_flag?'演示知识':'公开来源知识'}</p><h2>{selected.title}</h2><p>{selected.content}</p></div><StatusPill tone={freshness==='当前有效'?'success':freshness==='即将失效'?'warning':'danger'}>{freshness}</StatusPill></header><section className="policy-facts"><div><CalendarClock/><span><strong>有效期</strong><p>{selected.effective_at||'待确认'} 至 {selected.expires_at||'长期有效'}</p></span></div><div><MapPin/><span><strong>适用区域</strong><p>{selected.regions.join('、')}</p></span></div><div><UserRoundCheck/><span><strong>负责人 / 审核人</strong><p>{selected.created_by} / {selected.reviewed_by||'待审核'}</p></span></div></section><section><strong>来源与版本</strong><p>{selected.source}</p><small>{selected.source_url} · 当前 v{selected.version}</small></section></main><aside className="enterprise-action-pane"><section><strong>知识新鲜度</strong><p>被 {selected.linked_content_count} 条内容和 {selected.linked_customer_count} 个客户任务引用。</p>{freshness!=='当前有效'?<div className="warning-note"><AlertTriangle size={16}/>需要负责人重新核验，并检查受影响内容。</div>:null}</section><section><strong>版本冲突检查</strong><p>{selected.versions.filter(item=>item.status==='current').length>1?'存在多个当前版本，需要人工处理。':'当前没有检测到多个有效版本。'}</p></section></aside></section>
}
