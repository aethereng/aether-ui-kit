// Framework-free types for the shared control primitives.
// Per the packaging decision: core/ has zero Vue imports, unit-testable without a DOM.
// The mechanical contract (active state, emit) lives here; domain semantics
// (which option is active, what a dot color means) stay with the caller.

export type SegOption<V extends string = string> = {
  value: V
  label: string
  disabled?: boolean
}

export interface SegProps<V extends string = string> {
  options: SegOption<V>[]
  modelValue: V
  ariaLabel?: string
}

export type ChipOption<V extends string = string> = {
  value: V
  label: string
  count?: number
  dotColor?: string
  disabled?: boolean
}

export interface ChipProps<V extends string = string> {
  options: ChipOption<V>[]
  modelValue: V | Set<V>
  ariaLabel?: string
}

export interface ToolProps {
  label: string
  hot?: boolean
  disabled?: boolean
}
