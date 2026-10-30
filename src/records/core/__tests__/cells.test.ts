// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  STORED,
  bulkRefusal,
  cellChange,
  cellText,
  cellWords,
  choiceLabels,
  columnWidths,
  matches,
  numberText,
  ownUnit,
  pasteRows,
  tableColumns,
  textOf,
  valueFor,
  type TableColumn,
} from '..'
import { FIXINGS, PARTS, UNITS, row } from './toy'

const col = (kind: typeof PARTS, key: string): TableColumn => tableColumns(kind).find((c) => c.key === key)!
const size = col(PARTS, 'size')
const atY = col(PARTS, 'at.y')
const finish = col(PARTS, 'finish')
const stock = col(PARTS, 'stock')
const kept = col(PARTS, 'kept')
const load = col(FIXINGS, 'load')
const turns = col(FIXINGS, 'turns')

describe('what a cell shows', () => {
  it('shows a number at twelve significant figures, in the unit of its quantity', () => {
    expect(numberText(0.1 + 0.2)).toBe('0.3')
    expect(numberText(1e-20)).toBe('1e-20')
    expect(cellText(PARTS, { size: 0.0125 }, size, UNITS)).toBe('12.5')
    expect(cellText(PARTS, { size: 0.0125 }, size, STORED)).toBe('0.0125')
    expect(cellText(PARTS, { at: [1, 2, 3] }, atY, UNITS)).toBe('2000')
    expect(cellText(PARTS, { at: null }, atY, UNITS)).toBe('')
  })

  it('shows a list, a set of switches and an object as text, and nothing for a field the variant does not take', () => {
    expect(textOf(['a', 'b'])).toBe('a, b')
    expect(textOf([{ a: 1 }, { a: 2 }])).toBe('2 entries')
    expect(textOf({ a: true, b: false })).toBe('a')
    expect(textOf({ a: 1 })).toBe('{"a":1}')
    expect(textOf(null)).toBe('')
    expect(cellText(FIXINGS, { by: 'weld', turns: 3 }, turns, UNITS)).toBe('')
    expect(cellText(FIXINGS, { by: 'bolt', turns: 3 }, turns, UNITS)).toBe('3')
  })

  it("names a cell's own unit only where its variant gives another quantity than the column's", () => {
    expect(ownUnit(FIXINGS, { by: 'weld', load: 2000 }, load, UNITS)).toBe('kN/m')
    expect(ownUnit(FIXINGS, { by: 'bolt', load: 2000 }, load, UNITS)).toBe('')
    expect(cellText(FIXINGS, { by: 'weld', load: 2000 }, load, UNITS)).toBe('2')
    expect(cellWords(FIXINGS, { by: 'weld', load: 2000 }, load, UNITS)).toBe('2 kN/m')
    expect(cellWords(FIXINGS, { by: 'weld' }, load, UNITS)).toBe('none')
    expect(cellWords(PARTS, { finish: 'raw' }, finish, UNITS)).toBe('raw')
  })

  it('offers a choice its blank first: "(none)" where a blank is a value, "(choose)" where it is not', () => {
    expect(choiceLabels(PARTS, finish, ['raw', 'painted'])).toEqual(['(none)', 'raw', 'painted'])
    expect(choiceLabels(PARTS, stock, ['s1'])).toEqual(['(choose)', 's1'])
  })

  it('sizes a choice column to its blank alone where no row shown holds a value', () => {
    const measure = (t: string): number => t.length * 10
    const columns = [size, finish]
    const optionsOf = (c: TableColumn): readonly string[] => (c.key === 'finish' ? ['painted-coat'] : [])
    const blank = columnWidths(PARTS, columns, [row('p1', { size: 1 })], UNITS, optionsOf, measure)
    expect(blank.get('finish')).toBe(60 + 22 + 24)
    expect(blank.get('size')).toBe(40 + 22)
    const held = columnWidths(PARTS, columns, [row('p1', { size: 1, finish: 'raw' })], UNITS, optionsOf, measure)
    expect(held.get('finish')).toBe(120 + 22 + 24)
  })

  it("finds a row by its id or the text of a cell, in any case; an empty query finds every row", () => {
    const r = row('Beam-1', { finish: 'Painted', size: 0.5 })
    const columns = tableColumns(PARTS)
    expect(matches(PARTS, r, columns, 'beam', UNITS)).toBe(true)
    expect(matches(PARTS, r, columns, 'paint', UNITS)).toBe(true)
    expect(matches(PARTS, r, columns, '500', UNITS)).toBe(true)
    expect(matches(PARTS, r, columns, 'steel', UNITS)).toBe(false)
    expect(matches(PARTS, r, columns, '  ', UNITS)).toBe(true)
  })
})

