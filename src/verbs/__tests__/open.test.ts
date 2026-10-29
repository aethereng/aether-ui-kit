// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, replay, unreadKeywords, openVerb, type Call, type ChangeEvent, type Json, type Registry, type Store } from '..'
import { create, person, toyRegistry } from './toy'

/** The toy vocabulary with a kind that stands for the whole state, and the verb that opens another state. */
function opener(extra: (r: Registry) => void = () => {}, actors?: Parameters<typeof openVerb>[2]): { registry: Registry; store: Store } {
  const registry = toyRegistry((r) => {
    r.kind('workspace', { prefix: 'w' })
    r.verb(openVerb(r, 'workspace', actors))
    extra(r)
  })
  const store = createStore(registry)
  const made = store.run([create('Alpha', 10, 20), create('Beta', 30, 40), { verb: 'label.create', input: { on: 'b1', text: 'first' } }], person)
  expect(made.ok).toBe(true)
  return { registry, store }
}
const NEXT: Json = {
  entities: { box: { b7: { Name: 'Seven', Dims: { w: 1, h: 2 } }, b8: { Name: 'Eight', Dims: { w: 3, h: 4 } } }, crate: { c1: { Name: 'K' } } },
  counters: { box: 20, crate: 1 },
}
const open = (snapshot: Json = NEXT): Call => ({ verb: 'workspace.open', input: { snapshot } })
const rename = (id: string, name: string): Call => ({ verb: 'box.rename', input: { id, name } })
const lists = (store: Store) => ['box', 'crate', 'label'].map((k) => store.ids(k))
const shape = (store: Store) => ({ hash: store.hash(), undo: store.undoDepth, redo: store.redoDepth, log: store.log.length })
const nextBox = (store: Store): string | undefined => {
  const r = store.run([create('n', 1, 1, 'n')], person)
  return r.ok ? r.ids.n : undefined
}

