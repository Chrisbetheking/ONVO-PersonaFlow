import { describe, expect, it } from 'vitest'
import { fallbackBootstrap, fallbackWorkspace } from './demoData'
import { addLocalFollowupEvent, createLocalCampaignTasks, createLocalGeneration, createLocalReview } from './localDemo'

describe('local demo workflow', () => {
  it('keeps evidence and risk annotations on distinct clickable sentences', () => {
    const advisor = fallbackBootstrap.advisors.find(item => item.id === 'advisor-hz-02')!
    const vehicle = fallbackBootstrap.vehicles.find(item => item.id === 'l80')!
    const opportunity = fallbackWorkspace.opportunities.find(item => item.id === 'opp-chen-l80')!
    const result = createLocalGeneration({ advisor, vehicle, opportunity, campaignName: '家庭体验', campaignBrief: '按真实家庭物品体验。', platforms: ['私聊跟进'] })
    const variant = result.variants[0]
    expect(variant.claims[0].text).not.toBe(variant.risk_annotations[0].text)
    expect(variant.body).toContain(variant.claims[0].text)
    expect(variant.body).toContain(variant.risk_annotations[0].text)
  })

  it('submits complete local review data without truncation', () => {
    const advisor = fallbackBootstrap.advisors[0]
    const vehicle = fallbackBootstrap.vehicles[0]
    const result = createLocalGeneration({ advisor, vehicle, campaignName: '完整审核', campaignBrief: '保留完整正文。', platforms: ['朋友圈'] })
    result.variants[0].body += '\n\n完整尾部内容不能丢失。'
    const review = createLocalReview(result, result.variants[0])
    expect(review.body).toContain('完整尾部内容不能丢失')
    expect(review.claims).toEqual(result.variants[0].claims)
    expect(review.risk_annotations).toEqual(result.variants[0].risk_annotations)
    expect(review.evidence).toEqual(result.evidence)
  })

  it.each([
    ['customer-chen', '周辰'],
    ['customer-xu', '林悦'],
  ])('records booking with the supplied owning advisor for %s', (customerId, actor) => {
    const followup = fallbackWorkspace.followups.find(item => item.customer_id === customerId)!
    const updated = addLocalFollowupEvent(followup, {
      type: 'test_drive_booked',
      actor,
      title: '已预约试驾',
      content: '2026-07-23 14:00 到店。',
      scheduled_at: '2026-07-23 14:00',
      items: ['日常行李'],
      notes: '真实场景体验',
    })
    expect(updated.events[updated.events.length - 1]?.actor).toBe(actor)
    expect(updated.stage).toBe('已预约试驾')
  })

  it('creates task-level campaign details for every advisor and platform', () => {
    const campaign = fallbackWorkspace.campaigns[0]
    const vehicle = fallbackBootstrap.vehicles.find(item => item.id === campaign.vehicle_id)!
    const tasks = createLocalCampaignTasks(campaign, fallbackBootstrap.advisors, vehicle)
    expect(tasks).toHaveLength(campaign.target_advisors.length * campaign.channels.length)
    expect(tasks.every(task => task.advisor_name && task.platform && task.result)).toBe(true)
  })
})
