import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Graph2D from '../Graph2D.vue'
import type { GNode, GEdge } from '../../core'

/* The Graph2D VIEW LAYER — the transform, and the pointer maths that has to invert it.
 *
 * The trap this guards is specific: the layout runs in world coordinates and one <g> carries
 * the view transform, so every gesture arriving in client pixels has to be converted back
 * through that transform before it means anything. Get it wrong and everything still renders,
 * still compiles, and drags land somewhere other than the cursor — worse the further you have
 * zoomed. That is invisible to type-checking and to the core's own tests.
 *
 * jsdom has no layout, so getBoundingClientRect is stubbed to a known box below. These tests
 * are about the ARITHMETIC and the WIRING, not pixel geometry.
 *
 * Deliberately NOT tested here: that the force sim moves anything. rAF does not run in jsdom
 * the way it does in a browser, and animation belongs to viz/core/layout.test.ts, which steps
 * the sim directly. */

const W = 400
const H = 300

const nodes = (): GNode[] => [
  { id: 'a', pos: [100, 100], r: 6, label: 'A' },
  { id: 'b', pos: [300, 200], r: 6 },
  { id: 'c', pos: [200, 150], r: 6 },
]
const edges: GEdge[] = [
  { a: 'a', b: 'b' },
  { a: 'b', b: 'c' },
]

/* Every mount is tracked and torn down in afterEach below. None of this file's OTHER tests
 * notice a leaked mount -- they only read their own wrapper's DOM/emitted state synchronously
 * -- but Graph2D attaches its drag/pan listeners to `window`, not to its own element, so a
 * mount nobody unmounts keeps them live for the rest of the file. Harmless on its own; the
 * dev-warning tests below are the first thing in this file that can actually observe it, since
 * a stale listener firing on some LATER test's window-level pointer dispatch is exactly the
 * kind of cross-test noise a global side effect (console.warn) surfaces and a per-wrapper
 * assertion never would. */
const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.forEach((w) => w.unmount()); mounted.length = 0 })

function mountGraph(extra: Record<string, unknown> = {}) {
  const w = mount(Graph2D, {
    props: {
      nodes: nodes(),
      edges,
      width: W,
      height: H,
      mapping: 'direct',
      running: false,
      ...extra,
    },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

beforeAll(() => {
  // the SVG's CSS box matches its viewBox 1:1, so client px == viewBox units and the
  // expected numbers below stay readable
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, right: W, bottom: H, width: W, height: H } as DOMRect
  }
})

/* Silenced by default: mountGraph's nodes fixture is a static array these tests never write
 * back to, which is exactly the shape the dev-only "did the drag actually land" check (further
 * down) is built to flag -- every drag test above that point would otherwise warn on its first
 * move. The "Graph2D warns" suite below reads warnSpy directly to assert on it instead. */
let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { warnSpy.mockRestore() })

const pd = (el: Element, x: number, y: number, pointerId = 1) =>
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId, button: 0 }),
  )
const pm = (el: EventTarget, x: number, y: number, pointerId = 1) =>
  el.dispatchEvent(
    new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerId }),
  )
const pu = (el: EventTarget, pointerId = 1) =>
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId }))

const wheel = (el: Element, deltaY: number, x: number, y: number) =>
  el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, clientX: x, clientY: y }))

/** The view transform currently on the wrapping group. */
function transformOf(w: ReturnType<typeof mountGraph>) {
  const g = w.element.querySelector('svg > g')!
  return g.getAttribute('transform') || ''
}
function scaleOf(w: ReturnType<typeof mountGraph>) {
  const m = transformOf(w).match(/scale\(([\d.]+)\)/)
  return m ? Number(m[1]) : NaN
}
function translateOf(w: ReturnType<typeof mountGraph>) {
  const m = transformOf(w).match(/translate\(([-\d.]+),([-\d.]+)\)/)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: NaN, y: NaN }
}