describe('opening another state', () => {
  it('removes every entity with what it held and its place, adds those of the new state, and is announced as an open', () => {
    const { store } = opener()
    const seen: ChangeEvent[] = []
    store.subscribe((e) => seen.push(e))
    const r = store.run([open()], person)
    expect(r).toMatchObject({ ok: true, changed: true, batch: 2 })
    expect(r.ok && r.records.map((x) => `${x.op}:${x.kind}:${x.id}`)).toEqual(['remove:box:b2', 'remove:box:b1', 'remove:label:l1', 'add:box:b7', 'add:box:b8', 'add:crate:c1'])
    expect(r.ok && r.records.filter((x) => x.op === 'remove').map((x) => [x.id, x.position])).toEqual([['b2', 1], ['b1', 0], ['l1', 0]])
    expect(r.ok && r.records.find((x) => x.id === 'b1')?.before).toEqual({ Name: 'Alpha', Dims: { w: 10, h: 20 } })
    expect(r.ok && new Set(r.records.map((x) => x.cause))).toEqual(new Set(['workspace.open']))
    expect(seen.map((e) => e.cause)).toEqual(['open'])
    expect(lists(store)).toEqual([['b7', 'b8'], ['c1'], []])
  })
  it('keeps the state it replaced in its records: undo restores it, in order, and redo opens the new one again', () => {
    const { store } = opener()
    const start = store.hash()
    const order = lists(store)
    const seen: ChangeEvent[] = []
    store.run([open()], person)
    const opened = store.hash()
    store.subscribe((e) => seen.push(e))
    expect(store.undo('person').ok).toBe(true)
    expect(store.hash()).toBe(start)
    expect(lists(store)).toEqual(order)
    expect(store.redo('person').ok).toBe(true)
    expect(store.hash()).toBe(opened)
    expect(lists(store)).toEqual([['b7', 'b8'], ['c1'], []])
    expect(seen.map((e) => e.cause)).toEqual(['undo', 'redo'])
  })
  it('takes the counters of the state it opens and gives the replaced ones back on undo', () => {
    const { store } = opener()
    store.run([open()], person)
    expect(nextBox(store)).toBe('b21')
    expect(store.undo('person').ok).toBe(true)
    expect(store.undo('person').ok).toBe(true)
    expect(nextBox(store)).toBe('b3')
  })
  it('takes the counters of the opened state again on redo', () => {
    const { store } = opener()
    store.run([open()], person)
    store.undo('person')
    store.redo('person')
    expect(nextBox(store)).toBe('b21')
  })
  it('leaves no step when the state it opens holds what is open and counts as it does', () => {
    const { store } = opener()
    const before = shape(store)
    const r = store.run([open(store.snapshot() as unknown as Json)], person)
    expect(r).toMatchObject({ ok: true, changed: false, records: [] })
    expect(shape(store)).toEqual(before)
    expect(nextBox(store)).toBe('b3')
  })
  it('reads a kind the counters leave out as 0, so listing one at 0 is no difference', () => {
    const { store } = opener()
    const before = shape(store)
    const same = { ...store.snapshot(), counters: { ...store.snapshot().counters, crate: 0 } } as unknown as Json
    expect(store.run([open(same)], person)).toMatchObject({ ok: true, changed: false, records: [] })
    expect(shape(store)).toEqual(before)
  })
  it('makes one step that replaces the counters when the state it opens holds what is open and counts differently, and undo gives them back', () => {
    const { store } = opener()
    const before = shape(store)
    const same = { ...store.snapshot(), counters: { box: 50 } } as unknown as Json
    const r = store.run([open(same)], person)
    expect(r).toMatchObject({ ok: true, changed: true, batch: 2 })
    expect(store.hash()).toBe(before.hash)
    expect([store.undoDepth, store.log.length]).toEqual([before.undo + 1, before.log + 1])
    expect(nextBox(store)).toBe('b51')
    expect(store.undo('person').ok).toBe(true)
    expect(store.undo('person').ok).toBe(true)
    expect(store.hash()).toBe(before.hash)
    expect(nextBox(store)).toBe('b3')
  })
  it('makes one step when the state it opens differs from the open one only in the order of the ids, takes that order, and undo gives the old order back', () => {
    const { store } = opener()
    const before = shape(store)
    const reordered: Json = { entities: { box: { b2: { Name: 'Beta', Dims: { w: 30, h: 40 } }, b1: { Name: 'Alpha', Dims: { w: 10, h: 20 } } }, label: { l1: { On: { kind: 'box', id: 'b1' }, Text: 'first' } } }, counters: store.snapshot().counters }
    // the precondition: the state it opens holds what is open, and the order is the one thing that differs
    expect(store.ids('box')).toEqual(['b1', 'b2'])
    expect(store.run([open(reordered)], person)).toMatchObject({ ok: true, changed: true })
    expect(store.ids('box')).toEqual(['b2', 'b1'])
    expect(store.hash()).toBe(before.hash)
    expect([store.undoDepth, store.log.length]).toEqual([before.undo + 1, before.log + 1])
    expect(store.undo('person').ok).toBe(true)
    expect(store.ids('box')).toEqual(['b1', 'b2'])
  })
  it('lists the entities in the order the new state gives them, also for an id both states hold', () => {
    const { store } = opener()
    const next: Json = { entities: { box: { b2: { Name: 'B2', Dims: { w: 1, h: 1 } }, b1: { Name: 'B1', Dims: { w: 1, h: 1 } }, b3: { Name: 'B3', Dims: { w: 1, h: 1 } } } } }
    store.run([open(next)], person)
    expect(store.ids('box')).toEqual(['b2', 'b1', 'b3'])
    store.undo('person')
    expect(store.ids('box')).toEqual(['b1', 'b2'])
    store.redo('person')
    expect(store.ids('box')).toEqual(['b2', 'b1', 'b3'])
  })
  it('opens, undoes and redoes a state of twenty thousand entities in good time', () => {
    const registry = toyRegistry((r) => {
      r.kind('workspace', { prefix: 'w' })
      r.verb(openVerb(r, 'workspace'))
    })
    const boxes: { [id: string]: Json } = {}
    const crates: { [id: string]: Json } = {}
    for (let i = 1; i <= 20000; i++) {
      boxes[`b${i}`] = { Name: `n${i}`, Dims: { w: 1, h: 2 } }
      crates[`c${i}`] = { Name: `m${i}` }
    }
    const store = createStore(registry, { base: { entities: { box: boxes }, counters: { box: 20000 } } })
    const started = performance.now()
    expect(store.run([open({ entities: { crate: crates }, counters: {} })], person)).toMatchObject({ ok: true, changed: true })
    expect(store.undo('person').ok).toBe(true)
    expect(store.redo('person').ok).toBe(true)
    // measured at well under a quarter of a second; a bound this wide only trips on a cost that grows with the square of the size
    expect(performance.now() - started).toBeLessThan(5000)
    expect([store.ids('box').length, store.ids('crate').length, store.ids('crate')[19999]]).toEqual([0, 20000, 'c20000'])
  })
  it('is named for the kind, targets it, is flagged as opening, is open to the person, and carries a schema the checker reads', () => {
    const { registry } = opener()
    const verb = registry.verbs.get('workspace.open')!
    expect([verb.name, verb.target, verb.opens, verb.actors]).toEqual(['workspace.open', 'workspace', true, ['person']])
    expect(unreadKeywords(verb.input)).toEqual([])
  })
})

