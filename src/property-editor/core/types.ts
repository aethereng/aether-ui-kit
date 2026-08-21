/* The shared contract. Every consumer -- a drawer's fixed handful of fields, or an
 * schema-derived IFC entity fields -- describes what it needs with FieldDescriptor[]. Nothing here
 * knows what an IFC entity is, or what a timeline event is: that is the whole point. The
 * static-list-vs-schema-derived axis lives entirely in how the CALLER builds this array, not in
 * this file. */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  /* A number the user drags rather than types. NOT a `variant` of 'number', unlike enum's two
     display forms: it is a different control with a different interaction, and the value it is
     good for is one where the SCALE matters more than the digits -- an opacity, a cutting plane.
     Reuses min/max/step/suffix, so nothing about the data changes. */
  | 'range'
  | 'boolean'
  | 'enum'
  | 'date'
  | 'reference'
  | 'placement'

export interface EnumOption {
  value: string
  label: string
}

/* Same underlying type, two ways to show it -- a compact drawer uses button-groups
   a timeline surface uses a button group, an IFC entity panel uses dropdowns.
   Neither caller has to know the other exists; both just set `variant`. */
export type EnumVariant = 'buttons' | 'dropdown'

/* A generic 3D placement -- position + rotation. An IFC placement field maps
   onto a richer IFC-specific placement type; this is the neutral shape a caller's adapter converts
   to and from. Not guessing at IFC's real field names here -- that mapping is the caller's job. */
export interface PlacementValue {
  position: [number, number, number]
  rotation: [number, number, number] // radians, XYZ order
}

/* One entry per field. `key` addresses the value in the bound object -- dot-paths are NOT
   supported in v1 (flat objects only); nested objects are a real, deferred need, not silently
   half-supported. */
export interface FieldDescriptor {
  key: string
  type: FieldType
  label: string
  required?: boolean
  /** A raw CSS declaration list for a swatch rendered beside the label, e.g. 'background:#c33'
   *  or 'border:1.5px dashed #c33'. Deliberately the SAME shape as ChipOption.swatch rather than
   *  a new one -- and for the same reason: a control that toggles a coloured layer should carry
   *  the encoding of the thing it controls, so the panel reads as its own legend instead of
   *  needing one beside it. The kit renders the declaration; it never parses or interprets it. */
  swatch?: string
  options?: EnumOption[] // required when type === 'enum'
  variant?: EnumVariant // enum display; default 'dropdown'
  refType?: string // type === 'reference': what kind of thing this points at (caller-defined string)
  placeholder?: string
  /** type === 'number' and 'range'. All four map straight to the native input's own
   *  attributes -- no semantics added. If `step` is omitted, `precision` derives a default
   *  (2 -> 0.01) so the spinner increments by a sane amount for the expected decimal count; it
   *  does NOT round the stored or displayed value, so a caller mid-typing "1.500" never has
   *  trailing digits stripped out from underneath them. */
  step?: number
  min?: number
  max?: number
  precision?: number
  /** type === 'number' and 'range'. Rendered after the input, unconditionally, with no meaning
   *  attached -- '%', 'px' and 'N·m' are the same feature to this component. The kit renders a
   *  unit; it does not know one. Dimensional analysis -- conversion, mm<->in, knowing N·m and
   *  lbf·ft are the same dimension -- is the caller's, on the caller's side of this boundary. */
  suffix?: string
  /** type === 'textarea'. Height tracks content instead of a fixed row count — see
   *  TextField.vue's `autogrow` prop, which this forwards to. Off by default so existing
   *  fixed-`rows` textareas are unaffected. */
  autogrow?: boolean
}

export type FieldValues = Record<string, unknown>

export interface ValidationError {
  key: string
  message: string
}

export interface ChangeEvent {
  key: string
  value: unknown
  previous: unknown
}
