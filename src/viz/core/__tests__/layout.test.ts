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
    // the gallery and Brain Map both rely on this — the layout is not a black box that
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
})
