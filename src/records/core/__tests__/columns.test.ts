// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fieldsTaken, quantityOf, tableColumns, takesField, variantOf } from '..'
import { FIXINGS, PARTS, SHELVES } from './toy'

describe("a kind's table columns", () => {
  it('gives a column per field in the kind order, a vector as three, the advanced ones last', () => {
    const columns = tableColumns(PARTS)
    expect(columns.map((c) => c.key)).toEqual(['size', 'stock', 'finish', 'at.x', 'at.y', 'at.z', 'made', 'kept', 'sides', 'locks', 'pair', 'layers', 'count', 'extra'])
    expect(columns.filter((c) => c.advanced).map((c) => c.field)).toEqual(['count', 'extra'])
  })

  it('edits a number, a choice, a flag and a free text in the cell, and shows any other value as text', () => {
    const by = Object.fromEntries(tableColumns(PARTS).map((c) => [c.key, c]))
    expect(by.size).toMatchObject({ kind: 'number', quantity: 'length', label: 'Size of the part', head: 'Size' })
    expect(by.stock).toMatchObject({ kind: 'choice', ref: 'stocks' })
    expect(by.finish).toMatchObject({ kind: 'choice', values: ['raw', 'painted'] })
    expect(by['at.y']).toMatchObject({ kind: 'number', field: 'at', axis: 1, quantity: 'length', label: 'Place y', head: 'Place y' })
    expect(by.kept!.kind).toBe('flag')
    expect(by.count).toMatchObject({ kind: 'number', advanced: true })
    expect(by.made!.kind).toBe('string')
    for (const key of ['sides', 'locks', 'pair', 'layers', 'extra']) expect(by[key]!.kind, key).toBe('text')
  })

  it('shows as text a string field a variant gives a kind of record to name, and marks a field declared read only', () => {
    const by = Object.fromEntries(tableColumns(FIXINGS).map((c) => [c.key, c]))
    expect([by.note!.kind, by.part!.kind]).toEqual(['string', 'text'])
    const held = tableColumns(SHELVES).find((c) => c.key === 'held')!
    expect(held).toMatchObject({ kind: 'number', readonly: true })
    expect(tableColumns(SHELVES).filter((c) => c.readonly).map((c) => c.key)).toEqual(['held'])
  })

  it('puts the tag first, as text changed in the form, and shows the union of the variants', () => {
    const columns = tableColumns(FIXINGS)
    expect(columns.map((c) => c.key)).toEqual(['by', 'note', 'part', 'load', 'turns'])
    expect(columns[0]).toMatchObject({ field: 'by', kind: 'text', tag: true })
    expect(Object.keys(SHELVES.fields).at(-1), 'precondition: a tag declared last').toBe('hung')
    expect(tableColumns(SHELVES).map((c) => c.key)).toEqual(['hung', 'width', 'held', 'parts', 'posts'])
  })
})

describe('the fields a record takes', () => {
  it('takes every field of a kind with no variants', () => {
    expect(fieldsTaken(PARTS, '')).toEqual(Object.keys(PARTS.fields))
    expect(takesField(PARTS, {}, 'count')).toBe(true)
  })

  it("takes the tag, the common fields and its variant's own, and a record with no variant the tag and the common ones", () => {
    expect(fieldsTaken(FIXINGS, 'weld')).toEqual(['by', 'note', 'part', 'load'])
    expect(fieldsTaken(FIXINGS, '')).toEqual(['by', 'note'])
    expect(fieldsTaken(FIXINGS, 'nail')).toEqual(['by', 'note'])
    expect(takesField(FIXINGS, { by: 'bolt' }, 'turns')).toBe(true)
    expect(takesField(FIXINGS, { by: 'weld' }, 'turns')).toBe(false)
    expect(takesField(FIXINGS, { by: 'glue' }, 'note')).toBe(true)
    expect(takesField(FIXINGS, {}, 'by')).toBe(true)
    expect(takesField(FIXINGS, {}, 'part')).toBe(false)
    expect(variantOf(FIXINGS, { by: 'weld' })).toBe('weld')
    expect(variantOf(FIXINGS, { by: 3 })).toBe('')
    expect(variantOf(PARTS, { by: 'weld' })).toBe('')
  })

  it("measures a field in the quantity its row's variant gives it, else the column's", () => {
    const load = tableColumns(FIXINGS).find((c) => c.field === 'load')!
    expect(quantityOf(FIXINGS, { by: 'weld' }, load)).toBe('lineLoad')
    expect(quantityOf(FIXINGS, { by: 'bolt' }, load)).toBe('force')
    expect(quantityOf(FIXINGS, {}, load)).toBe('force')
  })
})
