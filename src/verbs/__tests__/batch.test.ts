// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Refuse, createStore, replay, type ApplyContext, type BatchSoFar, type Call, type ChangeEvent, type ChangeRecord, type Draft, type Json, type Schema, type Store } from '..'
import { create, person, proposed, script, toyRegistry, toyStore } from './toy'

const rename = (id: string, name: string): Call => ({ verb: 'box.rename', input: { id, name } })
const resize = (id: string, w?: number, h?: number): Call => ({ verb: 'box.resize', input: { id, ...(w === undefined ? {} : { w }), ...(h === undefined ? {} : { h }) } })

describe('a batch is atomic and one undo step', () => {
  it('makes three valid verbs one undo step, one batch number and one log group', () => {
    const { store } = toyStore()
    const depth = store.undoDepth
    const r = store.run([rename('b1', 'A2'), resize('b2', 5), create('Gamma')], person)
    expect(r.ok && r.changed).toBe(true)
    expect(store.undoDepth).toBe(depth + 1)
    expect(new Set(store.log.slice(-3).map((e) => e.batch)).size).toBe(1)
    expect(r.ok && new Set(r.records.map((x) => x.batch)).size).toBe(1)
  })
  it('changes the store, the stack and the log by nothing when the third verb is invalid', () => {
    const { store } = toyStore()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length, ids: store.ids('box') }
    const r = store.run([rename('b1', 'A2'), create('Gamma'), resize('b2', 500)], person)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.refusal).toMatchObject({ reason: 'input', at: 2 })
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length, ids: store.ids('box') }).toEqual(before)
  })
  it('refuses at the first verb that fails, naming its place in the batch', () => {
    const { store } = toyStore()
    const r = store.run([rename('b1', 'A2'), rename('b9', 'x'), resize('b2', 500)], person)
    expect(r.ok === false && r.refusal.at).toBe(1)
    expect(r.ok === false && r.refusal.issues[0]).toMatchObject({ kind: 'box', id: 'b9' })
  })
  it('lets a later verb of the batch see what an earlier one made', () => {
    const { store } = toyStore()
    const r = store.run([create('Gamma', 10, 10, 'g'), { verb: 'label.create', input: { on: { handle: 'g' }, text: 'new' } }], person)
    expect(r.ok).toBe(true)
    const g = r.ok ? r.ids.g : undefined
    expect(g).toBeDefined()
    expect(store.refs('box', g!).map((x) => x.kind)).toEqual(['label'])
  })
  it('refuses a reference to a box no earlier verb made, where it would pass if the box existed', () => {
    const { store } = toyStore()
    const r = store.run([{ verb: 'label.create', input: { on: 'b9', text: 'x' } }], person)
    expect(r.ok === false && r.refusal.reason).toBe('input')
    expect(store.run([{ verb: 'label.create', input: { on: 'b2', text: 'x' } }], person).ok).toBe(true)
  })
})

