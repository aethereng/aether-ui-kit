// Projection strategies: N-D position -> 2D screen space (+ hints).
// These are pure functions; the wrapper fits world bounds into the viewport.
import type { Projection, Vec } from './types'

// Orthographic 2D: first two axes are x/y. Extra axes are ignored for position
// (the caller maps them via projected.depth / t / d — e.g. color a node by its
// construction-sequence value). This is the Brain Map / Launch Board view today.
export const ortho2d: Projection = {
  name: 'ortho2d',
  project(pos: Vec): { x: number; y: number; depth?: number; t?: number; d?: number } {
    return { x: pos[0] ?? 0, y: pos[1] ?? 0, depth: pos[2], t: pos[3], d: pos[4] }
  },
}

// Isometric 3D: axes 0,1,2 -> screen via a 30° isometric transform; depth = z
// (radius/opacity in 2D, true depth under a GL renderer). Stub for the 3D path —
// the math is here so the core already speaks 3D; only the *drawing* differs later.
export const iso3d: Projection = {
  name: 'iso3d',
  project(pos: Vec): { x: number; y: number; depth?: number; t?: number; d?: number } {
    const x = pos[0] ?? 0
    const y = pos[1] ?? 0
    const z = pos[2] ?? 0
    const sx = (x - y) * Math.cos(Math.PI / 6)
    const sy = (x + y) * Math.sin(Math.PI / 6) - z
    return { x: sx, y: sy, depth: z, t: pos[3], d: pos[4] }
  },
}

/* Fitting projected points into a viewport, and getting back out again.
 *
 * Graph2D scales world coordinates to fill its box: cx = pad + (x - minX) * s. A caller
 * handling `drag` receives VIEWPORT coordinates and, in controlled mode, has to write world
 * coordinates back — so it needs the inverse. Leaving that arithmetic for each consumer to
 * rediscover produced exactly the bug you would expect: a fixed offset instead of the real
 * inverse, and a node that teleported ~100px on a 7px drag. One implementation, both
 * directions, tested. */
export interface Fit {
  minX: number
  minY: number
  s: number
  pad: number
}

export function fitToViewport(
  pts: { x: number; y: number }[],
  w: number,
  h: number,
  pad = 40,
): Fit {
  if (!pts.length) return { minX: 0, minY: 0, s: 1, pad }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX || 1
  const spanY = Math.max(...ys) - minY || 1
  return { minX, minY, s: Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY), pad }
}

/** Viewport point -> the world coordinate that projects to it. */
export function unproject(vx: number, vy: number, f: Fit): { x: number; y: number } {
  const s = f.s || 1
  return { x: (vx - f.pad) / s + f.minX, y: (vy - f.pad) / s + f.minY }
}
