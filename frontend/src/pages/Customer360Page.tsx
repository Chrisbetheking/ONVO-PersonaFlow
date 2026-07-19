import { useState } from 'react'
import { CalendarClock, Check, Clock3, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { Button, EmptyState, StatusPill } from '../shared/ui'

const dimensionLabels: Record<string,string> = { need_clarity:'需求明确度',product_fit:'产品匹配度',price_acceptance:'价格接受度',family_decision:'家庭决策状态',urgency:'时间紧迫性',relationship:'关系温度' }

export function Customer360Page() {
  const { workspace, boot, dataMode, refreshWorkspace, updateEnterpriseLocal, showToast } = useApp()
  const items = workspace.enterprise.customer_profiles
  const [selectedId,setSelectedId]=useState(items[0]?.id||'')
  const selected=items.find(i=>i.id===selectedId)||items[0]
  if(!selected) return <EmptyState title="暂无客户档案" description="CRM Demo Adapter 同步后会在这里形成客户 360。"/>
  const advisor=boot.advisors.find(i=>i.id===selected.advisor_id)

  async function action(id:string, action:string) {
    if(dataMode==='fallback') updateEnterpriseLocal(current=>({...current,customer_profiles:current.customer_profiles.map(customer=>customer.id===selected.id?{...customer,next_best_actions:customer.next_best_actions.map(item=>item.id===id?{...item,status:{accept:'accepted',delay:'delayed',escalate:'escalated'}[action]||action,updated_at:new Date().toISOString()}:item)}:customer)}))
    else { await api.customerAction(selected.id,id,action); await refreshWorkspace() }
    showToast('下一最佳行动状态已更新')
  }

  return <section className="customer-360-layout" data-testid="customer-360">
    <aside className="enterprise-list-pane"><div className="pane-toolbar"><strong>客户档案</strong><span>演示数据</span></div><div className="compact-queue">{items.map(item=><button key={item.id} data-testid={`customer-${item.id}`} className={selected.id===item.id?'compact-row active':'compact-row'} onClick={()=>setSelectedId(item.id)}><span><strong>{item.name}</strong><small>{item.city} · {item.family}</small></span><StatusPill tone="info">{item.purchase_window}</StatusPill></button>)}</div></aside>
    <main className="customer-profile-main">
      <header className="customer-profile-header"><div className="customer-avatar"><UserRound/></div><div><h2>{selected.name}</h2><p>{selected.city} · {selected.family} · 目标 {selected.target_vehicle_ids.join('、')}</p><small>负责人：{advisor?.name||selected.advisor_id} · 来源：{selected.data_source} · 最近同步 {selected.last_synced_at}</small></div><StatusPill tone={selected.consent_status==='已授权'?'success':'warning'}>{selected.consent_status}</StatusPill></header>
      <section className="profile-properties"><div><span>当前车辆</span><strong>{selected.current_vehicle}</strong></div><div><span>预算</span><strong>{selected.budget}</strong></div><div><span>购车时间</span><strong>{selected.purchase_window}</strong></div><div><span>渠道来源</span><strong>{selected.channel_source}</strong></div></section>
      <section className="state-dimensions"><div className="section-heading"><strong>客户状态与判断依据</strong><span>不使用黑盒总分</span></div>{Object.entries(selected.state).filter(([,v])=>typeof v==='object'&&!Array.isArray(v)).map(([key,value]:any)=><article key={key}><div><strong>{dimensionLabels[key]||key}</strong><StatusPill tone={value.level==='高'?'success':value.level==='中'?'warning':'info'}>{value.level}</StatusPill></div><ul>{value.evidence.map((e:string)=><li key={e}>{e}</li>)}</ul></article>)}</section>
      <section className="privacy-panel"><ShieldCheck size={18}/><div><strong>数据授权与使用边界</strong><p>{selected.allowed_scope}</p><small>保留至 {selected.retention_until} · 模型分析 {selected.model_analysis_allowed?'允许':'不允许'} · 删除请求：{selected.delete_request_status}</small></div></section>
    </main>
    <aside className="enterprise-action-pane"><section><strong>主要顾虑</strong><div className="plain-tags">{selected.state.concerns.map(item=><span key={item}>{item}</span>)}</div><p>当前障碍：{selected.state.blocker}</p></section><section className="next-actions"><strong>下一最佳行动</strong>{selected.next_best_actions.map(item=><article key={item.id} data-testid={`nba-${item.id}`}><div><h3>{item.action}</h3><StatusPill tone={item.status==='accepted'?'success':'warning'}>{item.status}</StatusPill></div><p>{item.reason}</p><small><CalendarClock size={13}/>{item.due_at} · {item.owner}</small><div className="row-actions"><button onClick={()=>void action(item.id,'accept')}><Check size={13}/>接受</button><button onClick={()=>void action(item.id,'delay')}><Clock3 size={13}/>延后</button><button onClick={()=>void action(item.id,'escalate')} >转经理</button></div></article>)}</section></aside>
  </section>
}
