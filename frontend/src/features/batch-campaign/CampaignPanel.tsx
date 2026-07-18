import { AlertCircle, CheckCircle2, CircleDashed, Eye, Play, RotateCcw, SearchCheck, UsersRound } from 'lucide-react'
import type { Campaign, CampaignTask } from '../../types'
import { Button, StatusPill } from '../../shared/ui'

function taskTone(status: CampaignTask['status']) {
  if (status === 'failed') return 'danger'
  if (status === 'ready' || status === 'submitted') return 'success'
  return 'warning'
}

function taskLabel(status: CampaignTask['status']) {
  return { ready: '可审核', needs_review: '需复核', failed: '失败', submitted: '已送审' }[status]
}

export function CampaignPanel({
  campaign,
  running,
  retryingTaskId,
  retryingFailed,
  onRun,
  onRetryTask,
  onRetryFailed,
  onOpenReview,
  onSampleReview,
}: {
  campaign: Campaign
  running: boolean
  retryingTaskId: string
  retryingFailed: boolean
  onRun: () => void
  onRetryTask: (taskId: string) => void
  onRetryFailed: () => void
  onOpenReview: (taskId: string) => void
  onSampleReview: () => void
}) {
  const failedTasks = campaign.tasks.filter(task => task.status === 'failed')
  const reviewableTasks = campaign.tasks.filter(task => task.result && task.status !== 'failed')
  return (
    <article className="campaign-panel" data-testid={`campaign-${campaign.id}`}>
      <header><div><p className="eyebrow">{campaign.created_by}</p><h2>{campaign.name}</h2><p>{campaign.brief}</p></div><StatusPill tone={campaign.status === 'completed' ? 'success' : 'info'}>{campaign.status === 'completed' ? '本轮已完成' : '可执行'}</StatusPill></header>
      <div className="campaign-definition"><div><UsersRound size={18} /><span><strong>{campaign.target_advisors.length} 位顾问</strong><p>按门店、客群和表达方式分别生成</p></span></div><div><CircleDashed size={18} /><span><strong>{campaign.channels.join('、')}</strong><p>每个平台使用独立内容结构</p></span></div></div>
      <div className="campaign-progress">
        <div><span>全部任务</span><strong>{campaign.task_summary.total}</strong></div>
        <div><span><CheckCircle2 size={14} />可审核</span><strong>{campaign.task_summary.ready}</strong></div>
        <div><span><CircleDashed size={14} />待复核</span><strong>{campaign.task_summary.pending_review}</strong></div>
        <div><span><AlertCircle size={14} />失败</span><strong>{campaign.task_summary.failed}</strong></div>
      </div>

      {campaign.tasks.length ? <div className="campaign-task-table" data-testid="campaign-task-table">
        <div className="campaign-task-head"><span>顾问</span><span>平台</span><span>状态</span><span>失败原因 / 重试</span><span>操作</span></div>
        {campaign.tasks.map(task => <div className="campaign-task-row" key={task.id} data-testid={`campaign-task-${task.id}`}>
          <span><strong>{task.advisor_name}</strong><small>{task.advisor_id}</small></span>
          <span>{task.platform}</span>
          <span><StatusPill tone={taskTone(task.status)}>{taskLabel(task.status)}</StatusPill></span>
          <span>{task.failure_reason || `已重试 ${task.retry_count} 次`}</span>
          <span className="campaign-task-actions">
            {task.status === 'failed' ? <Button data-testid={`retry-task-${task.id}`} variant="secondary" loading={retryingTaskId === task.id} onClick={() => onRetryTask(task.id)}><RotateCcw size={14} />重试</Button> : null}
            {task.result ? <Button data-testid={`open-task-review-${task.id}`} variant="ghost" onClick={() => onOpenReview(task.id)}><Eye size={14} />送审</Button> : null}
          </span>
        </div>)}
      </div> : <div className="campaign-empty-tasks">执行本轮任务后，这里会显示每位顾问、每个平台的真实任务明细。</div>}

      <footer><span>最近执行：{campaign.last_run}</span><div>
        <Button data-testid={`sample-review-${campaign.id}`} variant="ghost" disabled={!reviewableTasks.length} onClick={onSampleReview}><SearchCheck size={16} />抽样审核</Button>
        <Button data-testid={`retry-failed-${campaign.id}`} variant="secondary" loading={retryingFailed} disabled={!failedTasks.length} onClick={onRetryFailed}><RotateCcw size={16} />重试全部失败项</Button>
        <Button data-testid={`run-campaign-${campaign.id}`} loading={running} onClick={onRun}><Play size={16} />执行本轮批量任务</Button>
      </div></footer>
    </article>
  )
}