describe('an input that changes nothing leaves no step', () => {
  it('leaves the stack, the log and the hash as they were, and reports no change', () => {
    const { store } = toyStore()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    const r = store.run([rename('b1', 'Alpha'), resize('b2', 30, 40)], person)
    expect(r.ok && r.changed).toBe(false)
    expect(r.ok && r.records).toEqual([])
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('does leave one step when the same shape of input does change something', () => {
    const { store } = toyStore()
    const depth = store.undoDepth
    expect(store.run([rename('b1', 'Alpha2')], person).ok).toBe(true)
    expect(store.undoDepth).toBe(depth + 1)
  })
  it('keeps the one record of a batch that holds two unchanged writes and one that changes', () => {
    const { store } = toyStore()
    const r = store.run([rename('b1', 'Alpha'), rename('b2', 'Beta2'), resize('b1', 10)], person)
    expect(r.ok && r.records.map((x) => `${x.kind}.${x.id}.${x.component}`)).toEqual(['box.b2.Name'])
  })
  it('does not consume a batch number or clear the redo tail', () => {
    const { store } = toyStore()
    store.run([rename('b1', 'X')], person)
    store.undo('person')
    expect(store.redoDepth).toBe(1)
    store.run([rename('b1', 'Alpha')], person)
    expect(store.redoDepth).toBe(1)
    const next = store.run([rename('b1', 'Y')], person)
    expect(next.ok && next.batch).toBe(3)
  })
})

describe('a batch whose writes cancel is no change', () => {
  const cancel = [rename('b1', 'Z'), rename('b1', 'Alpha')]
  const makeAndDelete: Call[] = [create('t', 1, 1, 't'), { verb: 'box.delete', input: { id: { handle: 't' } } }]

  it('leaves both stacks, the log, the hash and the listeners as they were, and the redo tail still redoes', () => {
    const { store } = toyStore()
    store.run([rename('b1', 'X')], person)
    store.undo('person')
    const seen: ChangeEvent[] = []
    store.subscribe((e) => seen.push(e))
    const before = { hash: store.hash(), undo: store.undoDepth, redo: store.redoDepth, log: store.log.length }
    const r = store.run(cancel, person)
    expect(r.ok && r.changed).toBe(false)
    expect(r.ok && r.records).toEqual([])
    expect({ hash: store.hash(), undo: store.undoDepth, redo: store.redoDepth, log: store.log.length }).toEqual(before)
    expect(seen).toEqual([])
    expect(store.redo('person').ok).toBe(true)
    expect(store.get('box', 'b1')!.Name).toBe('X')
  })
  it('takes no batch number', () => {
    const { store } = toyStore()
    store.run(cancel, person)
    const next = store.run([rename('b1', 'Y')], person)
    expect(next.ok && next.batch).toBe(2)
  })
  it('spends no id: a create and its delete in one batch leave the next create the id they would have had', () => {
    const { store } = toyStore()
    const r = store.run(makeAndDelete, person)
    expect(r.ok && r.changed).toBe(false)
    expect(r.ok && r.ids).toEqual({})
    const next = store.run([create('n', 1, 1, 'n')], person)
    expect(next.ok && next.ids.n).toBe('b3')
  })
  it('is one step, one batch number and one log group when a write that changes something sits beside the cancelling ones', () => {
    const { store } = toyStore()
    store.run([rename('b1', 'X')], person)
    store.undo('person')
    const before = { hash: store.hash(), undo: store.undoDepth, log: store.log.length }
    const r = store.run([...cancel, rename('b2', 'Beta2')], person)
    expect(r.ok && r.changed).toBe(true)
    expect(r.ok && r.batch).toBe(3)
    expect(store.undoDepth).toBe(before.undo + 1)
    expect(store.redoDepth).toBe(0)
    expect(store.log.length).toBe(before.log + 3)
    store.undo('person')
    expect(store.hash()).toBe(before.hash)
  })
  it.each<[string, Call[], boolean]>([
    ['a rename and its reverse', cancel, false],
    ['a resize and its reverse on a box nothing points at', [resize('b2', 5), resize('b2', 30)], false],
    ['a create and its delete', makeAndDelete, false],
    ['a rename alone', [rename('b1', 'Z')], true],
    ['two renames of one box that end elsewhere', [rename('b1', 'Z'), rename('b1', 'Y')], true],
    ['a rename and its reverse beside a rename of another box', [...cancel, rename('b2', 'Q')], true],
    ['a resize and its reverse on a box a label sits on, which no system marks stale', [resize('b1', 5), resize('b1', 10)], false],
    ['a resize and a second resize that ends elsewhere on a box a label sits on', [resize('b1', 5), resize('b1', 6)], true],
    ['a create alone', [create('t', 1, 1)], true],
  ])('reports %s as changed only when the content hash moved', (_title, calls, changes) => {
    const { store } = toyStore()
    const before = store.hash()
    const r = store.run(calls, person)
    expect(r.ok && r.changed).toBe(changes)
    expect(r.ok && r.changed).toBe(store.hash() !== before)
  })
})

describe('a system reacts to the net change of what the verbs wrote', () => {
  const seen: string[][] = []
  const spied = (): Store => {
    const reg = toyRegistry((r) => {
      r.system({ name: 'spy', on: { kind: 'box', component: 'Dims' }, run: (_d, records) => void seen.push(records.map((x) => [x.id, x.component, x.field].join('.'))) })
      r.system({ name: 'spyKind', on: { kind: 'box' }, run: (_d, records) => void seen.push(records.map((x) => `${x.op}:${x.id}`)) })
    })
    const store = createStore(reg)
    store.run([create('Alpha', 10, 20), create('Beta', 30, 40), { verb: 'label.create', input: { on: 'b1', text: 'first' } }], person)
    seen.length = 0
    return store
  }
  it('runs no system for writes that cancel, leaves the label unmarked, and keeps no step', () => {
    const { store } = toyStore()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    const r = store.run([resize('b1', 11), resize('b1', 10)], person)
    expect(r.ok && r.changed).toBe(false)
    expect(r.ok && r.records).toEqual([])
    expect(store.get('label', 'l1')!.Stale).toBeUndefined()
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('runs the system when two writes of the batch end elsewhere', () => {
    const { store } = toyStore()
    const r = store.run([resize('b1', 11), resize('b1', 12)], person)
    expect(r.ok && r.changed).toBe(true)
    expect(store.get('label', 'l1')!.Stale).toBe(true)
    expect(r.ok && r.records.filter((x) => x.cause === 'system:stale')).toHaveLength(1)
  })
  it('hands a system only the records whose field the batch left changed', () => {
    const store = spied()
    store.run([resize('b1', 11, 20), resize('b1', 10, 21)], person)
    expect(seen).toEqual([['b1.Dims.h'], ['set:b1']])
    seen.length = 0
    store.run([resize('b2', 31)], person)
    expect(seen).toEqual([['b2.Dims.w'], ['set:b2']])
  })
  it('hands a system nothing for a box created and deleted in one batch, and the create when the box stays', () => {
    const store = spied()
    store.run([create('t', 1, 1, 't'), { verb: 'box.delete', input: { id: { handle: 't' } } }], person)
    expect(seen).toEqual([])
    store.run([create('t', 1, 1)], person)
    expect(seen).toEqual([['add:b3']])
  })
})

describe('handles', () => {
  it('names an unknown handle in the refusal', () => {
    const { store } = toyStore()
    const r = store.run([{ verb: 'label.create', input: { on: { handle: 'nope' }, text: 't' } }], person)
    expect(r.ok === false && r.refusal).toMatchObject({ reason: 'handle', at: 0 })
    expect(r.ok === false && r.refusal.issues[0]?.message).toMatch(/'nope'/)
  })
  it('refuses a handle on a verb that makes nothing, and a handle used twice', () => {
    const { store } = toyStore()
    expect(store.run([{ ...rename('b1', 'q'), as: 'x' }], person)).toMatchObject({ ok: false, refusal: { reason: 'handle' } })
    expect(store.run([create('a', 1, 1, 'x'), create('b', 1, 1, 'x')], person)).toMatchObject({ ok: false, refusal: { reason: 'handle', at: 1 } })
  })
  it('resolves a handle at any depth of the input', () => {
    const reg = toyRegistry((r) => {
      r.verb<{ on: { ref: string } }>({
        name: 'label.pin', target: 'label', mints: true,
        input: { type: 'object', properties: { on: { type: 'object', properties: { ref: { type: 'string', 'x-ref': 'box' } }, required: ['ref'] } }, required: ['on'] },
        apply: (d, i, c) => d.add('label', c.id!, { On: { kind: 'box', id: i.on.ref }, Text: 'pin' }),
        describe: () => 'Pin',
      })
    })
    const store = createStore(reg)
    const r = store.run([create('g', 1, 1, 'g'), { verb: 'label.pin', input: { on: { ref: { handle: 'g' } } } }], person)
    expect(r.ok).toBe(true)
  })
})

describe('minting', () => {
  it('never gives one id twice across create, delete, create', () => {
    const store = createStore(toyRegistry())
    const first = store.run([create('a', 1, 1, 'x')], person)
    const id1 = first.ok ? first.ids.x : ''
    store.run([{ verb: 'box.delete', input: { id: id1 ?? '' } }], person)
    const second = store.run([create('b', 1, 1, 'x')], person)
    const id2 = second.ok ? second.ids.x : ''
    expect(id1).toBe('b1')
    expect(id2).toBe('b2')
  })
  it('gives the counter back at an undo, so the id an undone create took goes to the next one (a delete gives none back: undoIds.test.ts)', () => {
    const store = createStore(toyRegistry())
    store.run([create('a')], person)
    store.undo('person')
    const r = store.run([create('b', 10, 20, 'x')], person)
    expect(r.ok && r.ids.x).toBe('b1')
  })
  it('shares one id space between kinds of one group, and none between kinds of different groups', () => {
    const store = createStore(toyRegistry())
    const r = store.run([create('a', 1, 1, 'b'), { verb: 'crate.create', input: { name: 'c' }, as: 'c' }, { verb: 'label.create', input: { on: { handle: 'b' }, text: 't' }, as: 'l' }], person)
    expect(r.ok && r.ids).toEqual({ b: 'b1', c: 'c1', l: 'l1' })
    const offered = store.run([{ verb: 'crate.create', input: { name: 'x', id: 'b1' } }], { actor: 'person', allowOfferedIds: true })
    expect(offered.ok === false && offered.refusal.issues[0]).toMatchObject({ kind: 'box', id: 'b1' })
    const apart = store.run([{ verb: 'label.create', input: { on: 'b1', text: 'x', id: 'b1' } }], { actor: 'person', allowOfferedIds: true })
    expect(apart.ok).toBe(true)
  })
  it('mints past the highest id of its shape already present, so an imported id cannot be reissued', () => {
    const store = createStore(toyRegistry(), { base: { entities: { box: { b7: { Name: 'imported', Dims: { w: 1, h: 1 } } } }, counters: {} } })
    const r = store.run([create('a', 1, 1, 'x')], person)
    expect(r.ok && r.ids.x).toBe('b8')
  })
  it('refuses an id a script offers, and takes one an importer offers when the caller says so', () => {
    const store = createStore(toyRegistry())
    const call: Call = { verb: 'box.create', input: { name: 'a', w: 1, h: 1, id: 'b5' } }
    expect(store.run([call], script)).toMatchObject({ ok: false, refusal: { reason: 'input' } })
    const r = store.run([call], { actor: 'person', allowOfferedIds: true })
    expect(r.ok && r.records[0]?.id).toBe('b5')
    expect(store.run([create('b', 1, 1, 'x')], person).ok && store.ids('box')).toEqual(['b5', 'b6'])
  })
  it('refuses an offered id with a reserved character, whitespace or a leading hash', () => {
    const store = createStore(toyRegistry())
    for (const id of ['a~b', 'a[1]', 'a b', '#a', '']) {
      const r = store.run([{ verb: 'box.create', input: { name: 'a', w: 1, h: 1, id } }], { actor: 'person', allowOfferedIds: true })
      expect(r.ok, `id '${id}'`).toBe(false)
    }
  })

  /** What the store holds, as a batch that was thrown out of must leave it. */
  const heldBy = (store: Store) => ({ hash: store.hash(), counters: store.snapshot().counters, depth: store.undoDepth, log: store.log.length })
  type PastTheInterface = { mint(kind: string): string; offer(kind: string, id: string): void }

  it.each(['mint', 'offer'] as const)('refuses to %s an id in a verb that declares no mints, which reaches the draft past its interface, and the store is as it was', (take) => {
    const store = createStore(
      toyRegistry((r) =>
        r.verb({
          name: 'box.sneak', target: 'box',
          input: { type: 'object', properties: {}, additionalProperties: false },
          apply: (d) => (take === 'mint' ? (d as unknown as PastTheInterface).mint('box') : (d as unknown as PastTheInterface).offer('box', 'b9')),
          describe: () => 'Take an id',
        }),
      ),
    )
    const before = heldBy(store)
    expect(() => store.run([{ verb: 'box.sneak', input: {} }], person)).toThrow(/box.sneak declares no mints/)
    expect(heldBy(store)).toEqual(before)
    // the next batch is taken
    expect(store.run([create('a', 1, 1, 'x')], person).ok && store.ids('box')).toEqual(['b1'])
  })

  it('refuses a system an id as well: a verb that declares mints does not leave the permission to the systems that follow it', () => {
    const store = createStore(
      toyRegistry((r) =>
        r.system({
          name: 'sneak',
          on: { kind: 'box' },
          run: (d) => (d as unknown as PastTheInterface).mint('box'),
        }),
      ),
    )
    const before = heldBy(store)
    expect(() => store.run([create('a', 1, 1, 'x')], person)).toThrow(/system:sneak declares no mints/)
    expect(heldBy(store)).toEqual(before)
  })

  /** The draft as a verb that casts it can reach it: the permissions the store grants, and the counters. */
  type Cast = PastTheInterface & {
    mints: boolean
    opening: boolean
    replacedCounters: unknown
    pending: Map<string, number>
    add(kind: string, id: string, components: { readonly [component: string]: Json }): void
    useCounters(next: { [kind: string]: number }): void
    restoreCounters(counters: ReadonlyMap<string, number>): void
  }
  /** A store over the toy vocabulary with one verb on a box that declares nothing and does what `apply` does to the draft it is handed. */
  const withSneak = (apply: (d: Cast) => void): Store =>
    createStore(
      toyRegistry((r) =>
        r.verb({
          name: 'box.sneak', target: 'box',
          input: { type: 'object', properties: {}, additionalProperties: false },
          apply: (d) => apply(d as unknown as Cast),
          describe: () => 'Sneak',
        }),
      ),
    )
  const sneak: Call = { verb: 'box.sneak', input: {} }
  /** A box made and a second made and deleted, so the counter stands at 2 with only b1 present: the case a counter put back would hand b2 out again. */
  const afterADelete = (store: Store): void => {
    expect(store.run([create('a', 1, 1, 'x'), create('b', 1, 1, 'y')], person).ok).toBe(true)
    expect(store.run([{ verb: 'box.delete', input: { id: 'b2' } }], person).ok).toBe(true)
    // the precondition: the counter stands past the id deleted
    expect(store.snapshot().counters).toEqual({ box: 2 })
  }

  it.each(['mint', 'offer'] as const)('refuses a verb that declares no mints the %s of an id, though it assigns mints to the draft it was handed, and the store is as it was', (take) => {
    const store = withSneak((d) => {
      d.mints = true
      if (take === 'mint') d.mint('box')
      else d.offer('box', 'b9')
    })
    const before = heldBy(store)
    expect(() => store.run([sneak], person)).toThrow(/box.sneak declares no mints/)
    expect(heldBy(store)).toEqual(before)
  })

  it('refuses a verb that does not open another state the replacing of the counters, though it assigns opening to the draft it was handed', () => {
    const store = withSneak((d) => {
      d.opening = true
      d.useCounters({ box: 0 })
    })
    const before = heldBy(store)
    expect(() => store.run([sneak], person)).toThrow(/only a verb that opens another state may replace the counters/)
    expect(heldBy(store)).toEqual(before)
  })

  it('refuses a verb that puts counters back, which would let an id that was deleted be issued again', () => {
    const store = withSneak((d) => d.restoreCounters(new Map()))
    afterADelete(store)
    const before = heldBy(store)
    expect(() => store.run([sneak], person)).toThrow(/only an undo or a redo may put counters back/)
    expect(heldBy(store)).toEqual(before)
    expect(store.run([create('c', 1, 1, 'z')], person).ok && store.ids('box')).toEqual(['b1', 'b3'])
  })

  it('keeps the counters when a verb assigns a map of counters to the draft it was handed, which the store never reads', () => {
    const store = withSneak((d) => {
      d.replacedCounters = new Map()
    })
    afterADelete(store)
    const before = heldBy(store)
    const r = store.run([sneak], person)
    // the batch wrote nothing
    expect(r.ok && r.changed).toBe(false)
    expect(heldBy(store)).toEqual(before)
    expect(store.run([create('c', 1, 1, 'z')], person).ok && store.ids('box')).toEqual(['b1', 'b3'])
  })

  it('refuses a verb that sets a counter below where it stands in a batch that also writes an entity, and the next id is the one after the id deleted', () => {
    const store = withSneak((d) => {
      d.pending.set('box', 1)
      d.add('box', 'extra', { Name: 'extra', Dims: { w: 1, h: 1 } })
    })
    afterADelete(store)
    const before = heldBy(store)
    expect(() => store.run([sneak], person)).toThrow(/the counter of 'box' would go down from 2 to 1/)
    expect(heldBy(store)).toEqual(before)
    expect(store.ids('box')).toEqual(['b1'])
    expect(store.run([create('c', 1, 1, 'z')], person).ok && store.ids('box')).toEqual(['b1', 'b3'])
  })

  it('lets a verb that declares mints take a second id in its own apply, which is the id after the one it was given', () => {
    const store = createStore(
      toyRegistry((r) =>
        r.verb({
          name: 'box.pair', target: 'box', mints: true,
          input: { type: 'object', properties: {}, additionalProperties: false },
          apply: (d, _i, c) => {
            d.add('box', c.id!, { Name: 'first', Dims: { w: 1, h: 1 } })
            d.add('box', (d as unknown as PastTheInterface).mint('box'), { Name: 'second', Dims: { w: 1, h: 1 } })
          },
          describe: () => 'Add two boxes',
        }),
      ),
    )
    expect(store.run([{ verb: 'box.pair', input: {} }], person).ok).toBe(true)
    expect(store.ids('box')).toEqual(['b1', 'b2'])
  })

  const closed: Schema = { type: 'object', properties: {}, additionalProperties: false }
  /** A store over the toy vocabulary with a verb that makes a box and, past its own, takes ids through its context: `take` runs in its apply. */
  const withContext = (declaresMints: boolean, take: (c: ApplyContext, d: Draft) => void): Store =>
    createStore(
      toyRegistry((r) =>
        r.verb({
          name: 'box.with_context', target: 'box', ...(declaresMints ? { mints: true } : {}),
          input: closed,
          apply: (d, _i, c) => {
            if (declaresMints) d.add('box', c.id!, { Name: 'first', Dims: { w: 1, h: 1 } })
            take(c, d)
          },
          describe: () => 'Add a box and take ids',
        }),
      ),
    )
  const useContext: Call = { verb: 'box.with_context', input: {} }
  const withCrate = (): Store => withContext(true, (c, d) => d.add('crate', c.mint('crate'), { Name: 'crate' }))

  it('lets a verb that declares mints take the id of another kind through its context', () => {
    const store = withCrate()
    expect(store.run([useContext], person).ok).toBe(true)
    // the box and the crate share one id space and each kind counts by its own prefix
    expect({ boxes: store.ids('box'), crates: store.ids('crate') }).toEqual({ boxes: ['b1'], crates: ['c1'] })
  })

  it('gives each id its context takes once: three boxes taken in turn are b1, b2 and b3', () => {
    const store = withContext(true, (c, d) => {
      d.add('box', c.mint('box'), { Name: 'second', Dims: { w: 1, h: 1 } })
      d.add('box', c.mint('box'), { Name: 'third', Dims: { w: 1, h: 1 } })
    })
    expect(store.run([useContext], person).ok).toBe(true)
    expect(store.ids('box')).toEqual(['b1', 'b2', 'b3'])
  })

  it('refuses a verb that declares no mints the mint of its context, and the store is as it was', () => {
    const store = withContext(false, (c) => void c.mint('box'))
    const before = heldBy(store)
    expect(() => store.run([useContext], person)).toThrow(/box.with_context declares no mints/)
    expect(heldBy(store)).toEqual(before)
  })

  it('refuses a kind the vocabulary does not hold, naming it, and the store is as it was', () => {
    const store = withContext(true, (c) => void c.mint('nothing'))
    const before = heldBy(store)
    const r = store.run([useContext], person)
    expect(r.ok === false && r.refusal).toMatchObject({ reason: 'apply', issues: [{ kind: 'nothing', message: "'nothing' is not a kind of this vocabulary" }] })
    expect(heldBy(store)).toEqual(before)
  })

  it('takes the same ids again when the batch is undone and redone', () => {
    const store = withCrate()
    expect(store.run([useContext], person).ok).toBe(true)
    const after = { hash: store.hash(), counters: store.snapshot().counters, crates: store.ids('crate') }
    expect(store.undo('person').ok).toBe(true)
    expect(store.ids('crate')).toEqual([])
    expect(store.redo('person').ok).toBe(true)
    expect({ hash: store.hash(), counters: store.snapshot().counters, crates: store.ids('crate') }).toEqual(after)
    // the next batch takes the ids after those
    expect(store.run([useContext], person).ok).toBe(true)
    expect({ boxes: store.ids('box'), crates: store.ids('crate') }).toEqual({ boxes: ['b1', 'b2'], crates: ['c1', 'c2'] })
  })
})

describe('validation and writes', () => {
  it('names the entity and field a verb finds wrong', () => {
    const { store } = toyStore()
    const r = store.run([resize('b1')], person)
    expect(r.ok === false && r.refusal).toMatchObject({ reason: 'validation', issues: [{ kind: 'box', id: 'b1', field: '/w' }] })
  })
  it('refuses a delete that would leave a label pointing at nothing, naming the label, and removes it on cascade', () => {
    const { store } = toyStore()
    const r = store.run([{ verb: 'box.delete', input: { id: 'b1' } }], person)
    expect(r.ok === false && r.refusal.issues[0]?.message).toMatch(/label l1/)
    expect(store.has('box', 'b1')).toBe(true)
    expect(store.run([{ verb: 'box.delete', input: { id: 'b1', cascade: true } }], person).ok).toBe(true)
    expect([store.has('box', 'b1'), store.has('label', 'l1')]).toEqual([false, false])
  })
  it('keeps null and absent apart in a record', () => {
    const reg = toyRegistry((r) => {
      r.verb<{ id: string; v?: number | null }>({
        name: 'box.note', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, v: { anyOf: [{ type: 'null' }, { type: 'number' }] } }, required: ['id'] },
        apply: (d, i) => d.set('box', i.id, 'Note', i.v === undefined ? undefined : i.v),
        describe: () => 'Note',
      })
    })
    const store = createStore(reg)
    store.run([create('a')], person)
    const toNull = store.run([{ verb: 'box.note', input: { id: 'b1', v: null } }], person)
    expect(toNull.ok && toNull.records[0]).toMatchObject({ op: 'set', component: 'Note', after: null })
    expect(toNull.ok && 'before' in toNull.records[0]!).toBe(false)
    const toAbsent = store.run([{ verb: 'box.note', input: { id: 'b1' } }], person)
    expect(toAbsent.ok && toAbsent.records[0]).toMatchObject({ op: 'set', component: 'Note', before: null })
    expect(toAbsent.ok && 'after' in toAbsent.records[0]!).toBe(false)
  })
  it('refuses a verb that computes a number that is not finite, naming the entity and field, and leaves the store usable', () => {
    const reg = toyRegistry((r) => {
      r.verb<{ id: string; by: number }>({
        name: 'box.scale', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, by: { type: 'number' } }, required: ['id', 'by'], additionalProperties: false },
        apply: (d, i) => d.setField('box', i.id, 'Dims', 'w', 1 / i.by),
        describe: () => 'Scale',
      })
      r.verb<{ id: string; by: number }>({
        name: 'box.ratio', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, by: { type: 'number' } }, required: ['id', 'by'], additionalProperties: false },
        apply: (d, i) => d.set('box', i.id, 'Ratio', { r: 1 / i.by }),
        describe: () => 'Ratio',
      })
    })
    const store = createStore(reg)
    store.run([create('a')], person)
    const before = store.hash()
    const r = store.run([{ verb: 'box.scale', input: { id: 'b1', by: 0 } }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'apply', at: 0, issues: [{ kind: 'box', id: 'b1', field: 'Dims.w' }] } })
    expect(store.hash()).toBe(before)
    const whole = store.run([{ verb: 'box.ratio', input: { id: 'b1', by: 0 } }], person)
    expect(whole).toMatchObject({ ok: false, refusal: { reason: 'apply', issues: [{ kind: 'box', id: 'b1', field: 'Ratio' }] } })
    expect(store.hash()).toBe(before)
    expect(store.run([{ verb: 'box.scale', input: { id: 'b1', by: 4 } }], person).ok).toBe(true)
    expect((store.get('box', 'b1')!.Dims as { w: number }).w).toBe(0.25)
  })
  it('refuses a created entity that holds a number that is not finite, pointing at it', () => {
    const reg = toyRegistry((r) => {
      r.verb<{ name: string }>({
        name: 'box.broken', target: 'box', mints: true,
        input: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
        apply: (d, i, c) => d.add('box', c.id!, { Name: i.name, Dims: { w: Number.NaN, h: 1 } }),
        describe: () => 'Broken',
      })
    })
    const store = createStore(reg)
    const r = store.run([{ verb: 'box.broken', input: { name: 'a' } }], person)
    expect(r.ok === false && r.refusal.issues[0]?.message).toContain('components/Dims/w')
    expect(store.ids('box')).toEqual([])
  })
  it('records a field write with the field, the value before and the value after', () => {
    const { store } = toyStore()
    const r = store.run([resize('b1', 99)], person)
    expect(r.ok && r.records.find((x) => x.component === 'Dims')).toMatchObject({ op: 'set', kind: 'box', id: 'b1', component: 'Dims', field: 'w', before: 10, after: 99, cause: 'box.resize', verb: 'box.resize' })
  })
  it('numbers records in one rising sequence and gives a batch one batch number', () => {
    const { store } = toyStore()
    const r = store.run([rename('b1', 'X'), rename('b2', 'Y')], person)
    const seqs = r.ok ? r.records.map((x) => x.seq) : []
    expect(seqs.length).toBeGreaterThan(1)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

describe('the committed state is frozen outside apply', () => {
  const sneaky = toyRegistry((r) => {
    r.verb<{ id: string }>({
      name: 'box.sneak', target: 'box',
      input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'] },
      apply: (d, i) => {
        // a direct write into a component, which the draft's own methods exist to prevent
        ;(d.get('box', i.id)!.Dims as { w: number }).w = 1
      },
      describe: () => 'Sneak',
    })
  })
  it('lets a verb write through the draft', () => {
    const store = createStore(sneaky)
    store.run([create('a')], person)
    expect(store.run([{ verb: 'box.resize', input: { id: 'b1', w: 5 } }], person).ok).toBe(true)
    expect((store.get('box', 'b1')!.Dims as { w: number }).w).toBe(5)
  })
  it('throws, naming the property, when a verb writes into a component directly, and leaves the store untouched', () => {
    const store = createStore(sneaky)
    store.run([create('a')], person)
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    expect(() => store.run([{ verb: 'box.sneak', input: { id: 'b1' } }], person)).toThrow(/read only property 'w'/)
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('refuses a write made while validating, and leaves the store untouched', () => {
    const reg = toyRegistry((r) => {
      r.verb<{ id: string }>({
        name: 'box.peek', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'] },
        validate: (d, i) => {
          ;(d as Draft).set('box', i.id, 'Name', 'peeked')
          return []
        },
        apply: () => {},
        describe: () => 'Peek',
      })
    })
    const store = createStore(reg)
    store.run([create('a')], person)
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    expect(() => store.run([{ verb: 'box.peek', input: { id: 'b1' } }], person)).toThrow(/frozen outside apply: setting box 'b1'/)
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('refuses a write through a draft a verb kept past its batch', () => {
    const held: { draft?: Draft } = {}
    const reg = toyRegistry((r) => {
      r.verb<{ id: string }>({
        name: 'box.keep', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'] },
        apply: (d) => {
          held.draft = d
        },
        describe: () => 'Keep',
      })
    })
    const store = createStore(reg)
    store.run([create('a')], person)
    expect(store.run([{ verb: 'box.keep', input: { id: 'b1' } }], person).ok).toBe(true)
    expect(() => held.draft!.set('box', 'b1', 'Name', 'late')).toThrow(/frozen outside apply/)
    expect(store.get('box', 'b1')!.Name).toBe('a')
  })
  it('refuses a reader of the store the same write', () => {
    const store = createStore(sneaky)
    store.run([create('a')], person)
    expect(() => {
      ;(store.get('box', 'b1')!.Dims as { w: number }).w = 1
    }).toThrow(/read only/)
  })
})

describe('what a caller is handed cannot be written to', () => {
  const frozen = (records: readonly object[]): boolean => Object.isFrozen(records) && records.every((x) => Object.isFrozen(x))
  it('keeps the records of an outcome unwritable, so redo applies what the batch wrote', () => {
    const registry = toyRegistry()
    const store = createStore(registry)
    store.run([create('Alpha')], person)
    const r = store.run([rename('b1', 'X')], person)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    store.undo('person')
    expect(() => {
      ;(r.records[0] as { after?: Json }).after = 'Q'
    }).toThrow(/read only/)
    expect(() => {
      ;(r.records as ChangeRecord[]).push(r.records[0]!)
    }).toThrow(/not extensible/)
    expect(store.redo('person').ok).toBe(true)
    expect(store.get('box', 'b1')!.Name).toBe('X')
    expect(replay(registry, store.save()).ok).toBe(true)
  })
  it('hands a listener frozen records, whole or filtered', () => {
    const { store } = toyStore()
    const seen: ChangeEvent[] = []
    store.subscribe((e) => seen.push(e))
    store.subscribe((e) => seen.push(e), { kind: 'box' })
    store.run([rename('b1', 'X')], person)
    expect(seen.map((e) => frozen(e.records))).toEqual([true, true])
  })
  it('hands the outcomes of undo and redo and the records of a preview frozen', () => {
    const { store } = toyStore()
    store.run([rename('b1', 'X')], person)
    const undone = store.undo('person')
    const redone = store.redo('person')
    const card = store.preview(proposed(store, [{ verb: 'box.rename', input: { id: 'b1', name: 'Y' } }]), { actor: 'script' })
    expect([undone, redone, card].map((o) => o.ok && frozen(o.records))).toEqual([true, true, true])
  })
  it('hands validate the batch so far as frozen lists of frozen records and calls', () => {
    const held: { batch?: BatchSoFar } = {}
    const reg = toyRegistry((r) => {
      r.verb<{ id: string }>({
        name: 'box.look', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'] },
        validate: (_d, _i, batch) => {
          held.batch = batch
          return []
        },
        apply: () => {},
        describe: () => 'Look',
      })
    })
    const store = createStore(reg)
    store.run([create('a')], person)
    store.run([rename('b1', 'X'), { verb: 'box.look', input: { id: 'b1' } }], person)
    const seen = held.batch!
    expect(frozen(seen.records)).toBe(true)
    expect(seen.records).toHaveLength(1)
    expect(Object.isFrozen(seen.calls) && Object.isFrozen(seen.calls[0]!.input)).toBe(true)
    expect(() => {
      ;(seen.records as ChangeRecord[]).push(seen.records[0]!)
    }).toThrow(/not extensible/)
  })
})

describe('refusing during a solve, and who may call', () => {
  it('refuses an edit with the reason while a lock is held, and takes it once released', () => {
    const { store } = toyStore()
    const release = store.lock('A solve is running; try again when it ends.')
    const r = store.run([rename('b1', 'X')], person)
    expect(r.ok === false && r.refusal).toMatchObject({ reason: 'locked', issues: [{ message: 'A solve is running; try again when it ends.' }] })
    release()
    expect(store.run([rename('b1', 'X')], person).ok).toBe(true)
  })
  it('refuses undo and redo while locked, and still reads', () => {
    const { store } = toyStore()
    store.run([rename('b1', 'X')], person)
    const release = store.lock('busy')
    expect(store.undo('person')).toMatchObject({ ok: false, refusal: { reason: 'locked' } })
    expect(store.read('entity.get', { kind: 'box', id: 'b1' })).toMatchObject({ ok: true })
    release()
    expect(store.undo('person').ok).toBe(true)
  })
  it('refuses redo while locked, and the step stays in the redo tail', () => {
    const { store } = toyStore()
    store.run([rename('b1', 'X')], person)
    store.undo('person')
    const release = store.lock('busy')
    expect(store.redo('person')).toMatchObject({ ok: false, refusal: { reason: 'locked' } })
    expect(store.redoDepth).toBe(1)
    release()
    expect(store.redo('person').ok).toBe(true)
  })
  it('keeps a lock until every holder has released it', () => {
    const { store } = toyStore()
    const a = store.lock('a')
    const b = store.lock('b')
    a()
    expect(store.run([rename('b1', 'X')], person).ok).toBe(false)
    b()
    expect(store.run([rename('b1', 'X')], person).ok).toBe(true)
  })
  it('refuses a verb the actor may not call, and takes it from the actor that may', () => {
    const { store } = toyStore()
    expect(store.run([{ verb: 'label.delete', input: { id: 'l1' } }], script)).toMatchObject({ ok: false, refusal: { reason: 'actor', at: 0 } })
    expect(store.run([{ verb: 'label.delete', input: { id: 'l1' } }], person).ok).toBe(true)
  })
  it('refuses a verb nobody registered', () => {
    const { store } = toyStore()
    expect(store.run([{ verb: 'box.explode', input: {} }], person)).toMatchObject({ ok: false, refusal: { reason: 'unknown_verb' } })
  })
})

describe('a system reacts inside the batch that caused it', () => {
  it('adds records tagged with its name, in the same batch', () => {
    const { store } = toyStore()
    const r = store.run([resize('b1', 11)], person)
    const stale = r.ok ? r.records.filter((x) => x.cause === 'system:stale') : []
    expect(stale).toMatchObject([{ kind: 'label', id: 'l1', component: 'Stale', after: true, verb: 'box.resize' }])
    expect(r.ok && new Set(r.records.map((x) => x.batch)).size).toBe(1)
  })
  it('names the call that wrote what a refusing system reacted to', () => {
    const reg = toyRegistry((r) => {
      r.system({ name: 'strict', on: { kind: 'box', component: 'Name' }, run: (d) => d.set('box', 'b99', 'Name', 'x') })
    })
    const store = createStore(reg)
    store.run([create('a'), create('b')], person)
    const r = store.run([resize('b1', 5), rename('b2', 'Q')], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'apply', at: 1, issues: [{ kind: 'box', id: 'b99' }] } })
    expect(store.get('box', 'b2')!.Name).toBe('b')
  })
  it('refuses a batch for a system that throws Refuse, with its issues, naming the call that wrote what it reacted to, and the store is as it was', () => {
    const reg = toyRegistry((r) => {
      r.system({ name: 'ends', on: { kind: 'box', component: 'Name' }, run: () => { throw new Refuse([{ kind: 'box', id: 'b2', message: 'box b2 ends the batch renamed' }]) } })
    })
    const store = createStore(reg)
    store.run([create('a'), create('b')], person)
    const before = store.hash()
    const r = store.run([resize('b1', 5), rename('b2', 'Q')], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'apply', at: 1, issues: [{ kind: 'box', id: 'b2', message: 'box b2 ends the batch renamed' }] } })
    expect(store.hash()).toBe(before)
  })
  it('undoes with the batch, and does not run for a record it does not subscribe to', () => {
    const { store } = toyStore()
    const before = store.hash()
    store.run([resize('b1', 11)], person)
    expect(store.get('label', 'l1')!.Stale).toBe(true)
    store.undo('person')
    expect(store.hash()).toBe(before)
    const r = store.run([rename('b1', 'Z')], person)
    expect(r.ok && r.records.some((x) => x.cause.startsWith('system:'))).toBe(false)
  })
})

describe('a system is handed the state before the batch', () => {
  const widthOf = (reader: { get(kind: string, id: string): { readonly [c: string]: Json } | undefined }, id: string): Json | undefined => (reader.get('box', id)?.Dims as { w: Json } | undefined)?.w

  it('reads the committed state, which the batch has not reached, where the draft holds the batch', () => {
    const seen: Array<{ before: Json | undefined; draft: Json | undefined; newBefore: boolean; newDraft: boolean }> = []
    const store = createStore(
      toyRegistry((r) =>
        r.system({
          name: 'look',
          on: { kind: 'box', component: 'Dims' },
          run: (d, _records, before) => void seen.push({ before: widthOf(before, 'b1'), draft: widthOf(d, 'b1'), newBefore: before.has('box', 'b3'), newDraft: d.has('box', 'b3') }),
        }),
      ),
    )
    store.run([create('Alpha', 10, 20), create('Beta', 30, 40)], person)
    seen.length = 0
    store.run([resize('b1', 11), create('Gamma')], person)
    expect(seen).toEqual([{ before: 10, draft: 11, newBefore: false, newDraft: true }])
  })

  it('is the state before each batch: the width a system reads is the one the batch before it left', () => {
    const seen: Array<Json | undefined> = []
    const store = createStore(toyRegistry((r) => r.system({ name: 'look', on: { kind: 'box', component: 'Dims' }, run: (_d, _records, before) => void seen.push(widthOf(before, 'b1')) })))
    store.run([create('Alpha', 10, 20)], person)
    seen.length = 0
    store.run([resize('b1', 11)], person)
    store.run([resize('b1', 12)], person)
    store.run([resize('b1', 13), resize('b1', 14)], person)
    expect(seen).toEqual([10, 11, 12])
  })

  it('hands a system every record of the batch so far, the verbs and the systems before it', () => {
    const seen: string[][] = []
    const store = createStore(
      toyRegistry((r) => {
        r.system({ name: 'note', on: { kind: 'box', component: 'Dims' }, run: (d, records) => void records.forEach((x) => d.set('box', x.id, 'Prev', 1)) })
        r.system({ name: 'look', on: {}, run: (d) => void seen.push(d.records.map((x) => `${x.cause}:${x.id}:${x.component ?? ''}`)) })
      }),
    )
    store.run([create('Alpha', 10, 20)], person)
    seen.length = 0
    store.run([resize('b1', 11)], person)
    // the write of the verb, and the write of the system that ran before the one that looks
    expect(seen).toEqual([['box.resize:b1:Dims', 'system:note:b1:Prev']])
  })

  // the system records on the box the width it had before the batch
  const noting = (widthBefore: (id: string, before: { get(kind: string, id: string): { readonly [c: string]: Json } | undefined }) => Json | undefined) =>
    toyRegistry((r) =>
      r.system({ name: 'note', on: { kind: 'box', component: 'Dims' }, run: (d, records, before) => void records.forEach((x) => d.set('box', x.id, 'Prev', widthBefore(x.id, before) ?? null)) }),
    )

  it('lets a system whose writes depend on it replay to the saved hash, where the same system reading a store outside it does not', () => {
    const edits: Call[] = [create('Alpha', 10, 20), resize('b1', 11), resize('b1', 12)]
    const own = createStore(noting((id, before) => widthOf(before, id)))
    for (const c of edits) own.run([c], person)
    // the precondition: the note holds the width before the last batch
    expect(own.get('box', 'b1')!.Prev).toBe(11)
    expect(replay(noting((id, before) => widthOf(before, id)), own.save())).toMatchObject({ ok: true })

    const live: { store?: Store } = {}
    live.store = createStore(noting((id) => widthOf(live.store!, id)))
    for (const c of edits) live.store.run([c], person)
    const refused = replay(noting((id) => widthOf(live.store!, id)), live.store.save())
    expect(refused).toMatchObject({ ok: false, refusal: { reason: 'replay' } })
    expect(refused.ok ? '' : refused.refusal.issues[0]?.message).toMatch(/the log reached a state other than the one saved/)
  })

  it('is the state the gesture began from at each of its moves, so the one batch a gesture logs replays to the saved hash', () => {
    const seen: Array<Json | undefined> = []
    const reading = (id: string, before: { get(kind: string, id: string): { readonly [c: string]: Json } | undefined }): Json | undefined => {
      const width = widthOf(before, id)
      seen.push(width)
      return width
    }
    const store = createStore(noting(reading))
    store.run([create('Alpha', 10, 20)], person)
    seen.length = 0
    const opened = store.gesture({ actor: 'person' })
    if (!opened.ok) throw new Error('the gesture was refused')
    opened.gesture.move([resize('b1', 11)])
    opened.gesture.move([resize('b1', 12)])
    expect(opened.gesture.end()).toMatchObject({ ok: true, changed: true })
    // the precondition: each move read the width the gesture began with, and the note holds it
    expect(seen).toEqual([10, 10])
    expect(store.get('box', 'b1')).toMatchObject({ Dims: { w: 12 }, Prev: 10 })
    // the log holds the last move alone, which replays on the state the gesture began from
    expect(replay(noting((id, before) => widthOf(before, id)), store.save())).toMatchObject({ ok: true })
  })
})

describe('a verb that declares the kinds it makes besides its target', () => {
  const TAG: Schema = { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, texts: { type: 'array', items: { type: 'string' } } }, required: ['id', 'texts'], additionalProperties: false }
  /** The toy vocabulary with a verb on a box that lists the label as the kind it makes and mints `kind`. */
  const taggingRegistry = (kind = 'label') =>
    toyRegistry((r) => {
      r.verb<{ id: string; texts: string[] }>({
        name: 'box.tag', target: 'box', mintsOther: ['label'],
        input: TAG,
        apply: (d, i, c) => i.texts.forEach((text) => d.add('label', c.mint(kind), { On: { kind: 'box', id: i.id }, Text: text })),
        describe: (i) => `Tag box ${i.id}`,
      })
    })
  const tagging = (kind = 'label'): Store => createStore(taggingRegistry(kind))
  const tag = (...texts: string[]): Call => ({ verb: 'box.tag', input: { id: 'b1', texts } })

  it('mints the kinds it lists and none of its target, and an undo, a redo and a replay give the hashes', () => {
    const store = tagging()
    store.run([create('Alpha')], person)
    const before = store.hash()
    const r = store.run([tag('a', 'b')], person)
    expect(r.ok && r.records.map((x) => `${x.kind}:${x.id}`)).toEqual(['label:l1', 'label:l2'])
    // the precondition: the box counter stands where the create left it, and the log holds the call with no id of its own
    expect(store.snapshot().counters).toEqual({ box: 1, label: 2 })
    expect(store.log[store.log.length - 1]!.input).toEqual({ id: 'b1', texts: ['a', 'b'] })
    const after = store.hash()
    expect(store.undo('person').ok && store.hash()).toBe(before)
    expect(store.redo('person').ok && store.hash()).toBe(after)
    const replayed = replay(taggingRegistry(), store.save())
    expect(replayed.ok && replayed.store.hash()).toBe(after)
  })

  it('is refused the mint of a kind it does not list, and the store is as it was', () => {
    const store = tagging('crate')
    store.run([create('Alpha')], person)
    const before = store.hash()
    expect(() => store.run([tag('a')], person)).toThrow(/box.tag does not declare that it mints 'crate'/)
    expect(store.hash()).toBe(before)
  })

  it('is refused at registration when a kind it lists is none', () => {
    expect(() =>
      toyRegistry((r) =>
        r.verb({ name: 'box.tag', target: 'box', mintsOther: ['nothing'], input: TAG, apply: () => {}, describe: () => 'Tag' }),
      ),
    ).toThrow(/mints the kind 'nothing', which is not registered/)
  })
})
