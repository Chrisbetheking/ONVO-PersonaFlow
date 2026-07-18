import { AlertCircle, CheckCircle2, CircleDashed, Play, RotateCcw, UsersRound } from 'lucide-react'
import type { Campaign } from '../../types'
import { Button, StatusPill } from '../../shared/ui'

export function CampaignPanel({ campaign, running, onRun }: { campaign: Campaign; running: boolean; onRun: () => void }) {
  return (
    <article className="campaign-panel">
      <header><div><p className="eyebrow">{campaign.created_by}</p><h2>{campaign.name}</h2><p>{campaign.brief}</p></div><StatusPill tone={campaign.status === 'completed' ? 'success' : 'info'}>{campaign.status === 'completed' ? '本轮已完成' : '可执行'}</StatusPill></header>
      <div className="campaign-definition"><div><UsersRound size={18} /><span><strong>{campaign.target_advisors.length} 位顾问</strong><p>按门店、客群和表达方式分别生成</p></span></div><div><CircleDashed size={18} /><span><strong>{campaign.channels.join('、')}</strong><p>每个平台使用独立内容结构</p></span></div></div>
      <div className="campaign-progress">
        <div><span>全部任务</span><strong>{campaign.task_summary.total}</strong></div>
        <div><span><CheckCircle2 size={14} />可审核</span><strong>{campaign.task_summary.ready}</strong></div>
        <div><span><CircleDashed size={14} />待复核</span><strong>{campaign.task_summary.pending_review}</strong></div>
        <div><span><AlertCircle size={14} />失败</span><strong>{campaign.task_summary.failed}</strong></div>
      </div>
      <footer><span>最近执行：{campaign.last_run}</span><div>{campaign.task_summary.failed ? <Button variant="secondary"><RotateCcw size={16} />仅重试失败项</Button> : null}<Button loading={running} onClick={onRun}><Play size={16} />执行本轮批量任务</Button></div></footer>
    </article>
  )
}
