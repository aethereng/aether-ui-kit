// Dimension-agnostic force layout. Operates on number[] positions so it is blind
// to 2D vs 3D vs 4D — adding axes is data, not code. O(n^2) repulsion; fine to
// ~1k nodes. The GL/3D+ path later swaps the *renderer*, not this engine.
import type { GNode, GEdge, LayoutOptions } from './types'

function dist(a: number[], b: number[]): number {
  let s = 0
  const n = Math.max(a.length, b.length)
  for (let k = 0; k < n; k++) {
    const d = (a[k] ?? 0) - (b[k] ?? 0)
    s += d * d
  }
  return Math.sqrt(s)
}

export class ForceLayout {
  nodes: GNode[]
  edges: GEdge[]
  opts: Required<LayoutOptions>
  private vel: Map<string, number[]>
  /* Simulation temperature. Motion is scaled by it and it decays every step, so the layout
   * settles and a caller can stop stepping instead of burning a frame forever on a converged
   * graph. Re-heating is what makes a drag look physical: without it the sim is frozen and
   * dragging a node moves that node alone while its neighbours sit there. */
  private alphaValue: number
  private pinned = new Set<string>()

  constructor(nodes: GNode[], edges: GEdge[], opts: LayoutOptions) {
    this.nodes = nodes
    this.edges = edges
    this.opts = {
      dims: opts.dims,
      repulsion: opts.repulsion ?? 9000,
      spring: opts.spring ?? 0.03,
      damping: opts.damping ?? 0.86,
      rest: opts.rest ?? 120,
    }
    this.alphaValue = 1
    this.vel = new Map()
    for (const n of nodes) {
      while (n.pos.length < opts.dims) n.pos.push((Math.random() - 0.5) * 240)
      this.vel.set(n.id, Array(opts.dims).fill(0))
    }
  }

  /** Current temperature, 0..1. Below ~0.02 there is nothing left to see. */
  alpha(): number {
    return this.alphaValue
  }

  /** Re-heat. Call on a drag so the neighbourhood relaxes around the moved node. */
  reheat(to = 0.4): void {
    this.alphaValue = Math.max(this.alphaValue, to)
  }

  /** True while the sim is still worth stepping — drive your rAF loop off this. */
  get running(): boolean {
    return this.alphaValue > 0.02
  }

  /** Hold a node in place: forces still propagate FROM it, but nothing moves it. */
  pin(id: string, pos?: number[]): void {
    this.pinned.add(id)
    if (pos) {
      const n = this.nodes.find((x) => x.id === id)
      if (n) n.pos = [...pos]
    }
    this.vel.set(id, Array(this.opts.dims).fill(0))
  }

  unpin(id: string): void {
    this.pinned.delete(id)
  }

  isPinned(id: string): boolean {
    return this.pinned.has(id)
  }

  step(): void {
    const { dims, repulsion, spring, damping, rest } = this.opts
    const byId = new Map(this.nodes.map((n) => [n.id, n]))
    const f = new Map<string, number[]>()
    for (const n of this.nodes) f.set(n.id, Array(dims).fill(0))

    // repulsion
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i]!
        const b = this.nodes[j]!
        const d = dist(a.pos, b.pos)
        if (d < 0.01) continue
        const force = repulsion / (d * d)
        const fa = f.get(a.id)!
        const fb = f.get(b.id)!
        for (let k = 0; k < dims; k++) {
          const u = ((a.pos[k] ?? 0) - (b.pos[k] ?? 0)) / d
          fa[k] = (fa[k] ?? 0) + u * force
          fb[k] = (fb[k] ?? 0) - u * force
        }
      }
    }
    // springs
    for (const e of this.edges) {
      const a = byId.get(e.a)
      const b = byId.get(e.b)
      if (!a || !b) continue
      const d = dist(a.pos, b.pos) || 0.01
      const target = (e.w ?? 1) * rest
      const force = (d - target) * spring
      const fa = f.get(a.id)!
      const fb = f.get(b.id)!
      for (let k = 0; k < dims; k++) {
        const u = ((b.pos[k] ?? 0) - (a.pos[k] ?? 0)) / d
        fa[k] = (fa[k] ?? 0) + u * force
        fb[k] = (fb[k] ?? 0) - u * force
      }
    }
    // integrate — scaled by alpha, and skipping whatever the caller is holding
    for (const n of this.nodes) {
      if (this.pinned.has(n.id)) continue
      const v = this.vel.get(n.id)!
      const fn = f.get(n.id)!
      for (let k = 0; k < dims; k++) {
        const nv = ((v[k] ?? 0) + (fn[k] ?? 0)) * damping
        v[k] = nv
        n.pos[k] = (n.pos[k] ?? 0) + nv * this.alphaValue
      }
    }
    this.alphaValue *= 0.985
  }
}
