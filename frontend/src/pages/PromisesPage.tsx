import { useState } from 'react'
import { AlarmClock, CheckCircle2, ClockArrowUp, UserRoundCheck } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { Button, EmptyState, StatusPill } from '../shared/ui'
import { updatePromiseStatus } from '../shared/enterpriseWorkflow'

const statusLabel:Record<string,string>={pending_confirmation:'待确认',pending_execution:'待执行',completed:'已完成',delayed:'已延期',cancelled:'已取消',overdue:'已超时'}
export function PromisesPage(){
  const {workspace,boot,dataMode,refreshWorkspace,updateEnterpriseLocal,showToast}=useApp()
  const items=workspace.enterprise.promises
  const [selectedId,setSelectedId]=useState(items[0]?.id||'')
  const selected=items.find(i=>i.id===selectedId)||items[0]
  async function act(action:string,payload:Record<string,unknown>={}){
    if(!selected)return
    if(dataMode==='fallback') updateEnterpriseLocal(current=>({...current,promises:current.promises.map(item=>item.id===selected.id?{...item,status:action==='complete'?'completed':action==='confirm'?'pending_execution':action==='delay'?'delayed':item.status,overdue:false,completed_at:action==='complete'?new Date().toISOString():item.completed_at,delay_reason:action==='delay'?String(payload.reason||''):item.delay_reason}:item)}))
    else {await api.promiseAction(selected.id,action,payload);await refreshWorkspace()}
    showToast('承诺状态已更新')
  }
  async function simulate(state:string){if(!selected)return;if(dataMode==='fallback')updateEnterpriseLocal(current=>({...current,promises:current.promises.map(item=>item.id===selected.id?{...item,status:state==='overdue'?'overdue':'pending_execution',overdue:state==='overdue',manager_attention:state==='overdue'||item.manager_attention}:item)}));else{await api.simulatePromise(selected.id,state);await refreshWorkspace()}showToast('已生成模拟提醒')}
  if(!selected)return <EmptyState title="暂无承诺" description="客户沟通中的明确承诺会进入台账，并由顾问确认。"/>
  const advisor=boot.advisors.find(i=>i.id===selected.advisor_id)
  return <section className="enterprise-split-layout promises-page" data-testid="promise-ledger"><aside className="enterprise-list-pane"><div className="pane-toolbar"><strong>承诺台账</strong><span>{items.length}</span></div><div className="compact-queue">{items.map(item=><button key={item.id} data-testid={`promise-${item.id}`} className={selected.id===item.id?'compact-row active':'compact-row'} onClick={()=>setSelectedId(item.id)}><span><strong>{item.commitment}</strong><small>{item.due_at} · {boot.advisors.find(a=>a.id===item.advisor_id)?.name}</small></span><StatusPill tone={item.overdue?'danger':item.status==='completed'?'success':'warning'}>{statusLabel[item.status]||item.status}</StatusPill></button>)}</div></aside><main className="enterprise-detail-pane"><header className="detail-heading"><div><p className="eyebrow">{selected.demo_flag?'演示承诺':'客户承诺'}</p><h2>{selected.commitment}</h2><p>{selected.original_message}</p></div><StatusPill tone={selected.overdue?'danger':'warning'}>{statusLabel[selected.status]||selected.status}</StatusPill></header><section className="promise-facts"><div><UserRoundCheck/><span><strong>负责人</strong><p>{advisor?.name||selected.advisor_id}</p></span></div><div><AlarmClock/><span><strong>截止时间</strong><p>{selected.due_at}</p></span></div><div><CheckCircle2/><span><strong>完成条件</strong><p>{selected.completion_criteria}</p></span></div></section><section><strong>来源与证据</strong><p>{selected.source}</p>{selected.evidence.map(e=><blockquote key={e}>{e}</blockquote>)}</section><div className="demo-notice">承诺由沟通内容识别后进入待确认状态，不会在顾问未确认时自动当作真实承诺执行。</div></main><aside className="enterprise-action-pane"><section className="action-stack"><strong>顾问操作</strong><Button data-testid="confirm-promise" onClick={()=>void act('confirm')}>确认承诺</Button><Button data-testid="complete-promise" onClick={()=>void act('complete',{evidence:'顾问确认已完成'})}>标记完成</Button><Button variant="secondary" onClick={()=>void act('delay',{reason:'客户时间调整'})}>延期并记录原因</Button><Button variant="secondary" onClick={()=>void act('request_manager')}>请求经理协助</Button></section><section className="action-stack"><strong>演示提醒</strong><Button data-testid="simulate-promise-due" variant="secondary" onClick={()=>void simulate('due_soon')}><ClockArrowUp size={15}/>模拟即将到期</Button><Button data-testid="simulate-promise-overdue" variant="danger" onClick={()=>void simulate('overdue')}><AlarmClock size={15}/>模拟承诺超时</Button></section>{workspace.enterprise.notifications[0]?<section><strong>飞书提醒卡片预览</strong><p>{workspace.enterprise.notifications[0].title}</p><small>{workspace.enterprise.notifications[0].body}</small></section>:null}</aside></section>
}
