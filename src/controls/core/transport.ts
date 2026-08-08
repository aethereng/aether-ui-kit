// Framework-free transport helpers. Shared by every scrubbable-playback surface
// (dynamics diagnostic, quintus viewer, and — per the 4D/5D thread — any timeline
// scrubbed view). Pairs with controls/vue/Transport.vue. The component is controlled:
// the caller owns current/duration/playing/speed; the transport only renders + emits.

export const DEFAULT_SPEEDS = [0.25, 0.5, 1, 2, 4]

export function cycleSpeed(speeds: number[], current: number): number {
  if (!speeds.length) return current
  const i = speeds.indexOf(current)
  return speeds[(i + 1) % speeds.length] ?? speeds[0]!
}

export function isAtEnd(current: number, duration: number, eps = 1e-6): boolean {
  return duration > 0 && current >= duration - eps
}

// Scrub-while-playing puts two writers on one playhead (the drag and the rAF).
// The caller pauses on scrub-start and resumes on scrub-end — this is the same
// bargain both real transports make; centralised here so it's one decision, not two.
export interface ScrubHandle {
  resume: boolean
}
export function beginScrub(playing: boolean): ScrubHandle {
  return { resume: playing }
}
export function endScrub(h: ScrubHandle, playing: boolean): boolean {
  return h.resume && !playing
}
