import { describe, it, expect } from 'vitest'
import {
  addDays,
  addMonths,
  daysInMonth,
  monthGrid,
  parseISO,
  sameDay,
  toISO,
  weekdayIndex,
} from '../calendar'

/* The bugs these guard against are all the same shape: a date-only value that is correct until it
 * touches a timezone or a month boundary, and then is quietly off by one. */

describe('parseISO — strict, because a date input reports "" for anything it cannot parse', () => {
  it('accepts a real date', () => {
    expect(parseISO('2026-08-21')).toEqual({ y: 2026, m: 8, d: 21 })
  })

  it('rejects a well-formed date that does not exist', () => {
    // The shape is perfect; February has no 30th. A regex-only check would pass this.
    expect(parseISO('2026-02-30')).toBeNull()
    expect(parseISO('2026-13-01')).toBeNull()
    expect(parseISO('2026-00-10')).toBeNull()
  })

  it('accepts Feb 29 in a leap year and rejects it otherwise', () => {
    expect(parseISO('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 })
    expect(parseISO('2026-02-29')).toBeNull()
  })

  it('rejects empty and loose forms', () => {
    for (const s of ['', '2026-8-21', '21/08/2026', '2026-08-21T00:00:00', 'today'])
      expect(parseISO(s)).toBeNull()
  })

  it('round-trips through toISO with zero padding', () => {
    expect(toISO({ y: 2026, m: 1, d: 5 })).toBe('2026-01-05')
    expect(parseISO(toISO({ y: 2026, m: 1, d: 5 }))).toEqual({ y: 2026, m: 1, d: 5 })
  })
})

describe('daysInMonth', () => {
  it('knows the months', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('gets February from the calendar, including the century rule', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(1900, 2)).toBe(28) // divisible by 100, not 400
    expect(daysInMonth(2000, 2)).toBe(29) // divisible by 400
  })
})

describe('addMonths — the modulo has to survive going backwards', () => {
  it('steps forward across a year boundary', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ y: 2027, m: 1 })
  })

  it('steps backward across a year boundary', () => {
    // A naive `total % 12` yields -1 here and lands in month 0 of the wrong year.
    expect(addMonths(2026, 1, -1)).toEqual({ y: 2025, m: 12 })
    expect(addMonths(2026, 1, -13)).toEqual({ y: 2024, m: 12 })
  })

  it('is identity at zero', () => {
    expect(addMonths(2026, 8, 0)).toEqual({ y: 2026, m: 8 })
  })
})

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays({ y: 2026, m: 8, d: 31 }, 1)).toEqual({ y: 2026, m: 9, d: 1 })
  })

  it('crosses a year end in both directions', () => {
    expect(addDays({ y: 2026, m: 12, d: 31 }, 1)).toEqual({ y: 2027, m: 1, d: 1 })
    expect(addDays({ y: 2026, m: 1, d: 1 }, -1)).toEqual({ y: 2025, m: 12, d: 31 })
  })

  it('crosses a leap day', () => {
    expect(addDays({ y: 2024, m: 2, d: 28 }, 1)).toEqual({ y: 2024, m: 2, d: 29 })
    expect(addDays({ y: 2026, m: 2, d: 28 }, 1)).toEqual({ y: 2026, m: 3, d: 1 })
  })

  it('does not drift a day when stepped 400 times', () => {
    // A DST-sensitive implementation (adding 86400000 ms to a local Date) loses or gains an hour
    // twice a year, and eventually reports the wrong calendar day. UTC arithmetic cannot.
    let v = { y: 2026, m: 1, d: 1 }
    for (let i = 0; i < 400; i++) v = addDays(v, 1)
    expect(v).toEqual({ y: 2027, m: 2, d: 5 })
  })
})

describe('weekdayIndex — 0 = Monday', () => {
  it('places known days', () => {
    expect(weekdayIndex({ y: 2026, m: 8, d: 17 })).toBe(0) // a Monday
    expect(weekdayIndex({ y: 2026, m: 8, d: 23 })).toBe(6) // the Sunday after
  })
})

describe('monthGrid', () => {
  it('is always 42 cells, so the popup never changes height', () => {
    for (const [y, m] of [
      [2026, 2],
      [2026, 8],
      [2024, 2],
      [2026, 11],
    ] as const)
      expect(monthGrid(y, m)).toHaveLength(42)
  })

  it('starts on a Monday and runs contiguously', () => {
    const g = monthGrid(2026, 8)
    expect(weekdayIndex(g[0]!)).toBe(0)
    for (let i = 1; i < g.length; i++) expect(sameDay(g[i]!, addDays(g[i - 1]!, 1))).toBe(true)
  })

  it('marks borrowed days from the neighbouring months', () => {
    const g = monthGrid(2026, 8) // 1 Aug 2026 is a Saturday, so five days are borrowed from July
    const inMonth = g.filter((c) => c.inMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[0]!.d).toBe(1)
    expect(g[0]!.inMonth).toBe(false)
    expect(g[0]!.m).toBe(7)
  })

  it('contains every day of the month exactly once', () => {
    const g = monthGrid(2024, 2).filter((c) => c.inMonth)
    expect(g.map((c) => c.d)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1))
  })
})
