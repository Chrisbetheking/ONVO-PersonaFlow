import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { navigate } from '../app/router'
import { CampaignPanel } from '../features/batch-campaign/CampaignPanel'
import { EmptyState } from '../shared/ui'

export function CampaignPage() {
  const { workspace, runCampaign, retryCampaignTask, retryFailedCampaignTasks, submitCampaignTaskReview, showToast } = useApp()
  const [runningId, setRunningId] = useState('')
  const [retryingTaskId, setRetryingTaskId] = useState('')
  const [retryingFailedId, setRetryingFailedId] = useState('')

  async function run(id: string) {
    const campaign = workspace.campaigns.find(item => item.id === id)
    if (!campaign) return
    setRunningId(id)
    try {
      const updated = await runCampaign(campaign)
      showToast(`批量任务完成：${updated.task_summary.ready || 0} 条可进入审核`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量任务失败')
    } finally {
      setRunningId('')
    }
  }

  async function retryTask(campaignId: string, taskId: string) {
    setRetryingTaskId(taskId)
    try {
      const updated = await retryCampaignTask(campaignId, taskId)
      const task = updated.tasks.find(item => item.id === taskId)
      showToast(task?.status === 'failed' ? `重试仍失败：${task.failure_reason}` : '任务重试成功，可进入审核')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '任务重试失败')
    } finally {
      setRetryingTaskId('')
    }
  }

  async function retryFailed(campaignId: string) {
    setRetryingFailedId(campaignId)
    try {
      const updated = await retryFailedCampaignTasks(campaignId)
      showToast(`失败任务已重试，当前仍失败 ${updated.task_summary.failed} 条`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '失败任务重试失败')
    } finally {
      setRetryingFailedId('')
    }
  }

  async function openReview(campaignId: string, taskId: string) {
    try {
      const review = await submitCampaignTaskReview(campaignId, taskId)
      showToast('批量生成结果已进入门店审核')
      navigate('review', { review: review.id })
    } catch (error) {
      showToast(error instanceof Error ? error.message : '送审失败')
    }
  }

  async function sampleReview(campaignId: string) {
    const campaign = workspace.campaigns.find(item => item.id === campaignId)
    const sample = campaign?.tasks.find(item => item.result && item.status !== 'failed' && item.status !== 'submitted')
    if (!sample) return
    await openReview(campaignId, sample.id)
  }

  if (!workspace.campaigns.length) return <EmptyState title="还没有活动任务" description="总部或门店创建活动后，可选择顾问、车型和渠道进行批量生成。" />
  return <section className="campaign-page"><div className="campaign-note"><strong>批量不是复制粘贴</strong><p>同一活动只提供共同事实和目标，顾问客群、城市和表达方式仍会参与每条内容生成；发布前需要抽样审核。</p></div>{workspace.campaigns.map(item => <CampaignPanel key={item.id} campaign={item} running={runningId === item.id} retryingTaskId={retryingTaskId} retryingFailed={retryingFailedId === item.id} onRun={() => void run(item.id)} onRetryTask={taskId => void retryTask(item.id, taskId)} onRetryFailed={() => void retryFailed(item.id)} onOpenReview={taskId => void openReview(item.id, taskId)} onSampleReview={() => void sampleReview(item.id)} />)}</section>
}
