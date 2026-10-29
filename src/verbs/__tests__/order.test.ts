// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, openVerb, replay, type Call, type Json, type Registry, type Snapshot, type Store } from '..'
import { person, toyRegistry } from './toy'

/** The toy vocabulary with the verb that opens another state. */
const registry = (): Registry =>
  toyRegistry((r) => {
    r.kind('workspace', { prefix: 'w' })
    r.verb(openVerb(r, 'workspace'))
  })
const taking = { actor: 'person' as const, allowOfferedIds: true }
const box = (id: string): Call => ({ verb: 'box.create', input: { name: `box ${id}`, w: 1, h: 1, id } })
/** The ids of the three boxes the tests hold, in the order they are added: two of them read as a list position, which an object lists first. */
const IDS = ['wall', '2', '1']
/** A store that holds the three boxes, added in that order. */
function held(): Store {
  const store = createStore(registry())
  expect(store.run(IDS.map(box), taking).ok).toBe(true)
  return store
}
const listed = (store: Store): string[] => {
  const r = store.read('entity.list', { kind: 'box' })
  if (!r.ok) throw new Error('the read was refused')
  return (r.value as Array<{ id: string }>).map((e) => e.id)
}
const open = (snapshot: Json): Call => ({ verb: 'workspace.open', input: { snapshot } })

describe('the order of ids that read as a list position', () => {
  it('is the order they were added in, for the ids of the store and for the listing', () => {
    const store = held()
    expect(store.ids('box')).toEqual(IDS)
    expect(listed(store)).toEqual(IDS)
  })

  it('is written beside the entities of a snapshot, because an object lists those ids first, and read back by a store made from it', () => {
    const snapshot = held().snapshot()
    // the precondition: the object lists the ids in another order than they were added in
    expect(Object.keys(snapshot.entities.box!)).toEqual(['1', '2', 'wall'])
    expect(snapshot.order).toEqual({ box: IDS })
    expect(createStore(registry(), { base: snapshot }).ids('box')).toEqual(IDS)
  })

  it('is not written for a kind whose ids an object lists in the order the store holds them', () => {
    const store = createStore(registry())
    store.run([{ verb: 'box.create', input: { name: 'a', w: 1, h: 1 } }, { verb: 'box.create', input: { name: 'b', w: 1, h: 1 } }], person)
    expect(store.ids('box')).toEqual(['b1', 'b2'])
    expect('order' in store.snapshot()).toBe(false)
  })

  it('gives the content hash whatever order the ids were added in', () => {
    const store = held()
    const reversed = createStore(registry())
    reversed.run([...IDS].reverse().map(box), taking)
    expect(reversed.ids('box')).toEqual([...IDS].reverse())
    expect(reversed.hash()).toBe(store.hash())
  })

  it('is kept by a save: the log replays over a base that lists it, and the store replayed holds the ids in the order', () => {
    const second = createStore(registry(), { base: held().snapshot() })
    expect(second.run([{ verb: 'box.create', input: { name: 'x', w: 1, h: 1 } }], person).ok).toBe(true)
    const saved = second.save()
    expect(saved.base.order).toEqual({ box: IDS })
    const again = replay(registry(), saved)
    expect(again.ok && again.store.ids('box')).toEqual([...IDS, 'b1'])
  })

  it('is taken by an open from the order its snapshot lists, and undo gives the order of the state it replaced', () => {
    const store = createStore(registry())
    expect(store.run([box('2'), box('1')], taking).ok).toBe(true)
    // the precondition: the state replaced holds its ids in an order an object does not list them in, so an undo that gave an object's order back would fail here
    expect(store.snapshot().order).toEqual({ box: ['2', '1'] })
    const snapshot = held().snapshot()
    expect(store.run([open(snapshot as unknown as Json)], person).ok).toBe(true)
    expect(store.ids('box')).toEqual(IDS)
    expect(store.undo('person').ok).toBe(true)
    expect(store.ids('box')).toEqual(['2', '1'])
  })

  it('is taken by an open whose snapshot differs from the store only in the order, as one step that undo takes back', () => {
    const store = held()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    // the precondition: the store holds the ids in the order they were added, and the snapshot lists them in the order an object gives
    expect(store.ids('box')).toEqual(IDS)
    const snapshot = { entities: store.snapshot().entities, counters: store.snapshot().counters, order: { box: ['1', '2', 'wall'] } }
    expect(store.run([open(snapshot as unknown as Json)], person)).toMatchObject({ ok: true, changed: true })
    expect(store.ids('box')).toEqual(['1', '2', 'wall'])
    expect(store.hash()).toBe(before.hash)
    expect([store.undoDepth, store.log.length]).toEqual([before.depth + 1, before.log + 1])
    expect(store.undo('person').ok).toBe(true)
    expect(store.ids('box')).toEqual(IDS)
  })

  it('is no step when the snapshot of an open lists the order the store holds', () => {
    const store = held()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    const snapshot = store.snapshot()
    // the precondition: the snapshot does list an order, and it is the store's
    expect(snapshot.order).toEqual({ box: IDS })
    expect(store.run([open(snapshot as unknown as Json)], person)).toMatchObject({ ok: true, changed: false, records: [] })
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
    expect(store.ids('box')).toEqual(IDS)
  })

  it('is the object\'s own order in a snapshot that lists none, which is all an object can say', () => {
    const snapshot: Snapshot = { entities: { box: Object.fromEntries(IDS.map((id) => [id, { Name: id, Dims: { w: 1, h: 1 } }])) }, counters: {} }
    expect(createStore(registry(), { base: snapshot }).ids('box')).toEqual(['1', '2', 'wall'])
  })
})

