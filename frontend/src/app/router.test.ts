import { describe, expect, it } from 'vitest'
import { parseRoute } from './router'

describe('hash router', () => {
  it('routes an opportunity into the content studio', () => {
    const route = parseRoute('#/studio?opportunity=opp-chen-l80')
    expect(route.id).toBe('studio')
    expect(route.params.get('opportunity')).toBe('opp-chen-l80')
  })

  it('falls back to today for unknown routes', () => {
    expect(parseRoute('#/unknown').id).toBe('today')
  })
})
