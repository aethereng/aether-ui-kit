// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, replay, toCallSchema, unreadKeywords, updateVerb, type Call, type FieldSpec, type FieldTable, type Json, type Registry, type Store, type UpdateOptions } from '..'
import { create, person, proposed, toyRegistry } from './toy'

/** The fields of the toy box, from one table: a text with a check, and two numbers inside one object component. */
const BOX: FieldTable = {
  name: { component: 'Name', schema: { type: 'string' }, check: (v) => (typeof v === 'string' && v.trim() === '' ? 'a box needs a name' : undefined) },
  w: { component: 'Dims', key: 'w', label: 'width', unit: 'mm', schema: { type: 'number', minimum: 1, maximum: 100 } },
  h: { component: 'Dims', key: 'h', label: 'height', unit: 'mm', schema: { type: 'number', minimum: 1, maximum: 100 } },
}
/** The fields of the toy label; `on` is held as a kind and an id, as the label's relation component holds it. */
const LABEL: FieldTable = {
  text: { component: 'Text', schema: { type: 'string' } },
  on: { component: 'On', label: 'box', schema: { type: 'string', 'x-ref': 'box' }, store: (id) => ({ kind: 'box', id: id as string }) },
}

/** A store over the toy vocabulary with `box.update` and `label.update` generated from the tables: b1 Alpha 10 by 20, b2 Beta, l1 on b1. */
function toy(options?: UpdateOptions, box: FieldTable = BOX): { registry: Registry; store: Store } {
  const registry = toyRegistry((r) => {
    r.verb(updateVerb('box', box, options))
    r.verb(updateVerb('label', LABEL))
  })
  const store = createStore(registry)
  const made = store.run([create('Alpha', 10, 20), create('Beta', 30, 40), { verb: 'label.create', input: { on: 'b1', text: 'first' } }], person)
  expect(made.ok).toBe(true)
  return { registry, store }
}
const update = (id: string, set: Json): Call => ({ verb: 'box.update', input: { id, set } })
const state = (store: Store) => ({ hash: store.hash(), depth: store.undoDepth, redo: store.redoDepth, log: store.log.length })

describe('a verb generated from a field table', () => {
  it('is named for the kind, targets it, and carries a schema the checker reads, laid out as the table is', () => {
    const verb = updateVerb('box', BOX)
    expect([verb.name, verb.target]).toEqual(['box.update', 'box'])
    expect(unreadKeywords(verb.input)).toEqual([])
    const shape = verb.input as { properties: { id: unknown; set: { properties: Record<string, { description?: string }>; additionalProperties: boolean } }; required: string[] }
    expect(shape.properties.id).toEqual({ type: 'string', 'x-ref': 'box' })
    expect(shape.required).toEqual(['id', 'set'])
    expect(Object.keys(shape.properties.set.properties)).toEqual(['name', 'w', 'h'])
    expect(shape.properties.set.additionalProperties).toBe(false)
    expect(shape.properties.set.properties.w!.description).toBe('Width, in mm.')
    expect(shape.properties.set.properties.name!.description).toBeUndefined()
  })
  it('keeps the description a field schema gives, and is registered by the registry like any verb', () => {
    const own = updateVerb('box', { name: { component: 'Name', unit: 'text', schema: { type: 'string', description: 'The box name.' } } })
    const shape = own.input as { properties: { set: { properties: { name: { description: string } } } } }
    expect(shape.properties.set.properties.name.description).toBe('The box name.')
    expect(toy().registry.verbs.has('box.update')).toBe(true)
  })
  it('serves as the call schema: the id also takes a handle, and the proposal schema lists the verb', () => {
    const { registry } = toy()
    const callSchema = toCallSchema(registry.verbs.get('box.update')!.input) as { properties: { id: { anyOf: unknown[] } } }
    expect(callSchema.properties.id.anyOf).toHaveLength(2)
    const variants = (registry.proposalSchema('script') as unknown as { properties: { items: { items: { anyOf: Array<{ properties: { verb: { enum: string[] } } }> } } } }).properties.items.items.anyOf
    expect(variants.map((v) => v.properties.verb.enum[0])).toEqual(expect.arrayContaining(['box.update', 'label.update']))
  })
})

