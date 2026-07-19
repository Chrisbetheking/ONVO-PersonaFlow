import { describe, expect, it } from 'vitest'
import { canSubmitVariant, markVariantStale, roleHome, updatePromiseStatus } from './enterpriseWorkflow'

const variant: any = { verification_status: 'verified', compliance_status: 'verified', status: 'draft', version_history: [] }

describe('enterprise workflow', () => {
  it('maps role spaces to their operational home', () => {
    expect(roleHome.manager).toBe('manager-radar')
    expect(roleHome.hq).toBe('hotspots')
  })
  it('invalidates verification after content edit', () => {
    const next = markVariantStale(variant)
    expect(next.verification_status).toBe('needs_revalidation')
    expect(canSubmitVariant(next)).toBe(false)
  })
  it('tracks overdue promises', () => {
    const next = updatePromiseStatus({ manager_attention: false } as any, '已超时')
    expect(next.overdue).toBe(true)
    expect(next.manager_attention).toBe(true)
  })
})
