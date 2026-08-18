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

/* One option in a RadioGroup. Structurally the same row as PropertyEditor's EnumOption, which is
   what lets a `FieldDescriptor.options` array pass straight through when the form composes this
   control — the form's type is not re-declared here, and neither is converted at the boundary. */
export type RadioOption<V extends string = string> = {
  value: V
  label: string
  disabled?: boolean
}

export interface RadioGroupProps<V extends string = string> {
  options: RadioOption<V>[]
  modelValue: V
  /** The group's accessible name. A radiogroup with no name announces only its options. */
  ariaLabel?: string
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
  /** 'pill' is the bordered inline chip of a filter bar; 'row' is the borderless full-width list
   *  row of a sidebar rail, with its count aligned right. Both exist in the surfaces this came
   *  from, and a rail rendered as wrapping pills reads as the wrong control.
   *
   *  Declared HERE and not only on the component: index.ts tells consumers to type their own state
   *  against this interface, so a prop the component accepts and the interface omits is a prop they
   *  cannot pass without an error. Seg shipped exactly this defect, with the same prop name, and
   *  the fix there was the same — take props from the exported type rather than an inline literal. */
  variant?: 'pill' | 'row'
}

export interface ToolProps {
  label: string
  hot?: boolean
  disabled?: boolean
}

/* A collapsible panel: a header row that stays visible, and a region below it that does not.
 *
 * CONTROLLED, like Graph2D/Gantt/Transport -- the caller owns `open` and the component emits
 * `update:open`, so `v-model:open` works. It never toggles itself. Deliberate: both app consumers
 * key open-state by row (a filename, a group id), which a self-managing panel cannot express.
 *
 * Why this is NOT a <details>/<summary>, which would give the whole keyboard and screen-reader
 * contract for free: everything after a <summary> is hidden while the panel is closed -- verified,
 * not assumed (`checkVisibility()` returns false and the element does not hit-test) -- so a header
 * control that must stay reachable when collapsed cannot live there. Putting it INSIDE the summary
 * instead flattens it in the accessibility tree — the exact defect a consuming app shipped, where a
 * link inside the click target needed an inline stopPropagation to work at all, and the header took
 * no keyboard focus. A header row the component owns can hold both; a <summary> cannot.
 * The one thing <details> gave that had to be rebuilt is find-in-page reaching collapsed text --
 * see `hidden="until-found"` in Disclosure.vue.
 *
 * `meta` is a prop rather than a slot so the toggle's accessible name stays deterministic;
 * `#aside` is for header controls and renders OUTSIDE the button, never nested in it. */
export interface DisclosureProps {
  /** Header text, and the toggle's accessible name. */
  label: string
  /** Whether the region is revealed. The caller owns it. */
  open?: boolean
  /** Quieter second line under `label` — a filename, a count, what is inside. */
  meta?: string
  /** Disable the toggle. The region stays in whatever state `open` says. */
  disabled?: boolean
}

/* One row in a Select. `subtitle` is a quieter second line — a consumer's ULS combination carries
   its factored formula there ("1.35·G + 1.5·Q"), which is what makes two similarly-named rows
   distinguishable rather than decorative. */
export interface SelectOption {
  value: string
  label: string
  subtitle?: string
  disabled?: boolean
}

/* A labelled group of Select rows, rendered as an <optgroup>. Grouping is structure, not styling:
   a picker listing load cases AND combinations flattened into one list loses the distinction
   between two kinds of thing, which in a structural model is a correctness problem. */
export interface SelectGroup {
  label: string
  options: SelectOption[]
}

/* One mark on a Slider's track, at a value the scale itself does not make obvious.
 *
 * NOT decoration, and the case that asked for it says why: a consumer's deform scale is ×1 at
 * position 25 of 100 — deliberately LEFT of centre, because exaggerating a deflection is the
 * common need and shrinking it is rare — and a drag that lands near 25 SNAPS onto it. Without a
 * mark, neither fact is visible: the neutral point is somewhere unmarked in the left quarter, and
 * the snap reads as the control jumping on its own.
 *
 * `label` is optional because a mark can be a plain notch on a scale, but it is the reason the
 * type exists. An unlabelled tick says "something is here"; "×1" says what. */
export interface SliderTick {
  value: number
  label?: string
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