describe('what a typed or chosen value gives a row', () => {
  it('reads a number in the unit shown and stores it as the record holds it; a minus sign reads as one', () => {
    expect(valueFor(PARTS, {}, size, '12.5', UNITS)).toEqual({ value: 0.0125 })
    expect(valueFor(PARTS, {}, size, '−2', STORED)).toEqual({ value: -2 })
    expect(valueFor(PARTS, {}, size, 'ten', UNITS)).toEqual({ unread: 'Number only' })
    expect(valueFor(PARTS, {}, size, ' ', UNITS)).toEqual({ unread: 'Number only' })
  })

  it("gives one number of a vector into the vector the row holds, or into zeros, and never blanks it", () => {
    expect(valueFor(PARTS, { at: [1, 2, 3] }, atY, '5000', UNITS)).toEqual({ value: [1, 5, 3] })
    expect(valueFor(PARTS, {}, atY, '5000', UNITS)).toEqual({ value: [0, 5, 0] })
    expect(valueFor(PARTS, { at: [1, 2, 3] }, atY, '', UNITS)).toEqual({ unread: 'Number only' })
  })

  it('gives a blank choice a null where a blank is a value, and asks for one where it is not; a flag its state', () => {
    expect(valueFor(PARTS, {}, finish, '', UNITS)).toEqual({ value: null })
    expect(valueFor(PARTS, {}, stock, '', UNITS)).toEqual({ unread: 'Choose one' })
    expect(valueFor(PARTS, {}, stock, 's2', UNITS)).toEqual({ value: 's2' })
    expect(valueFor(PARTS, {}, kept, true, UNITS)).toEqual({ value: true })
  })

  it("stores a number in the quantity its row's variant gives the field", () => {
    expect(valueFor(FIXINGS, { by: 'weld' }, load, '3', UNITS)).toEqual({ value: 3000 })
  })
})

