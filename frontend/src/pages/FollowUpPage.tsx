import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, MessageCirclePlus, RotateCcw, Save, Sparkles } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../app/AppContext'
import { FollowupTimeline } from '../features/lead-follow-up/FollowupTimeline'
import { Button, EmptyState, StatusPill } from '../shared/ui'
import type { LeadAnalysis } from '../types'

export function FollowUpPage({ params }: { params: URLSearchParams }) {
  const { workspace, addFollowupEvent, toggleMemory, showToast } = useApp()
  const requested = params.get('customer')
  const [customerId, setCustomerId] = useState(requested || workspace.followups[0]?.customer_id || '')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedbackText, setFeedbackText] = useState('家里两个孩子，L80 第三排启用后后备箱够不够用？\n周末可以预约试驾吗？\nBaaS 和全购怎么选？')
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const followup = workspace.followups.find(item => item.customer_id === customerId) || workspace.followups[0]

  useEffect(() => {
    if (requested && workspace.followups.some(item => item.customer_id === requested)) setCustomerId(requested)
  }, [requested, workspace.followups])

  const activeMemories = useMemo(() => followup?.memories.filter(item => item.active) || [], [followup])

  if (!followup) return <EmptyState title="还没有客户跟进记录" description="从内容作战台记录发送或补录客户回复后，会在这里形成时间线。" />

  async function addReply() {
    if (!message.trim()) return
    setSaving(true)
    try {
      await addFollowupEvent(followup.customer_id, { type: 'customer_message', actor: followup.customer_name, title: '补录客户回复', content: message.trim(), status: 'received' })
      setMessage('')
      showToast('客户回复已加入时间线，并更新记忆')
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : '反馈分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  async function bookTestDrive() {
    await addFollowupEvent(followup.customer_id, { type: 'test_drive_booked', actor: '周辰', title: '已预约家庭场景试驾', content: '周日 14:30 到店，客户将携带儿童推车和两个登机箱进行装载体验。', status: 'completed' })
    showToast('试驾预约已记录')
  }

  return (
    <section className="followup-page">
      <div className="followup-header">
        <label>客户<select value={followup.customer_id} onChange={event => setCustomerId(event.target.value)}>{workspace.followups.map(item => <option key={item.customer_id} value={item.customer_id}>{item.customer_name}</option>)}</select></label>
        <div><StatusPill tone="info">{followup.stage}</StatusPill><Button onClick={() => void bookTestDrive()}><CalendarCheck2 size={16} />记录试驾预约</Button></div>
      </div>

      <div className="followup-grid">
        <section className="timeline-panel">
          <div className="section-title"><div><p className="eyebrow">客户时间线</p><h2>{followup.customer_name}的沟通与行动记录</h2></div><span>{followup.events.length} 条记录</span></div>
          <FollowupTimeline events={followup.events} />
          <div className="reply-composer">
            <div><MessageCirclePlus size={18} /><strong>补录客户回复或顾问备注</strong></div>
            <textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="例如：客户确认周日到店，并希望现场体验满员状态下的后备箱。" />
            <div><small>补录内容会明确标记来源，不会伪装成系统自动读取。</small><Button loading={saving} onClick={() => void addReply()}><Save size={16} />加入时间线</Button></div>
          </div>
          <details className="feedback-analyzer">
            <summary>批量导入评论 / 私信并识别下一轮选题</summary>
            <p>保留原有客户反馈分析能力。每行一条消息，结果用于识别意向、顾虑和建议回复。</p>
            <textarea value={feedbackText} onChange={event => setFeedbackText(event.target.value)} />
            <Button variant="secondary" loading={analyzing} onClick={() => void analyzeFeedback()}>分析反馈</Button>
            {analysis ? <div className="feedback-results"><div><strong>{analysis.high_intent}</strong><span>高意向</span></div><div><strong>{analysis.medium_intent}</strong><span>中意向</span></div><div><strong>{analysis.low_intent}</strong><span>低意向</span></div><section><strong>下一轮内容建议</strong>{analysis.next_content_topics.map(item => <p key={item}>{item}</p>)}</section></div> : null}
          </details>
        </section>

        <aside className="memory-panel">
          <div className="next-action"><span>下一步行动</span><strong>{followup.next_action}</strong><p>{followup.next_action_due}</p></div>
          <div className="panel-title"><div><Sparkles size={17} /><strong>会影响下一次生成的记忆</strong></div><span>{activeMemories.length} 项启用</span></div>
          <div className="memory-list">{followup.memories.map(memory => <article className={memory.active ? 'memory-item' : 'memory-item inactive'} key={memory.id}><div><StatusPill tone={memory.scope === 'customer' ? 'info' : 'neutral'}>{memory.scope === 'customer' ? '客户记忆' : '顾问客群记忆'}</StatusPill><label className="switch"><input type="checkbox" checked={memory.active} onChange={event => void toggleMemory(followup.customer_id, memory.id, event.target.checked)} /><span /></label></div><strong>{memory.title}</strong><p>{memory.value}</p><small>{memory.source} · {memory.updated_at}</small></article>)}</div>
          <div className="memory-impact"><RotateCcw size={17} /><div><strong>下一次生成会怎样变化</strong><p>系统会优先询问满员收纳和儿童用品，并避免只展示空车最大空间。</p></div></div>
        </aside>
      </div>
    </section>
  )
}
