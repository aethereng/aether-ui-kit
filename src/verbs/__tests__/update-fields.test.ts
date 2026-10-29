// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { StoreRefusal, createStore, refStore, unreadKeywords, updateVerb, type Call, type FieldTable, type Json, type Registry, type Store, type UpdateCheck, type UpdateOptions } from '..'
import { create, person, proposed, toyRegistry } from './toy'

const DIM = { type: 'number', minimum: 1, maximum: 100 }
/** The toy box: optional fields of each kind of clearing (a component, a key, another word, a word that leaves null a value). */
const BOX: FieldTable = {
  name: { component: 'Name', schema: { type: 'string' } },
  w: { component: 'Dims', key: 'w', label: 'width', unit: 'mm', schema: DIM },
  h: { component: 'Dims', key: 'h', label: 'height', unit: 'mm', schema: DIM },
  depth: { component: 'Dims', key: 'depth', label: 'depth', unit: 'mm', schema: DIM, clear: null },
  note: { component: 'Note', schema: { type: 'string' }, clear: null },
  extra: { component: 'Extra', key: 'k', schema: DIM, clear: null },
  colour: { component: 'Colour', schema: { type: 'string', enum: ['red', 'blue'] }, clear: 'none' },
  tag: { component: 'Tag', schema: { anyOf: [{ type: 'string' }, { type: 'null' }] }, clear: false },
}
/** A bundle of boxes: the list of boxes is held as references, which the registry's relation for the component reads. */
const BUNDLE: FieldTable = {
  name: { component: 'Name', schema: { type: 'string' } },
  boxes: { component: 'Boxes', label: 'boxes', schema: { type: 'array', items: { type: 'string', 'x-ref': 'box' } }, store: refStore('box'), clear: null },
}

/** The toy vocabulary with a bundle kind and the update verbs of box and bundle; b1 Alpha 10 by 20, b2 Beta 30 by 40, k1 an empty bundle. */
function fields(options: { box?: FieldTable; boxOptions?: UpdateOptions; bundleOptions?: UpdateOptions } = {}): { registry: Registry; store: Store } {
  const registry = toyRegistry((r) => {
    r.kind('bundle', { prefix: 'k', relations: { Boxes: 'box' } })
    r.verb<{ name: string }>({
      name: 'bundle.create', target: 'bundle', mints: true,
      input: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
      apply: (d, i, c) => d.add('bundle', c.id!, { Name: i.name, Boxes: [] }),
      describe: (i) => `Add a bundle '${i.name}'`,
    })
    r.verb<{ id: string; k: number }>({
      name: 'box.extra', target: 'box',
      input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, k: { type: 'number' } }, required: ['id', 'k'], additionalProperties: false },
      apply: (d, i) => d.set('box', i.id, 'Extra', { k: i.k }),
      describe: (i) => `Give box ${i.id} an extra`,
    })
    r.verb(updateVerb('box', options.box ?? BOX, options.boxOptions))
    r.verb(updateVerb('bundle', BUNDLE, options.bundleOptions))
  })
  const store = createStore(registry)
  const made = store.run([create('Alpha', 10, 20), create('Beta', 30, 40), { verb: 'bundle.create', input: { name: 'Pack' } }], person)
  expect(made.ok).toBe(true)
  return { registry, store }
}
const update = (id: string, set: Json): Call => ({ verb: 'box.update', input: { id, set } })
const bundle = (set: Json, id = 'k1'): Call => ({ verb: 'bundle.update', input: { id, set } })
const shape = (store: Store) => ({ hash: store.hash(), undo: store.undoDepth, redo: store.redoDepth, log: store.log.length })
const boxOf = (store: Store, id = 'b1') => store.get('box', id)!

