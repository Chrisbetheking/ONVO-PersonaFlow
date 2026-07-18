import { useState } from 'react'
import { useApp } from '../app/AppContext'
import { CampaignPanel } from '../features/batch-campaign/CampaignPanel'
import { EmptyState } from '../shared/ui'

export function CampaignPage() {
  const { workspace, runCampaign, showToast } = useApp()
  const [runningId, setRunningId] = useState('')

  async function run(id: string) {
    const campaign = workspace.campaigns.find(item => item.id === id)
    if (!campaign) return
    setRunningId(id)
    try {
      const summary = await runCampaign(campaign)
      showToast(`批量任务完成：${summary.ready || 0} 条可进入审核`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量任务失败')
    } finally {
      setRunningId('')
    }
  }

  if (!workspace.campaigns.length) return <EmptyState title="还没有活动任务" description="总部或门店创建活动后，可选择顾问、车型和渠道进行批量生成。" />
  return <section className="campaign-page"><div className="campaign-note"><strong>批量不是复制粘贴</strong><p>同一活动只提供共同事实和目标，顾问客群、城市和表达方式仍会参与每条内容生成；发布前需要抽样审核。</p></div>{workspace.campaigns.map(item => <CampaignPanel key={item.id} campaign={item} running={runningId === item.id} onRun={() => void run(item.id)} />)}</section>
}