describe('a state that cannot be opened', () => {
  it.each<[string, Json, 'validation' | 'input' | 'apply', string]>([
    ['a kind nobody registered', { entities: { boxx: {} } }, 'validation', "'boxx' is not a kind of this vocabulary"],
    ['an id with a reserved character', { entities: { box: { 'a~b': { Name: 'x' } } } }, 'validation', "'a~b' cannot be an id"],
    ['one id in two kinds of one group', { entities: { box: { b1: {} }, crate: { b1: {} } } }, 'validation', "the id 'b1' is held as a box and as a crate"],
    ['components that are not an object', { entities: { box: { b1: 5 } } }, 'validation', "box 'b1' holds no components"],
    ['entities of a kind that are not an object', { entities: { box: [] } }, 'validation', 'must be an object of components by id'],
    ['no entities', {}, 'validation', 'needs its entities'],
    ['a counter that is a fraction', { entities: {}, counters: { box: 1.5 } }, 'validation', "the counter of 'box' must be a whole number"],
    ['a counter of a kind nobody registered', { entities: {}, counters: { boxx: 1 } }, 'validation', "'boxx' is not a kind of this vocabulary"],
    ['a state that is not an object', 7, 'input', 'of type object'],
  ])('is refused when it holds %s, naming it, and the store is as it was', (_title, snapshot, reason, message) => {
    const { store } = opener()
    const before = shape(store)
    const r = store.run([open(snapshot)], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason, at: 0 } })
    expect(r.ok === false && r.refusal.issues.map((i) => i.message).join('; ')).toContain(message)
    expect(shape(store)).toEqual(before)
  })
  it('is refused when a component holds a number that is not finite, and the store is as it was', () => {
    const { store } = opener()
    const before = shape(store)
    const r = store.run([open({ entities: { box: { b1: { Name: 'x', Dims: { w: Number.NaN } } } } })], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'apply' } })
    expect(shape(store)).toEqual(before)
  })
  it('takes a batch to itself', () => {
    const { store } = opener()
    const before = shape(store)
    expect(store.run([open(), rename('b1', 'X')], person)).toMatchObject({ ok: false, refusal: { reason: 'input', at: 0 } })
    expect(store.run([rename('b1', 'X'), open()], person)).toMatchObject({ ok: false, refusal: { reason: 'input', at: 1 } })
    expect(shape(store)).toEqual(before)
  })
  it('is open to the person only, unless the verb is made open to a script too', () => {
    expect(opener().store.run([open()], { actor: 'script' })).toMatchObject({ ok: false, refusal: { reason: 'actor', at: 0 } })
    const both = opener(undefined, { actors: ['person', 'script'] })
    expect(both.store.run([open()], { actor: 'script' })).toMatchObject({ ok: true, changed: true })
  })
  it('is refused inside a gesture, and the gesture goes on', () => {
    const { store } = opener()
    const before = shape(store)
    const g = store.gesture({ actor: 'person' })
    expect(g.ok).toBe(true)
    if (!g.ok) return
    expect(g.gesture.move([open()])).toMatchObject({ ok: false, refusal: { reason: 'input' } })
    expect(shape(store)).toEqual(before)
    expect(g.gesture.end()).toMatchObject({ ok: true, changed: false })
  })
})