describe('removing an optional field', () => {
  it('removes an optional component when the call gives its clear word, records the value it took away, and undo puts it back', () => {
    const { store } = fields()
    store.run([update('b1', { note: 'x' })], person)
    const cleared = store.run([update('b1', { note: null })], person)
    expect(cleared.ok && cleared.records).toMatchObject([{ op: 'set', component: 'Note', before: 'x' }])
    expect(cleared.ok && 'after' in cleared.records[0]!).toBe(false)
    expect('Note' in boxOf(store)).toBe(false)
    expect(store.undo('person').ok).toBe(true)
    expect(boxOf(store).Note).toBe('x')
    expect(store.redo('person').ok).toBe(true)
    expect('Note' in boxOf(store)).toBe(false)
  })
  it('removes an optional key of an object component and leaves the other keys, and undo puts the key back', () => {
    const { store } = fields()
    store.run([update('b1', { depth: 5 })], person)
    expect(boxOf(store).Dims).toEqual({ w: 10, h: 20, depth: 5 })
    store.run([update('b1', { depth: null })], person)
    expect(boxOf(store).Dims).toEqual({ w: 10, h: 20 })
    store.undo('person')
    expect(boxOf(store).Dims).toEqual({ w: 10, h: 20, depth: 5 })
  })
  it('removes the component with the last key it holds, as one record, and undo puts the component back with that key', () => {
    const { store } = fields()
    store.run([{ verb: 'box.extra', input: { id: 'b1', k: 5 } }], person)
    expect(boxOf(store).Extra).toEqual({ k: 5 })
    const cleared = store.run([update('b1', { extra: null })], person)
    expect(cleared.ok && cleared.records).toMatchObject([{ op: 'set', component: 'Extra', before: { k: 5 } }])
    expect(cleared.ok && 'field' in cleared.records[0]!).toBe(false)
    expect('Extra' in boxOf(store)).toBe(false)
    expect(store.undo('person').ok).toBe(true)
    expect(boxOf(store).Extra).toEqual({ k: 5 })
  })
  it('counts the removal of a field the entity does not hold, also a key of a component it does not hold, as no change, and leaves no step', () => {
    const { store } = fields()
    const before = shape(store)
    expect(store.run([update('b1', { depth: null, note: null, colour: 'none', extra: null })], person)).toMatchObject({ ok: true, changed: false, records: [] })
    expect(shape(store)).toEqual(before)
  })
  it('takes the table\'s own word, and refuses null for a field whose word is another, naming the field', () => {
    const { store } = fields()
    store.run([update('b1', { colour: 'red' })], person)
    expect(boxOf(store).Colour).toBe('red')
    store.run([update('b1', { colour: 'none' })], person)
    expect('Colour' in boxOf(store)).toBe(false)
    const r = store.run([update('b1', { colour: null })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ field: '/set/colour' }] } })
  })
  it('keeps null as a value where the table gives another word, and removes the field with that word', () => {
    const { store } = fields()
    const stored = store.run([update('b1', { tag: null })], person)
    expect(stored.ok && stored.records).toMatchObject([{ component: 'Tag', after: null }])
    expect(boxOf(store).Tag).toBeNull()
    const cleared = store.run([update('b1', { tag: false })], person)
    expect(cleared.ok && cleared.records).toMatchObject([{ component: 'Tag', before: null }])
    expect('Tag' in boxOf(store)).toBe(false)
  })
  it('stores a text that the field accepts and that is not the clear word, where the word is a value the schema refuses', () => {
    const { store } = fields()
    expect(store.run([update('b1', { tag: 'unset' })], person)).toMatchObject({ ok: true, changed: true })
    expect(boxOf(store).Tag).toBe('unset')
  })
  it('refuses a table whose clear word is a value its own schema accepts, naming the field, because that value could never be stored', () => {
    const nullable = { anyOf: [{ type: 'string' }, { type: 'null' }] }
    expect(() => updateVerb('box', { tag: { component: 'Tag', schema: nullable, clear: 'unset' } })).toThrow(/clear word of the field 'tag' of 'box' is a value its schema accepts/)
    expect(() => updateVerb('box', { tag: { component: 'Tag', schema: nullable, clear: null } })).toThrow(/field 'tag'/)
    expect(() => updateVerb('box', { colour: { component: 'Colour', schema: { type: 'string', enum: ['red', 'blue'] }, clear: 'red' } })).toThrow(/field 'colour'/)
    expect(() => updateVerb('box', { colour: { component: 'Colour', schema: { type: 'string', enum: ['red', 'blue'] }, clear: 'none' } })).not.toThrow()
    expect(() => updateVerb('box', { note: { component: 'Note', schema: { type: 'string' }, clear: null } })).not.toThrow()
  })
  it('refuses null for a field that has no clear word, naming it', () => {
    const { store } = fields()
    const before = shape(store)
    const r = store.run([update('b1', { w: null })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ field: '/set/w' }] } })
    expect(shape(store)).toEqual(before)
  })
  it('does not run the check of a field on its clear word, and runs it on a value', () => {
    const check = vi.fn<(value: Json) => undefined>(() => undefined)
    const { store } = fields({ box: { name: BOX.name!, note: { component: 'Note', schema: { type: 'string' }, clear: null, check } } })
    store.run([update('b1', { note: null })], person)
    expect(check).not.toHaveBeenCalled()
    store.run([update('b1', { note: 'a' })], person)
    expect(check).toHaveBeenCalledTimes(1)
    expect(check.mock.calls[0]![0]).toBe('a')
  })
  it('offers the clear word in the call schema with a description that says so, in a schema the checker reads', () => {
    const verb = updateVerb('box', BOX)
    expect(unreadKeywords(verb.input)).toEqual([])
    const props = (verb.input as { properties: { set: { properties: Record<string, { anyOf?: unknown[]; description?: string }> } } }).properties.set.properties
    expect(props.depth).toMatchObject({ anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Depth, in mm. Give null to clear it.' })
    expect(props.colour).toMatchObject({ anyOf: [{ type: 'string' }, { enum: ['none'] }], description: "Give 'none' to clear it." })
    expect(props.w).not.toHaveProperty('anyOf')
  })
  it('writes the card line with the fields it clears, after the fields it sets', () => {
    const { store } = fields()
    const line = (set: Json): string | undefined => {
      const card = store.preview(proposed(store, [update('b1', set)]))
      return card.ok ? card.lines[0] : undefined
    }
    expect(line({ depth: null, name: 'X' })).toBe("Set name to 'X' and clear depth on box b1")
    expect(line({ depth: null })).toBe('Clear depth on box b1')
    expect(line({ note: null, depth: null })).toBe('Clear depth, note on box b1')
  })
})