describe('an order a snapshot lists wrongly', () => {
  const entities = (): Snapshot['entities'] => ({ box: Object.fromEntries(IDS.map((id) => [id, { Name: id, Dims: { w: 1, h: 1 } }])) })
  const bad: Array<[string, unknown, RegExp]> = [
    ['names an id twice', { box: ['wall', '2', '2'] }, /order of box names '2' twice/],
    ['names an id the kind does not hold', { box: ['wall', '2', '9'] }, /order of box names '9', which the kind does not hold/],
    ['leaves an id out', { box: ['wall', '2'] }, /order of box leaves out '1'/],
    ['is no list', { box: 'wall' }, /order of box must be a list of ids/],
    ['names a kind nobody registered', { boxx: ['wall'] }, /order (names|of) 'boxx'|not a kind of this vocabulary/],
  ]

  it.each(bad)('is refused when a store is made from the base: it %s', (_, order, message) => {
    expect(() => createStore(registry(), { base: { entities: entities(), counters: {}, order } as unknown as Snapshot })).toThrow(message)
  })

  it.each(bad)('is refused by an open, naming the order, and the store is as it was: it %s', (_, order, message) => {
    const store = held()
    const before = { hash: store.hash(), ids: store.ids('box'), depth: store.undoDepth }
    const r = store.run([open({ entities: entities(), counters: {}, order } as unknown as Json)], person)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.refusal.reason).toBe('validation')
    expect(!r.ok && r.refusal.issues.map((i) => i.message).join('; ')).toMatch(message)
    expect({ hash: store.hash(), ids: store.ids('box'), depth: store.undoDepth }).toEqual(before)
  })

  // the order as a whole: a value that is no object of lists is refused, where an order that is absent is read as none
  const noObject: Array<[string, unknown]> = [['is null', null], ['is a list', []]]

  it.each(noObject)('is refused when a store is made from the base: the order as a whole %s', (_, order) => {
    expect(() => createStore(registry(), { base: { entities: entities(), counters: {}, order } as unknown as Snapshot })).toThrow(/order of the base must be an object of lists of ids by kind/)
  })

  it.each(noObject)('is refused by an open, and the store is as it was: the order as a whole %s', (_, order) => {
    const store = held()
    const before = { hash: store.hash(), ids: store.ids('box'), depth: store.undoDepth }
    const r = store.run([open({ entities: entities(), counters: {}, order } as unknown as Json)], person)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.refusal.reason).toBe('validation')
    expect(!r.ok && r.refusal.issues.map((i) => i.message).join('; ')).toMatch(/the order must be an object of lists of ids by kind/)
    expect({ hash: store.hash(), ids: store.ids('box'), depth: store.undoDepth }).toEqual(before)
  })
})

describe('which ids an object lists first', () => {
  /** The snapshot of a store that holds a box under each of these ids, added in this order. */
  const snapshotOf = (ids: string[]): Snapshot => {
    const store = createStore(registry())
    expect(store.run(ids.map(box), taking).ok).toBe(true)
    // the precondition: the store holds them in the order they were added
    expect(store.ids('box')).toEqual(ids)
    return store.snapshot()
  }

  it('writes the order for 4294967294, the last list position, which an object lists before an id added earlier', () => {
    const snapshot = snapshotOf(['4294967295', '4294967294'])
    expect(Object.keys(snapshot.entities.box!)).toEqual(['4294967294', '4294967295'])
    expect(snapshot.order).toEqual({ box: ['4294967295', '4294967294'] })
  })

  it.each<[string, string[]]>([
    ['4294967295 is past the last list position, so an object lists it after the id added before it', ['wall', '4294967295']],
    ['a leading zero, a sign and an exponent make no list position', ['-1', '01', '1e3']],
  ])('writes no order: %s', (_, ids) => {
    const snapshot = snapshotOf(ids)
    expect(Object.keys(snapshot.entities.box!)).toEqual(ids)
    expect('order' in snapshot).toBe(false)
  })
})
