// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canonical, createRegistry, createStore, openVerb, replay, sha256, updateVerb, type Call, type FieldTable, type Json, type Registry, type Saved, type Store } from '..'
import { frozenCopy, plainCopy } from '../json'
import { create, person, toyRegistry } from './toy'

const PROTO = '__proto__'

/**
 * Text parsed from a file or a message gives an object whose key is really named __proto__. These tests build their
 * hostile values by parsing text, because an object literal with that name sets a prototype and holds no key.
 */
const HOSTILE = {
  snapshot: '{"entities":{"box":{"b1":{"Name":"x","__proto__":{"Dims":{"w":1,"h":2}}}}}}',
  meta: '{"__proto__":{"Dims":{"w":1,"h":2}}}',
  number: '{"__proto__":1}',
}
const parse = (text: string): Json => JSON.parse(text) as Json

/** The toy vocabulary with the open verb, an update verb with a free-form field, and a verb that writes a hostile value from inside apply. */
function keyed(): { registry: Registry; store: Store } {
  const registry = toyRegistry((r) => {
    r.kind('workspace', { prefix: 'w' })
    r.verb(openVerb(r, 'workspace'))
    r.verb(updateVerb('box', { name: { component: 'Name', schema: { type: 'string' } }, meta: { component: 'Meta', schema: { type: 'object' }, freeForm: true } }))
    r.verb<{ id: string; how: string }>({
      name: 'box.stamp', target: 'box',
      input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, how: { type: 'string' } }, required: ['id', 'how'], additionalProperties: false },
      apply: (d, i) => {
        if (i.how === 'add') d.add('box', 'b9', parse(`{"Name":"x","__proto__":${HOSTILE.number}}`) as { [c: string]: Json })
        if (i.how === 'set') d.set('box', i.id, 'Meta', parse(HOSTILE.meta))
        if (i.how === 'field') d.setField('box', i.id, 'Dims', 'w', parse(HOSTILE.number))
        if (i.how === 'component') d.set('box', i.id, '__proto__', 1)
        if (i.how === 'field name') d.setField('box', i.id, 'Dims', '__proto__', 1)
      },
      describe: (i) => `Stamp box ${i.id}`,
    })
  })
  const store = createStore(registry)
  const made = store.run([create('Alpha', 10, 20), create('Beta', 30, 40)], person)
  expect(made.ok).toBe(true)
  return { registry, store }
}
const shape = (store: Store) => ({ hash: store.hash(), undo: store.undoDepth, redo: store.redoDepth, log: store.log.length })
const open = (snapshot: Json): Call => ({ verb: 'workspace.open', input: { snapshot } })
const messages = (r: { ok: false; refusal: { issues: Array<{ message: string }> } }): string => r.refusal.issues.map((i) => i.message).join('; ')

describe('a key named __proto__ in what is opened, given or written', () => {
  it('is refused in the state to open, naming the key and where it sits, and the store is as it was', () => {
    const { store } = keyed()
    const before = shape(store)
    const r = store.run([open(parse(HOSTILE.snapshot))], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', at: 0, issues: [{ field: '/snapshot/entities/box/b1/__proto__' }] } })
    expect(r.ok === false && messages(r)).toContain('a key named __proto__')
    expect(shape(store)).toEqual(before)
    expect(store.get('box', 'b1')!.Dims).toEqual({ w: 10, h: 20 })
  })
  it('is refused by the open verb\'s own reading of the state, whoever calls it', () => {
    const { registry, store } = keyed()
    const issues = registry.verbs.get('workspace.open')!.validate!(store, { snapshot: parse(HOSTILE.snapshot) }, { calls: [], records: [] })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ field: '/snapshot/entities/box/b1/__proto__' })
    expect(issues[0]!.message).toContain('a key named __proto__')
  })
  it('is refused in a field of any verb, also where the schema leaves the keys free', () => {
    const { store } = keyed()
    const before = shape(store)
    const r = store.run([{ verb: 'box.update', input: { id: 'b1', set: { meta: parse(HOSTILE.meta) } } }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ field: '/set/meta/__proto__' }] } })
    expect(shape(store)).toEqual(before)
    expect(store.run([{ verb: 'box.update', input: { id: 'b1', set: { meta: { note: 'fine' } } } }], person).ok).toBe(true)
  })
  it.each<[string, string, string]>([
    ['an entity added with it in its components', 'add', "components/__proto__ is a key named __proto__"],
    ['a component set to a value that holds it', 'set', "Meta/__proto__ is a key named __proto__"],
    ['a field set to a value that holds it', 'field', "Dims.w/__proto__ is a key named __proto__"],
    ['a component named by it', 'component', 'cannot be the name of a component or a field'],
    ['a field named by it', 'field name', 'cannot be the name of a component or a field'],
  ])('is refused when a verb writes %s, and the store is as it was', (_title, how, message) => {
    const { store } = keyed()
    const before = shape(store)
    const r = store.run([{ verb: 'box.stamp', input: { id: 'b1', how } }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'apply', at: 0 } })
    expect(r.ok === false && messages(r)).toContain(message)
    expect(shape(store)).toEqual(before)
    expect(store.has('box', 'b9')).toBe(false)
  })
  it('is refused in the base of a store, naming where it sits', () => {
    const { registry } = keyed()
    const base = parse('{"entities":{"box":{"b1":{"Name":"x","__proto__":{"Dims":1}}}},"counters":{}}') as unknown as Saved['base']
    expect(() => createStore(registry, { base })).toThrow('the base holds a key named __proto__ at /entities/box/b1/__proto__')
  })
  it('is refused in an entry of a log being replayed, and the replay says so', () => {
    const { registry, store } = keyed()
    const saved = store.save()
    saved.log.push({ seq: saved.log.length, batch: 9, verb: 'box.update', input: parse('{"id":"b1","set":{"meta":{"__proto__":1}}}'), actor: 'person' })
    const back = replay(registry, saved)
    expect(back).toMatchObject({ ok: false, refusal: { reason: 'replay', at: saved.log.length - 1 } })
    expect(!back.ok && back.refusal.issues[0]!.message).toContain('a key named __proto__')
  })
  it('leaves a state that is opened and replayed with the same components in every entity as well as the same hash', () => {
    const { registry, store } = keyed()
    const next = { entities: { box: { b5: { Name: 'Five', Dims: { w: 1, h: 2 } }, b6: { Name: 'Six', Dims: { w: 3, h: 4 }, Meta: { note: 'n' } } } }, counters: { box: 6 } }
    expect(store.run([open(next)], person)).toMatchObject({ ok: true, changed: true })
    const back = replay(registry, store.save())
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.store.hash()).toBe(store.hash())
    for (const id of store.ids('box')) {
      expect(back.store.get('box', id)).toEqual(store.get('box', id))
      expect(Object.getPrototypeOf(back.store.get('box', id))).toBe(Object.prototype)
    }
    expect(back.store.ids('box')).toEqual(['b5', 'b6'])
  })
})

