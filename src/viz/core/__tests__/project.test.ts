import { describe, it, expect } from 'vitest'
import { fitToViewport, unproject, ortho2d } from '../project'

/* The fit and its inverse are the contract a controlled Graph2D consumer depends on: `drag`
 * hands back viewport coordinates, and writing them into a node without inverting the fit is
 * what made a 7px drag teleport a node 100px. */

describe('fitToViewport / unproject', () => {
  const pts = [
    { x: -500, y: -300 },
    { x: 500, y: 300 },
    { x: 0, y: 0 },
  ]

  it('round-trips: unproject(project(p)) === p', () => {
    const f = fitToViewport(pts, 560, 360)
    for (const p of pts) {
      const vx = f.pad + (p.x - f.minX) * f.s
      const vy = f.pad + (p.y - f.minY) * f.s
      const back = unproject(vx, vy, f)
      expect(back.x).toBeCloseTo(p.x, 6)
      expect(back.y).toBeCloseTo(p.y, 6)
    }
  })

  it('fits inside the viewport with the pad respected', () => {
    const f = fitToViewport(pts, 560, 360)
    for (const p of pts) {
      const vx = f.pad + (p.x - f.minX) * f.s
      expect(vx).toBeGreaterThanOrEqual(f.pad - 1e-9)
      expect(vx).toBeLessThanOrEqual(560 - f.pad + 1e-9)
    }
  })

  it('survives a degenerate span without dividing by zero', () => {
    // every node on one line — spanY is 0
    const f = fitToViewport([{ x: 0, y: 5 }, { x: 10, y: 5 }], 560, 360)
    expect(Number.isFinite(f.s)).toBe(true)
    expect(Number.isFinite(unproject(100, 100, f).x)).toBe(true)
  })

  it('handles an empty set', () => {
    const f = fitToViewport([], 560, 360)
    expect(Number.isFinite(f.s)).toBe(true)
  })

  it('ortho2d passes the first two axes through, so higher axes are free for other meaning', () => {
    const p = ortho2d.project([3, 4, 5, 6], 4)
    expect(p.x).toBe(3)
    expect(p.y).toBe(4)
    expect(p.depth).toBe(5)
  })
})
