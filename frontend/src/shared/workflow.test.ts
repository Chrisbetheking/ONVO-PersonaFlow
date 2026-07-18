import { describe, expect, it } from 'vitest'
import { annotateText, canSubmitVariant, statusLabel } from './workflow'

describe('content trust workflow', () => {
  it('links fact statements and risk statements to the side panel', () => {
    const text = '乐道 L80 定位为家庭 SUV。当前官方页面显示 24.28 万元起。'
    const segments = annotateText(text, [
      { id: 'claim-1', text: '当前官方页面显示 24.28 万元起。', evidence_id: 'evidence-price', field: '价格' },
    ], [
      { id: 'risk-1', text: '当前官方页面显示 24.28 万元起。', level: 'info', rule: '动态事实', reason: '需复核', suggestion: '发布当天复核' },
    ])
    expect(segments.some(item => item.type === 'risk' || item.type === 'claim')).toBe(true)
  })

  it('blocks submission when evidence is missing or blocking risks remain', () => {
    expect(canSubmitVariant('这是一段足够长的正文，用于测试提交条件。', 0, 0)).toBe(false)
    expect(canSubmitVariant('这是一段足够长的正文，用于测试提交条件。', 1, 1)).toBe(false)
    expect(canSubmitVariant('这是一段足够长的正文，用于测试提交条件。', 1, 0)).toBe(true)
  })

  it('maps workflow statuses to readable labels', () => {
    expect(statusLabel('approved')).toBe('已批准')
    expect(statusLabel('in_progress')).toBe('处理中')
  })
})
