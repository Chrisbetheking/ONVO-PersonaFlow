import type { Claim, RiskAnnotation } from '../types'

export type AnnotatedSegment = {
  text: string
  type: 'plain' | 'claim' | 'risk'
  refId?: string
}

export function annotateText(text: string, claims: Claim[], risks: RiskAnnotation[]): AnnotatedSegment[] {
  const marks: Array<{ start: number; end: number; type: 'claim' | 'risk'; refId: string }> = []
  claims.forEach(item => {
    const needle = item.text.trim()
    const start = needle ? text.indexOf(needle) : -1
    if (start >= 0) marks.push({ start, end: start + needle.length, type: 'claim', refId: item.evidence_id })
  })
  risks.forEach(item => {
    const needle = item.text.trim()
    const start = needle ? text.indexOf(needle) : -1
    if (start >= 0) marks.push({ start, end: start + needle.length, type: 'risk', refId: item.id })
  })
  marks.sort((a, b) => a.start - b.start || (a.type === 'risk' ? -1 : 1))
  const accepted: typeof marks = []
  marks.forEach(mark => {
    const previous = accepted[accepted.length - 1]
    if (!previous || mark.start >= previous.end) accepted.push(mark)
  })
  if (!accepted.length) return [{ text, type: 'plain' }]
  const segments: AnnotatedSegment[] = []
  let cursor = 0
  accepted.forEach(mark => {
    if (mark.start > cursor) segments.push({ text: text.slice(cursor, mark.start), type: 'plain' })
    segments.push({ text: text.slice(mark.start, mark.end), type: mark.type, refId: mark.refId })
    cursor = mark.end
  })
  if (cursor < text.length) segments.push({ text: text.slice(cursor), type: 'plain' })
  return segments
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待处理',
    later: '稍后处理',
    in_progress: '处理中',
    done: '已完成',
    approved: '已批准',
    returned: '已退回',
    needs_revision: '需修改',
    ready_for_human_review: '可提交审核',
  }
  return labels[status] || status
}

export function canSubmitVariant(body: string, claimCount: number, blockingRiskCount: number) {
  return body.trim().length >= 20 && claimCount > 0 && blockingRiskCount === 0
}
