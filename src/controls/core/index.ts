// Framework-free core for the shared control primitives (Seg, Chip, Tool).
// Per the packaging decision: zero Vue imports; the mechanical contract (which
// option is active, what a click emits) lives here, domain semantics stay with the caller.
import type { ChipOption } from './types'

// Re-export the whole type surface. A consumer types its own state against these —
// FilterGroup[] in particular is the shape a caller must build to use FilterRail, so
// omitting it made the component unusable from outside without reaching past the
// exports map into ./types directly.
export type {
  SegOption,
  ChipOption,
  FilterGroup,
  SegProps,
  ChipProps,
  ToolProps,
} from './types'

// Return true if `value` is the active selection among `options`.
export function isSegActive<V extends string>(value: V, active: V): boolean {
  return value === active
}

// Chip supports single-value or a Set of active values (multi-select filters).
export function isChipActive<V extends string>(value: V, active: V | Set<V>): boolean {
  if (active instanceof Set) return active.has(value)
  return value === active
}

// True when any option carries a count > 0 — used by callers to decide visibility.
export function hasVisibleOptions<V extends string>(options: ChipOption<V>[]): boolean {
  return options.some((o) => (o.count ?? 0) > 0)
}

// The transport core is the other half of controls/. Re-exported here because the scrub
// bargain in particular (beginScrub/endScrub) is a decision every playback host must make
// identically — leaving it reachable only from inside the kit meant the one consumer that
// needed it wrote its own copy, which is the duplication this package exists to end.
export { DEFAULT_SPEEDS, cycleSpeed, isAtEnd, beginScrub, endScrub } from './transport'
export type { ScrubHandle } from './transport'
