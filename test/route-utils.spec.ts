import { describe, expect, it } from 'vitest'
import { normalizeRouteCode } from '../src/lib/routeUtils'

describe('service route code normalization', () => {
  it('maps DL and its bayan-service variant DLB to Liman', () => {
    expect(normalizeRouteCode('DL')).toBe('LİMAN')
    expect(normalizeRouteCode('DLB')).toBe('LİMAN')
    expect(normalizeRouteCode(' dlb ')).toBe('LİMAN')
  })
})
