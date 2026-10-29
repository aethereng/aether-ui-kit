// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkShape, createStore, replay, type Json, type Registry, type Store } from '..'
import { create, person, toyRegistry } from './toy'

/** Names that only the prototype chain of a plain object knows: read by bracket, an id, a component or a field named like one finds a value that nothing holds. */
const INHERITED = ['constructor', 'toString', 'hasOwnProperty', 'valueOf']
const offered = { actor: 'person' as const, allowOfferedIds: true }

/** The toy vocabulary with a verb that writes a component, or a field of one, named `constructor`. */
function marking(): { registry: Registry; store: Store } {
  const registry = toyRegistry((r) => {
    r.verb<{ id: string; how: string }>({
      name: 'box.mark', target: 'box',
      input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, how: { type: 'string' } }, required: ['id', 'how'], additionalProperties: false },
      apply: (d, i) => {
        if (i.how === 'component') d.set('box', i.id, 'constructor', 1)
        if (i.how === 'field') d.setField('box', i.id, 'Dims', 'constructor', 1)
      },
      describe: (i) => `Mark box ${i.id}`,
    })
  })
  const store = createStore(registry)
  expect(store.run([create('Alpha', 10, 20), create('Beta', 30, 40)], person).ok).toBe(true)
  return { registry, store }
}

describe('an id named like a member of Object.prototype', () => {
  it('is found, listed and read through the projection, and kept by a snapshot and by a replay', () => {
    const { registry, store } = marking()
    for (const id of INHERITED) expect(store.run([{ verb: 'box.create', input: { id, name: id, w: 1, h: 1 } }], offered)).toMatchObject({ ok: true, changed: true })
    expect(store.ids('box')).toEqual(['b1', 'b2', ...INHERITED])
    for (const id of INHERITED) expect(store.get('box', id)).toMatchObject({ Name: id })
    const all = store.read('model.read', { path: '' })
    const projected = all.ok ? (all.value as { value: { box: { [id: string]: Json } } }).value.box : {}
    expect(Object.keys(projected)).toEqual(['b1', 'b2', ...INHERITED])
    expect(store.read('model.read', { path: 'box[constructor].Name' })).toEqual({ ok: true, value: { found: true, value: 'constructor' } })
    const rebuilt = createStore(registry, { base: store.snapshot() })
    expect(rebuilt.hash()).toBe(store.hash())
    expect(rebuilt.ids('box')).toEqual(store.ids('box'))
    const replayed = replay(registry, store.save())
    expect(replayed.ok && replayed.store.hash()).toBe(store.hash())
    expect(replayed.ok && replayed.store.ids('box')).toEqual(store.ids('box'))
  })
  it('is no clash in a saved base against another kind of the same id space, where one id held by two kinds still is', () => {
    const { registry } = marking()
    const box = { Name: 'x', Dims: { w: 1, h: 1 } }
    const ok = createStore(registry, { base: { entities: { box: { constructor: box }, crate: { c1: { Name: 'k' } } }, counters: {} } })
    expect(ok.ids('box')).toEqual(['constructor'])
    expect(ok.ids('crate')).toEqual(['c1'])
    expect(() => createStore(registry, { base: { entities: { box: { constructor: box }, crate: { constructor: { Name: 'k' } } }, counters: {} } })).toThrow("the base holds the id 'constructor' as a box and as a crate")
  })
})

describe('a component or a field named like a member of Object.prototype', () => {
  it('records no value before for one the entity does not hold, and undo and redo agree', () => {
    const { store } = marking()
    const made = store.run([{ verb: 'box.mark', input: { id: 'b1', how: 'component' } }], person)
    expect(made.ok && made.records).toMatchObject([{ op: 'set', component: 'constructor', after: 1 }])
    expect(made.ok && 'before' in made.records[0]!).toBe(false)
    expect(store.undo('person').ok).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(store.get('box', 'b1')!, 'constructor')).toBe(false)
    expect(store.redo('person').ok).toBe(true)
    expect(Object.getOwnPropertyDescriptor(store.get('box', 'b1')!, 'constructor')?.value).toBe(1)
  })
  it('records no value before for a field the component does not hold, and undo and redo agree', () => {
    const { store } = marking()
    const made = store.run([{ verb: 'box.mark', input: { id: 'b1', how: 'field' } }], person)
    expect(made.ok && made.records).toMatchObject([{ op: 'set', component: 'Dims', field: 'constructor', after: 1 }])
    expect(made.ok && 'before' in made.records[0]!).toBe(false)
    expect(store.undo('person').ok).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(store.get('box', 'b1')!.Dims as object, 'constructor')).toBe(false)
    expect(store.redo('person').ok).toBe(true)
    expect(Object.getOwnPropertyDescriptor(store.get('box', 'b1')!.Dims as object, 'constructor')?.value).toBe(1)
  })
  it('is missing from a value that does not hold it, where a schema requires it, and present in one that does', () => {
    const schema = { type: 'object', properties: {}, required: ['constructor'] }
    expect(checkShape(schema, {}, () => true)).toMatchObject([{ field: '/constructor' }])
    expect(checkShape(schema, { constructor: 1 }, () => true)).toEqual([])
  })
})
