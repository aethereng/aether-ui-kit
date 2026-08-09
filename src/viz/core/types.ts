// Framework-free types for the graph / scene primitive (viz group).
// The model is dimension-agnostic: a node's position is number[] — [x, y] today,
// [x, y, z(spatial), t(construction sequence), d(discipline)] when the 4D/5D
// renderer lands. Nothing in core assumes 2D; projection is a strategy the
// renderer picks. Per the packaging decision: zero Vue imports here.

export type Vec = number[]

export interface GNode {
  id: string
  pos: Vec // dimension-agnostic; caller decides what each index means
  label?: string
  color?: string
  r?: number // base radius (screen px) before any depth scaling
  meta?: Record<string, unknown>
}

export interface GEdge {
  a: string // node id
  b: string // node id
  w?: number // weight → spring rest length
}

// A projection maps an N-D position into 2D screen space + optional hints the
// *current* renderer can use (depth for radius/opacity, t for color/scrubber).
// A 3D/4D renderer reads more of the hint fields; SVG-2D ignores what it can't draw.
export interface Projected {
  x: number
  y: number
  depth?: number // e.g. z — for radius/opacity in 2D, real depth in 3D
  t?: number // 4th axis (construction sequence) — exposed for color/scrubber
  d?: number // 5th axis (discipline) — exposed for color/scrubber
}

export interface Projection {
  name: string
  project(pos: Vec, dims: number): Projected
}

export interface LayoutOptions {
  dims: number // how many axes of pos[] are live (>= 2)
  repulsion?: number
  spring?: number
  damping?: number
  rest?: number // base spring rest length (scaled by edge weight)
  /** Repulsion range. Beyond this distance nodes stop pushing each other, which is what keeps
   *  a graph with disconnected parts from drifting apart without bound. 0 disables the cutoff. */
  cutoff?: number
  /** Pull toward the origin, per sub-step. Without it nothing holds the cloud together and a
   *  layout with no edges simply expands forever. */
  centering?: number
  /** Hard clamp on the first two axes, [minX, minY, maxX, maxY], applied after each step.
   *  The reference implementation pins nodes inside the viewport this way so the layout can
   *  be drawn 1:1 with no rescaling — which is what lets a drag track the cursor exactly. */
  bounds?: [number, number, number, number]
  /** Force sub-steps per step(). Forces accumulate into velocity across sub-steps, then the
   *  layout damps and integrates ONCE — matching the reference implementation this came from. */
  substeps?: number
}

export interface Viewport {
  width: number
  height: number
  pad?: number
}
