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
}

export interface Viewport {
  width: number
  height: number
  pad?: number
}