describe('a rule across fields', () => {
  /** The width may not be more than twice the height, whichever of them the call sets. */
  const NARROW: UpdateOptions = {
    check: ({ after }) => (typeof after.w === 'number' && typeof after.h === 'number' && after.w > 2 * after.h ? [{ field: 'w', message: `the width ${after.w} is more than twice the height ${after.h}` }] : []),
  }
  it('refuses a call whose fields break it, naming the field it names and saying why, and leaves the store as it was', () => {
    const { store } = fields({ boxOptions: NARROW })
    const before = shape(store)
    const r = store.run([update('b1', { w: 50, h: 20 })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'validation', at: 0, issues: [{ kind: 'box', id: 'b1', field: '/set/w', message: 'the width 50 is more than twice the height 20' }] } })
    expect(shape(store)).toEqual(before)
    expect(store.run([update('b1', { w: 40, h: 20 })], person).ok).toBe(true)
  })
  it('gives the rule the values the entity holds for a field the call leaves out', () => {
    const { store } = fields({ boxOptions: NARROW })
    expect(store.run([update('b1', { w: 50 })], person)).toMatchObject({ ok: false, refusal: { issues: [{ field: '/set/w' }] } })
    expect(store.run([update('b1', { w: 40 })], person).ok).toBe(true)
  })
  it('is given the set as the call gives it and the values before and after as the components hold them, a removed field absent from after', () => {
    const seen: UpdateCheck[] = []
    const { store } = fields({ boxOptions: { check: (c) => (seen.push(c), []) } })
    store.run([update('b1', { depth: 5 })], person)
    seen.length = 0
    store.run([update('b1', { w: 11, depth: null })], person)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ id: 'b1', set: { w: 11, depth: null }, before: { name: 'Alpha', w: 10, h: 20, depth: 5 }, after: { name: 'Alpha', w: 11, h: 20 } })
    expect('depth' in seen[0]!.after).toBe(false)
    expect(Object.keys(seen[0]!.set)).toEqual(['w', 'depth'])
  })
  it('refuses what a rule says of a field outside the table as the call\'s own refusal, naming that field, and takes one about a field of the table the call does not set', () => {
    const rule: UpdateOptions = {
      check: ({ set }) => (set.w === 99 ? [{ field: 'nope', message: 'w may not be 99' }] : set.w === 98 ? [{ field: 'h', message: 'h is too small for this w' }] : []),
    }
    const { store } = fields({ boxOptions: rule })
    const before = shape(store)
    const outside = store.run([update('b1', { w: 99 })], person)
    expect(outside).toMatchObject({ ok: false, refusal: { reason: 'validation', at: 0, issues: [{ kind: 'box', id: 'b1', field: '/set' }] } })
    expect(outside.ok === false && outside.refusal.issues[0]!.message).toBe("the rule of box.update named 'nope', which is not a field of box: w may not be 99")
    expect(shape(store)).toEqual(before)
    expect(store.run([update('b1', { w: 98 })], person)).toMatchObject({ ok: false, refusal: { issues: [{ field: '/set/h', message: 'h is too small for this w' }] } })
  })
  it('refuses the call as a whole when the rule names no field', () => {
    const { store } = fields({ boxOptions: { check: () => [{ message: 'not today' }] } })
    expect(store.run([update('b1', { w: 11 })], person)).toMatchObject({ ok: false, refusal: { reason: 'validation', issues: [{ kind: 'box', id: 'b1', field: '/set', message: 'not today' }] } })
  })
  it('is not run for a call the schema refused or a field check refused, and is run for one that passes both', () => {
    const rule = vi.fn<(call: UpdateCheck) => Array<{ field?: string; message: string }>>(() => [])
    const { store } = fields({ box: { ...BOX, name: { ...BOX.name!, check: (v) => (v === '' ? 'a box needs a name' : undefined) } }, boxOptions: { check: rule } })
    expect(store.run([update('b1', { w: 500 })], person).ok).toBe(false)
    expect(store.run([update('b1', { name: '' })], person).ok).toBe(false)
    expect(rule).not.toHaveBeenCalled()
    expect(store.run([update('b1', { w: 12 })], person).ok).toBe(true)
    expect(rule).toHaveBeenCalledTimes(1)
  })
  it('is given references as the component holds them', () => {
    const seen: UpdateCheck[] = []
    const { store } = fields({ bundleOptions: { check: (c) => (seen.push(c), []) } })
    store.run([bundle({ boxes: ['b2'] })], person)
    store.run([bundle({ boxes: ['b1', 'b2'] })], person)
    expect(seen[1]).toMatchObject({ set: { boxes: ['b1', 'b2'] }, before: { boxes: [{ kind: 'box', id: 'b2' }] }, after: { boxes: [{ kind: 'box', id: 'b1' }, { kind: 'box', id: 'b2' }] } })
  })
})

