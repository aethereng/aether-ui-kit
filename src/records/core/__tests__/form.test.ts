// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formFields, groupFields, issueField, keepOnVariant, type FormContext } from '..'
import { FIXINGS, PARTS } from './toy'

const held: Record<string, string[]> = { stocks: ['s1', 's2'], parts: ['p1'] }
const context: FormContext = { ids: (kind) => held[kind] ?? [], word: (kind) => `one of ${kind}` }
const byName = (fields: ReturnType<typeof formFields>) => Object.fromEntries(fields.map((f) => [f.name, f]))

describe('the form of a record', () => {
  it('shows every field of a kind with no variants, in the kind order, each in the control its value takes', () => {
    const fields = formFields(PARTS, '', context)
    expect(fields.map((f) => f.name)).toEqual(Object.keys(PARTS.fields))
    const kinds = Object.fromEntries(fields.map((f) => [f.name, f.kind]))
    expect(kinds).toEqual({
      size: 'number',
      stock: 'choice',
      finish: 'choice',
      at: 'vector',
      made: 'text',
      kept: 'flag',
      sides: 'switches',
      locks: 'switches',
      pair: 'app',
      layers: 'rows',
      count: 'number',
      extra: 'json',
    })
  })

  it('offers a choice of another record the ids the app holds, with the word that opens the one chosen', () => {
    const f = byName(formFields(PARTS, '', context))
    expect(f.stock).toMatchObject({ options: [{ value: 's1', label: 's1' }, { value: 's2', label: 's2' }], ref: 'stocks', refWord: 'one of stocks', required: true, blank: '(choose)' })
    expect(f.finish).toMatchObject({ options: [{ value: 'raw', label: 'raw' }, { value: 'painted', label: 'painted' }], required: false, clears: true, blank: '(none)' })
    expect(f.finish!.ref).toBeUndefined()
    const none = byName(formFields(PARTS, '', { ids: () => [] }))
    expect(none.stock).toMatchObject({ options: [], blank: '(no stocks yet)' })
    expect(none.stock!.refWord).toBeUndefined()
  })

  it('reads the shape of a switches value from its schema, and offers the names its declaration or its schema gives', () => {
    const f = byName(formFields(PARTS, '', context))
    expect(f.sides).toMatchObject({ holds: 'names', options: [{ value: 'left', label: 'left' }, { value: 'right', label: 'right' }, { value: 'top', label: 'top' }] })
    expect(f.locks).toMatchObject({ holds: 'flags', options: [{ value: 'a', label: 'Lock A' }, { value: 'b', label: 'Lock B' }], nullable: true, clears: false })
  })

  it("marks the app's own field and its fixed count, and a rows field's columns with the records a reference column offers", () => {
    const f = byName(formFields(PARTS, '', context))
    expect(f.pair).toMatchObject({ kind: 'app', fixed: 2 })
    expect(f.layers!.columns).toEqual([
      { key: 'depth', label: 'Depth', quantity: 'length' },
      { key: 'stock', label: 'Stock', options: [{ value: 's1', label: 's1' }, { value: 's2', label: 's2' }] },
    ])
    expect(f.size).toMatchObject({ quantity: 'length', group: 'Shape', shape: { type: 'number' } })
    expect(f.at).toMatchObject({ quantity: 'length', nullable: true })
    expect(f.count).toMatchObject({ advanced: true })
  })

  it("shows the tag, the common fields and the variant's own, and requires what the variant requires", () => {
    const f = formFields(FIXINGS, 'weld', context)
    expect(f.map((x) => x.name)).toEqual(['by', 'note', 'part', 'load'])
    expect(f.map((x) => x.required)).toEqual([true, false, true, true])
    expect(formFields(FIXINGS, '', context).map((x) => x.name)).toEqual(['by', 'note'])
  })

  it('names the kind a field refers to under its variant, and measures it in the quantity the variant gives it', () => {
    const bolt = byName(formFields(FIXINGS, 'bolt', context))
    const weld = byName(formFields(FIXINGS, 'weld', context))
    expect(bolt.part).toMatchObject({ kind: 'choice', ref: 'parts', options: [{ value: 'p1', label: 'p1' }] })
    expect(weld.part).toMatchObject({ kind: 'choice', ref: 'stocks' })
    expect(bolt.load!.quantity).toBe('force')
    expect(weld.load!.quantity).toBe('lineLoad')
  })

  it('offers each variant whose needs the app holds a record of, and the variant shown', () => {
    const tag = (variant: string, ids: FormContext['ids']) => formFields(FIXINGS, variant, { ids })[0]!.options.map((o) => o.value)
    expect(tag('', (k) => held[k] ?? [])).toEqual(['bolt', 'weld', 'glue'])
    expect(tag('', () => [])).toEqual(['glue'])
    expect(tag('weld', () => [])).toEqual(['weld', 'glue'])
    expect(formFields(FIXINGS, '', context)[0]!.options[0]).toEqual({ value: 'bolt', label: 'A bolt' })
  })

  it('groups the plain fields in the order their groups first appear, the fields of no group first, and keeps the advanced apart', () => {
    const { groups, advanced } = groupFields(formFields(PARTS, '', context))
    expect(groups.map((g) => g.name)).toEqual(['', 'Shape'])
    expect(groups[1]!.fields.map((f) => f.name)).toEqual(['size', 'at'])
    expect(groups[0]!.fields.map((f) => f.name)).toEqual(['stock', 'finish', 'made', 'kept', 'sides', 'locks', 'pair', 'layers'])
    expect(advanced.map((f) => f.name)).toEqual(['count', 'extra'])
  })
})

describe('a change of variant', () => {
  it('keeps the values of the fields the new variant shares with the old, and drops the rest', () => {
    const fields = formFields(FIXINGS, 'weld', context)
    expect(keepOnVariant(FIXINGS, 'weld', fields, { by: 'bolt', note: 'n', load: 5, turns: 3 })).toEqual({ by: 'weld', note: 'n', load: 5 })
  })

  it('blanks a choice the new variant cannot offer, and starts from nothing when no variant is chosen', () => {
    const fields = formFields(FIXINGS, 'weld', context)
    expect(keepOnVariant(FIXINGS, 'weld', fields, { by: 'bolt', part: 'p1' })).toEqual({ by: 'weld' })
    expect(keepOnVariant(FIXINGS, 'weld', fields, { by: 'bolt', part: 's2' })).toEqual({ by: 'weld', part: 's2' })
    expect(keepOnVariant(FIXINGS, '', fields, { by: 'bolt', note: 'n' })).toEqual({})
  })
})

describe('the field a refusal belongs to', () => {
  it('reads the id, a field of a set or a record, and a place inside a field, by its place', () => {
    expect(issueField({ field: '/id' })).toBe('id')
    expect(issueField({ field: '/set/size' })).toBe('size')
    expect(issueField({ field: '/record/layers/0/depth' })).toBe('layers')
    expect(issueField({})).toBeUndefined()
  })
})
