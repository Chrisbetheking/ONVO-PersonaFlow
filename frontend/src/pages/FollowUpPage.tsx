import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, Clock3, MapPin, MessageCirclePlus, PanelRightClose, PanelRightOpen, Save, Sparkles, UserRound } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { FollowupTimeline } from '../features/lead-follow-up/FollowupTimeline'
import { ActionMenu, Button, DemoBadge, Dialog, EmptyState, ErrorState, StatusPill } from '../shared/ui'
import type { FollowupEvent, LeadAnalysis } from '../types'

const channelOptions = [
  ['all', '全部渠道'], ['授权沟通 Demo', '授权私聊 Demo'], ['电话记录 Demo', '电话记录 Demo'],
  ['到店记录', '到店记录'], ['系统事件', '系统事件'], ['人工补录', '人工补录'],
] as const

export function FollowUpPage({ params }: { params: URLSearchParams }) {
  const { boot, workspace, addFollowupEvent, toggleMemory, dataMode, showToast, refreshWorkspace, updateEnterpriseLocal } = useApp()
  const requested = params.get('customer')
  const [customerId, setCustomerId] = useState(requested || workspace.followups[0]?.customer_id || '')
  const [channel, setChannel] = useState('all')
  const [message, setMessage] = useState('')
  const [composerMode, setComposerMode] = useState<'customer' | 'advisor'>('customer')
  const [saving, setSaving] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<FollowupEvent | null>(null)
  const [feedbackText, setFeedbackText] = useState('家里两个孩子，L80 第三排启用后后备箱够不够用？\n周末可以预约试驾吗？\nBaaS 和全购怎么选？')
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingTime, setBookingTime] = useState('2026-07-19T14:30')
  const [bookingItems, setBookingItems] = useState('儿童推车、两个登机箱')
  const [bookingNotes, setBookingNotes] = useState('按满员状态体验装载和周末出行路线。')
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [contextCollapsed, setContextCollapsed] = useState(false)
  const followup = workspace.followups.find(item => item.customer_id === customerId) || workspace.followups[0]
  const advisor = boot.advisors.find(item => item.id === followup?.advisor_id)
  const vehicle = boot.vehicles.find(item => item.id === followup?.vehicle_id)

  useEffect(() => {
    if (requested && workspace.followups.some(item => item.customer_id === requested)) setCustomerId(requested)
  }, [requested, workspace.followups])

  const activeMemories = useMemo(() => followup?.memories.filter(item => item.active) || [], [followup])
  const filteredEvents = useMemo(() => (followup?.events || []).filter(event => {
    if (channel === 'all') return true
    return (event.source_label || event.type).includes(channel)
  }), [followup?.events, channel])

  if (!followup) return <EmptyState title="还没有客户沟通记录" description="从内容作战台记录发送或补录客户回复后，会在这里形成会话。" />

  async function addMessage() {
    if (!message.trim()) return
    setSaving(true); setError('')
    try {
      const isCustomer = composerMode === 'customer'
      await addFollowupEvent(followup.customer_id, {
        type: isCustomer ? 'customer_message' : 'advisor_note',
        actor: isCustomer ? followup.customer_name : advisor?.name || '顾问',
        title: isCustomer ? '人工补录客户回复' : '顾问发送记录 Demo',
        content: message.trim(),
        status: isCustomer ? 'received' : 'completed',
        source_label: isCustomer ? '人工补录' : '授权沟通 Demo',
        sync_status: dataMode === 'local_demo' ? '本地工作区' : '演示同步完成',
      })
      setMessage('')
      showToast(isCustomer ? '客户回复已加入会话并更新记忆' : '顾问发送记录已加入会话')
    } catch (caught) { setError(caught instanceof Error ? caught.message : '补录失败') } finally { setSaving(false) }
  }

  async function convertEvent(event: FollowupEvent, action: 'memory' | 'concern' | 'promise' | 'next_action' | 'manager_help') {
    const note = action === 'promise' ? '根据该消息在 24 小时内完成确认' : ''
    try {
      if (dataMode === 'local_demo') {
        const now = new Date().toISOString()
        updateEnterpriseLocal(current => {
          if (action === 'promise') return { ...current, promises: [{ id: `local-promise-${Date.now()}`, customer_id: followup.customer_id, advisor_id: followup.advisor_id, original_message: event.content, source_event_id: event.id, commitment: note, due_at: '24 小时内', completion_criteria: '顾问提交完成备注', status: 'pending_confirmation', source: '客户沟通转承诺 · 本地演示', created_at: now, remind_at: '', overdue: false, manager_attention: false, evidence: [], demo_flag: true }, ...current.promises] }
          if (action === 'next_action') return { ...current, customer_profiles: current.customer_profiles.map(customer => customer.id === followup.customer_id ? { ...customer, next_best_actions: [{ id: `local-nba-${Date.now()}`, action: '根据客户最新消息完成下一步沟通', reason: event.content, due_at: '24 小时内', owner: advisor?.name || '当前顾问', risk: '未及时回应会降低客户信任', required_materials: [], manager_help: false, status: '系统建议' }, ...customer.next_best_actions] } : customer) }
          if (action === 'manager_help') return { ...current, quality_signals: [{ id: `local-manager-${Date.now()}`, advisor_id: followup.advisor_id, customer_id: followup.customer_id, category: '经理协助', risk_level: 'medium', status: 'pending_review', original_message: event.content, trigger_rule: '顾问人工请求经理协助', system_explanation: '该客户消息需要经理共同判断。', fact_ids: [], repeat_count: 1, employee_response: '', manager_decision: '', decision_reason: '', created_at: now, demo_flag: true }, ...current.quality_signals] }
          return current
        })
      } else {
        await api.convertFollowupEvent(followup.customer_id, event.id, action, note)
        await refreshWorkspace()
      }
      showToast({ memory: '已转为客户记忆', concern: '已转为客户顾虑', promise: '已进入承诺台账，等待顾问确认', next_action: '已创建下一最佳行动', manager_help: '已进入经理待复核队列' }[action])
    } catch (caught) { showToast(caught instanceof Error ? caught.message : '转换失败') }
  }

  async function analyzeFeedback() {
    const messages = feedbackText.split('\n').map(item => item.trim()).filter(Boolean)
    if (!messages.length) return
    setAnalyzing(true)
    try { setAnalysis(await api.analyzeLeads(messages)) } catch (caught) { showToast(caught instanceof Error ? caught.message : '反馈分析失败') } finally { setAnalyzing(false) }
  }

  async function bookTestDrive() {
    if (!advisor || !bookingTime.trim()) return
    setBooking(true); setError('')
    try {
      const items = bookingItems.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean)
      const content = `${bookingTime} 到店。携带物品：${items.join('、') || '未填写'}。${bookingNotes}`
      await addFollowupEvent(followup.customer_id, {
        type: 'test_drive_booked', actor: advisor.name, title: '已预约家庭场景试驾', content,
        scheduled_at: bookingTime, items, notes: bookingNotes, status: 'completed', source_label: '到店记录', sync_status: dataMode === 'local_demo' ? '本地演示' : '工作区已记录',
      })
      setBookingOpen(false); showToast(`试驾预约已由${advisor.name}记录`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '试驾预约记录失败') } finally { setBooking(false) }
  }

  return (
    <section className={contextCollapsed ? "followup-page conversation-workbench right-rail-collapsed" : "followup-page conversation-workbench"}>
      <aside className="conversation-list" aria-label="客户会话列表">
        <div className="conversation-list-heading"><strong>客户沟通</strong><span>{workspace.followups.length}</span></div>
        {workspace.followups.map(item => { const itemAdvisor = boot.advisors.find(a => a.id === item.advisor_id); const last = item.events[item.events.length - 1]; return <button data-testid={`customer-row-${item.customer_id}`} key={item.customer_id} className={item.customer_id === followup.customer_id ? 'conversation-row active' : 'conversation-row'} onClick={() => { setCustomerId(item.customer_id); window.location.hash = `/followup?customer=${item.customer_id}` }}><span className="avatar">{item.customer_name.slice(0, 1)}</span><span><strong>{item.customer_name}</strong><small>{last?.content || item.next_action}</small><em>{itemAdvisor?.name || '未分配'} · {item.stage}</em></span></button> })}
      </aside>

      <section className="conversation-thread">
        <header className="conversation-header"><div><p className="eyebrow">{vehicle?.name || '客户沟通'}</p><h2>{followup.customer_name}</h2><p><UserRound size={14}/>{advisor?.name || '未找到顾问'} · {advisor?.store || '未分配门店'}</p></div><div><StatusPill tone="info">{followup.stage}</StatusPill><DemoBadge>{dataMode === 'live' ? '业务记录' : '授权沟通 Demo'}</DemoBadge><button className="header-rail-toggle" aria-label={contextCollapsed ? '展开客户上下文' : '收起客户上下文'} title={contextCollapsed ? '展开客户上下文' : '收起客户上下文'} onClick={() => setContextCollapsed(value => !value)}>{contextCollapsed ? <PanelRightOpen size={17}/> : <PanelRightClose size={17}/>}</button><Button data-testid="open-booking" onClick={() => setBookingOpen(true)}><CalendarCheck2 size={16}/>预约试驾</Button></div></header>
        <div className="conversation-channel-filter" data-testid="conversation-channel-filter">{channelOptions.map(([value, label]) => <button key={value} className={channel === value ? 'active' : ''} onClick={() => setChannel(value)}>{label}</button>)}</div>
        {error ? <ErrorState description={error}/> : null}
        <div className="conversation-scroll" data-testid="conversation-timeline"><FollowupTimeline events={filteredEvents} selectedId={selectedEvent?.id} onSelect={setSelectedEvent} renderActions={event => <><button data-testid={`event-to-promise-${event.id}`} className="message-primary-action" onClick={() => void convertEvent(event, 'promise')}>转为承诺</button><ActionMenu label="更多消息操作" align="left"><button role="menuitem" onClick={() => void convertEvent(event, 'memory')}>转为客户记忆</button><button role="menuitem" onClick={() => void convertEvent(event, 'concern')}>记录为顾虑</button><button role="menuitem" onClick={() => void convertEvent(event, 'next_action')}>创建下一行动</button><button role="menuitem" onClick={() => void convertEvent(event, 'manager_help')}>请求经理协助</button></ActionMenu></>} /></div>
        {selectedEvent ? <div className="event-source-drawer" data-testid="event-source-detail"><strong>原始来源</strong><p>{selectedEvent.source_label || '系统事件'}</p><small>{selectedEvent.sync_status || '未标记同步状态'} · {selectedEvent.time}</small></div> : null}
        <div className="reply-composer">
          <div className="composer-heading"><MessageCirclePlus size={18}/><strong>{composerMode === 'customer' ? '人工补录客户回复' : '记录顾问发送 Demo'}</strong><div><button className={composerMode === 'customer' ? 'active' : ''} onClick={() => setComposerMode('customer')}>客户回复</button><button className={composerMode === 'advisor' ? 'active' : ''} onClick={() => setComposerMode('advisor')}>顾问发送</button></div></div>
          <div className="quick-replies"><button onClick={() => setMessage('收到，我先按你家的真实人数和常带物品准备体验清单。')}>场景确认</button><button onClick={() => setMessage('我先核验最新价格和权益，再把有来源的版本发给你。')}>事实核验</button><button onClick={() => setMessage('我把这个问题请门店经理一起确认，确认后第一时间回复你。')}>经理协助</button></div>
          <textarea data-testid="followup-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="输入客户回复或顾问发送记录。"/>
          <div><small>{composerMode === 'customer' ? '人工补录会明确标记来源，并同步更新客户记忆。' : '这是授权沟通 Demo 记录，不会发送到真实平台。'}</small><Button data-testid="add-followup-message" loading={saving} disabled={!message.trim()} onClick={() => void addMessage()}><Save size={16}/>加入会话</Button></div>
        </div>
        <details className="feedback-analyzer"><summary>批量导入评论 / 私信并识别下一轮选题</summary><p>每行一条消息，结果用于识别意向、顾虑和建议回复，不会自动发送。</p><textarea value={feedbackText} onChange={event => setFeedbackText(event.target.value)}/><Button variant="secondary" loading={analyzing} onClick={() => void analyzeFeedback()}>分析反馈</Button>{analysis ? <div className="feedback-results"><div><strong>{analysis.high_intent}</strong><span>高意向</span></div><div><strong>{analysis.medium_intent}</strong><span>中意向</span></div><div><strong>{analysis.low_intent}</strong><span>低意向</span></div><section><strong>下一轮内容建议</strong>{analysis.next_content_topics.map(item => <p key={item}>{item}</p>)}</section></div> : null}</details>
      </section>

      <aside className="customer-context-panel"><section className="customer-properties"><div className="panel-title"><strong>客户上下文</strong><StatusPill tone="neutral">当前会话</StatusPill></div><dl><div><dt>负责顾问</dt><dd>{advisor?.name || '未找到顾问'}</dd></div><div><dt>目标车型</dt><dd>{vehicle?.name || followup.vehicle_id}</dd></div><div><dt>客户阶段</dt><dd>{followup.stage}</dd></div></dl></section><section className="next-action"><span>下一步行动</span><strong>{followup.next_action}</strong><p><Clock3 size={14}/>{followup.next_action_due}</p></section><section><div className="panel-title"><div><Sparkles size={17}/><strong>会影响下一次生成的记忆</strong></div><span>{activeMemories.length} 项启用</span></div><div className="memory-list">{followup.memories.map(memory => <article data-testid={`memory-${memory.id}`} key={memory.id}><div><strong>{memory.title}</strong><p>{memory.value}</p><small>{memory.source} · {memory.updated_at}</small></div><label><input type="checkbox" checked={memory.active} onChange={event => void toggleMemory(followup.customer_id, memory.id, event.target.checked)}/>启用</label></article>)}</div></section></aside>

      <Dialog open={bookingOpen} title="预约家庭场景试驾" description={`当前客户：${followup.customer_name} · 负责顾问：${advisor?.name || '未分配'}`} testId="booking-dialog" onClose={() => setBookingOpen(false)} footer={<><Button variant="secondary" onClick={() => setBookingOpen(false)}>取消</Button><Button data-testid="confirm-booking" loading={booking} disabled={!bookingTime.trim()} onClick={() => void bookTestDrive()}>确认预约</Button></>}>
        <label className="field-label">预约时间<input data-testid="booking-time" type="datetime-local" value={bookingTime} onChange={event => setBookingTime(event.target.value)}/></label>
        <label className="field-label">体验地点<div className="input-with-icon"><MapPin size={16}/><input value={advisor?.store || ''} readOnly/></div></label>
        <label className="field-label">携带物品<input data-testid="booking-items" value={bookingItems} onChange={event => setBookingItems(event.target.value)}/></label>
        <label className="field-label">体验备注<textarea data-testid="booking-notes" value={bookingNotes} onChange={event => setBookingNotes(event.target.value)}/></label>
        <small className="dialog-boundary">{dataMode === 'local_demo' ? '当前为本地演示预约，不会写入真实试驾系统。' : '当前记录保存在此浏览器工作区；接入真实试驾系统后可替换为预约接口。'}</small>
      </Dialog>
    </section>
  )
}