describe('a change to several rows goes to every one or to none', () => {
  const p1 = row('p1', { size: 0.001, kept: false })
  const p2 = row('p2', { size: 0.002 })
  const p3 = row('p3', { size: 0.003 })
  const shown = new Set(['p1', 'p2', 'p3'])

  it('refuses where a ticked row is hidden by the search, naming it', () => {
    expect(bulkRefusal(PARTS, [p1, p2, p3], size, new Set(['p1']), UNITS)).toEqual({ row: 'p2', words: 'Ticked and hidden by the search: p2, p3' })
  })

  it('refuses where a row takes no such field, naming it', () => {
    const rows = [row('f1', { by: 'bolt' }), row('f2', { by: 'glue' })]
    expect(bulkRefusal(FIXINGS, rows, turns, new Set(['f1', 'f2']), UNITS)).toEqual({ row: 'f2', words: 'No turns in f2' })
  })

  it("refuses one number for rows whose cells measure different quantities, naming each row's unit", () => {
    const rows = [row('f1', { by: 'bolt' }), row('f2', { by: 'weld' })]
    expect(bulkRefusal(FIXINGS, rows, load, new Set(['f1', 'f2']), UNITS)).toEqual({ row: 'f2', words: 'Units differ: f1 kN, f2 kN/m' })
    expect(bulkRefusal(FIXINGS, [rows[0]!, row('f3', { by: 'bolt' })], load, new Set(['f1', 'f3']), UNITS)).toBeNull()
  })

  it('gives a change in a ticked row to every ticked row, each that does not hold it already', () => {
    const out = cellChange(PARTS, p1, size, '2', [p1, p2, p3], shown, UNITS)
    expect(out).toEqual({ values: [row('p1', p1.record), row('p3', p3.record)].map((r) => ({ ...r, value: 0.002 })) })
  })

  it('gives a change in a row that is not ticked to that row alone, and nothing for a cell left as it shows', () => {
    expect(cellChange(PARTS, p1, size, '5', [p2, p3], shown, UNITS)).toEqual({ values: [{ ...p1, value: 0.005 }] })
    expect(cellChange(PARTS, p1, size, ' 1 ', [], shown, UNITS)).toBeNull()
    expect(cellChange(PARTS, p1, kept, false, [], shown, UNITS)).toBeNull()
    expect(cellChange(PARTS, p1, kept, true, [], shown, UNITS)).toEqual({ values: [{ ...p1, value: true }] })
  })

  it('refuses a ticked change where one row cannot read the value, naming it, and names a bulk refusal first', () => {
    expect(cellChange(PARTS, p1, size, 'x', [p1, p2], shown, UNITS)).toEqual({ refused: { row: 'p1', words: 'Number only' } })
    expect(cellChange(PARTS, p1, size, '2', [p1, p2], new Set(['p1']), UNITS)).toEqual({ refused: { row: 'p2', words: 'Ticked and hidden by the search: p2' } })
  })
})

describe('lines pasted into a cell go one to a row, from that row down', () => {
  const rows = [row('p1', { size: 0.001 }), row('p2', { size: 0.002 }), row('p3', { size: 0.003 })]

  it('writes each line to a row as one change, one number of a vector each; a trailing line break is dropped', () => {
    const out = pasteRows(PARTS, '7\r\n8\n', rows[1]!, size, rows, rows, UNITS)
    expect(out).toEqual({ values: [{ ...rows[1]!, value: 0.007 }, { ...rows[2]!, value: 0.008 }] })
    const vector = pasteRows(PARTS, '1000\n2000', rows[0]!, atY, rows, rows, UNITS)
    expect(vector).toEqual({ values: [{ ...rows[0]!, value: [0, 1, 0] }, { ...rows[1]!, value: [0, 2, 0] }] })
  })

  it('leaves one line to an ordinary paste', () => {
    expect(pasteRows(PARTS, '7', rows[0]!, size, rows, rows, UNITS)).toBeNull()
    expect(pasteRows(PARTS, '7\n', rows[0]!, size, rows, rows, UNITS)).toBeNull()
  })

  it('refuses more lines than rows from there down, a tab, a hidden row between, and a line a row cannot read', () => {
    expect(pasteRows(PARTS, '1\n2\n3', rows[1]!, size, rows, rows, UNITS)).toEqual({ refused: { row: 'p2', words: '3 lines pasted, and 2 rows from here down' } })
    expect(pasteRows(PARTS, '1\t2\n3', rows[0]!, size, rows, rows, UNITS)).toEqual({ refused: { row: 'p1', words: 'One column per paste' } })
    const shown = [rows[0]!, rows[2]!]
    expect(pasteRows(PARTS, '1\n2', rows[0]!, size, shown, rows, UNITS)).toEqual({ refused: { row: 'p2', words: 'Hidden by the search: p2' } })
    expect(pasteRows(PARTS, '1\nx', rows[0]!, size, rows, rows, UNITS)).toEqual({ refused: { row: 'p2', words: 'p2: Number only' } })
  })

  it('refuses a line for a row whose variant takes no such field, naming the row', () => {
    const fixings = [row('f1', { by: 'bolt' }), row('f2', { by: 'glue' })]
    expect(pasteRows(FIXINGS, '1\n2', fixings[0]!, turns, fixings, fixings, UNITS)).toEqual({ refused: { row: 'f2', words: 'f2 takes no turns' } })
  })
})