describe('a field that is a list of references', () => {
  it('holds each entry as a reference in the order given, and the boxes it lists see it', () => {
    const { store } = fields()
    store.run([bundle({ boxes: ['b2', 'b1'] })], person)
    expect(store.get('bundle', 'k1')!.Boxes).toEqual([{ kind: 'box', id: 'b2' }, { kind: 'box', id: 'b1' }])
    expect(store.refs('box', 'b1')).toEqual([{ kind: 'bundle', id: 'k1', component: 'Boxes', at: '/Boxes/1' }])
  })
  it('names the entry of the list that points at no box, and leaves the store as it was', () => {
    const { store } = fields()
    const before = shape(store)
    const r = store.run([bundle({ boxes: ['b1', 'b9'] })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ kind: 'box', id: 'b9', field: '/set/boxes/1' }] } })
    expect(shape(store)).toEqual(before)
  })
  it('resolves a handle in the list to the id it names', () => {
    const { store } = fields()
    const r = store.run([create('G', 1, 1, 'g'), bundle({ boxes: [{ handle: 'g' }, 'b1'] })], person)
    expect(r.ok && r.ids).toEqual({ g: 'b3' })
    expect(store.get('bundle', 'k1')!.Boxes).toEqual([{ kind: 'box', id: 'b3' }, { kind: 'box', id: 'b1' }])
  })
  it('counts the same list as no change, and undoes and redoes a change to it', () => {
    const { store } = fields()
    store.run([bundle({ boxes: ['b1'] })], person)
    expect(store.run([bundle({ boxes: ['b1'] })], person)).toMatchObject({ ok: true, changed: false })
    store.run([bundle({ boxes: ['b2', 'b1'] })], person)
    store.undo('person')
    expect(store.get('bundle', 'k1')!.Boxes).toEqual([{ kind: 'box', id: 'b1' }])
    store.redo('person')
    expect(store.get('bundle', 'k1')!.Boxes).toEqual([{ kind: 'box', id: 'b2' }, { kind: 'box', id: 'b1' }])
  })
  it('removes the list with its clear word, which frees the boxes, and undo gives the list back', () => {
    const { store } = fields()
    store.run([bundle({ boxes: ['b1'] })], person)
    store.run([bundle({ boxes: null })], person)
    expect('Boxes' in store.get('bundle', 'k1')!).toBe(false)
    expect(store.refs('box', 'b1')).toEqual([])
    store.undo('person')
    expect(store.refs('box', 'b1')).toHaveLength(1)
  })
  it('keeps a box that a bundle lists from being deleted without its cascade', () => {
    const { store } = fields()
    store.run([bundle({ boxes: ['b1'] })], person)
    const r = store.run([{ verb: 'box.delete', input: { id: 'b1' } }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'validation' } })
    expect(r.ok === false && r.refusal.issues[0]?.message).toContain('bundle k1')
  })
  it('refuses a list that names one box twice at the entry that repeats it, and leaves the store as it was', () => {
    const { store } = fields()
    const before = shape(store)
    const r = store.run([bundle({ boxes: ['b1', 'b2', 'b1'] })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'validation', at: 0, issues: [{ kind: 'bundle', id: 'k1', field: '/set/boxes/2' }] } })
    expect(r.ok === false && r.refusal.issues[0]!.message).toBe("the list names box 'b1' twice, as entry 0 and as entry 2")
    expect(shape(store)).toEqual(before)
    expect(store.run([bundle({ boxes: ['b1', 'b2'] })], person).ok).toBe(true)
  })
  it('refuses a handle that resolves to a box the list already names, at its entry', () => {
    const { store } = fields()
    const r = store.run([create('G', 1, 1, 'g'), bundle({ boxes: ['b3', { handle: 'g' }] })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'validation', at: 1, issues: [{ field: '/set/boxes/1' }] } })
    expect(store.has('box', 'b3')).toBe(false)
  })
  it('throws a refusal that carries the pointer of the repeating entry when the hook is called on its own', () => {
    const thrown = (): unknown => {
      try {
        refStore('box')(['b1', 'b2', 'b1'])
      } catch (e) {
        return e
      }
      return undefined
    }
    expect(thrown()).toBeInstanceOf(StoreRefusal)
    expect((thrown() as StoreRefusal).at).toBe('/2')
  })
  it('a refusal raised inside a hand-written apply is returned as a refusal, with the store as it was', () => {
    const registry = toyRegistry((r) => {
      r.verb<{ id: string }>({
        name: 'box.pair', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'], additionalProperties: false },
        apply: (d, i) => d.set('box', i.id, 'Pair', refStore('box')([i.id, 'b2', i.id])),
        describe: (i) => `Pair box ${i.id}`,
      })
    })
    const store = createStore(registry)
    expect(store.run([create('A'), create('B')], person).ok).toBe(true)
    const before = { hash: store.hash(), undo: store.undoDepth, log: store.log.length }
    const r = store.run([{ verb: 'box.pair', input: { id: 'b1' } }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'apply', issues: [{ kind: 'box', field: '/2' }] } })
    expect(r.ok === false && r.refusal.issues[0]!.message).toBe("the list names box 'b1' twice, as entry 0 and as entry 2")
    expect({ hash: store.hash(), undo: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('holds one id as one reference and a list as a list through the same hook', () => {
    expect(refStore('box')('b1')).toEqual({ kind: 'box', id: 'b1' })
    expect(refStore('box')(['b1', 'b2'])).toEqual([{ kind: 'box', id: 'b1' }, { kind: 'box', id: 'b2' }])
    expect(refStore('box')([])).toEqual([])
  })
})
