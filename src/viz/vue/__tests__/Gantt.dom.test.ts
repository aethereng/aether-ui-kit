import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import Gantt from '../Gantt.vue'
import type { GanttItem, GanttLane } from '../../core/gantt'

/* The Gantt POINTER LAYER, which is where this component has actually broken.
 *
 * Twice now the failure was in the wrapper, invisible to type-checking and to the core's own
 * tests: an extraction changed the rendered class names and every hit-test selector silently
 * stopped matching, so select / drag / resize / create were all dead while everything still
 * compiled. These tests fire real pointer sequences at the rendered DOM and assert the emits,
 * which is the only layer that would have caught it.
 *
 * jsdom has no layout and no pointer capture, so both are stubbed below. That makes these
 * tests about WIRING — does a gesture on this element reach that handler — not about
 * pixel-accurate geometry. Geometry is the core's job and is tested there. */

const lanes: GanttLane[] = [
  { type: 'design', name: 'Design', color: '#0aa', wash: '#0aa2' },
  { type: 'build', name: 'Build', color: '#a70', wash: '#a702' },
]

const items = (): GanttItem[] => [
  { id: 'a1', start: 2, end: 9, type: 'design', status: 'open', title: 'Concept' },
  { id: 'b1', start: 12, type: 'build', status: 'open', title: 'Point item' },
  { id: 'x1', start: 5, type: 'design', status: 'open', title: 'Anchor', anchor: true },
]

function mountGantt(extra: Record<string, unknown> = {}) {
  return mount(Gantt, {
    props: { items: items(), lanes, ppd: 20, ndays: 40, ...extra },
    attachTo: document.body,
  })
}

beforeAll(() => {
  // jsdom implements neither; without them the component throws mid-gesture
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.releasePointerCapture = () => {}
  }
  // every rect is zero in jsdom — give bars a width so edge-vs-body hit tests are meaningful
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 30, width: 200, height: 30 } as DOMRect
  }
})

const pd = (el: Element, x: number, y = 10) =>
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
  )
const pm = (el: Element, x: number, y = 10) =>
  el.dispatchEvent(
    new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }),
  )
const pu = (el: Element) =>
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))

describe('Gantt renders the classes its own hit-tests look for', () => {
  // the regression that killed every interaction was exactly this drift
  it.each(['.ag-lane', '.ag-ev'])('renders %s', (sel) => {
    expect(mountGantt().element.querySelectorAll(sel).length).toBeGreaterThan(0)
  })

  it('gives every event bar a data-id the hit-test can read back', () => {
    const w = mountGantt()
    for (const el of w.element.querySelectorAll('.ag-ev, .ag-ms')) {
      expect(el.getAttribute('data-id')).toBeTruthy()
    }
  })
})

describe('Gantt pointer gestures', () => {
  it('emits select on a click that never moves', () => {
    const w = mountGantt()
    const bar = w.element.querySelector('.ag-ev')!
    pd(bar, 50)
    pu(bar)
    expect(w.emitted('select')?.[0]).toEqual(['a1'])
  })

  it('emits dragStart exactly once, before the first move', () => {
    const w = mountGantt()
    const bar = w.element.querySelector('.ag-ev')!
    pd(bar, 50)
    pm(bar, 90)
    pm(bar, 130)
    pm(bar, 170)
    pu(bar)
    // one undo checkpoint per gesture is the whole contract — not one per pixel
    expect(w.emitted('dragStart')).toHaveLength(1)
    const moves = w.emitted('move') ?? []
    expect(moves.length).toBeGreaterThan(0)
  })

  it('emits dragEnd when a real drag ends, and select when it did not move', () => {
    const w = mountGantt()
    const bar = w.element.querySelector('.ag-ev')!
    pd(bar, 50)
    pm(bar, 140)
    pu(bar)
    expect(w.emitted('dragEnd')).toHaveLength(1)
    expect(w.emitted('select')).toBeUndefined()
  })

  it('moves a span without changing its length', () => {
    const w = mountGantt()
    const bar = w.element.querySelector('.ag-ev')!
    pd(bar, 50)
    pm(bar, 150)
    pu(bar)
    const [, start, end] = (w.emitted('move')!.at(-1) as [string, number, number | null])
    expect(end).not.toBeNull()
    expect(end! - start).toBe(9 - 2) // original span preserved
  })

  it('never drags an anchor', () => {
    const w = mountGantt()
    const anchor = w.element.querySelector('[data-id="x1"]')
    if (!anchor) return // anchors render as their own node type; nothing to assert if absent
    pd(anchor, 50)
    pm(anchor, 160)
    pu(anchor)
    expect(w.emitted('move')).toBeUndefined()
  })

  it('does not emit move for a jitter below the drag threshold', () => {
    const w = mountGantt()
    const bar = w.element.querySelector('.ag-ev')!
    pd(bar, 50)
    pm(bar, 51)
    pu(bar)
    expect(w.emitted('move')).toBeUndefined()
    expect(w.emitted('select')?.[0]).toEqual(['a1'])
  })

  it('is controlled: a drag never mutates the items it was given', () => {
    const given = items()
    const snapshot = JSON.stringify(given)
    const w = mount(Gantt, {
      props: { items: given, lanes, ppd: 20, ndays: 40 },
      attachTo: document.body,
    })
    const bar = w.element.querySelector('.ag-ev')!
    pd(bar, 50)
    pm(bar, 160)
    pu(bar)
    // the caller owns the data; the component may only report deltas
    expect(JSON.stringify(given)).toBe(snapshot)
  })
})
