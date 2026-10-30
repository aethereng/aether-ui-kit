// The columns of a kind's table: every field of the kind in its display order, the tag first, the advanced fields last,
// and a vector as three columns (x, y, z). A number, a choice and a flag are edited in their cell; any other value shows
// as text and is edited in the form. A kind whose records take one of several variants shows the union of their fields:
// a cell of a field its row's variant does not take is empty and takes nothing, and the tag is changed in the form.
import type { Fields, KindDecl } from './types'
import { valueSchema } from './schema'

export interface TableColumn {
  /** The field, and for a vector the axis after a dot: `at.x`. */
  key: string
  field: string
  /** The field's words, and for a vector the axis. */
  label: string
  /** The column head's words: the field's short name where it has one, and for a vector the axis. */
  head: string
  kind: 'number' | 'choice' | 'flag' | 'text'
  /** For one number of a vector: its place in it. */
  axis?: 0 | 1 | 2
  /** The quantity the field's numbers measure, where it has one (a row's variant may give another: quantityOf). */
  quantity?: string
  /** For a choice of another record: the kind it is chosen from. */
  ref?: string
  /** For a choice of a fixed set: the values offered. */
  values?: readonly string[]
  /** The variant's tag: shown, changed in the form. */
  tag?: true
  advanced?: true
}

const AXES = ['x', 'y', 'z'] as const

/** The columns of a kind's table, the plain fields first and then the advanced ones, each in the kind's order. */
export function tableColumns(kind: KindDecl): TableColumn[] {
  const tag = kind.tag
  const names = Object.keys(kind.fields)
  if (tag !== undefined && names.includes(tag)) names.sort((a, b) => (a === tag ? -1 : b === tag ? 1 : 0))
  const columns = names.flatMap((name): TableColumn[] => {
    const decl = kind.fields[name]!
    const value = valueSchema(decl.schema)
    const head = decl.short ?? decl.label
    const more = { field: name, label: decl.label, head, ...(decl.advanced ? { advanced: true as const } : {}), ...(name === tag ? { tag: true as const } : {}) }
    if (decl.control === 'vector') {
      return AXES.map((axis, i) => ({ ...more, key: `${name}.${axis}`, label: `${decl.label} ${axis}`, head: `${head} ${axis}`, kind: 'number', axis: i as 0 | 1 | 2, quantity: decl.quantity }))
    }
    if (decl.control !== undefined) return [{ ...more, key: name, kind: 'text' }]
    if (typeof value['x-ref'] === 'string') return [{ ...more, key: name, kind: 'choice', ref: value['x-ref'] }]
    if (Array.isArray(value.enum)) return [{ ...more, key: name, kind: 'choice', values: value.enum as string[] }]
    if (value.type === 'number' || value.type === 'integer') return [{ ...more, key: name, kind: 'number', quantity: decl.quantity }]
    if (value.type === 'boolean') return [{ ...more, key: name, kind: 'flag' }]
    return [{ ...more, key: name, kind: 'text' }]
  })
  return [...columns.filter((c) => !c.advanced), ...columns.filter((c) => c.advanced)].map((c) => (c.tag ? { ...c, kind: 'text' } : c))
}

/** The variant a record holds, by its tag: its name, or '' where it holds none. */
export function variantOf(kind: KindDecl, record: Fields | undefined): string {
  const value = kind.tag === undefined ? undefined : record?.[kind.tag]
  return typeof value === 'string' ? value : ''
}

/**
 * The fields a record of a variant takes, in the kind's order: every field for a kind with no variants; else the tag, the
 * common fields and the variant's own. A variant the kind does not hold, or none, takes the tag and the common fields.
 */
export function fieldsTaken(kind: KindDecl, variant: string): string[] {
  const names = Object.keys(kind.fields)
  if (kind.tag === undefined || kind.variants === undefined) return names
  const taken = new Set([kind.tag, ...(kind.common ?? []), ...(kind.variants[variant]?.fields ?? [])])
  return names.filter((n) => taken.has(n))
}

/** Whether a record takes a field: every field, for a kind with no variants; the fields of its variant otherwise. */
export function takesField(kind: KindDecl, record: Fields, field: string): boolean {
  if (kind.tag === undefined || kind.variants === undefined) return true
  if (field === kind.tag || (kind.common ?? []).includes(field)) return true
  return kind.variants[variantOf(kind, record)]?.fields.includes(field) ?? false
}

/** The quantity a record's field measures: the one its variant gives it, else the column's. */
export function quantityOf(kind: KindDecl, record: Fields, column: Pick<TableColumn, 'field' | 'quantity'>): string | undefined {
  const own = kind.variants?.[variantOf(kind, record)]?.quantities?.[column.field]
  return own ?? column.quantity
}
