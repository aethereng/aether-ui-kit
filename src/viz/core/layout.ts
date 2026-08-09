// Dimension-agnostic force layout. Operates on number[] positions so it is blind
// to 2D vs 3D vs 4D — adding axes is data, not code. O(n^2) repulsion; fine to
// ~1k nodes. The GL/3D+ path later swaps the *renderer*, not this engine.
import type { GNode, GEdge, LayoutOptions } from './types'

function dist2(a: number[], b: number[]): number {
  let s = 0
  const n = Math.max(a.length, b.length)
  for (let k = 0; k < n; k++) {
    const d = (a[k] ?? 0) - (b[k] ?? 0)
    s += d * d
  }
  return s
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
    /* Defaults are the reference implementation's, measured rather than guessed. The port had
     * drifted to repulsion 9000 / spring 0.03 / rest 120 with one sub-step, no range cutoff
     * and no centring — roughly 3.5x the effective repulsion with nothing holding the cloud
     * together, which settles looser and, with disconnected nodes, never settles at all. */
    this.opts = {
      dims: opts.dims,
      repulsion: opts.repulsion ?? 1300,
      spring: opts.spring ?? 0.01,
      damping: opts.damping ?? 0.85,
      rest: opts.rest ?? 110,
      cutoff: opts.cutoff ?? 200,
      centering: opts.centering ?? 0.0018,
      substeps: opts.substeps ?? 2,
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
    const { dims, repulsion, spring, damping, rest, cutoff, centering, substeps } = this.opts
    const byId = new Map(this.nodes.map((n) => [n.id, n]))
    const cutoff2 = cutoff > 0 ? cutoff * cutoff : Infinity

    /* Forces accumulate straight into velocity, across every sub-step, and the layout damps
     * and integrates once at the end. Damping per sub-step instead would bleed off most of
     * the force before it ever moved anything. */
    for (let s = 0; s < substeps; s++) {
      // repulsion — short range, so a distant component stops pushing entirely
      for (let i = 0; i < this.nodes.length; i++) {
        const a = this.nodes[i]!
        const va = this.vel.get(a.id)!
        for (let j = i + 1; j < this.nodes.length; j++) {
          const b = this.nodes[j]!
          const d2 = dist2(a.pos, b.pos)
          if (d2 > cutoff2 || d2 < 1e-9) continue
          const d = Math.sqrt(d2)
          const force = repulsion / d2
          const vb = this.vel.get(b.id)!
          for (let k = 0; k < dims; k++) {
            const u = (((b.pos[k] ?? 0) - (a.pos[k] ?? 0)) / d) * force
            va[k] = (va[k] ?? 0) - u
            vb[k] = (vb[k] ?? 0) + u
          }
        }
        // pull toward the origin; the projection re-centres afterwards, so origin is centre
        if (centering) {
          for (let k = 0; k < dims; k++) va[k] = (va[k] ?? 0) - (a.pos[k] ?? 0) * centering
        }
      }
      // springs
      for (const e of this.edges) {
        const a = byId.get(e.a)
        const b = byId.get(e.b)
        if (!a || !b) continue
        const d = Math.sqrt(dist2(a.pos, b.pos)) || 0.01
        const force = (d - (e.w ?? 1) * rest) * spring
        const va = this.vel.get(a.id)!
        const vb = this.vel.get(b.id)!
        for (let k = 0; k < dims; k++) {
          const u = (((b.pos[k] ?? 0) - (a.pos[k] ?? 0)) / d) * force
          va[k] = (va[k] ?? 0) + u
          vb[k] = (vb[k] ?? 0) - u
        }
      }
    }

    // damp and integrate once, scaled by alpha; pinned nodes are held by the caller
    for (const n of this.nodes) {
      if (this.pinned.has(n.id)) continue
      const v = this.vel.get(n.id)!
      for (let k = 0; k < dims; k++) {
        const nv = (v[k] ?? 0) * damping
        v[k] = nv
        n.pos[k] = (n.pos[k] ?? 0) + nv * this.alphaValue
      }
    }
    this.alphaValue *= 0.985
  }
}
