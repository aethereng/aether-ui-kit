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
  /** `null` means NO option is selected, which any preset selector over continuous or derived
   *  state needs: "the current value matches none of these". The alternative -- a synthetic
   *  "Custom" option standing in for nothing-selected -- lies about the option set AND becomes
   *  selectable, so it needs its own guard against being chosen. This does not. */
  modelValue: V | null
  ariaLabel?: string
  /** 'default' — square-cornered, panel-grey active segment.
   *  'pill'    — fully rounded, uppercase mono, accent-wash active segment. A second real look
   *              that already shipped in a consumer's header, not a style hook: the same
   *              precedent Chip's `variant` set. */
  variant?: 'default' | 'pill'
}

export type ChipOption<V extends string = string> = {
  value: V
  label: string
  count?: number
  /** Leading dot. Omit for none. */
  dotColor?: string
  /** A raw CSS declaration list for the leading swatch, e.g. 'background:#c33' or
   *  'border:1.5px dashed #c33'. Where dotColor gives an 8px colour dot, this gives a wider
   *  block that can carry the SAME encoding as the thing being filtered — a dashed border for
   *  "planned", a faded fill for "done". That is what lets a set of chips replace a legend
   *  rather than sit beside one. Takes precedence over dotColor. */
  swatch?: string
  /** Accent for the chip's own text and active border. Distinct from dotColor because
   *  the two encode different things and surfaces use them independently: a rail may
   *  colour the dot by category while leaving the label neutral, or colour the label to
   *  carry the encoding with no dot at all. */
  color?: string
  /** De-emphasise without disabling. The canonical filter behaviour dims an option whose count
   *  is zero but keeps it clickable, so a user can still see the axis exists. Distinct from
   *  `disabled`, which removes the interaction entirely. */
  muted?: boolean
  disabled?: boolean
  /** Per-option explanatory text, rendered as the native `title` attribute.
   *
   *  KNOWN TRADEOFF, not an oversight: native `title` has no touch equivalent. On a phone or
   *  tablet this text is simply unreachable, and nothing errors -- it fails silently. Fine for a
   *  label restatement or a hint; NOT fine if the text is load-bearing content a user needs to
   *  make the choice. A chip carrying real explanatory content needs a different affordance
   *  (visible helper text, or a disclosure), not a tooltip. */
  title?: string
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

// A named group of toggles inside a FilterRail. `options` are ChipOption rows;
// `selected` is the active Set for this group. Grouping + selection are data —
// the rail renders one Chip row per group and wires toggle/clear mechanically.
export interface FilterGroup<V extends string = string> {
  key: string
  label: string
  options: ChipOption<V>[]
  selected: Set<V>
}

// A message in a ChatPanel log. `role` picks the bubble style and the printed label
// ('you' / 'agent' / 'note' for sys); `queued` marks a request not yet sent, which both
// real consumers style as dashed + dimmed. `refs` is always an array — a caller with a
// single reference passes a one-element array rather than the panel juggling two shapes.
export interface ChatMessage {
  role: 'you' | 'agent' | 'sys'
  text: string
  queued?: boolean
  refs?: string[]
}
