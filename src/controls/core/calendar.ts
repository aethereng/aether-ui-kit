/* Calendar arithmetic for the date field's own picker.
 *
 * @internal — and that tag is load-bearing, not decoration: the package-contract test treats every
 * other module in a `core/` folder as public and fails the build if the barrel does not re-export
 * it. This is the one marker that says "private on purpose" rather than "someone forgot".
 *
 * Not in the exports map and not re-exported from ./index, because the picker is an
 * implementation detail of the date field, not a component in its own right — if a second consumer
 * ever needs a bare month grid, it gets extracted then, under the kit's two-consumer rule. It lives
 * in core/ rather than inside the .vue only so it can be unit-tested, which is the whole reason to
 * keep the arithmetic out of the component.
 *
 * Everything works on plain integers, and the ONE Date constructed is UTC and used only to ask which
 * weekday a day-number falls on. That is not fussiness: `new Date('2026-08-21')` parses as UTC
 * midnight, so `.getDate()` in any negative-offset zone answers the 20th — a date-only value that
 * round-trips through local time comes back a day early for half the planet. `today()` is the
 * deliberate exception, since "today" is a question about the user's local clock.
 */

/** Calendar date. `m` is 1-12, NOT the 0-11 that Date uses — the off-by-one between the two is the
 *  single most common bug in date code, so this type never carries the ambiguous form. */
export interface YMD {
  y: number
  m: number
  d: number
}

const pad = (n: number) => (n < 10 ? '0' + n : String(n))

/** `YYYY-MM-DD` — the value format of `<input type="date">`, which is what this field stores. */
export function toISO(v: YMD): string {
  return `${v.y}-${pad(v.m)}-${pad(v.d)}`
}

/** Strict: anything that is not exactly `YYYY-MM-DD` AND a real calendar day returns null. An empty
 *  date input reports `''`, and 2026-02-30 is not a date however well-formed it looks. */
export function parseISO(s: string): YMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  const y = +match[1]!,
    m = +match[2]!,
    d = +match[3]!
  if (m < 1 || m > 12) return null
  if (d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

/** Day 0 of month `m` is the last day of month `m-1`; with Date's 0-based months, passing `m`
 *  directly lands on the last day of `m`. Leap years come out of the calendar rather than a rule. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 0 = Monday. Weeks start Monday here; a locale-aware first day would need locale data the kit
 *  deliberately does not carry. */
export function weekdayIndex(v: YMD): number {
  return (new Date(Date.UTC(v.y, v.m - 1, v.d)).getUTCDay() + 6) % 7
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  // -1 back to 0-based so the modulo works, then +1 forward again
  const total = y * 12 + (m - 1) + delta
  return { y: Math.floor(total / 12), m: (((total % 12) + 12) % 12) + 1 }
}

/** Move by whole days, clamping through month and year boundaries. Used by the grid's arrow keys,
 *  where stepping off the end of a month must land on the next month rather than day 32. */
export function addDays(v: YMD, delta: number): YMD {
  const t = new Date(Date.UTC(v.y, v.m - 1, v.d + delta))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

export function sameDay(a: YMD | null, b: YMD | null): boolean {
  return !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d
}

/** The user's local today — the one place local time is the correct question to ask. */
export function today(): YMD {
  const n = new Date()
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }
}

export interface GridCell extends YMD {
  /** False for the leading/trailing days borrowed from the neighbouring months. */
  inMonth: boolean
}

/** Always 42 cells (6 rows of 7). Fixed height on purpose: a grid that returns 5 rows for some
 *  months and 6 for others makes the popup change height as you page through it, which moves the
 *  buttons under the user's cursor. */
export function monthGrid(y: number, m: number): GridCell[] {
  const lead = weekdayIndex({ y, m, d: 1 })
  const first = addDays({ y, m, d: 1 }, -lead)
  const cells: GridCell[] = []
  for (let i = 0; i < 42; i++) {
    const c = addDays(first, i)
    cells.push({ ...c, inMonth: c.y === y && c.m === m })
  }
  return cells
}

export const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const
