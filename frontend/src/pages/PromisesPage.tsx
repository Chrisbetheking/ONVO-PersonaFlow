import { useState } from 'react'
import { AlarmClock, CheckCircle2, ClockArrowUp, ExternalLink, UserRoundCheck } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { navigate } from '../app/router'
import { Button, Dialog, EmptyState, StatusPill } from '../shared/ui'

const statusLabel: Record<string,string> = { pending_confirmation:'待确认',pending_execution:'待执行',completed:'已完成',delayed:'已延期',cancelled:'已取消',overdue:'已超时' }
type ActionForm = { action: 'reschedule' | 'delay' | 'complete' | 'request_manager'; title: string } | null

export function PromisesPage(){
  const {workspace,boot,dataMode,refreshWorkspace,updateEnterpriseLocal,showToast}=useApp()
  const items=workspace.enterprise.promises
  const [selectedId,setSelectedId]=useState(items[0]?.id||'')
  const [form,setForm]=useState<ActionForm>(null)
  const [dueAt,setDueAt]=useState('2026-07-21T18:00')
  const [reason,setReason]=useState('')
  const [evidence,setEvidence]=useState('')
  const [working,setWorking]=useState(false)
  const selected=items.find(i=>i.id===selectedId)||items[0]

  async function act(action:string,payload:Record<string,unknown>={}){
    if(!selected)return
    setWorking(true)
    try {
      if(dataMode==='fallback') {
        const now=new Date().toISOString()
        updateEnterpriseLocal(current=>({...current,promises:current.promises.map(item=>item.id===selected.id?{
          ...item,
          status:action==='complete'?'completed':action==='confirm'?'pending_execution':action==='delay'||action==='reschedule'?'delayed':item.status,
          due_at:action==='reschedule'&&payload.due_at?String(payload.due_at):item.due_at,
          overdue:false,
          completed_at:action==='complete'?now:item.completed_at,
          delay_reason:action==='delay'||action==='reschedule'?String(payload.reason||''):item.delay_reason,
          manager_attention:action==='request_manager'?true:item.manager_attention,
          manager_reason:action==='request_manager'?String(payload.reason||''):item.manager_reason,
          evidence:action==='complete'?[...item.evidence,String(payload.evidence||'')].filter(Boolean):item.evidence,
        }:item)}))
      } else {await api.promiseAction(selected.id,action,payload);await refreshWorkspace()}
      showToast('承诺状态已更新并写入客户时间线与审计日志')
      setForm(null);setReason('');setEvidence('')
    } catch(error){showToast(error instanceof Error?error.message:'承诺状态更新失败')} finally {setWorking(false)}
  }

  async function simulate(state:string){if(!selected)return;setWorking(true);try{if(dataMode==='fallback')updateEnterpriseLocal(current=>({...current,promises:current.promises.map(item=>item.id===selected.id?{...item,status:state==='overdue'?'overdue':'pending_execution',overdue:state==='overdue',manager_attention:state==='overdue'||item.manager_attention}:item)}));else{await api.simulatePromise(selected.id,state);await refreshWorkspace()}showToast('已生成模拟提醒；飞书卡片仅为预览，尚未真实发送')}finally{setWorking(false)}}
  if(!selected)return <EmptyState title="暂无承诺" description="客户沟通中的明确承诺会进入台账，并由顾问确认。"/>
  const advisor=boot.advisors.find(i=>i.id===selected.advisor_id)
  const customer=workspace.followups.find(item=>item.customer_id===selected.customer_id)

  return <section className="enterprise-split-layout promises-page" data-testid="promise-ledger">
    <aside className="enterprise-list-pane"><div className="pane-toolbar"><strong>承诺台账</strong><span>{items.length}</span></div><div className="compact-queue">{items.map(item=><button key={item.id} data-testid={`promise-${item.id}`} className={selected.id===item.id?'compact-row active':'compact-row'} onClick={()=>setSelectedId(item.id)}><span><strong>{item.commitment}</strong><small>{item.due_at} · {boot.advisors.find(a=>a.id===item.advisor_id)?.name}</small></span><StatusPill tone={item.overdue?'danger':item.status==='completed'?'success':'warning'}>{statusLabel[item.status]||item.status}</StatusPill></button>)}</div></aside>
    <main className="enterprise-detail-pane"><header className="detail-heading"><div><p className="eyebrow">{selected.demo_flag?'演示承诺':'客户承诺'}</p><h2>{selected.commitment}</h2><button className="source-message-link" onClick={()=>navigate('followup',{customer:selected.customer_id})}>{selected.original_message}<ExternalLink size={14}/></button></div><StatusPill tone={selected.overdue?'danger':selected.status==='completed'?'success':'warning'}>{statusLabel[selected.status]||selected.status}</StatusPill></header><section className="promise-facts"><div><UserRoundCheck/><span><strong>负责人</strong><p>{advisor?.name||selected.advisor_id}</p></span></div><div><AlarmClock/><span><strong>截止时间</strong><p>{selected.due_at}</p></span></div><div><CheckCircle2/><span><strong>完成条件</strong><p>{selected.completion_criteria}</p></span></div></section><section><strong>来源与证据</strong><p>{selected.source}</p>{selected.evidence.map(e=><blockquote key={e}>{e}</blockquote>)}{selected.delay_reason?<p>延期原因：{selected.delay_reason}</p>:null}{selected.manager_reason?<p>请求经理协助：{selected.manager_reason}</p>:null}</section><div className="demo-notice">承诺由沟通内容识别后进入待确认状态。状态变化会写入{customer?.customer_name||'客户'}时间线；飞书提醒只做 Demo 预览。</div></main>
    <aside className="enterprise-action-pane"><section className="action-stack"><strong>顾问操作</strong><Button data-testid="confirm-promise" disabled={selected.status!=='pending_confirmation'} loading={working} onClick={()=>void act('confirm')}>确认承诺</Button><Button data-testid="complete-promise" disabled={!['pending_execution','delayed','overdue'].includes(selected.status)} onClick={()=>setForm({action:'complete',title:'填写完成证据'})}>标记完成</Button><Button variant="secondary" onClick={()=>setForm({action:'reschedule',title:'修改截止时间'})}>修改截止时间</Button><Button variant="secondary" onClick={()=>setForm({action:'delay',title:'延期并说明原因'})}>延期</Button><Button variant="secondary" onClick={()=>setForm({action:'request_manager',title:'请求经理协助'})}>请求经理协助</Button></section><section className="action-stack"><strong>演示提醒</strong><Button data-testid="simulate-promise-due" variant="secondary" loading={working} onClick={()=>void simulate('due_soon')}><ClockArrowUp size={15}/>模拟即将到期</Button><Button data-testid="simulate-promise-overdue" variant="danger" loading={working} onClick={()=>void simulate('overdue')}><AlarmClock size={15}/>模拟承诺超时</Button></section>{workspace.enterprise.notifications[0]?<section><strong>飞书提醒卡片 Demo 预览</strong><p>{workspace.enterprise.notifications[0].title}</p><small>{workspace.enterprise.notifications[0].body}</small><StatusPill tone="neutral">尚未真实发送</StatusPill></section>:null}</aside>

    <Dialog open={Boolean(form)} title={form?.title||''} description="变更原因和完成证据将写入当前工作区的时间线与审计记录。" onClose={()=>setForm(null)} testId="promise-action-dialog" footer={<><Button variant="secondary" onClick={()=>setForm(null)}>取消</Button><Button data-testid="confirm-promise-action" loading={working} disabled={(form?.action==='complete'&&!evidence.trim())||(['delay','reschedule','request_manager'].includes(form?.action||'')&&!reason.trim())} onClick={()=>form&&void act(form.action,{due_at:dueAt,reason,evidence})}>确认</Button></>}>
      {form?.action==='reschedule'?<label className="field-label">新的截止时间<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>:null}
      {form?.action==='complete'?<label className="field-label">完成证据或备注<textarea data-testid="promise-evidence" value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="例如：已发送空间体验清单，客户确认收到。"/></label>:<label className="field-label">原因<textarea data-testid="promise-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明变更或请求协助的具体原因。"/></label>}
    </Dialog>
  </section>
}