describe('Graph2D renders what its own hit-tests look for', () => {
  it('gives every node a data-id, which is how hover and pan tell nodes from background', () => {
    const w = mountGraph()
    const ids = [...w.element.querySelectorAll('.aether-graph__node')].map((n) =>
      n.getAttribute('data-id'),
    )
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('wraps the content in exactly one transform group', () => {
    const w = mountGraph()
    expect(w.element.querySelectorAll('svg > g').length).toBe(1)
    expect(transformOf(w)).toMatch(/^translate\(0\.00,0\.00\) scale\(1\.0000\)$/)
  })
})

describe('Graph2D zoom is opt-in', () => {
  it('ignores the wheel when zoomable is not set', () => {
    const w = mountGraph()
    wheel(w.element, -100, 200, 150)
    expect(scaleOf(w)).toBe(1)
    expect(w.emitted('zoom')).toBeUndefined()
  })

  it('zooms on the wheel when it is', async () => {
    const w = mountGraph({ zoomable: true })
    wheel(w.element, -100, 200, 150)
    await w.vm.$nextTick()
    expect(scaleOf(w)).toBeCloseTo(1.12, 3)
    expect(w.emitted('zoom')![0]).toEqual([1.12])
  })

  it('zooms out on the opposite wheel direction', async () => {
    const w = mountGraph({ zoomable: true })
    wheel(w.element, 100, 200, 150)
    await w.vm.$nextTick()
    expect(scaleOf(w)).toBeCloseTo(1 / 1.12, 3)
  })

  it('keeps the point under the cursor pinned across a zoom', async () => {
    const w = mountGraph({ zoomable: true })
    // zoom about the exact centre of the box
    wheel(w.element, -100, 200, 150)
    await w.vm.$nextTick()
    const k = scaleOf(w)
    const t = translateOf(w)
    // the world point that was at (200,150) must still be at (200,150)
    expect(t.x + 200 * k).toBeCloseTo(200, 3)
    expect(t.y + 150 * k).toBeCloseTo(150, 3)
  })

  it('clamps to minZoom and maxZoom', async () => {
    const w = mountGraph({ zoomable: true, minZoom: 0.5, maxZoom: 2 })
    for (let i = 0; i < 40; i++) wheel(w.element, -100, 200, 150)
    await w.vm.$nextTick()
    expect(scaleOf(w)).toBeCloseTo(2, 5)
    for (let i = 0; i < 80; i++) wheel(w.element, 100, 200, 150)
    await w.vm.$nextTick()
    expect(scaleOf(w)).toBeCloseTo(0.5, 5)
  })
})

describe('Graph2D drag maths survives the view transform', () => {
  /* The whole reason the transform is a risk. At scale 1 a naive implementation passes; the
     bug only shows up once zoomed, which is exactly when nobody is looking. */
  it('reports drag coordinates in world space at scale 1', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, 160, 130)
    expect(w.emitted('drag')!.at(-1)).toEqual(['a', 160, 130])
    pu(window)
  })

  it('reports drag coordinates in world space AFTER a zoom, not screen space', async () => {
    const w = mountGraph({ zoomable: true })
    wheel(w.element, -100, 0, 0) // zoom 1.12 about the origin -> translate stays (0,0)
    await w.vm.$nextTick()
    const k = scaleOf(w)
    expect(translateOf(w)).toEqual({ x: 0, y: 0 })

    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, 224, 168)
    // screen (224,168) at scale k about the origin is world (224/k, 168/k)
    const got = w.emitted('drag')!.at(-1) as [string, number, number]
    expect(got[1]).toBeCloseTo(224 / k, 3)
    expect(got[2]).toBeCloseTo(168 / k, 3)
    // and NOT the raw screen coordinates -- the failure mode this test exists for
    expect(got[1]).not.toBeCloseTo(224, 1)
    pu(window)
  })

  it('emits nodeClick when a press never moves, and not after a drag', async () => {
    const w = mountGraph()
    const node = w.element.querySelector('[data-id="b"]')!
    pd(node, 300, 200)
    pu(window)
    expect(w.emitted('nodeClick')![0]).toEqual(['b'])

    pd(node, 300, 200)
    pm(window, 340, 220)
    pu(window)
    expect(w.emitted('nodeClick')!.length).toBe(1)
  })
})