describe('what a call may name', () => {
  it('sets a whole component and a field of an object component, in the order of the table whatever order the call writes them in', () => {
    const { store } = toy()
    const r = store.run([update('b2', { h: 41, name: 'X' })], person)
    expect(r.ok && r.records.map((x) => [x.component, x.field, x.before, x.after])).toEqual([['Name', undefined, 'Beta', 'X'], ['Dims', 'h', 40, 41]])
    expect(store.get('box', 'b2')).toEqual({ Name: 'X', Dims: { w: 30, h: 41 } })
  })
  it('refuses a field outside the table, naming it, and leaves the store as it was', () => {
    const { store } = toy()
    const before = state(store)
    const r = store.run([update('b1', { colour: 'red' })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', at: 0, issues: [{ field: '/set/colour' }] } })
    expect(state(store)).toEqual(before)
    expect(store.run([update('b1', { name: 'X' })], person).ok).toBe(true)
  })
  it.each<[string, Json, string, string]>([
    ['above its maximum', { w: 500 }, '/set/w', 'above 100'],
    ['below its minimum', { h: 0 }, '/set/h', 'below 1'],
    ['of the wrong type', { w: 'wide' }, '/set/w', 'of type number'],
    ['a name that is not text', { name: 7 }, '/set/name', 'of type string'],
  ])('refuses a value %s, naming the field, and leaves the store as it was', (_title, set, field, message) => {
    const { store } = toy()
    const before = state(store)
    const r = store.run([update('b1', set)], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ field }] } })
    expect(r.ok === false && r.refusal.issues[0]?.message).toContain(message)
    expect(state(store)).toEqual(before)
  })
  it('takes a value at the edge of its range', () => {
    const { store } = toy()
    expect(store.run([update('b1', { w: 100, h: 1 })], person)).toMatchObject({ ok: true, changed: true })
  })
  it('refuses a call that names no field, and an id nobody has', () => {
    const { store } = toy()
    expect(store.run([update('b1', {})], person)).toMatchObject({ ok: false, refusal: { reason: 'validation', issues: [{ kind: 'box', id: 'b1', field: '/set' }] } })
    expect(store.run([update('b9', { name: 'X' })], person)).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ kind: 'box', id: 'b9' }] } })
  })
  it('names the entity and the field a check of the table refuses', () => {
    const { store } = toy()
    const r = store.run([update('b1', { name: '  ' })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'validation', issues: [{ kind: 'box', id: 'b1', field: '/set/name', message: 'a box needs a name' }] } })
    expect(store.run([update('b1', { name: 'Fine' })], person).ok).toBe(true)
  })
  it('does not read a field the call leaves out from the prototype of its set', () => {
    const odd: FieldTable = { constructor: { component: 'Odd', schema: { type: 'string' } }, name: { component: 'Name', schema: { type: 'string' } } }
    const { store } = toy(undefined, odd)
    const r = store.run([update('b1', { name: 'X' })], person)
    expect(r.ok && r.records.map((x) => x.component)).toEqual(['Name'])
  })
})

describe('an update that changes nothing', () => {
  it('leaves no step, no log entry and no batch number, and keeps the redo tail; one that changes leaves one step', () => {
    const { store } = toy()
    store.run([update('b1', { name: 'X' })], person)
    store.undo('person')
    const before = state(store)
    const same = store.run([update('b1', { name: 'Alpha', w: 10 })], person)
    expect(same).toMatchObject({ ok: true, changed: false, records: [] })
    expect(same.ok && same.batch).toBeUndefined()
    expect(state(store)).toEqual(before)
    const moved = store.run([update('b1', { name: 'Alpha', w: 11 })], person)
    expect(moved.ok && moved.records[0]).toMatchObject({ component: 'Dims', field: 'w', before: 10, after: 11 })
    expect(moved.ok && moved.records.filter((x) => x.component === 'Name')).toEqual([])
    expect(store.undoDepth).toBe(before.depth + 1)
    expect(store.redoDepth).toBe(0)
  })
})

describe('the card line, undo, replay, references and actors', () => {
  it('describes the call with each field named by its label, its value and its unit, in the order of the table', () => {
    const { store } = toy()
    const card = store.preview(proposed(store, [{ verb: 'box.update', input: { id: 'b1', set: { h: 21, w: 11, name: 'X' } } }]))
    expect(card.ok && card.lines).toEqual(["Set name to 'X', width to 11 mm, height to 21 mm on box b1"])
  })
  it('undoes and redoes like any other verb, and its log replays to the same state', () => {
    const { registry, store } = toy()
    const before = store.hash()
    store.run([update('b1', { name: 'X', w: 50 }), update('b2', { h: 5 })], person)
    const after = store.hash()
    expect(store.undo('person').ok).toBe(true)
    expect(store.hash()).toBe(before)
    expect(store.redo('person').ok).toBe(true)
    expect(store.hash()).toBe(after)
    const back = replay(registry, store.save())
    expect(back.ok && back.store.hash()).toBe(after)
  })
  it('holds a reference as the component holds it, and sees no change when it names the same box again', () => {
    const { store } = toy()
    const moved = store.run([{ verb: 'label.update', input: { id: 'l1', set: { on: 'b2' } } }], person)
    expect(moved.ok && moved.records[0]).toMatchObject({ component: 'On', before: { kind: 'box', id: 'b1' }, after: { kind: 'box', id: 'b2' } })
    expect(store.refs('box', 'b2').map((x) => x.id)).toEqual(['l1'])
    const again = store.run([{ verb: 'label.update', input: { id: 'l1', set: { on: 'b2' } } }], person)
    expect(again).toMatchObject({ ok: true, changed: false })
    expect(store.run([{ verb: 'label.update', input: { id: 'l1', set: { on: 'b9' } } }], person)).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ kind: 'box', id: 'b9' }] } })
  })
  it('refuses a call from an actor the options leave out, and takes it from the actor that may', () => {
    const { store } = toy({ actors: ['person'] })
    expect(store.run([update('b1', { name: 'X' })], { actor: 'script' })).toMatchObject({ ok: false, refusal: { reason: 'actor', at: 0 } })
    expect(store.run([update('b1', { name: 'X' })], person).ok).toBe(true)
  })
})

