// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, type Call, type Store } from '..'
import { create, person, toyRegistry, toyStore } from './toy'

// one seeded input for every verb of the toy vocabulary, against the store toyStore builds (b1, b2, l1)
const seeded: Array<[string, Call[]]> = [
  ['box.create', [create('Gamma', 5, 6)]],
  ['box.rename', [{ verb: 'box.rename', input: { id: 'b1', name: 'Alpha2' } }]],
  ['box.resize (a field; the stale system also writes)', [{ verb: 'box.resize', input: { id: 'b1', w: 77 } }]],
  ['box.delete with cascade', [{ verb: 'box.delete', input: { id: 'b1', cascade: true } }]],
  ['crate.create', [{ verb: 'crate.create', input: { name: 'K' } }]],
  ['label.create', [{ verb: 'label.create', input: { on: 'b2', text: 'second' } }]],
  ['label.delete', [{ verb: 'label.delete', input: { id: 'l1' } }]],
  ['a batch of several verbs', [create('G'), { verb: 'box.rename', input: { id: 'b2', name: 'B2' } }, { verb: 'box.delete', input: { id: 'b1', cascade: true } }]],
]

/** The ids of a kind in the order entity.list gives them, read as the person or a script reads them. */
function listed(store: Store, kind: string): string[] {
  const r = store.read('entity.list', { kind })
  return r.ok ? (r.value as Array<{ id: string }>).map((x) => x.id) : []
}
const lists = (store: Store): string[][] => ['box', 'crate', 'label'].map((k) => listed(store, k))

describe('undo and redo restore the content hash', () => {
  it.each(seeded)('%s: undo reaches the hash and the list order before, redo the hash and the order after', (_name, calls) => {
    const { store } = toyStore()
    const before = store.hash()
    const orderBefore = lists(store)
    expect(store.run(calls, person).ok).toBe(true)
    const after = store.hash()
    const orderAfter = lists(store)
    expect(after).not.toBe(before)
    expect(store.undo('person').ok).toBe(true)
    expect(store.hash()).toBe(before)
    expect(lists(store)).toEqual(orderBefore)
    expect(store.redo('person').ok).toBe(true)
    expect(store.hash()).toBe(after)
    expect(lists(store)).toEqual(orderAfter)
  })
  it('walks back through several batches and forward again', () => {
    const { store } = toyStore()
    const h = [store.hash()]
    for (const name of ['p', 'q', 'r']) {
      store.run([{ verb: 'box.rename', input: { id: 'b1', name } }], person)
      h.push(store.hash())
    }
    for (let i = 2; i >= 0; i--) {
      store.undo('person')
      expect(store.hash()).toBe(h[i])
    }
    for (let i = 1; i <= 3; i++) {
      store.redo('person')
      expect(store.hash()).toBe(h[i])
    }
  })
})

describe('undo of a remove puts the entity back where it was', () => {
  const del = (id: string, cascade = false): Call => ({ verb: 'box.delete', input: { id, ...(cascade ? { cascade } : {}) } })
  it('puts a box removed from the middle of the list back in the middle', () => {
    const { store } = toyStore()
    store.run([create('Gamma')], person)
    expect(listed(store, 'box')).toEqual(['b1', 'b2', 'b3'])
    store.run([del('b2')], person)
    expect(listed(store, 'box')).toEqual(['b1', 'b3'])
    store.undo('person')
    expect(listed(store, 'box')).toEqual(['b1', 'b2', 'b3'])
  })
  it('puts each entity of a cascade back in the order of its own kind', () => {
    const { store } = toyStore()
    store.run([{ verb: 'label.create', input: { on: 'b2', text: 'second' } }], person)
    expect([listed(store, 'box'), listed(store, 'label')]).toEqual([['b1', 'b2'], ['l1', 'l2']])
    store.run([del('b1', true)], person)
    expect([listed(store, 'box'), listed(store, 'label')]).toEqual([['b2'], ['l2']])
    store.undo('person')
    expect([listed(store, 'box'), listed(store, 'label')]).toEqual([['b1', 'b2'], ['l1', 'l2']])
  })
  it('puts it back again after a redo and a second undo', () => {
    const { store } = toyStore()
    store.run([create('Gamma')], person)
    const before = store.hash()
    store.run([del('b2')], person)
    store.undo('person')
    store.redo('person')
    expect(listed(store, 'box')).toEqual(['b1', 'b3'])
    store.undo('person')
    expect(listed(store, 'box')).toEqual(['b1', 'b2', 'b3'])
    expect(store.hash()).toBe(before)
  })
  it('restores the order when one batch removes several entities of a kind', () => {
    const { store } = toyStore()
    store.run([create('Gamma'), create('Delta')], person)
    expect(listed(store, 'box')).toEqual(['b1', 'b2', 'b3', 'b4'])
    store.run([del('b3'), del('b1', true), del('b4')], person)
    expect(listed(store, 'box')).toEqual(['b2'])
    store.undo('person')
    expect(listed(store, 'box')).toEqual(['b1', 'b2', 'b3', 'b4'])
  })
  it('restores the order when a batch both creates and removes entities of a kind', () => {
    const { store } = toyStore()
    store.run([create('Gamma'), del('b1', true), create('Delta')], person)
    expect(listed(store, 'box')).toEqual(['b2', 'b3', 'b4'])
    store.undo('person')
    expect(listed(store, 'box')).toEqual(['b1', 'b2'])
    expect(store.ids('box')).toEqual(['b1', 'b2'])
    store.redo('person')
    expect(listed(store, 'box')).toEqual(['b2', 'b3', 'b4'])
    expect(store.ids('box')).toEqual(['b2', 'b3', 'b4'])
  })
  it('records the position on a remove, carries it on the add that undoes the remove, and writes none on an add', () => {
    const { store } = toyStore()
    store.run([create('Gamma')], person)
    const removed = store.run([del('b2')], person)
    expect(removed.ok && removed.records[0]).toMatchObject({ op: 'remove', kind: 'box', id: 'b2', position: 1 })
    const undone = store.undo('person')
    expect(undone.ok && undone.records[0]).toMatchObject({ op: 'add', kind: 'box', id: 'b2', position: 1 })
    const added = store.run([create('Delta')], person)
    expect(added.ok && 'position' in added.records[0]!).toBe(false)
  })
})