describe('Graph2D pan', () => {
  it('pans on a background drag', async () => {
    const w = mountGraph({ zoomable: true })
    pd(w.element, 20, 20) // the svg itself, no data-id under it
    pm(window, 60, 45)
    await w.vm.$nextTick()
    expect(translateOf(w)).toEqual({ x: 40, y: 25 })
    pu(window)
  })

  it('does not pan when the gesture starts on a node -- the node drag wins', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, 160, 130)
    await w.vm.$nextTick()
    expect(translateOf(w)).toEqual({ x: 0, y: 0 })
    pu(window)
  })

  it('does not pan at all when zoomable is off', async () => {
    const w = mountGraph()
    pd(w.element, 20, 20)
    pm(window, 200, 200)
    await w.vm.$nextTick()
    expect(translateOf(w)).toEqual({ x: 0, y: 0 })
    pu(window)
  })

  /* The regression that only shows up on the SECOND gesture, which is why every
     one-gesture-per-mount test above missed it. A press on a node was recorded as an active
     pointer but never released, so the next press made the component think two fingers were
     down and take the pinch branch — zooming off the distance between a live pointer and a
     ghost. Two node drags, then a background drag, must still be a plain pan. */
  it('still pans after earlier node drags -- released pointers are not left behind', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="a"]')!
    for (const id of [1, 2]) {
      pd(node, 100, 100, id)
      pm(window, 140, 120, id)
      pu(window, id)
    }
    const k = scaleOf(w)
    const t0 = translateOf(w)

    pd(w.element, 20, 20, 3)
    pm(window, 70, 50, 3)
    await w.vm.$nextTick()
    expect(scaleOf(w)).toBe(k) // a pan, not a phantom pinch
    expect(translateOf(w)).toEqual({ x: t0.x + 50, y: t0.y + 30 })
    pu(window, 3)
  })

  it('clamps the pan so the graph cannot be dragged off the canvas', async () => {
    const w = mountGraph({ zoomable: true })
    pd(w.element, 20, 20)
    pm(window, 5000, 5000) // shove it far past the right/bottom edge
    await w.vm.$nextTick()
    const t = translateOf(w)
    // content spans x 94..306 at scale 1; its left edge must stay inside the box
    expect(t.x + 94).toBeLessThanOrEqual(W)
    expect(t.y + 94).toBeLessThanOrEqual(H)
    pu(window)
  })
})

describe('Graph2D fit', () => {
  it('scales the content box into the viewport and centres it', async () => {
    const w = mountGraph({ zoomable: true })
    // content: x 94..306 (212 wide), y 94..206 (112 tall)
    ;(w.vm as unknown as { zoomFit: (p?: number) => void }).zoomFit(16)
    await w.vm.$nextTick()
    const k = scaleOf(w)
    expect(k).toBeCloseTo(Math.min((W - 32) / 212, (H - 32) / 112), 4)
    const t = translateOf(w)
    // the content's centre lands on the viewport's centre. Tolerance is 1dp because the
    // transform is serialised with toFixed(2) -- reading it back cannot be tighter than that.
    expect(t.x + 200 * k).toBeCloseTo(W / 2, 1)
    expect(t.y + 150 * k).toBeCloseTo(H / 2, 1)
  })

  it('undoes a zoom and a pan', async () => {
    const w = mountGraph({ zoomable: true })
    wheel(w.element, -100, 10, 10)
    pd(w.element, 20, 20)
    pm(window, 90, 70)
    pu(window)
    await w.vm.$nextTick()
    expect(translateOf(w).x).not.toBe(0)
    ;(w.vm as unknown as { zoomFit: (p?: number) => void }).zoomFit(16)
    await w.vm.$nextTick()
    const k = scaleOf(w)
    expect(translateOf(w).x).toBeCloseTo((W - (94 + 306) * k) / 2, 1)
  })
})

