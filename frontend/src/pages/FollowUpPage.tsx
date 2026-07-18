import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, Clock3, MapPin, MessageCirclePlus, RotateCcw, Save, Sparkles, UserRound } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { FollowupTimeline } from '../features/lead-follow-up/FollowupTimeline'
import { Button, Dialog, EmptyState, ErrorState, StatusPill } from '../shared/ui'
import type { LeadAnalysis } from '../types'

export function FollowUpPage({ params }: { params: URLSearchParams }) {
  const { boot, workspace, addFollowupEvent, toggleMemory, dataMode, showToast } = useApp()
  const requested = params.get('customer')
  const [customerId, setCustomerId] = useState(requested || workspace.followups[0]?.customer_id || '')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedbackText, setFeedbackText] = useState('家里两个孩子，L80 第三排启用后后备箱够不够用？\n周末可以预约试驾吗？\nBaaS 和全购怎么选？')
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingTime, setBookingTime] = useState('2026-07-19T14:30')
  const [bookingItems, setBookingItems] = useState('儿童推车、两个登机箱')
  const [bookingNotes, setBookingNotes] = useState('按满员状态体验装载和周末出行路线。')
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const followup = workspace.followups.find(item => item.customer_id === customerId) || workspace.followups[0]
  const advisor = boot.advisors.find(item => item.id === followup?.advisor_id)
  const vehicle = boot.vehicles.find(item => item.id === followup?.vehicle_id)

  useEffect(() => {
    if (requested && workspace.followups.some(item => item.customer_id === requested)) setCustomerId(requested)
  }, [requested, workspace.followups])

  const activeMemories = useMemo(() => followup?.memories.filter(item => item.active) || [], [followup])

  if (!followup) return <EmptyState title="还没有客户跟进记录" description="从内容作战台记录发送或补录客户回复后，会在这里形成时间线。" />

  async function addReply() {
    if (!message.trim()) return
    setSaving(true)
    setError('')
    try {
      await addFollowupEvent(followup.customer_id, { type: 'customer_message', actor: followup.customer_name, title: '补录客户回复', content: message.trim(), status: 'received' })
      setMessage('')
      showToast('客户回复已加入时间线，并更新记忆')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '补录失败')
    } finally {
      setSaving(false)
    }
  }

  async function analyzeFeedback() {
    const messages = feedbackText.split('\n').map(item => item.trim()).filter(Boolean)
    if (!messages.length) return
    setAnalyzing(true)
    try {
      setAnalysis(await api.analyzeLeads(messages))
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '反馈分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  async function bookTestDrive() {
    if (!advisor || !bookingTime.trim()) return
    setBooking(true)
    setError('')
    try {
      const items = bookingItems.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean)
      const content = `${bookingTime} 到店。携带物品：${items.join('、') || '未填写'}。${bookingNotes}`
      await addFollowupEvent(followup.customer_id, {
        type: 'test_drive_booked',
        actor: advisor.name,
        title: '已预约家庭场景试驾',
        content,
        scheduled_at: bookingTime,
        items,
        notes: bookingNotes,
        status: 'completed',
      })
      setBookingOpen(false)
      showToast(`试驾预约已由${advisor.name}记录`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '试驾预约记录失败')
    } finally {
      setBooking(false)
    }
  }

  return (
    <section className="followup-page conversation-workbench">
      <aside className="conversation-list" aria-label="客户会话列表">
        <div className="conversation-list-heading"><strong>客户沟通</strong><span>{workspace.followups.length}</span></div>
        {workspace.followups.map(item => {
          const itemAdvisor = boot.advisors.find(advisorItem => advisorItem.id === item.advisor_id)
          const last = item.events[item.events.length - 1]
          return <button data-testid={`customer-row-${item.customer_id}`} key={item.customer_id} className={item.customer_id === followup.customer_id ? 'conversation-row active' : 'conversation-row'} onClick={() => setCustomerId(item.customer_id)}>
            <span className="avatar">{item.customer_name.slice(0, 1)}</span>
            <span><strong>{item.customer_name}</strong><small>{last?.content || item.next_action}</small><em>{itemAdvisor?.name || '未分配'} · {item.stage}</em></span>
          </button>
        })}
      </aside>

      <section className="conversation-thread">
        <header className="conversation-header">
          <div><p className="eyebrow">{vehicle?.name || '客户跟进'}</p><h2>{followup.customer_name}</h2><p><UserRound size={14} />{advisor?.name || '未找到顾问'} · {advisor?.store || '未分配门店'}</p></div>
          <div><StatusPill tone="info">{followup.stage}</StatusPill><Button data-testid="open-booking" onClick={() => setBookingOpen(true)}><CalendarCheck2 size={16} />预约试驾</Button></div>
        </header>
        {error ? <ErrorState description={error} /> : null}
        <div className="conversation-scroll" data-testid="conversation-timeline"><FollowupTimeline events={followup.events} /></div>
        <div className="reply-composer">
          <div><MessageCirclePlus size={18} /><strong>补录客户回复或顾问备注</strong></div>
          <textarea data-testid="followup-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="例如：客户确认周日到店，并希望现场体验满员状态下的后备箱。" />
          <div><small>{dataMode === 'fallback' ? '本地演示：内容只保存在当前浏览器。' : '补录内容会保留来源并更新客户记忆。'}</small><Button data-testid="add-followup-message" loading={saving} disabled={!message.trim()} onClick={() => void addReply()}><Save size={16} />加入时间线</Button></div>
        </div>
        <details className="feedback-analyzer">
          <summary>批量导入评论 / 私信并识别下一轮选题</summary>
          <p>每行一条消息，结果用于识别意向、顾虑和建议回复，不会自动发送。</p>
          <textarea value={feedbackText} onChange={event => setFeedbackText(event.target.value)} />
          <Button variant="secondary" loading={analyzing} onClick={() => void analyzeFeedback()}>分析反馈</Button>
          {analysis ? <div className="feedback-results"><div><strong>{analysis.high_intent}</strong><span>高意向</span></div><div><strong>{analysis.medium_intent}</strong><span>中意向</span></div><div><strong>{analysis.low_intent}</strong><span>低意向</span></div><section><strong>下一轮内容建议</strong>{analysis.next_content_topics.map(item => <p key={item}>{item}</p>)}</section></div> : null}
        </details>
      </section>

      <aside className="customer-context-panel">
        <section className="customer-properties">
          <div className="panel-title"><strong>客户上下文</strong><StatusPill tone="neutral">当前会话</StatusPill></div>
          <dl><div><dt>负责顾问</dt><dd>{advisor?.name || '未找到顾问'}</dd></div><div><dt>目标车型</dt><dd>{vehicle?.name || followup.vehicle_id}</dd></div><div><dt>客户阶段</dt><dd>{followup.stage}</dd></div></dl>
        </section>
        <section className="next-action"><span>下一步行动</span><strong>{followup.next_action}</strong><p><Clock3 size={14} />{followup.next_action_due}</p></section>
        <section>
          <div className="panel-title"><div><Sparkles size={17} /><strong>会影响下一次生成的记忆</strong></div><span>{activeMemories.length} 项启用</span></div>
          <div className="memory-list">{followup.memories.map(memory => <article data-testid={`memory-${memory.id}`} className={memory.active ? 'memory-item' : 'memory-item inactive'} key={memory.id}><div><StatusPill tone={memory.scope === 'customer' ? 'info' : 'neutral'}>{memory.scope === 'customer' ? '客户记忆' : '顾问客群记忆'}</StatusPill><label className="switch"><input type="checkbox" checked={memory.active} onChange={event => void toggleMemory(followup.customer_id, memory.id, event.target.checked)} /><span /></label></div><strong>{memory.title}</strong><p>{memory.value}</p><small>{memory.source} · {memory.updated_at}</small></article>)}</div>
        </section>
        <div className="memory-impact"><RotateCcw size={17} /><div><strong>下一次生成会怎样变化</strong><p>系统会优先询问当前启用记忆中的家庭结构、空间顾虑和预约偏好。</p></div></div>
      </aside>

      <Dialog
        open={bookingOpen}
        title="确认试驾预约"
        description={`为${followup.customer_name}安排体验，记录会进入客户时间线。`}
        onClose={() => setBookingOpen(false)}
        testId="booking-dialog"
        footer={<><Button variant="ghost" onClick={() => setBookingOpen(false)}>取消</Button><Button data-testid="confirm-booking" loading={booking} disabled={!bookingTime.trim() || !advisor} onClick={() => void bookTestDrive()}>确认预约</Button></>}
      >
        <div className="booking-summary"><span className="avatar large">{followup.customer_name.slice(0, 1)}</span><div><strong>{followup.customer_name}</strong><p>{advisor?.name || '未找到顾问'} · {advisor?.store || '未分配门店'}</p></div></div>
        <label className="field-label">预约时间<input data-testid="booking-time" type="datetime-local" value={bookingTime} onChange={event => setBookingTime(event.target.value)} /></label>
        <label className="field-label">体验地点<div className="input-with-icon"><MapPin size={16} /><input value={advisor?.store || ''} readOnly /></div></label>
        <label className="field-label">携带物品<input data-testid="booking-items" value={bookingItems} onChange={event => setBookingItems(event.target.value)} /></label>
        <label className="field-label">体验备注<textarea data-testid="booking-notes" value={bookingNotes} onChange={event => setBookingNotes(event.target.value)} /></label>
        <small className="dialog-boundary">{dataMode === 'fallback' ? '当前为本地演示预约，不会写入真实试驾系统。' : '当前记录保存在此浏览器工作区；接入真实试驾系统后可替换为预约接口。'}</small>
      </Dialog>
    </section>
  )
}
