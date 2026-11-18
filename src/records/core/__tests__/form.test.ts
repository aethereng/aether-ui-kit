// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { STORED, formFields, groupFields, issueField, keepOnVariant, placeholderOf, type FormContext } from '..'
import type { Json } from '../../../verbs'
import { FIXINGS, PARTS, SHELVES, UNITS } from './toy'

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
      { key: 'push', label: 'Push', quantity: 'force', vector: true },
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

  it('shows the fields in the kind order, a tag declared last last, and requires the tag though it is optional', () => {
    const f = formFields(SHELVES, 'wall', context)
    expect(f.map((x) => x.name)).toEqual(['width', 'held', 'parts', 'posts', 'outline', 'hung'])
    expect(SHELVES.fields.hung!.optional, 'precondition: an optional tag').toBe(true)
    expect(byName(f).hung!.required).toBe(true)
    expect(byName(f).width!.required).toBe(false)
  })

  it('offers a list of references one choice per entry, of the records the app holds, a fixed count where its schema sets one', () => {
    const f = byName(formFields(SHELVES, 'wall', context))
    expect(f.parts).toMatchObject({ kind: 'refList', options: [{ value: 'p1', label: 'p1' }] })
    expect(f.parts!.fixed).toBeUndefined()
    expect(f.posts).toMatchObject({ kind: 'refList', fixed: 2, options: [{ value: 's1', label: 's1' }, { value: 's2', label: 's2' }] })
    expect(f.held).toMatchObject({ kind: 'number', readonly: true })
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

describe('what a field shows greyed where it holds no value', () => {
  const view = (name: string, kind = PARTS, variant = '') => formFields(kind, variant, context).find((f) => f.name === name)!

  it('shows a number in its unit at the digits a held number shows', () => {
    expect(placeholderOf(view('size'), 0.0125, UNITS)).toBe('12.5')
    expect(placeholderOf(view('size'), 0.0125, STORED)).toBe('0.0125')
    expect(placeholderOf(view('size'), 0.30000000000000004, STORED)).toBe('0.3')
    expect(placeholderOf(view('count'), 3, UNITS), 'a number of no quantity').toBe('3')
  })

  it('shows a free text as it is, and nothing for an empty one', () => {
    expect(placeholderOf(view('made'), 'Ann', UNITS)).toBe('Ann')
    expect(placeholderOf(view('made'), '', UNITS)).toBeUndefined()
  })

  it('shows each part of three numbers in the unit, and none for a part that is not a number', () => {
    expect(placeholderOf(view('at'), [0.1, 0.2, 0.30000000000000004], UNITS)).toEqual(['100', '200', '300'])
    expect(placeholderOf(view('at'), [1, null, 'x'], STORED)).toEqual(['1', undefined, undefined])
    expect(placeholderOf(view('at'), [], STORED), 'no part is a number').toBeUndefined()
    expect(placeholderOf(view('at'), [1], STORED), 'the parts after the last').toEqual(['1', undefined, undefined])
  })

  it('shows nothing for a value of another shape than its control holds', () => {
    for (const other of [undefined, null, 'ten', true, [1], { k: 1 }]) expect(placeholderOf(view('size'), other, UNITS), JSON.stringify(other)).toBeUndefined()
    for (const other of [undefined, null, 5, true, ['a'], { k: 1 }]) expect(placeholderOf(view('made'), other, UNITS), JSON.stringify(other)).toBeUndefined()
    for (const other of [undefined, null, 5, 'x', true, { k: 1 }]) expect(placeholderOf(view('at'), other, UNITS), JSON.stringify(other)).toBeUndefined()
  })

  it('shows nothing in any other control', () => {
    const others: [string, Json][] = [
      ['stock', 's1'],
      ['kept', true],
      ['kept', [1, 2, 3]],
      ['sides', ['top']],
      ['sides', [1, 2, 3]],
      ['locks', { a: true }],
      ['layers', [{ depth: 1, stock: 's1', push: [1, 2, 3] }]],
      ['extra', { k: 1 }],
      ['pair', ['s1', 's2']],
    ]
    for (const [name, value] of others) expect(placeholderOf(view(name), value, UNITS), name).toBeUndefined()
    expect(placeholderOf(view('outline', SHELVES, 'wall'), [[1, 2, 3]], UNITS), 'a summary').toBeUndefined()
    expect(placeholderOf(view('posts', SHELVES, 'wall'), ['s1', 's2'], UNITS), 'a list of references').toBeUndefined()
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
