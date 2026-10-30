// The form of one record: the fields a record of its variant takes, in the kind's order, each in the control its value
// takes, and grouped as the declaration says with the rarely changed ones folded under Advanced. A new variant keeps the
// values the fields it shares with the old one hold. A verb's refusal names the field it belongs to by its place.
import type { Json, Schema } from '../../verbs'
import { clearsField, takesNull, valueSchema } from './schema'
import { fieldsTaken } from './columns'
import type { FieldColumn, KindDecl } from './types'

/** A choice offered: its value and its words. */
export interface Option {
  value: string
  label: string
}

/** A field as the form shows it. */
export interface FieldView {
  name: string
  label: string
  /**
   * The control: a number; a choice of a fixed set or of another record; a flag; a list of references (`refList`, one
   * choice per entry); or the declaration's control.
   */
  kind: 'number' | 'choice' | 'flag' | 'refList' | 'vector' | 'switches' | 'rows' | 'summary' | 'json' | 'text' | 'app'
  options: Option[]
  required: boolean
  /** A null given for it clears it. */
  clears: boolean
  /** It takes null as a value. */
  nullable: boolean
  /** A list with a fixed count of entries: one choice per entry. */
  fixed?: number
  /** The value's schema, for text read as a value. */
  shape?: Schema
  quantity?: string
  columns?: (FieldColumn & { options?: Option[] })[]
  /** The blank of a choice: what it reads before anything is chosen. */
  blank: string
  /** For a choice of another record, the kind it is chosen from. */
  ref?: string
  /** For a choice of another record, the word for one record of that kind. */
  refWord?: string
  /** For `switches`: whether the value is an object of flags or a list of the names that are on. */
  holds?: 'flags' | 'names'
  group?: string
  advanced?: true
  readonly?: true
  presets?: readonly { label: string; value: Json }[]
}

/** What a form reads from the app: the records a choice offers, and the word for one record of a kind. */
export interface FormContext {
  /** The ids of the records of a kind: the options of a choice of one, and whether a variant's `needs` is met. */
  ids(kind: string): readonly string[]
  /** The word for one record of a kind, for the link that opens the record chosen. */
  word?(kind: string): string
}

const isSchema = (s: unknown): s is Schema => typeof s === 'object' && s !== null && !Array.isArray(s)
const plain = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: v }))

/**
 * The fields the form shows for a record of `variant` ('' for none chosen): those a record of it takes (fieldsTaken: the
 * tag, the common fields and the variant's own), in the kind's order, so a kind that declares its tag first shows it
 * first. The tag offers each variant whose `needs` the app holds a record of, and the variant shown; a choice of another
 * record offers the ids the app holds.
 */
