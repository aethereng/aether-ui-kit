import { describe, it, expect } from 'vitest'
import { laneLayout, lanesHeight, isPoint, computePPD, type GanttItem, type GanttLane } from '../gantt'

const LANES: GanttLane[] = [
  { type: 'design', name: 'Design', color: '#0af', wash: '#0af2' },
  { type: 'build', name: 'Build', color: '#fa0', wash: '#fa02' },
]

const item = (over: Partial<GanttItem> & { id: string }): GanttItem => ({
  start: 0,
  type: 'design',
  title: 't',
  ...over,
})

describe('laneLayout', () => {
  it('does not mutate the items it is given', () => {
    // The regression this guards: laneLayout used to stamp `_row` onto the caller's own
    // objects. A consumer may pass deep-reactive state (the gallery does) and call this
    // from inside a computed that also reads it — a write-during-read that only stays
    // benign while rows never change mid-gesture. Drag makes them change.
    const items = [
      item({ id: 'a', start: 0, end: 5 }),
      item({ id: 'b', start: 3, end: 8 }),
      item({ id: 'c', start: 10, end: 12 }),
    ]
    const before = JSON.parse(JSON.stringify(items))
    laneLayout(LANES, items, null)
    expect(items).toEqual(before)
    expect(items.some((i) => '_row' in i)).toBe(false)
  })

  it('stacks overlapping spans onto separate rows, packing greedily', () => {
    const items = [
      item({ id: 'a', start: 0, end: 5 }), // row 0
      item({ id: 'b', start: 3, end: 8 }), // overlaps a → row 1
      item({ id: 'c', start: 6, end: 9 }), // a is free by 6 → row 0
    ]
    const L = laneLayout(LANES, items, null).design!
    expect(L.rowOf).toEqual({ a: 0, b: 1, c: 0 })
    expect(L.rows.length).toBe(2)
  })

  it('separates spans from one-day points, and excludes anchors from both', () => {
    const items = [
      item({ id: 'span', start: 0, end: 4 }),
      item({ id: 'point', start: 2 }),
      item({ id: 'sameday', start: 7, end: 7 }), // end === start is a point, not a span
      item({ id: 'anchor', start: 3, anchor: true }),
    ]
    const L = laneLayout(LANES, items, null).design!
    expect(L.spans.map((s) => s.id)).toEqual(['span'])
    expect(L.points.map((p) => p.id).sort()).toEqual(['point', 'sameday'])
  })

  it('groups points by day and expands only the requested lane+day', () => {
    const items = [
      item({ id: 'p1', start: 4 }),
      item({ id: 'p2', start: 4 }),
      item({ id: 'p3', start: 9 }),
    ]
    const plain = laneLayout(LANES, items, null).design!
    expect(plain.byDay[4]!.map((i) => i.id)).toEqual(['p1', 'p2'])
    expect(plain.expanded).toBeNull()

    const expanded = laneLayout(LANES, items, { t: 'design', i: 4 }).design!
    expect(expanded.expanded!.map((i) => i.id)).toEqual(['p1', 'p2'])
    // a different lane's expansion request must not leak into this one
    expect(laneLayout(LANES, items, { t: 'build', i: 4 }).design!.expanded).toBeNull()
  })

  it('routes items to their own lane and marks empty lanes empty', () => {
    const items = [item({ id: 'a', start: 0, end: 2, type: 'design' })]
    const lanes = laneLayout(LANES, items, null)
    expect(lanes.design!.empty).toBe(false)
    expect(lanes.build!.empty).toBe(true)
    expect(lanes.build!.height).toBe(0)
    // an empty lane contributes no height to the total
    expect(lanesHeight(lanes)).toBe(lanes.design!.height)
  })
})

describe('isPoint', () => {
  it('treats a missing, null, or equal end as a point — and an anchor as neither', () => {
    expect(isPoint(item({ id: '1', start: 3 }))).toBe(true)
    expect(isPoint(item({ id: '2', start: 3, end: null }))).toBe(true)
    expect(isPoint(item({ id: '3', start: 3, end: 3 }))).toBe(true)
    expect(isPoint(item({ id: '4', start: 3, end: 4 }))).toBe(false)
    expect(isPoint(item({ id: '5', start: 3, anchor: true }))).toBe(false)
  })
})

describe('computePPD', () => {
  it('fits the whole span in "all" view', () => {
    // 1804px of usable width across 60 days → 30px/day
    expect(computePPD('all', 1804, 60)).toBe(30)
  })

  it('holds a minimum so days never collapse to sub-pixel widths', () => {
    expect(computePPD('all', 40, 60)).toBe(11)
  })

  it('fits the SELECTED MONTH\'s own day count in month view, not a flat 33', () => {
    // 1324px of usable width across a real 30-day month -> 44px/day, not 40
    expect(computePPD('9', 1324, 60, 30)).toBe(44)
    // a 31-day month over the same width divides differently again
    expect(computePPD('8', 1324, 60, 31)).toBe(42)
  })

  it('holds a lower floor in month view than the old fixed one, so a real month is less likely to force a scrollbar', () => {
    expect(computePPD('8', 40, 60, 31)).toBe(16)
  })
})