describe('what an open leaves behind', () => {
  it('runs no system, where an ordinary write to the same kind does', () => {
    let reacted = 0
    const { store } = opener((r) => r.system({ name: 'watch', on: { kind: 'box' }, run: () => void reacted++ }))
    reacted = 0
    store.run([open()], person)
    expect(reacted).toBe(0)
    store.run([rename('b7', 'Q')], person)
    expect(reacted).toBe(1)
  })
  it('enters the log as one entry that holds the state, and the log replays to the same state and counters', () => {
    const { registry, store } = opener()
    store.run([open()], person)
    store.undo('person')
    store.redo('person')
    const entry = store.log.find((e) => e.verb === 'workspace.open')
    expect(entry).toMatchObject({ batch: 2, actor: 'person', input: { snapshot: NEXT } })
    expect(store.log.filter((e) => e.verb === 'workspace.open')).toHaveLength(1)
    const back = replay(registry, store.save())
    expect(back.ok && back.store.hash()).toBe(store.hash())
    expect(back.ok && lists(back.store)).toEqual(lists(store))
    expect(back.ok && nextBox(back.store)).toBe('b21')
  })
  it('counts as one step against the undo limit, and says how many it trimmed', () => {
    const registry = toyRegistry((r) => {
      r.kind('workspace', { prefix: 'w' })
      r.verb(openVerb(r, 'workspace'))
    })
    const store = createStore(registry, { limit: 1 })
    store.run([create('Alpha')], person)
    const r = store.run([open()], person)
    expect(r).toMatchObject({ ok: true, trimmed: 1 })
    expect(store.undoDepth).toBe(1)
  })
})

describe('replacing the counters', () => {
  const fake = (counters: { [kind: string]: number }, opens: boolean) => (r: Registry) => {
    r.verb<{ id: string }>({
      name: 'box.reset', target: 'box', opens,
      input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'] },
      apply: (d) => d.useCounters(counters),
      describe: () => 'Reset',
    })
  }
  it('is refused to a verb that does not open another state', () => {
    const { store } = opener(fake({ box: 0 }, false))
    const before = shape(store)
    expect(() => store.run([{ verb: 'box.reset', input: { id: 'b1' } }], person)).toThrow(/only a verb that opens another state/)
    expect(shape(store)).toEqual(before)
  })
  it.each<[string, { [kind: string]: number }]>([
    ['a negative number', { box: -1 }],
    ['a fraction', { box: 2.5 }],
    ['a kind nobody registered', { boxx: 1 }],
  ])('is refused to a verb that opens, for %s, and the store is as it was', (_title, counters) => {
    const { store } = opener(fake(counters, true))
    const before = shape(store)
    expect(store.run([{ verb: 'box.reset', input: { id: 'b1' } }], person)).toMatchObject({ ok: false, refusal: { reason: 'apply' } })
    expect(shape(store)).toEqual(before)
  })
})
