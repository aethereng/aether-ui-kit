import { describe, it, expect } from 'vitest'
import { DEFAULT_SPEEDS, cycleSpeed, isAtEnd, beginScrub, endScrub } from '../transport'

/* The transport core is the shared answer to two questions every scrubbable-playback
 * surface asks: "is the playhead parked at the end?" (which turns Play into Replay) and
 * "who owns the clock during a drag?". Both were previously answered twice, by hand, in
 * two different apps. These tests pin the semantics so a third consumer inherits them. */

describe('cycleSpeed', () => {
  it('advances to the next preset', () => {
    expect(cycleSpeed([0.5, 1, 2], 0.5)).toBe(1)
    expect(cycleSpeed([0.5, 1, 2], 1)).toBe(2)
  })

  it('wraps around at the end', () => {
    expect(cycleSpeed([0.5, 1, 2], 2)).toBe(0.5)
  })

  it('falls to the first preset when the current speed is not one of them', () => {
    // indexOf returns -1, so (-1 + 1) % n === 0 — a speed set from elsewhere
    // must not strand the button.
    expect(cycleSpeed([0.5, 1, 2], 999)).toBe(0.5)
  })

  it('returns the current speed rather than undefined for an empty preset list', () => {
    expect(cycleSpeed([], 1)).toBe(1)
  })

  it('ships a default preset ladder spanning slower and faster than real time', () => {
    expect(DEFAULT_SPEEDS).toContain(1)
    expect(Math.min(...DEFAULT_SPEEDS)).toBeLessThan(1)
    expect(Math.max(...DEFAULT_SPEEDS)).toBeGreaterThan(1)
  })
})

describe('isAtEnd', () => {
  it('is true at the duration', () => {
    expect(isAtEnd(5, 5)).toBe(true)
  })

  it('is true just short of the duration, within epsilon', () => {
    // float accumulation in a rAF loop never lands exactly on the duration
    expect(isAtEnd(5 - 1e-9, 5)).toBe(true)
  })

  it('is false mid-timeline', () => {
    expect(isAtEnd(2.5, 5)).toBe(false)
  })

  it('is false for a zero duration', () => {
    // nothing loaded yet — Play must not render as Replay on an empty transport
    expect(isAtEnd(0, 0)).toBe(false)
  })

  it('honours a caller-supplied epsilon', () => {
    expect(isAtEnd(4.9, 5, 0.5)).toBe(true)
    expect(isAtEnd(4.9, 5, 0.01)).toBe(false)
  })
})

describe('scrub handoff', () => {
  it('resumes only when playback was running before the drag', () => {
    const h = beginScrub(true)
    expect(endScrub(h, false)).toBe(true)
  })

  it('does not resume when the transport was already paused', () => {
    // dragging a paused transport must leave it paused
    const h = beginScrub(false)
    expect(endScrub(h, false)).toBe(false)
  })

  it('does not double-resume when something already restarted playback', () => {
    // guards the two-writers-on-one-playhead case the whole handshake exists to prevent
    const h = beginScrub(true)
    expect(endScrub(h, true)).toBe(false)
  })
})
