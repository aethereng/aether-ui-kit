/* The shared contract. Every consumer -- a drawer's fixed handful of fields, or an
 * schema-derived IFC entity fields -- describes what it needs with FieldDescriptor[]. Nothing here
 * knows what an IFC entity is, or what a timeline event is: that is the whole point. The
 * static-list-vs-schema-derived axis lives entirely in how the CALLER builds this array, not in
 * this file. */

export type FieldType =
  | 'text'
  | 'textarea'
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
  options?: EnumOption[] // required when type === 'enum'
  variant?: EnumVariant // enum display; default 'dropdown'
  refType?: string // type === 'reference': what kind of thing this points at (caller-defined string)
  placeholder?: string
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
