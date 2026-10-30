// The cells of a record table: what a cell shows, what a typed or chosen value gives its row, and when a change to several
// rows at once, ticked or pasted, is refused. A change goes to every row it names or to none: it is refused, naming the
// rows, where a row is hidden by the search, where one takes no such field (its variant has none), or where the rows'
// cells measure different quantities, since one typed number would mean two different values; and a field declared read
// only takes no change at all. A number is typed in the unit shown and stored as the record's units hold it (Units).
import type { Json } from '../../verbs'
import { blankTaken } from './schema'
import { quantityOf, takesField, type TableColumn } from './columns'
import { choiceWidth, numberWidth, textWidth, type Measure } from './widths'
import type { Fields, KindDecl, Units } from './types'

/** A row of a table: a record and its id. */
export interface Row {
  id: string
  record: Fields
}

/** A value a change gives one row. */
export interface RowValue {
  id: string
  record: Fields
  value: Json
}

/** A refused change: the row the refusal names, and its words. */
export interface CellRefusal {
  row: string
  words: string
}

/** A number as a field shows it: twelve significant figures, so a conversion's last-bit residue does not show. */
export const numberText = (value: number): string => String(Number(value.toPrecision(12)))

/** The value a column's cell holds: the field, or one number of a vector. */
export function cellValue(record: Fields, column: Pick<TableColumn, 'field' | 'axis'>): Json | undefined {
  const v = record[column.field]
  return column.axis === undefined ? v : Array.isArray(v) ? v[column.axis] : undefined
}

/** A value shown as text: a list of plain values joined, the switches that are on; anything else as JSON. */
export function textOf(v: Json | undefined): string {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'object') return String(v)
  if (Array.isArray(v)) return v.every((x) => typeof x !== 'object' || x === null) ? v.join(', ') : `${v.length} entries`
  const on = Object.entries(v)
    .filter(([, x]) => x === true)
    .map(([k]) => k)
  return on.length > 0 && Object.values(v).every((x) => typeof x === 'boolean') ? on.join(', ') : JSON.stringify(v)
}

/** What a cell shows: a number in its unit, anything else as text; nothing for a field its row's variant does not take. */
export function cellText(kind: KindDecl, record: Fields, column: TableColumn, units: Units): string {
  if (!takesField(kind, record, column.field)) return ''
  const v = cellValue(record, column)
  if (column.kind !== 'number') return textOf(v)
  if (typeof v !== 'number') return ''
  const quantity = quantityOf(kind, record, column)
  return numberText(quantity === undefined ? v : units.shown(v, quantity))
}

/** A cell's own unit, where its row's variant gives the field another quantity than the column's head says; else ''. */
export function ownUnit(kind: KindDecl, record: Fields, column: TableColumn, units: Units): string {
  const quantity = quantityOf(kind, record, column)
  if (quantity === column.quantity || quantity === undefined) return ''
  return units.label(quantity) ?? ''
}

/** A cell's value in words, in the unit it shows in: 'none' where it holds nothing. */
export function cellWords(kind: KindDecl, record: Fields, column: TableColumn, units: Units): string {
  const text = cellText(kind, record, column, units)
  if (text === '') return 'none'
  const quantity = quantityOf(kind, record, column)
  const label = quantity === undefined ? undefined : units.label(quantity)
  return column.kind === 'number' && label !== undefined ? `${text} ${label}` : text
}

/** A choice's labels as its cell offers them: the blank first, "(none)" where a blank is a value, else "(choose)". */
export function choiceLabels(kind: KindDecl, column: TableColumn, options: readonly string[]): string[] {
  return [blankTaken(kind, column.field) ? '(none)' : '(choose)', ...options]
}

/**
 * Each number, free text and choice column's width in px (widths.ts): a number's or a text's widest value over the rows
 * shown; a choice's longest label where a row shown holds a value, and its blank label, which each of its cells shows,
 * where none does.
 */
export function columnWidths(
  kind: KindDecl,
  columns: readonly TableColumn[],
  rows: readonly Row[],
  units: Units,
  optionsOf: (column: TableColumn) => readonly string[],
  measure: Measure,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of columns) {
    const texts = rows.map((r) => cellText(kind, r.record, c, units))
    if (c.kind === 'number') out.set(c.key, numberWidth(texts, measure))
    else if (c.kind === 'string') out.set(c.key, textWidth(texts, measure))
    else if (c.kind === 'choice') {
      const labels = choiceLabels(kind, c, optionsOf(c))
      out.set(c.key, choiceWidth(texts.some((t) => t !== '') ? labels : labels.slice(0, 1), measure))
    }
  }
  return out
}

/** Whether a row is found by a search: its id, or the text of a cell, holds the query, in any case. */
export function matches(kind: KindDecl, row: Row, columns: readonly TableColumn[], query: string, units: Units): boolean {
  const q = query.trim().toLowerCase()
  return q === '' || row.id.toLowerCase().includes(q) || columns.some((c) => cellText(kind, row.record, c, units).toLowerCase().includes(q))
}

/** What a typed or chosen value gives a row: the value to store, or the words that say why it cannot be read. */
export function valueFor(kind: KindDecl, record: Fields, column: TableColumn, typed: string | boolean, units: Units): { value: Json } | { unread: string } {
  if (column.kind === 'flag') return { value: typed === true }
  const text = String(typed).trim()
  if (column.kind === 'choice' || column.kind === 'string') {
    if (text !== '') return { value: text }
    return blankTaken(kind, column.field) ? { value: null } : { unread: column.kind === 'choice' ? 'Choose one' : 'Write a value' }
  }
  if (text === '') return column.axis === undefined && blankTaken(kind, column.field) ? { value: null } : { unread: 'Number only' }
  const n = Number(text.replace(/−/g, '-'))
  if (!Number.isFinite(n)) return { unread: 'Number only' }
  const quantity = quantityOf(kind, record, column)
  const stored = quantity === undefined ? n : units.stored(n, quantity)
  if (column.axis === undefined) return { value: stored }
  const held = record[column.field]
  const vector = Array.isArray(held) && held.length === 3 ? [...held] : [0, 0, 0]
  vector[column.axis] = stored
  return { value: vector }
}

