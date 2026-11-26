// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore, replay, type Call, type Gesture, type Registry, type Store } from '..'
import { canonical, sha256 } from '../json'
import { create, person, proposed, toyStore } from './toy'

// the store's own json module, with its sha256 counted: one whole-store hash is one sha256 of the canonical entities
const counted = vi.hoisted(() => ({ sha256: 0 }))
vi.mock('../json', async (load) => {
  const real = await load<typeof import('../json')>()
  return { ...real, sha256: (text: string) => (counted.sha256++, real.sha256(text)) }
})
beforeEach(() => void (counted.sha256 = 0))

const resize = (id: string, w: number): Call => ({ verb: 'box.resize', input: { id, w } })

function open(store: Store): Gesture {
  const g = store.gesture(person)
  if (!g.ok) throw new Error(`the gesture was refused: ${g.refusal.issues.map((i) => i.message).join('; ')}`)
  return g.gesture
}

/** The content hash of the state as it stands, read from a snapshot, which leaves the store's own cache as it was. */
const hashOf = (store: Store): string => sha256(canonical(store.snapshot().entities))

/** A save made now holds the hash of the state the gesture found, and its log replays to it. */
function savesStart(registry: Registry, store: Store, start: string): void {
  const saved = store.save()
  expect(saved.hash).toBe(start)
  const back = replay(registry, saved)
  expect(back.ok).toBe(true)
  expect(back.ok && back.store.hash()).toBe(start)
}

describe('opening a gesture costs no hash of the store', () => {
  it('counts a whole-store hash where one is taken, so a count of none says something', () => {
    const { store } = toyStore()
    counted.sha256 = 0
    store.hash()
    expect(counted.sha256).toBe(1)
  })
  it('opens, moves and ends one gesture per edit without hashing the store', () => {
    const { store } = toyStore()
    counted.sha256 = 0
    for (const w of [31, 32, 33, 34, 35]) {
      const g = open(store)
      expect(g.move([resize('b2', w)])).toMatchObject({ ok: true, changed: true })
      expect(g.end()).toMatchObject({ ok: true, changed: true })
    }
    expect(counted.sha256).toBe(0)
    expect(store.get('box', 'b2')!.Dims).toEqual({ w: 35, h: 40 })
  })
})

describe('the hashes a save, a proposal and a replay read are those of the state a gesture opened on', () => {
  it('before any move, after moves, after a refused move, and after a move back to the start', () => {
    const { registry, store } = toyStore()
    const start = hashOf(store)
    const g = open(store)
    savesStart(registry, store, start)
    g.move([resize('b2', 31)])
    savesStart(registry, store, start)
    g.move([resize('b2', 32), resize('b1', 12)])
    savesStart(registry, store, start)
    expect(g.move([resize('b2', 1000)]).ok).toBe(false)
    savesStart(registry, store, start)
    expect(g.move([resize('b2', 30)])).toMatchObject({ ok: true, changed: false })
    savesStart(registry, store, start)
    g.move([resize('b2', 33)])
    savesStart(registry, store, start)
    savesStart(registry, store, start)
    g.end()
    expect(store.save().hash).toBe(hashOf(store))
    expect(store.save().hash).not.toBe(start)
  })
  it('when a move adds a kind the start held none of, and when it removes the last entity of a kind', () => {
    const { registry, store } = toyStore()
    const start = hashOf(store)
    const g = open(store)
    g.move([{ verb: 'crate.create', input: { name: 'C' } }])
    expect(store.ids('crate')).toHaveLength(1)
    savesStart(registry, store, start)
    g.move([{ verb: 'label.delete', input: { id: 'l1' } }])
    expect(store.ids('label')).toEqual([])
    savesStart(registry, store, start)
    g.move([{ verb: 'box.delete', input: { id: 'b1', cascade: true } }, create('N')])
    savesStart(registry, store, start)
    g.cancel()
    expect(store.hash()).toBe(start)
  })
  it('when a move writes what a system reacts to, and when the state under the gesture holds a kind emptied earlier', () => {
    const { registry, store } = toyStore()
    expect(store.run([{ verb: 'label.delete', input: { id: 'l1' } }], person)).toMatchObject({ ok: true, changed: true })
    expect(store.ids('label')).toEqual([])
    const start = hashOf(store)
    const g = open(store)
    g.move([{ verb: 'label.create', input: { on: 'b1', text: 'third' } }, resize('b1', 14)])
    expect(store.ids('label')).toHaveLength(1)
    expect(store.get('label', store.ids('label')[0]!)!.Stale).toBe(true)
    savesStart(registry, store, start)
    g.end()
    expect(store.run([{ verb: 'label.create', input: { on: 'b2', text: 'fourth' } }], person)).toMatchObject({ ok: true, changed: true })
    const next = hashOf(store)
    const h = open(store)
    h.move([resize('b2', 33)])
    expect(store.get('label', store.ids('label')[1]!)!.Stale).toBe(true)
    savesStart(registry, store, next)
    h.end()
  })
  it('when the hash was already taken before the gesture opened', () => {
    const { registry, store } = toyStore()
    const start = store.hash()
    const g = open(store)
    g.move([resize('b2', 31)])
    savesStart(registry, store, start)
    g.end()
  })
  it('in a store opened on a base, whose base hash a save carries through a gesture unchanged', () => {
    const { registry, store: first } = toyStore()
    const store = createStore(registry, { base: first.snapshot() })
    const baseHash = store.save().baseHash
    expect(baseHash).toBe(hashOf(first))
    store.run([resize('b1', 15)], person)
    const start = hashOf(store)
    const g = open(store)
    g.move([resize('b1', 16)])
    expect(store.save().baseHash).toBe(baseHash)
    savesStart(registry, store, start)
    g.end()
    expect(store.save().baseHash).toBe(baseHash)
  })
  it('a proposal made after a gesture ends rests on the state the gesture left, and is accepted on it', () => {
    const { store } = toyStore()
    const g = open(store)
    g.move([resize('b2', 31)])
    g.end()
    const p = proposed(store, [{ verb: 'box.rename', input: { id: 'b1', name: 'Q' } }])
    expect(p.baseHash).toBe(hashOf(store))
    expect(store.accept(p, person)).toMatchObject({ ok: true, changed: true })
  })
})
