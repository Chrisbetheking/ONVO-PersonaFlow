import { useState } from 'react'
import { CalendarClock, Check, Clock3, HelpCircle, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { Button, Dialog, EmptyState, StatusPill } from '../shared/ui'
import type { CustomerStateEvidence } from '../types'

const dimensionLabels: Record<string,string> = { need_clarity:'需求明确度',product_fit:'产品匹配度',price_acceptance:'价格接受度',family_decision:'家庭决策状态',urgency:'时间紧迫性',relationship:'关系温度' }
const actionStatusLabel: Record<string,string> = { recommended:'系统建议', accepted:'已接受', delayed:'已延后', escalated:'已转经理', ignored:'已忽略', completed:'已完成', modified:'已修改' }

type PendingAction = { id: string; action: 'modify'|'delay'|'ignore'|'escalate'; title: string } | null

export function Customer360Page() {
  const { workspace, boot, dataMode, refreshWorkspace, updateEnterpriseLocal, showToast } = useApp()
  const items = workspace.enterprise.customer_profiles
  const [selectedId,setSelectedId]=useState(items[0]?.id||'')
  const [expanded,setExpanded]=useState('need_clarity')
  const [pending,setPending]=useState<PendingAction>(null)
  const [note,setNote]=useState('')
  const selected=items.find(i=>i.id===selectedId)||items[0]
  if(!selected) return <EmptyState title="暂无客户档案" description="CRM Demo Adapter 同步后会在这里形成客户 360。"/>
  const advisor=boot.advisors.find(i=>i.id===selected.advisor_id)

  async function action(id:string, action:string, actionNote='') {
    if(dataMode==='fallback') updateEnterpriseLocal(current=>({...current,customer_profiles:current.customer_profiles.map(customer=>customer.id===selected.id?{...customer,next_best_actions:customer.next_best_actions.map(item=>item.id===id?{...item,status:{accept:'accepted',modify:'modified',delay:'delayed',escalate:'escalated',ignore:'ignored',complete:'completed'}[action]||action,note:actionNote,updated_at:new Date().toISOString()}:item)}:customer)}))
    else { await api.customerAction(selected.id,id,action,actionNote); await refreshWorkspace() }
    showToast('下一最佳行动状态已更新并保留操作原因')
    setPending(null);setNote('')
  }

  function evidenceView(value: string | CustomerStateEvidence, index: number) {
    if(typeof value==='string') return <li key={`${value}-${index}`}><p>{value}</p><small>演示历史记录 · 规则判断 · Demo</small></li>
    return <li key={`${value.text}-${index}`}><p>{value.text}</p><small>{value.source} · {value.occurred_at} · {value.channel} · {value.method}{value.demo_flag?' · Demo':''}</small></li>
  }

  return <section className="customer-360-layout" data-testid="customer-360">
    <aside className="enterprise-list-pane"><div className="pane-toolbar"><strong>客户档案</strong><span>演示数据</span></div><div className="compact-queue">{items.map(item=><button key={item.id} data-testid={`customer-${item.id}`} className={selected.id===item.id?'compact-row active':'compact-row'} onClick={()=>setSelectedId(item.id)}><span><strong>{item.name}</strong><small>{item.city} · {item.family}</small></span><StatusPill tone="info">{item.purchase_window}</StatusPill></button>)}</div></aside>
    <main className="customer-profile-main">
      <header className="customer-profile-header"><div className="customer-avatar"><UserRound/></div><div><h2>{selected.name}</h2><p>{selected.city} · {selected.family} · 目标 {selected.target_vehicle_ids.join('、')}</p><small>当前客户负责顾问：{advisor?.name||selected.advisor_id} · 数据来源：{selected.data_source} · 最近同步 {selected.last_synced_at}</small></div><StatusPill tone={selected.consent_status==='已授权'?'success':'warning'}>{selected.consent_status}</StatusPill></header>
      <section className="profile-properties"><div><span>当前车辆</span><strong>{selected.current_vehicle}</strong></div><div><span>预算</span><strong>{selected.budget}</strong></div><div><span>购车时间</span><strong>{selected.purchase_window}</strong></div><div><span>渠道来源</span><strong>{selected.channel_source}</strong></div></section>
      <section className="state-dimensions"><div className="section-heading"><strong>客户状态与判断依据</strong><span>每项均可展开来源</span></div>{Object.entries(selected.state).filter(([,v])=>typeof v==='object'&&!Array.isArray(v)).map(([key,value]:any)=><article key={key} className={expanded===key?'expanded':''}><button className="dimension-heading" data-testid={`dimension-${key}`} onClick={()=>setExpanded(current=>current===key?'':key)}><strong>{dimensionLabels[key]||key}</strong><StatusPill tone={value.level==='高'?'success':value.level==='中'?'warning':'info'}>{value.level}</StatusPill></button>{expanded===key?<ul data-testid={`dimension-evidence-${key}`}>{value.evidence.map((e:string|CustomerStateEvidence,index:number)=>evidenceView(e,index))}</ul>:null}</article>)}</section>
      <section className="privacy-panel"><ShieldCheck size={18}/><div><strong>数据授权与使用边界</strong><p>{selected.allowed_scope}</p><small>保留至 {selected.retention_until} · 模型分析 {selected.model_analysis_allowed?'允许':'不允许'} · 删除请求：{selected.delete_request_status}</small></div></section>
    </main>
    <aside className="enterprise-action-pane"><section><strong>主要顾虑</strong><div className="plain-tags">{selected.state.concerns.map(item=><span key={item}>{item}</span>)}</div><p>当前障碍：{selected.state.blocker}</p></section><section className="next-actions"><strong>下一最佳行动</strong>{selected.next_best_actions.map(item=><article key={item.id} data-testid={`nba-${item.id}`}><div><h3>{item.action}</h3><StatusPill tone={item.status==='accepted'||item.status==='completed'?'success':item.status==='ignored'?'neutral':'warning'}>{actionStatusLabel[item.status]||item.status}</StatusPill></div><p>{item.reason}</p><small><CalendarClock size={13}/>{item.due_at} · {item.owner}</small><details><summary><HelpCircle size={13}/>为什么推荐</summary><p>风险：{item.risk}</p><p>所需资料：{item.required_materials.join('、')||'无'}</p><p>{item.manager_help?'需要经理协助':'顾问可直接处理'}</p></details><div className="row-actions"><button disabled={item.status==='accepted'} onClick={()=>void action(item.id,'accept')}><Check size={13}/>接受</button><button onClick={()=>setPending({id:item.id,action:'modify',title:'修改建议'})}>修改</button><button onClick={()=>setPending({id:item.id,action:'delay',title:'延后处理'})}><Clock3 size={13}/>延后</button><button onClick={()=>setPending({id:item.id,action:'escalate',title:'转给经理'})}>转经理</button><button onClick={()=>setPending({id:item.id,action:'ignore',title:'忽略建议'})}>忽略</button><button onClick={()=>void action(item.id,'complete')}>完成</button></div>{item.note?<small>处理说明：{item.note}</small>:null}</article>)}</section></aside>
    <Dialog open={Boolean(pending)} title={pending?.title||''} description="填写原因后，状态变化会保存在当前 workspace 并写入审计记录。" onClose={()=>setPending(null)} testId="nba-action-dialog" footer={<><Button variant="secondary" onClick={()=>setPending(null)}>取消</Button><Button data-testid="confirm-nba-action" disabled={!note.trim()} onClick={()=>pending&&void action(pending.id,pending.action,note)}>确认</Button></>}><label className="field-label">处理原因<textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="说明为什么修改、延后、忽略或转经理。"/></label></Dialog>
  </section>
}
