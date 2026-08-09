import { describe, it, expect } from 'vitest'
import { ForceLayout } from '../layout'
import type { GNode, GEdge } from '../types'

/* ForceLayout is the piece the gallery drives directly, without the Vue component, to show
 * that the core stands on its own. These tests pin the two properties a consumer actually
 * depends on: stepping MOVES things, and repeated stepping SETTLES rather than exploding. */

const nodes = (): GNode[] => [
  { id: 'a', pos: [0, 0, 0] },
  { id: 'b', pos: [10, 0, 0] },
  { id: 'c', pos: [0, 10, 0] },
  { id: 'd', pos: [-10, -5, 0] },
]
const edges: GEdge[] = [
  { a: 'a', b: 'b', w: 1 },
  { a: 'a', b: 'c', w: 1 },
]

const snapshot = (l: ForceLayout) => l.nodes.map((n) => [...n.pos])
const totalDrift = (before: number[][], after: number[][]) =>
  before.reduce((sum, p, i) => sum + Math.hypot(...p.map((v, k) => v - (after[i]![k] ?? 0))), 0)

describe('ForceLayout', () => {
  it('moves nodes when stepped', () => {
    const l = new ForceLayout(nodes(), edges, { dims: 3 })
    const before = snapshot(l)
    l.step()
    expect(totalDrift(before, snapshot(l))).toBeGreaterThan(0)
  })

  it('mutates the node objects it was given, so a caller can share them', () => {
    // both real consumers rely on this — the layout is not a black box that
    // hands back copies, it owns the array you passed it
    const ns = nodes()
    const l = new ForceLayout(ns, edges, { dims: 3 })
    expect(l.nodes).toBe(ns)
    const p0 = [...ns[0]!.pos]
    for (let i = 0; i < 5; i++) l.step()
    expect(ns[0]!.pos).not.toEqual(p0)
  })

  it('settles: later steps move things less than early ones', () => {
    const l = new ForceLayout(nodes(), edges, { dims: 3 })
    const s0 = snapshot(l)
    for (let i = 0; i < 5; i++) l.step()
    const early = totalDrift(s0, snapshot(l))

    for (let i = 0; i < 200; i++) l.step()
    const s1 = snapshot(l)
    for (let i = 0; i < 5; i++) l.step()
    const late = totalDrift(s1, snapshot(l))

    expect(late).toBeLessThan(early)
  })

  it('stays finite — damping must not let the sim explode', () => {
    const l = new ForceLayout(nodes(), edges, { dims: 3 })
    for (let i = 0; i < 500; i++) l.step()
    for (const n of l.nodes) {
      for (const v of n.pos) {
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('pads positions up to the requested dimension count', () => {
    // a caller supplying 2-D seeds must still get a usable 3-D layout
    const flat: GNode[] = [
      { id: 'a', pos: [1, 2] },
      { id: 'b', pos: [3, 4] },
    ]
    const l = new ForceLayout(flat, [], { dims: 3 })
    for (const n of l.nodes) expect(n.pos.length).toBeGreaterThanOrEqual(3)
  })

  it('handles a single node with no edges without dividing by zero', () => {
    const l = new ForceLayout([{ id: 'solo', pos: [0, 0, 0] }], [], { dims: 3 })
    l.step()
    for (const v of l.nodes[0]!.pos) expect(Number.isFinite(v)).toBe(true)
  })

  describe('alpha (temperature)', () => {
    it('starts hot and cools with every step', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      const a0 = l.alpha()
      l.step()
      expect(l.alpha()).toBeLessThan(a0)
    })

    it('reports running until it has cooled, then stops', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      expect(l.running).toBe(true)
      for (let i = 0; i < 400; i++) l.step()
      expect(l.running).toBe(false)
    })

    it('reheat revives a settled sim — this is what makes a drag look physical', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      for (let i = 0; i < 400; i++) l.step()
      expect(l.running).toBe(false)
      l.reheat(0.5)
      expect(l.running).toBe(true)
    })

    it('reheat never cools a hotter sim', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      const hot = l.alpha()
      l.reheat(0.1)
      expect(l.alpha()).toBe(hot)
    })
  })

  describe('pinning', () => {
    it('holds a pinned node exactly where it was put', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      l.pin('a', [500, 500, 0])
      for (let i = 0; i < 20; i++) l.step()
      const a = l.nodes.find((n) => n.id === 'a')!
      expect(a.pos[0]).toBe(500)
      expect(a.pos[1]).toBe(500)
    })

    it('drags the neighbourhood along: connected nodes move TOWARD a pinned node', () => {
      // the behaviour the gallery was missing — a drag that moves one node and nothing else
      // reads as "the graph has no forces"
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      l.pin('a', [600, 600, 0])
      l.reheat(1)
      const b = l.nodes.find((n) => n.id === 'b')!
      const before = Math.hypot(b.pos[0]! - 600, b.pos[1]! - 600)
      for (let i = 0; i < 40; i++) l.step()
      const after = Math.hypot(b.pos[0]! - 600, b.pos[1]! - 600)
      expect(after).toBeLessThan(before) // 'b' is edge-connected to 'a', so the spring pulls it
    })

    it('leaves an unconnected node alone', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      l.pin('a', [600, 600, 0])
      const d = l.nodes.find((n) => n.id === 'd')!
      const before = Math.hypot(d.pos[0]! - 600, d.pos[1]! - 600)
      for (let i = 0; i < 40; i++) l.step()
      // 'd' has no edge to 'a' — repulsion should push it away, never pull it in
      expect(Math.hypot(d.pos[0]! - 600, d.pos[1]! - 600)).toBeGreaterThan(before * 0.9)
    })

    it('unpin returns the node to the simulation', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      l.pin('a', [500, 500, 0])
      expect(l.isPinned('a')).toBe(true)
      l.unpin('a')
      l.reheat(1)
      const a = l.nodes.find((n) => n.id === 'a')!
      const p0 = [...a.pos]
      for (let i = 0; i < 20; i++) l.step()
      expect(a.pos).not.toEqual(p0)
    })
  })

  describe('bounded forces, as the reference implementation has them', () => {
    it('stops repelling beyond the cutoff', () => {
      // two far-apart nodes with no edge: inside the cutoff they push apart, beyond it they
      // are simply left alone. Without this a disconnected component accelerates away forever.
      const far: GNode[] = [
        { id: 'a', pos: [0, 0, 0] },
        { id: 'b', pos: [900, 0, 0] },
      ]
      const l = new ForceLayout(far, [], { dims: 3, centering: 0 })
      const gap0 = Math.abs(far[1]!.pos[0]! - far[0]!.pos[0]!)
      for (let i = 0; i < 30; i++) l.step()
      const gap1 = Math.abs(far[1]!.pos[0]! - far[0]!.pos[0]!)
      expect(Math.abs(gap1 - gap0)).toBeLessThan(1)
    })

    it('still repels inside the cutoff', () => {
      const near: GNode[] = [
        { id: 'a', pos: [0, 0, 0] },
        { id: 'b', pos: [40, 0, 0] },
      ]
      const l = new ForceLayout(near, [], { dims: 3, centering: 0 })
      const gap0 = Math.abs(near[1]!.pos[0]! - near[0]!.pos[0]!)
      for (let i = 0; i < 30; i++) l.step()
      expect(Math.abs(near[1]!.pos[0]! - near[0]!.pos[0]!)).toBeGreaterThan(gap0)
    })

    it('pulls a lone node toward the origin rather than letting it sit adrift', () => {
      const lone: GNode[] = [{ id: 'x', pos: [700, 500, 0] }]
      const l = new ForceLayout(lone, [], { dims: 3 })
      const d0 = Math.hypot(lone[0]!.pos[0]!, lone[0]!.pos[1]!)
      for (let i = 0; i < 60; i++) l.step()
      expect(Math.hypot(lone[0]!.pos[0]!, lone[0]!.pos[1]!)).toBeLessThan(d0)
    })

    it('keeps a disconnected graph bounded', () => {
      // no edges at all — the case that made the previous version expand without limit
      const loose: GNode[] = Array.from({ length: 12 }, (_, i) => ({
        id: 'n' + i,
        pos: [(i % 4) * 60 - 90, Math.floor(i / 4) * 60 - 60, 0],
      }))
      const l = new ForceLayout(loose, [], { dims: 3 })
      for (let i = 0; i < 400; i++) l.step()
      const extent = Math.max(...loose.map((n) => Math.hypot(n.pos[0]!, n.pos[1]!)))
      expect(Number.isFinite(extent)).toBe(true)
      expect(extent).toBeLessThan(2000)
    })

    it('accumulates force across sub-steps before damping once', () => {
      // one sub-step vs two must not settle identically, or `substeps` is doing nothing
      const mk = (substeps: number) => {
        const ns: GNode[] = [
          { id: 'a', pos: [0, 0, 0] },
          { id: 'b', pos: [40, 0, 0] },
        ]
        const l = new ForceLayout(ns, [], { dims: 3, substeps, centering: 0 })
        for (let i = 0; i < 10; i++) l.step()
        return Math.abs(ns[1]!.pos[0]! - ns[0]!.pos[0]!)
      }
      expect(mk(2)).toBeGreaterThan(mk(1))
    })
  })

  describe('bounds', () => {
    const BOX: [number, number, number, number] = [30, 24, 530, 340]

    it('never lets a node leave the stage, however hard it is pushed', () => {
      // a tight cluster at one corner: repulsion would fling several outside without a clamp
      const packed: GNode[] = Array.from({ length: 10 }, (_, i) => ({
        id: 'n' + i,
        pos: [40 + (i % 3), 30 + Math.floor(i / 3), 0],
      }))
      const l = new ForceLayout(packed, [], { dims: 3, bounds: BOX })
      for (let i = 0; i < 300; i++) l.step()
      for (const n of packed) {
        expect(n.pos[0]!).toBeGreaterThanOrEqual(BOX[0])
        expect(n.pos[0]!).toBeLessThanOrEqual(BOX[2])
        expect(n.pos[1]!).toBeGreaterThanOrEqual(BOX[1])
        expect(n.pos[1]!).toBeLessThanOrEqual(BOX[3])
      }
    })

    it('clamps a pinned position too, so a drag cannot park a node off-stage', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3, bounds: BOX })
      l.pin('a', [9999, -9999, 0])
      const a = l.nodes.find((n) => n.id === 'a')!
      expect(a.pos[0]).toBe(BOX[2])
      expect(a.pos[1]).toBe(BOX[1])
    })

    it('is unbounded by default, so an existing consumer is unaffected', () => {
      const l = new ForceLayout(nodes(), edges, { dims: 3 })
      l.pin('a', [9999, 0, 0])
      expect(l.nodes.find((n) => n.id === 'a')!.pos[0]).toBe(9999)
    })
  })
})