describe('a name that cannot be an id, a kind or a key', () => {
  const offered = { actor: 'person' as const, allowOfferedIds: true }
  const offer = (id: string): Call => ({ verb: 'box.create', input: { id, name: 'x', w: 1, h: 1 } })
  it('refuses an offered id named __proto__ by name, and the store is as it was', () => {
    const { store } = keyed()
    const before = shape(store)
    const r = store.run([offer(PROTO)], offered)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'apply', at: 0 } })
    expect(r.ok === false && messages(r)).toContain("'__proto__' cannot be an id")
    expect(shape(store)).toEqual(before)
  })
  it('takes an offered id that only the prototype chain knows, where it refuses __proto__', () => {
    const { store } = keyed()
    expect(store.run([offer('constructor')], offered)).toMatchObject({ ok: true, changed: true })
    expect(store.get('box', 'constructor')).toMatchObject({ Name: 'x' })
  })
  it('refuses a kind, a prefix and a group named __proto__ when they are registered', () => {
    expect(() => createRegistry().kind(PROTO, { prefix: 'p' })).toThrow('must not be named __proto__')
    expect(() => createRegistry().kind('thing', { prefix: PROTO })).toThrow('must not be named __proto__')
    expect(() => createRegistry().kind('thing', { prefix: 'p', group: PROTO })).toThrow('must not be named __proto__')
    expect(() => createRegistry().kind('constructor', { prefix: 'p', group: 'toString' })).not.toThrow()
  })
  it('is refused in the basis of a call, naming where it sits', () => {
    const { store } = keyed()
    const before = shape(store)
    const r = store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'Z' }, basis: parse(HOSTILE.meta) }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', at: 0, issues: [{ field: '/basis/__proto__' }] } })
    expect(r.ok === false && messages(r)).toContain('a key named __proto__')
    expect(shape(store)).toEqual(before)
    expect(store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'Z' }, basis: { why: 'fine' } }], person).ok).toBe(true)
  })
  it('is refused in the input of a read, naming where it sits', () => {
    const { store } = keyed()
    const r = store.read('entity.list', parse('{"kind":"box","filter":{"__proto__":1}}'))
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ field: '/filter/__proto__' }] } })
    expect(store.read('entity.list', { kind: 'box', filter: { Name: 'Alpha' } })).toMatchObject({ ok: true })
  })
  it('is refused as the name of a field in a table of fields', () => {
    const table = JSON.parse('{"name":{"component":"Name","schema":{"type":"string"}},"__proto__":{"component":"Meta","schema":{"type":"string"}}}') as FieldTable
    expect(() => updateVerb('box', table)).toThrow("a field of 'box' is named __proto__")
  })
  it('survives every copy a save and a replay make of a value, with the hash of the original and its components where they were', () => {
    const original = parse(HOSTILE.snapshot) as { entities: { box: { b1: { [k: string]: Json } } } }
    const stored = frozenCopy(original)
    const saved = plainCopy(stored)
    const replayed = frozenCopy(saved)
    for (const copy of [stored, saved, replayed]) {
      expect(sha256(canonical(copy))).toBe(sha256(canonical(original)))
      const b1 = copy.entities.box.b1
      expect(Object.keys(b1)).toEqual(['Name', PROTO])
      expect(Object.getOwnPropertyDescriptor(b1, PROTO)?.value).toEqual({ Dims: { w: 1, h: 2 } })
      expect(Object.getPrototypeOf(b1)).toBe(Object.prototype)
    }
  })
})