describe('Graph2D hover', () => {
  it('emits nodeHover with client coords while over a node, and nodeLeave when off it', async () => {
    const w = mountGraph()
    const node = w.element.querySelector('[data-id="c"]')!
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 200, clientY: 150, pointerId: 1 }))
    expect(w.emitted('nodeHover')!.at(-1)).toEqual(['c', 200, 150])

    // moving over the background is a leave
    w.element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }))
    expect(w.emitted('nodeLeave')!.length).toBe(1)
  })

  it('tracks the pointer while it stays on the same node', async () => {
    const w = mountGraph()
    const node = w.element.querySelector('[data-id="c"]')!
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 200, clientY: 150, pointerId: 1 }))
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 203, clientY: 152, pointerId: 1 }))
    expect(w.emitted('nodeHover')!.length).toBe(2)
    expect(w.emitted('nodeHover')!.at(-1)).toEqual(['c', 203, 152])
  })

  it('suppresses the card mid-drag -- a tooltip that follows you around is noise', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="c"]')!
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 200, clientY: 150, pointerId: 1 }))
    expect(w.emitted('nodeHover')!.length).toBe(1)

    pd(node, 200, 150)
    node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 210, clientY: 155, pointerId: 1 }))
    expect(w.emitted('nodeHover')!.length).toBe(1) // no new hover
    expect(w.emitted('nodeLeave')!.length).toBe(1) // and the open card was dismissed
    pu(window)
  })
})

describe('Graph2D per-node opacity and stroke', () => {
  it('forwards opacity, stroke and strokeWidth from GNode to the circle', () => {
    const w = mountGraph({
      nodes: [
        { id: 'a', pos: [100, 100], r: 6, opacity: 0.34 },
        { id: 'b', pos: [300, 200], r: 6, stroke: 'purple', strokeWidth: 2.5 },
        { id: 'c', pos: [200, 150], r: 6 },
      ],
    })
    const circleOf = (id: string) => w.element.querySelector(`[data-id="${id}"] circle`)!
    expect(circleOf('a').getAttribute('opacity')).toBe('0.34')
    expect(circleOf('b').getAttribute('stroke')).toBe('purple')
    expect(circleOf('b').getAttribute('stroke-width')).toBe('2.5')
    // unset on a node -> unset on its circle, not a stray "null"/"undefined" attribute
    expect(circleOf('c').hasAttribute('opacity')).toBe(false)
    expect(circleOf('c').hasAttribute('stroke')).toBe(false)
  })
})

describe('Graph2D cursor state', () => {
  it('is not zoomable or dragging by default', () => {
    const w = mountGraph()
    expect(w.element.classList.contains('zoomable')).toBe(false)
    expect(w.element.classList.contains('dragging')).toBe(false)
  })

  it('marks the surface zoomable', () => {
    const w = mountGraph({ zoomable: true })
    expect(w.element.classList.contains('zoomable')).toBe(true)
  })

  it('marks dragging for the duration of a node drag, on the SVG root', async () => {
    const w = mountGraph()
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    await w.vm.$nextTick()
    expect(w.element.classList.contains('dragging')).toBe(true)
    pu(window)
    await w.vm.$nextTick()
    expect(w.element.classList.contains('dragging')).toBe(false)
  })

  it('marks dragging for the duration of a background pan', async () => {
    const w = mountGraph({ zoomable: true })
    pd(w.element, 20, 20)
    await w.vm.$nextTick()
    expect(w.element.classList.contains('dragging')).toBe(true)
    pu(window)
    await w.vm.$nextTick()
    expect(w.element.classList.contains('dragging')).toBe(false)
  })

  it('marks dragging on press even for a click that never moves -- and clears it on release', async () => {
    const w = mountGraph()
    const node = w.element.querySelector('[data-id="b"]')!
    pd(node, 300, 200)
    await w.vm.$nextTick()
    expect(w.element.classList.contains('dragging')).toBe(true) // true for the down...
    pu(window)
    await w.vm.$nextTick()
    expect(w.element.classList.contains('dragging')).toBe(false) // ...false again by the click
  })
})

