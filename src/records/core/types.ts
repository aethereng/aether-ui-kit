// The declaration of a kind of record: its fields in display order, each with the schema of its value and the words and
// display the form and the table give it, and the variants a record of the kind may take. An app declares its kinds once
// and the record parts read them; the verbs a change calls stay the app's.
import type { Json, Schema } from '../../verbs'

/**
 * How the form shows a value that is not one number, one choice or one flag: three numbers x, y, z (`vector`); a set of
 * switches, over an object of flags or a list of names (`switches`); a list of objects as a table, one row per entry
 * (`rows`); a line of what the value holds, given by the app (`summary`); JSON text (`json`); free text (`text`). A field
 * whose control is the app's own is `app`: the kit's field draws nothing for it, and the app's form draws its control.
 */
export type Control = 'vector' | 'switches' | 'rows' | 'summary' | 'json' | 'text' | 'app'

/** A column of a `rows` field: the property of each entry, its words, and its quantity when it is a physical number. */
export interface FieldColumn {
  key: string
  label: string
  quantity?: string
}

/** One field of a kind. */
export interface FieldDecl {
  /** The value's JSON Schema; `x-ref` names the kind a reference points into. */
  schema: Schema
  /** The field may be absent; every other field is required. */
  optional?: true
  label: string
  /** A table head's words, where the label is long. */
  short?: string
  /** What the field's numbers measure, read through Units; none for a direction, a ratio, a count. */
  quantity?: string
  /** The group the form shows it in. */
  group?: string
  /** Folded under Advanced in the form, and shown after the other columns in the table. */
  advanced?: true
  control?: Control
  /** The names of a choice or of `switches`, with their words. */
  options?: readonly { value: string; label: string }[]
  /** Values offered above `switches`. */
  presets?: readonly { label: string; value: Json }[]
  /** The columns of `rows`. */
  columns?: readonly FieldColumn[]
  /** Shown and never changed. */
  readonly?: true
}

/** One variant of a kind: the fields it takes beside the tag and the common ones, and those it requires. */
export interface Variant {
  label: string
  fields: readonly string[]
  required: readonly string[]
  /** A field whose numbers measure another quantity under this variant than its declaration gives it. */
  quantities?: Readonly<Record<string, string>>
  /** A field that names a record of a kind under this variant, where its schema names none. */
  refs?: Readonly<Record<string, string>>
  /** The kind a record of this variant must name, so the variant is offered only where a record of it exists. */
  needs?: string
}

/** A kind of record. */
export interface KindDecl {
  /** The kind's name, as an `x-ref` names it. */
  name: string
  /** The word for one record of the kind. */
  word: string
  /** The fields, in display order, without the id. */
  fields: Readonly<Record<string, FieldDecl>>
  /** The field that tells the variants apart. */
  tag?: string
  /** The fields every variant takes, and all a record with no variant takes beside the tag. */
  common?: readonly string[]
  variants?: Readonly<Record<string, Variant>>
}

/**
 * The units a record's numbers are shown in: what a stored number shows as, and what a typed one is stored as. Every number
 * of a field or column with a quantity goes through `shown` and `stored`, whether or not `label` has words for the
 * quantity, so for a quantity shown as stored they give the number back unchanged.
 */
export interface Units {
  /** The unit's words for a quantity, or undefined where its numbers show as stored with no unit. */
  label(quantity: string): string | undefined
  shown(value: number, quantity: string): number
  stored(value: number, quantity: string): number
  /** The unit's words for a quantity as the record stores it, where a field's text holds stored numbers (`summary`). */
  storedLabel?(quantity: string): string | undefined
}

/** A record's fields, by name, without the id. */
export type Fields = { [field: string]: Json | undefined }

/** Units that show every number as stored, with no unit. */
export const STORED: Units = {
  label: () => undefined,
  shown: (value) => value,
  stored: (value) => value,
}
