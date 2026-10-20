import { describe, expect, it } from 'vitest'
import { formatElapsed, QUIET_AFTER_SECONDS, quietSeconds } from '../activity'

describe('formatElapsed', () => {
  it('shows seconds below a minute, and drops the fraction', () => {
    expect(formatElapsed(0)).toBe('0 s')
    expect(formatElapsed(7_000)).toBe('7 s')
    expect(formatElapsed(999)).toBe('0 s')
  })

  it('shows minutes and two-digit seconds once a minute has passed', () => {
    expect(formatElapsed(65_000)).toBe('1 min 05 s')
    expect(formatElapsed(125_000)).toBe('2 min 05 s')
  })

  it('reads a negative span as zero', () => {
    expect(formatElapsed(-4_000)).toBe('0 s')
  })
})

describe('quietSeconds', () => {
  it('returns nothing before the quiet spell reaches its length', () => {
    expect(quietSeconds(1_000, 1_000 + (QUIET_AFTER_SECONDS * 1000 - 1))).toBeNull()
  })

  it('returns the whole seconds from the moment the API last sent anything, once the spell is long enough', () => {
    expect(quietSeconds(1_000, 1_000 + QUIET_AFTER_SECONDS * 1000)).toBe(QUIET_AFTER_SECONDS)
    expect(quietSeconds(1_000, 1_000 + 27_500)).toBe(27)
  })
})