export function formFields(kind: KindDecl, variant: string, context: FormContext): FieldView[] {
  const chosen = kind.variants?.[variant]
  return fieldsTaken(kind, variant).map((name): FieldView => {
    const decl = kind.fields[name]!
    const value = valueSchema(decl.schema)
    const items = value.type === 'array' && isSchema(value.items) ? value.items : undefined
    const refKind =
      typeof value['x-ref'] === 'string' ? value['x-ref'] : items !== undefined && typeof items['x-ref'] === 'string' ? items['x-ref'] : chosen?.refs?.[name]
    const names = items !== undefined && Array.isArray(items.enum) ? (items.enum as string[]) : undefined
    const fixedCount = typeof value.minItems === 'number' && value.minItems === value.maxItems ? value.minItems : undefined
    const kindOf = (): FieldView['kind'] => {
      if (decl.control === 'app') return 'app'
      if (refKind !== undefined && items !== undefined) return 'refList'
      if (refKind !== undefined || Array.isArray(value.enum)) return 'choice'
      if (names !== undefined) return 'switches'
      if (decl.control !== undefined) return decl.control
      if (value.type === 'number' || value.type === 'integer') return 'number'
      if (value.type === 'boolean') return 'flag'
      return value.type === 'string' ? 'text' : 'json'
    }
    const view = kindOf()
    const isTag = name === kind.tag
    const options: Option[] = isTag
      ? Object.entries(kind.variants ?? {})
          .filter(([key, v]) => v.needs === undefined || context.ids(v.needs).length > 0 || key === variant)
          .map(([key, v]) => ({ value: key, label: v.label }))
      : decl.options !== undefined
        ? [...decl.options]
        : refKind !== undefined
          ? plain(context.ids(refKind))
          : Array.isArray(value.enum)
            ? plain(value.enum as string[])
            : names !== undefined
              ? plain(names)
              : view === 'switches' && isSchema(value.properties)
                ? plain(Object.keys(value.properties))
                : []
    const required = isTag || decl.optional !== true || (chosen?.required.includes(name) ?? false)
    const itemProps = items !== undefined && isSchema(items.properties) ? items.properties : {}
    const columns = decl.columns?.map((c) => {
      const column = itemProps[c.key]
      const ref = isSchema(column) ? column['x-ref'] : undefined
      return { ...c, ...(typeof ref === 'string' ? { options: plain(context.ids(ref)) } : {}) }
    })
    const blank = options.length === 0 && refKind !== undefined ? `(no ${refKind.replace(/_/g, ' ')} yet)` : required ? '(choose)' : '(none)'
    const quantity = chosen?.quantities?.[name] ?? decl.quantity
    return {
      name,
      label: decl.label,
      kind: view,
      options,
      required,
      clears: clearsField(kind, name),
      nullable: takesNull(decl.schema),
      ...(view === 'refList' || view === 'app' ? (fixedCount === undefined ? {} : { fixed: fixedCount }) : {}),
      ...(view === 'json' || view === 'summary' || view === 'number' || view === 'text' ? { shape: value } : {}),
      ...(quantity === undefined ? {} : { quantity }),
      ...(columns === undefined ? {} : { columns }),
      blank,
      ...(view === 'choice' && refKind !== undefined ? { ref: refKind, ...(context.word ? { refWord: context.word(refKind) } : {}) } : {}),
      ...(view === 'switches' ? { holds: value.type === 'object' ? ('flags' as const) : ('names' as const) } : {}),
      ...(decl.group === undefined ? {} : { group: decl.group }),
      ...(decl.advanced ? { advanced: true as const } : {}),
      ...(decl.readonly ? { readonly: true as const } : {}),
      ...(decl.presets === undefined ? {} : { presets: decl.presets }),
    }
  })
}

/** The plain fields by their group, in the order the groups first appear, the fields of no group first; and the advanced. */
export function groupFields<F extends Pick<FieldView, 'group' | 'advanced'>>(fields: readonly F[]): { groups: { name: string; fields: F[] }[]; advanced: F[] } {
  const groups: { name: string; fields: F[] }[] = []
  for (const f of fields) {
    if (f.advanced) continue
    const name = f.group ?? ''
    let group = groups.find((g) => g.name === name)
    if (group === undefined) {
      group = { name, fields: [] }
      groups.push(group)
    }
    group.fields.push(f)
  }
  groups.sort((a, b) => (a.name === '' ? -1 : b.name === '' ? 1 : 0))
  return { groups, advanced: fields.filter((f) => f.advanced) }
}

/**
 * The draft a new variant starts from: the values `held` holds in the fields the new variant shares with the old, and
 * none of the rest; a choice the new variant cannot offer (a record of a kind it does not name) goes blank. `fields` are
 * the new variant's (formFields). No variant chosen starts from nothing.
 */
export function keepOnVariant(
  kind: KindDecl,
  next: string,
  fields: readonly { name: string; kind: string; options: readonly Option[] }[],
  held: Readonly<Record<string, Json | undefined>>,
): Record<string, Json> {
  if (next === '' || kind.tag === undefined) return {}
  const kept: Record<string, Json> = {}
  for (const f of fields) {
    if (f.name === kind.tag) continue
    const v = held[f.name]
    if (v === undefined) continue
    if (f.kind === 'choice' && typeof v === 'string' && !f.options.some((o) => o.value === v)) continue
    kept[f.name] = v
  }
  return { [kind.tag]: next, ...kept }
}

/** The field a verb's refusal belongs to, by its place: `id` for the id, else the field its place names (`/set/e`). */
export function issueField(issue: { field?: string }): string | undefined {
  return issue.field === '/id' ? 'id' : issue.field?.split('/')[2]
}