describe('a field whose value is an object', () => {
  const META: FieldTable = {
    meta: {
      component: 'Meta',
      schema: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          inner: { type: 'object', properties: { a: { type: 'number' } } },
          list: { type: 'array', items: { type: 'object', properties: { n: { type: 'number' } } } },
          either: { anyOf: [{ type: 'object', properties: { k: { type: 'string' } } }, { type: 'null' }] },
        },
      },
    },
  }
  const meta = (set: Json): Call => ({ verb: 'box.update', input: { id: 'b1', set: { meta: set } } })
  it.each<[string, Json, string]>([
    ['at the top of the value', { tag: 'x', extra: 1 }, '/set/meta/extra'],
    ['one object down', { inner: { a: 1, b: 2 } }, '/set/meta/inner/b'],
    ['in an item of a list', { list: [{ n: 1 }, { n: 2, m: 3 }] }, '/set/meta/list/1/m'],
    ['in an alternative', { either: { k: 'x', z: 1 } }, '/set/meta/either/z'],
  ])('refuses a key the table does not list %s, naming it, and leaves the store as it was', (_title, value, pointer) => {
    const { store } = toy(undefined, META)
    const before = state(store)
    const r = store.run([meta(value)], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input' } })
    expect(r.ok === false && r.refusal.issues.map((i) => i.message).join('; ')).toContain(pointer)
    expect(state(store)).toEqual(before)
  })
  it('takes the keys the table lists, at every depth', () => {
    const { store } = toy(undefined, META)
    const value = { tag: 'x', inner: { a: 1 }, list: [{ n: 1 }, { n: 2 }], either: { k: 'y' } }
    expect(store.run([meta(value)], person)).toMatchObject({ ok: true, changed: true })
    expect(store.get('box', 'b1')!.Meta).toEqual(value)
    expect(store.run([meta({ either: null })], person).ok).toBe(true)
  })
  it('takes no key of a field whose schema lists none, unless the table marks the field free-form', () => {
    const open: FieldTable = { meta: { component: 'Meta', schema: { type: 'object' } } }
    const free: FieldTable = { meta: { component: 'Meta', schema: { type: 'object' }, freeForm: true } }
    expect(toy(undefined, open).store.run([meta({ anything: 1 })], person)).toMatchObject({ ok: false, refusal: { reason: 'input', issues: [{ field: '/set/meta/anything' }] } })
    expect(toy(undefined, open).store.run([meta({})], person)).toMatchObject({ ok: true })
    const loose = toy(undefined, free).store
    expect(loose.run([meta({ anything: 1, deeper: { more: [1, 2] } })], person)).toMatchObject({ ok: true, changed: true })
    expect(loose.get('box', 'b1')!.Meta).toEqual({ anything: 1, deeper: { more: [1, 2] } })
  })
  it('offers the closed schema as the call schema, an object at every depth closed, and the table itself unchanged', () => {
    const before = JSON.stringify(META)
    const verb = updateVerb('box', META)
    expect(unreadKeywords(verb.input)).toEqual([])
    const set = (verb.input as { properties: { set: { properties: { meta: { additionalProperties?: boolean; properties: Record<string, { additionalProperties?: boolean; items?: { additionalProperties?: boolean }; anyOf?: Array<{ additionalProperties?: boolean }> }> } } } } }).properties.set.properties.meta
    expect([set.additionalProperties, set.properties.inner!.additionalProperties, set.properties.list!.items!.additionalProperties, set.properties.either!.anyOf![0]!.additionalProperties]).toEqual([false, false, false, false])
    expect(JSON.stringify(META)).toBe(before)
  })
})

describe('a table that cannot be one source', () => {
  const number: FieldSpec = { component: 'Dims', key: 'w', schema: { type: 'number' } }
  it.each<[string, FieldTable, string]>([
    ['no field', {}, "the field table of 'box' holds no field"],
    ['a field with no schema', { a: { component: 'Name' } as unknown as FieldSpec }, "the field 'a' of 'box' needs a schema"],
    ['two fields writing one key', { a: number, b: { ...number } }, "the fields 'a' and 'b' of 'box' both write Dims.w"],
    ['a whole component beside a field of it', { a: { component: 'Dims', schema: { type: 'object' } }, b: number }, "the fields 'a' and 'b' of 'box' both write Dims"],
    ['a field with no component', { a: { component: '', schema: { type: 'string' } } }, "the field 'a' of 'box' needs a component"],
  ])('is refused when it holds %s', (_title, table, message) => {
    expect(() => updateVerb('box', table)).toThrow(message)
  })
  it('takes two fields in one object component under different keys', () => {
    expect(() => updateVerb('box', { a: number, b: { ...number, key: 'h' } })).not.toThrow()
  })
})
