import { describe, it, expect } from 'vitest'
import { ariaChecked, checkboxLengths, checkState, isCheckboxKey, nextChecked } from '../checkbox'

describe('a checkbox state', () => {
  it('reads its value, and mixed wins over either value', () => {
    expect(checkState(false)).toBe('off')
    expect(checkState(true)).toBe('on')
    expect(checkState(false, true)).toBe('mixed')
    expect(checkState(true, true)).toBe('mixed')
  })

  it('names each state in the words aria-checked takes', () => {
    expect(ariaChecked('off')).toBe('false')
    expect(ariaChecked('on')).toBe('true')
    expect(ariaChecked('mixed')).toBe('mixed')
  })
})

describe('what a press gives', () => {
  it('turns off to on and on to off', () => {
    expect(nextChecked(false)).toBe(true)
    expect(nextChecked(true)).toBe(false)
  })

  it('turns a group partly on all the way on, whichever value is held behind it', () => {
    expect(nextChecked(false, true)).toBe(true)
    expect(nextChecked(true, true)).toBe(true)
  })
})

describe('the key that presses it', () => {
  it('is Space alone', () => {
    expect(isCheckboxKey(' ')).toBe(true)
    for (const key of ['Enter', 'Tab', 'Escape', 'a', 'Space', '']) expect(isCheckboxKey(key), key).toBe(false)
  })
})

describe('the lengths of the drawing', () => {
  it('gives the three sizes the gallery shows', () => {
    expect(checkboxLengths(16)).toEqual({ side: 16, radius: 5, dot: 6, barWidth: 8, barHeight: 2 })
    expect(checkboxLengths(20)).toEqual({ side: 20, radius: 6, dot: 6, barWidth: 10, barHeight: 2 })
    expect(checkboxLengths(24)).toEqual({ side: 24, radius: 7, dot: 8, barWidth: 12, barHeight: 2 })
  })

  it.each([11, 13, 16, 17, 18.4, 20, 23, 24, 32, 48])('stays whole and even at %s, inside its key', (size) => {
    const l = checkboxLengths(size)
    expect(l.side % 2).toBe(0)
    expect(l.dot % 2).toBe(0)
    expect(l.barWidth % 2).toBe(0)
    expect(l.barHeight % 2).toBe(0)
    expect(Number.isInteger(l.radius)).toBe(true)
    expect(l.dot).toBeGreaterThan(0)
    expect(l.dot).toBeLessThan(l.side)
    expect(l.barWidth).toBeLessThan(l.side)
    expect(l.barHeight).toBeLessThan(l.side)
  })

  it('keeps a side for a size too small to draw', () => {
    expect(checkboxLengths(0).side).toBe(2)
  })
})