describe('Graph2D edge-pan while dragging a node', () => {
  /* The SVG root clips to its own box (overflow:hidden is the UA default for <svg>), so a
     dragged node's WORLD position can be unbounded and still visually vanish at the edge --
     indistinguishable from a hard wall even though nothing actually stopped it. Holding a
     drag near the edge should scroll the view to follow, the way Figma/Miro do. This is a
     real regression test: the first version had the two edge directions backwards, which
     doesn't pan the wrong way so much as fight clampPan to a standstill -- net motion looks
     like nothing happened, not like it moved backwards, so a plain "did it move" check would
     have caught it, but knowing the DIRECTION is what actually distinguishes "fixed" from
     "silently doing nothing" again. */
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
  })
  afterAll(() => {
    vi.useRealTimers() // don't leak fake rAF into any test file that runs after this one
  })

  it('pans left (shrinks zx) while held near the right edge', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, W - 10, H / 2) // 10px from the right edge, inside the 36px margin
    await vi.advanceTimersByTimeAsync(200)
    expect(translateOf(w).x).toBeLessThan(0)
  })

  it('pans right (grows zx) while held near the left edge', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, 10, H / 2) // 10px from the left edge
    await vi.advanceTimersByTimeAsync(200)
    expect(translateOf(w).x).toBeGreaterThan(0)
  })

  it('does nothing while comfortably inside the margin', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, W / 2, H / 2) // dead centre
    await vi.advanceTimersByTimeAsync(200)
    expect(translateOf(w)).toEqual({ x: 0, y: 0 })
  })

  it('stops as soon as the pointer releases, even mid-margin', async () => {
    const w = mountGraph({ zoomable: true })
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, W - 10, H / 2)
    await vi.advanceTimersByTimeAsync(50)
    pu(window)
    const afterRelease = translateOf(w)
    await vi.advanceTimersByTimeAsync(200)
    expect(translateOf(w)).toEqual(afterRelease) // no further motion once released
  })

  it('does not edge-pan when the graph is not zoomable', async () => {
    const w = mountGraph() // zoomable defaults to false
    const node = w.element.querySelector('[data-id="a"]')!
    pd(node, 100, 100)
    pm(window, W - 10, H / 2)
    await vi.advanceTimersByTimeAsync(200)
    expect(translateOf(w)).toEqual({ x: 0, y: 0 })
  })
})

describe('Graph2D labels hold their size while the graph scales', () => {
  it('publishes the inverse scale so type can divide it back out', async () => {
    const w = mountGraph({ zoomable: true })
    expect(w.element.getAttribute('style')).toContain('--aether-graph-label-scale: 1.000')
    wheel(w.element, -100, 200, 150)
    await w.vm.$nextTick()
    const k = scaleOf(w)
    expect(w.element.getAttribute('style')).toContain(
      `--aether-graph-label-scale: ${(1 / k).toFixed(3)}`,
    )
  })

  it('shrinks the label offset by the same factor so it stays put against its node', async () => {
    const w = mountGraph({ zoomable: true })
    const dyAt1 = w.element.querySelector('[data-id="a"] text')!.getAttribute('dy')
    expect(Number(dyAt1)).toBeCloseTo(6 + 11, 5)
    wheel(w.element, -100, 200, 150)
    await w.vm.$nextTick()
    const k = scaleOf(w)
    const dy = Number(w.element.querySelector('[data-id="a"] text')!.getAttribute('dy'))
    expect(dy).toBeCloseTo(6 + 11 / k, 5)
    // rendered gap below the circle is unchanged: (dy - r) * k == 11
    expect((dy - 6) * k).toBeCloseTo(11, 5)
  })
})

