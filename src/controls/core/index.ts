// Framework-free core for the shared control primitives (Seg, Chip, Tool).
// Per the packaging decision: zero Vue imports; the mechanical contract (which
// option is active, what a click emits) lives here, domain semantics stay with the caller.
import type { ChipOption } from './types'

export type { ChipOption } from './types'
export type { SegProps, ChipProps, ToolProps } from './types'

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