describe('the stacks', () => {
  it('clears the redo tail with a new batch that changes something', () => {
    const { store } = toyStore()
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' } }], person)
    store.undo('person')
    expect(store.redoDepth).toBe(1)
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'Y' } }], person)
    expect(store.redoDepth).toBe(0)
    expect(store.redo('person')).toMatchObject({ ok: false, refusal: { reason: 'nothing_to_redo' } })
  })
  it('refuses undo with nothing to undo, and says so', () => {
    const store = createStore(toyRegistry())
    expect(store.undo('person')).toMatchObject({ ok: false, refusal: { reason: 'nothing_to_undo' } })
    store.run([create('a')], person)
    expect(store.undo('person').ok).toBe(true)
    expect(store.undo('person')).toMatchObject({ ok: false, refusal: { reason: 'nothing_to_undo' } })
  })
  it('keeps the newest steps up to the limit and reports how many it dropped', () => {
    const store = createStore(toyRegistry(), { limit: 3 })
    store.run([create('a')], person)
    const trimmed: number[] = []
    for (const name of ['p', 'q', 'r', 's']) {
      const r = store.run([{ verb: 'box.rename', input: { id: 'b1', name } }], person)
      trimmed.push(r.ok ? r.trimmed : -1)
    }
    expect(store.undoDepth).toBe(3)
    // the create and the first two renames fill the three steps; the third and fourth rename each push one out
    expect(trimmed).toEqual([0, 0, 1, 1])
  })
  it('lets only the person undo and redo', () => {
    const { store } = toyStore()
    expect(store.undo('script')).toMatchObject({ ok: false, refusal: { reason: 'actor' } })
    expect(store.undo('person').ok).toBe(true)
    expect(store.redo('script')).toMatchObject({ ok: false, refusal: { reason: 'actor' } })
  })
})

describe('undo memory is proportional to the change', () => {
  it('keeps one record per write and shares every entity it did not touch with the state before', () => {
    const { store } = toyStore()
    const untouched = store.get('box', 'b2')
    const r = store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' } }], person)
    expect(r.ok && r.records).toHaveLength(1)
    expect(store.get('box', 'b2')).toBe(untouched)
    expect(store.get('box', 'b1')).not.toBe(untouched)
  })
})

describe('undo refuses a state it was not written against', () => {
  type Inside = { state: { entities: Map<string, Map<string, unknown>> } }
  it('undoes normally when the state is as the step left it', () => {
    const { store } = toyStore()
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' } }], person)
    expect(store.undo('person').ok).toBe(true)
  })
  it('refuses, naming the entity, and changes nothing when the entity the step wrote has gone', () => {
    const { store } = toyStore()
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' } }], person)
    ;(store as unknown as Inside).state.entities.get('box')!.delete('b1')
    const before = { hash: store.hash(), depth: store.undoDepth }
    const r = store.undo('person')
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'diverged', issues: [{ kind: 'box', id: 'b1' }] } })
    expect(store.undoDepth).toBe(before.depth)
  })
})