const named = (rows: readonly Row[]): string => rows.map((r) => r.id).join(', ')
const unchanged = (column: TableColumn): string => `${column.label} is read only`

/** Why one change cannot go to every one of these rows, naming the rows, or null where it can. */
export function bulkRefusal(kind: KindDecl, rows: readonly Row[], column: TableColumn, shown: ReadonlySet<string>, units: Units): CellRefusal | null {
  if (column.readonly && rows.length > 0) return { row: rows[0]!.id, words: unchanged(column) }
  const hidden = rows.filter((r) => !shown.has(r.id))
  if (hidden.length > 0) return { row: hidden[0]!.id, words: `Ticked and hidden by the search: ${named(hidden)}` }
  const lacking = rows.filter((r) => !takesField(kind, r.record, column.field))
  if (lacking.length > 0) return { row: lacking[0]!.id, words: `No ${column.label.toLowerCase()} in ${named(lacking)}` }
  const measured = rows.map((r) => quantityOf(kind, r.record, column))
  const other = rows.find((_, i) => measured[i] !== measured[0])
  if (other === undefined) return null
  const unit = (q: string | undefined): string => (q === undefined ? 'none' : (units.label(q) ?? q))
  return { row: other.id, words: `Units differ: ${rows.map((r, i) => `${r.id} ${unit(measured[i])}`).join(', ')}` }
}

/**
 * A cell left, or Enter pressed in it: the values it gives, to its row or, where the row is ticked with others, to every
 * ticked row. `ticked` is every ticked row, those the search hides among them, so that a change to a hidden one is
 * refused. Null where nothing changes: the cell left as it shows, every row already holding the value, or a field
 * declared read only. A refusal where the change cannot go to every row. A row that already holds the value is left out,
 * so Enter and then leaving the cell give it once.
 */
export function cellChange(
  kind: KindDecl,
  row: Row,
  column: TableColumn,
  typed: string | boolean,
  ticked: readonly Row[],
  shown: ReadonlySet<string>,
  units: Units,
): { refused: CellRefusal } | { values: RowValue[] } | null {
  if (column.readonly) return null
  const all = ticked.length > 1 && ticked.some((r) => r.id === row.id) ? ticked : [row]
  const same = column.kind === 'flag' ? typed === cellValue(row.record, column) : String(typed).trim() === cellText(kind, row.record, column, units)
  if (all.length < 2 && same) return null
  const refused = all.length > 1 ? bulkRefusal(kind, all, column, shown, units) : null
  if (refused !== null) return { refused }
  const values: RowValue[] = []
  for (const r of all) {
    const read = valueFor(kind, r.record, column, typed, units)
    if ('unread' in read) return { refused: { row: r.id, words: read.unread } }
    if (JSON.stringify(read.value ?? null) !== JSON.stringify(r.record[column.field] ?? null)) values.push({ id: r.id, record: r.record, value: read.value })
  }
  return values.length === 0 ? null : { values }
}

/**
 * Several lines pasted into a cell: one to a row, from `at` down the rows shown. Null for one line, an ordinary paste. A
 * paste is refused where the field is declared read only, where a line holds a tab (one column per paste), where the rows
 * from here down are fewer than the lines, where the search hides a row between the first row written and the last, and
 * where a row takes no such field or cannot read its line.
 */
export function pasteRows(
  kind: KindDecl,
  text: string,
  at: Row,
  column: TableColumn,
  rows: readonly Row[],
  allRows: readonly Row[],
  units: Units,
): { refused: CellRefusal } | { values: RowValue[] } | null {
  const lines = text.split(/\r?\n/)
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length < 2) return null
  if (column.readonly) return { refused: { row: at.id, words: unchanged(column) } }
  if (lines.some((l) => l.includes('\t'))) return { refused: { row: at.id, words: 'One column per paste' } }
  const start = rows.findIndex((r) => r.id === at.id)
  const down = rows.slice(start, start + lines.length)
  if (start < 0 || down.length < lines.length) return { refused: { row: at.id, words: `${lines.length} lines pasted, and ${start < 0 ? 0 : down.length} rows from here down` } }
  const shown = new Set(rows.map((r) => r.id))
  const from = allRows.findIndex((r) => r.id === down[0]!.id)
  const to = allRows.findIndex((r) => r.id === down[down.length - 1]!.id)
  const hidden = allRows.slice(from, to + 1).filter((r) => !shown.has(r.id))
  if (hidden.length > 0) return { refused: { row: hidden[0]!.id, words: `Hidden by the search: ${named(hidden)}` } }
  const values: RowValue[] = []
  for (const [i, r] of down.entries()) {
    if (!takesField(kind, r.record, column.field)) return { refused: { row: r.id, words: `${r.id} takes no ${column.label.toLowerCase()}` } }
    const read = valueFor(kind, r.record, column, lines[i]!, units)
    if ('unread' in read) return { refused: { row: r.id, words: `${r.id}: ${read.unread}` } }
    values.push({ id: r.id, record: r.record, value: read.value })
  }
  return { values }
}