describe('Graph2D drops edges whose endpoint is not in nodes[]', () => {
  /* The regression this guards: a host that filters which nodes it shows (Brain Map's
     folder/flag/search filters) but keeps passing every edge in the whole dataset used to
     still render an edge into a now-hidden node -- the missing endpoint fell back to (0,0),
     so every one of those edges converged on the same phantom point in the corner. */
  it('renders exactly the edges whose both ends are visible', () => {
    const w = mountGraph({
      edges: [
        { a: 'a', b: 'b' }, // both visible
        { a: 'b', b: 'ghost' }, // ghost is not in nodes()
        { a: 'ghost', b: 'a' }, // same, other position
      ],
    })
    expect(w.element.querySelectorAll('.aether-graph__edge').length).toBe(1)
  })

  it('never renders a line touching the origin fallback -- proof the old ?? 0 path is gone', () => {
    const w = mountGraph({ edges: [{ a: 'a', b: 'ghost' }] })
    const lines = [...w.element.querySelectorAll('.aether-graph__edge')]
    expect(lines.length).toBe(0) // dropped entirely, not drawn to (0,0)
  })

  it('keeps a valid edge even when it is listed alongside several invalid ones', () => {
    const w = mountGraph({
      edges: [{ a: 'x', b: 'y' }, { a: 'a', b: 'c' }, { a: 'z', b: 'a' }],
    })
    const lines = [...w.element.querySelectorAll('.aether-graph__edge')]
    expect(lines.length).toBe(1)
    const aPos = w.element.querySelector('[data-id="a"]')!.getAttribute('transform')
    const cPos = w.element.querySelector('[data-id="c"]')!.getAttribute('transform')
    const [ax, ay] = aPos!.match(/[\d.]+/g)!.map(Number)
    const [cx, cy] = cPos!.match(/[\d.]+/g)!.map(Number)
    expect(lines[0]!.getAttribute('x1')).toBe(String(ax))
    expect(lines[0]!.getAttribute('y1')).toBe(String(ay))
    expect(lines[0]!.getAttribute('x2')).toBe(String(cx))
    expect(lines[0]!.getAttribute('y2')).toBe(String(cy))
  })
})

describe('Graph2D warns when a controlled drag never reaches nodes[]', () => {
  /* The regression this guards: Brain Map's drag handler mutated its position store correctly
     but never told Vue to look again, so the emitted `drag` was fine and the node just never
     moved on screen -- silently, every time, once the initial physics settle finished. This
     check is the automated version of the exact manual test that caught it originally: drag,
     then ask "did nodes[] actually change to match?" */

  it('stays quiet when the host updates nodes[] in response to drag, as a correct one does', async () => {
    const w = mountGraph()
    pd(w.element.querySelector('[data-id="a"]')!, 100, 100)
    pm(window, 160, 130)
    const [id, x, y] = w.emitted('drag')!.at(-1) as [string, number, number]
    // simulate a host whose @drag handler updates its store AND triggers a re-render --
    // the two things together are what setProps models here
    await w.setProps({ nodes: nodes().map((n) => (n.id === id ? { ...n, pos: [x, y] } : n)) })
    await nextTick()
    expect(warnSpy).not.toHaveBeenCalled()
    pu(window)
  })

  it('warns once, naming the node, when nodes[] never catches up', async () => {
    const w = mountGraph() // fixture nodes() is never written back to -- the bug, reproduced
    pd(w.element.querySelector('[data-id="a"]')!, 100, 100)
    pm(window, 160, 130)
    await nextTick()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]![0]).toContain('"a"')
    pu(window)
  })

  it('does not re-warn on subsequent moves of the same gesture -- one signal is enough', async () => {
    const w = mountGraph()
    const el = w.element.querySelector('[data-id="a"]')!
    pd(el, 100, 100)
    pm(window, 160, 130)
    await nextTick()
    pm(window, 170, 140)
    pm(window, 180, 150)
    await nextTick()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    pu(window)
  })

  it('does not check at all under mapping="fit" -- nodes[].pos and the emitted (x,y) are not even the same coordinate space there', async () => {
    const w = mountGraph({ mapping: 'fit' })
    pd(w.element.querySelector('[data-id="a"]')!, 100, 100)
    pm(window, 160, 130)
    await nextTick()
    expect(warnSpy).not.toHaveBeenCalled()
    pu(window)
  })

  it('does not check in running mode -- Graph2D owns positions itself there', async () => {
    const w = mountGraph({ running: true })
    pd(w.element.querySelector('[data-id="a"]')!, 100, 100)
    pm(window, 160, 130)
    await nextTick()
    expect(warnSpy).not.toHaveBeenCalled()
    pu(window)
  })
})
