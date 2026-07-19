import type { ContentVariant, PromiseItem, QualitySignal, RoleSpace } from '../types'

export const roleHome: Record<RoleSpace, string> = {
  advisor: 'today',
  manager: 'manager-radar',
  hq: 'hotspots',
}

export function markVariantStale(variant: ContentVariant, fields: string[] = ['body']): ContentVariant {
  return {
    ...variant,
    verification_status: 'needs_revalidation',
    compliance_status: 'needs_revalidation',
    status: 'needs_revision',
    verified_at: '',
    version_history: [...(variant.version_history || []), { type: 'content_changed', fields, at: new Date().toISOString() }],
  }
}

export function canSubmitVariant(variant: ContentVariant) {
  return variant.verification_status === 'verified' && variant.compliance_status === 'verified'
}

export function updatePromiseStatus(item: PromiseItem, status: string, reason = ''): PromiseItem {
  return {
    ...item,
    status,
    overdue: status === '已超时',
    manager_attention: status === '已超时' || item.manager_attention,
    completed_at: status === '已完成' ? new Date().toISOString() : item.completed_at,
    delay_reason: status === '已延期' ? reason : item.delay_reason,
  }
}

export function updateQualitySignal(item: QualitySignal, patch: Partial<QualitySignal>): QualitySignal {
  return { ...item, ...patch }
}
