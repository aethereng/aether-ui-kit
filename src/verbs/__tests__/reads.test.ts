// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, isValidId, parsePath, resolvePath, type Json, type Reader } from '..'
import { create, person, toyRegistry, toyStore } from './toy'

describe('read verbs', () => {
  it('entity.get returns the components, and null for an entity that is not there', () => {
    const { store } = toyStore()
    expect(store.read('entity.get', { kind: 'box', id: 'b1' })).toEqual({ ok: true, value: { Name: 'Alpha', Dims: { w: 10, h: 20 } } })
    expect(store.read('entity.get', { kind: 'box', id: 'b9' })).toEqual({ ok: true, value: null })
  })
  it('entity.list returns every entity of the kind, and only those that match a filter', () => {
    const { store } = toyStore()
    expect(store.read('entity.list', { kind: 'box' })).toMatchObject({ ok: true, value: [{ id: 'b1' }, { id: 'b2' }] })
    expect(store.read('entity.list', { kind: 'box', filter: { Name: 'Beta' } })).toMatchObject({ ok: true, value: [{ id: 'b2' }] })
    expect(store.read('entity.list', { kind: 'box', filter: { Name: 'Nobody' } })).toEqual({ ok: true, value: [] })
  })
  it('entity.list matches a filter against the components an entity holds itself, so a name the prototype chain knows matches nothing', () => {
    const { store } = toyStore()
    const chain = Object.prototype as unknown as { [name: string]: Json }
    chain.Shared = 'x'
    try {
      expect(({} as { [k: string]: Json }).Shared, 'the precondition: an empty object reads Shared as x').toBe('x')
      expect(store.read('entity.list', { kind: 'box', filter: { Shared: 'x' } })).toEqual({ ok: true, value: [] })
    } finally {
      delete chain.Shared
    }
  })
  it('entity.refs names what points at an entity through a declared relation, and nothing for an entity nothing points at', () => {
    const { store } = toyStore()
    expect(store.read('entity.refs', { kind: 'box', id: 'b1' })).toEqual({ ok: true, value: [{ kind: 'label', id: 'l1', component: 'On', at: '/On' }] })
    expect(store.read('entity.refs', { kind: 'box', id: 'b2' })).toEqual({ ok: true, value: [] })
  })
  it('model.read reads a whole kind, one entity by id, a component, a field and a position', () => {
    const { store } = toyStore()
    store.run([{ verb: 'box.rename', input: { id: 'b2', name: 'Beta' } }], person)
    const at = (path: string) => store.read('model.read', { path })
    expect(at('box[b1].Dims.w')).toEqual({ ok: true, value: { found: true, value: 10 } })
    expect(at('box[b2].Name')).toEqual({ ok: true, value: { found: true, value: 'Beta' } })
    expect(at('label.l1.On.id')).toEqual({ ok: true, value: { found: true, value: 'b1' } })
    expect(at('box')).toMatchObject({ ok: true, value: { found: true, value: { b1: { Name: 'Alpha' }, b2: { Name: 'Beta' } } } })
    expect(at('')).toMatchObject({ ok: true, value: { found: true, value: { box: {}, crate: {}, label: {} } } })
  })
  it('model.read says found: false for a path that holds nothing, and says why for one that does not parse', () => {
    const { store } = toyStore()
    expect(store.read('model.read', { path: 'box[b9].Name' })).toEqual({ ok: true, value: { found: false } })
    expect(store.read('model.read', { path: 'box[b1' })).toMatchObject({ ok: true, value: { found: false, why: expect.stringMatching(/dotted path/) } })
  })
  it('produces no records, no step and no log entry', () => {
    const { store } = toyStore()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    store.read('entity.get', { kind: 'box', id: 'b1' })
    store.read('entity.list', { kind: 'box' })
    store.read('model.read', { path: 'box' })
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('refuses an unknown read and an input that does not fit the read\'s schema', () => {
    const { store } = toyStore()
    expect(store.read('entity.nope', {})).toMatchObject({ ok: false, refusal: { reason: 'unknown_verb' } })
    expect(store.read('entity.get', { kind: 'box' })).toMatchObject({ ok: false, refusal: { reason: 'input' } })
  })
})

describe('the projection a vocabulary serves', () => {
  /** The read shape of a vocabulary of its own: the boxes as a list of records, nothing else. */
  const served = () => {
    const seen: Array<{ kinds: readonly string[]; boxes: number }> = []
    const registry = toyRegistry(() => {}, {
      project: (reader, kinds) => {
        seen.push({ kinds, boxes: reader.ids('box').length })
        return { boxes: reader.ids('box').map((id) => ({ id, name: (reader.get('box', id)?.Name ?? null) as Json })) }
      },
    })
    const store = createStore(registry)
    store.run([create('Alpha'), create('Beta')], person)
    return { store, seen }
  }
  it('is what model.read reads a path in, in place of the default one', () => {
    const { store } = served()
    expect(store.read('model.read', { path: 'boxes[1].name' })).toEqual({ ok: true, value: { found: true, value: 'Beta' } })
    expect(store.read('model.read', { path: 'boxes' })).toEqual({ ok: true, value: { found: true, value: [{ id: 'b1', name: 'Alpha' }, { id: 'b2', name: 'Beta' }] } })
    expect(store.read('model.read', { path: 'box' })).toEqual({ ok: true, value: { found: false } })
  })
  it('is given a reader of the store as it is committed and the names of the registered kinds in the order they were registered', () => {
    const { store, seen } = served()
    store.read('model.read', { path: 'boxes' })
    expect(seen[seen.length - 1]).toEqual({ kinds: ['box', 'crate', 'label'], boxes: 2 })
    store.run([create('Gamma')], person)
    store.read('model.read', { path: '' })
    expect(seen[seen.length - 1]!.boxes).toBe(3)
  })
  it('is given get, has, ids and refs and no handle on the maps behind them', () => {
    const held: Reader[] = []
    const registry = toyRegistry(() => {}, {
      project: (reader) => {
        held.push(reader)
        return {}
      },
    })
    const store = createStore(registry)
    store.run([create('Alpha'), { verb: 'label.create', input: { on: 'b1', text: 'first' } }], person)
    store.read('model.read', { path: '' })
    const reader = held[0]! as unknown as { [name: string]: unknown }
    expect(Object.keys(reader).sort()).toEqual(['get', 'has', 'ids', 'refs'])
    expect(reader.entities).toBeUndefined()
    expect(reader.counters).toBeUndefined()
    const read = held[0]!
    expect(read.has('box', 'b1')).toBe(true)
    expect(read.get('box', 'b1')).toEqual(store.get('box', 'b1'))
    expect(read.ids('box')).toEqual(['b1'])
    expect(read.refs('box', 'b1')).toEqual([{ kind: 'label', id: 'l1', component: 'On', at: '/On' }])
  })
  it('leaves the default projection to a registry that is given none, and the other reads as they are', () => {
    const { store } = toyStore()
    expect(store.read('model.read', { path: 'box[b1].Name' })).toEqual({ ok: true, value: { found: true, value: 'Alpha' } })
    const served2 = served().store
    expect(served2.read('entity.get', { kind: 'box', id: 'b1' })).toMatchObject({ ok: true, value: { Name: 'Alpha' } })
  })
})

describe('the path grammar', () => {
  it('reads fields, ids and positions', () => {
    expect(parsePath('a.b[c1].d[0]')).toEqual([{ field: 'a' }, { field: 'b' }, { bracket: 'c1' }, { field: 'd' }, { bracket: '0' }])
    expect(parsePath('')).toEqual([])
  })
  it('refuses a path that does not read', () => {
    for (const bad of ['.a', 'a..b', 'a.', 'a[', 'a[]', 'a{b}', 'a~b', 'a.[0]']) expect({ bad, parsed: parsePath(bad) }).toEqual({ bad, parsed: null })
  })
  it('indexes a list by position and an object by key, and finds nothing past the end', () => {
    const root = { list: [{ x: 1 }, { x: 2 }], o: { k: 'v' } }
    expect(resolvePath(root, parsePath('list[1].x')!)).toBe(2)
    expect(resolvePath(root, parsePath('o[k]')!)).toBe('v')
    expect(resolvePath(root, parsePath('list[2]')!)).toBeUndefined()
    expect(resolvePath(root, parsePath('list[01]')!)).toBeUndefined()
  })
  it('keeps every valid id addressable and refuses an id the grammar could not address', () => {
    for (const id of ['b1', 'e1234', 'T0_p_top_2_m', 'a-b', 'C15x33.9']) {
      expect({ id, valid: isValidId(id) }).toEqual({ id, valid: true })
      expect(resolvePath({ [id]: 1 }, parsePath(`[${id}]`)!)).toBe(1)
    }
    const tab = String.fromCharCode(9)
    for (const id of ['', '#x', 'a[b]', 'a{b}', 'a~b', 'a b', `a${tab}b`]) expect({ id: JSON.stringify(id), valid: isValidId(id) }).toEqual({ id: JSON.stringify(id), valid: false })
  })
})
