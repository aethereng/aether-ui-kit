// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, replay, type LogEntry, type Saved } from '..'
import { create, person, toyRegistry, toyStore } from './toy'

/** A store with a history that holds a minted id, a handle, a cascade, an undo and a redo. */
function history() {
  const registry = toyRegistry()
  const store = createStore(registry)
  store.run([create('Alpha', 10, 20, 'a'), { verb: 'label.create', input: { on: { handle: 'a' }, text: 'first' } }], person)
  store.run([create('Beta', 30, 40)], person)
  store.run([{ verb: 'box.resize', input: { id: 'b1', w: 50 } }], person)
  store.undo('person')
  store.redo('person')
  store.run([{ verb: 'box.delete', input: { id: 'b2' } }], person)
  store.undo('person')
  store.run([create('Gamma', 1, 1)], person)
  return { registry, store }
}

describe('the log', () => {
  it('holds every minted id and no handle in each entry\'s input', () => {
    const { store } = history()
    const first = store.log.slice(0, 2)
    expect(first.map((e) => e.verb)).toEqual(['box.create', 'label.create'])
    expect(first[0]!.input).toEqual({ name: 'Alpha', w: 10, h: 20, id: 'b1' })
    expect(first[1]!.input).toEqual({ on: 'b1', text: 'first', id: 'l1' })
    expect(JSON.stringify(store.log)).not.toContain('handle')
  })
  it('records an undo and a redo as entries of their own, and groups a batch\'s entries under one number', () => {
    const { store } = history()
    expect(store.log.map((e) => e.verb)).toContain('undo')
    expect(store.log.map((e) => e.verb)).toContain('redo')
    expect(store.log.filter((e) => e.batch === 1)).toHaveLength(2)
  })
  it('numbers its entries from zero in order', () => {
    const { store } = history()
    expect(store.log.map((e) => e.seq)).toEqual(store.log.map((_, i) => i))
  })
  it('is read as a frozen list, so a reader cannot change it and a later commit does not change a list already read', () => {
    const { store } = toyStore()
    const first = store.log
    const length = first.length
    expect(() => {
      ;(first as LogEntry[]).length = 0
    }).toThrow(/read only/)
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' } }], person)
    expect(first).toHaveLength(length)
    expect(store.log).toHaveLength(length + 1)
  })
  it('hands every reader one list between two changes of the log, and a new list after a change', () => {
    const { store } = toyStore()
    const first = store.log
    expect(store.log).toBe(first)
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' } }], person)
    const second = store.log
    expect(second).not.toBe(first)
    expect(store.log).toBe(second)
    store.undo('person')
    expect(store.log).not.toBe(second)
    expect(store.log.map((e) => e.verb).slice(-1)).toEqual(['undo'])
  })
  it("keeps each entry's input unwritable and copies the basis it is given", () => {
    const { store } = toyStore()
    const basis = { why: 'a reason' }
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' }, basis }], person)
    basis.why = 'changed'
    const entry = store.log[store.log.length - 1]!
    expect(entry.basis).toEqual({ why: 'a reason' })
    expect(() => {
      ;(entry.input as { name: string }).name = 'Y'
    }).toThrow(/read only/)
    expect(() => {
      ;(entry as { verb: string }).verb = 'box.explode'
    }).toThrow(/read only/)
    store.undo('person')
    const undone = store.log[store.log.length - 1]!
    expect(() => {
      ;(undone as { verb: string }).verb = 'box.explode'
    }).toThrow(/read only/)
    expect(() => {
      ;(undone.input as { extra?: number }).extra = 1
    }).toThrow(/not extensible/)
  })
})

describe('replay', () => {
  it('reaches the stored content hash with the same ids, undo and redo included', () => {
    const { registry, store } = history()
    const r = replay(registry, store.save())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.store.hash()).toBe(store.hash())
    expect(r.store.ids('box')).toEqual(store.ids('box'))
    expect(r.store.log).toEqual(store.log)
    expect(r.store.undoDepth).toBe(store.undoDepth)
  })
  it('replays a log that went through JSON text', () => {
    const { registry, store } = history()
    const saved = JSON.parse(JSON.stringify(store.save())) as Saved
    const r = replay(registry, saved)
    expect(r.ok && r.store.hash()).toBe(store.hash())
  })
  it('replays over a base that is not empty', () => {
    const registry = toyRegistry()
    const first = createStore(registry)
    first.run([create('Seed')], person)
    const store = createStore(registry, { base: first.snapshot() })
    store.run([create('Next', 1, 1)], person)
    expect(store.ids('box')).toEqual(['b1', 'b2'])
    const r = replay(registry, store.save())
    expect(r.ok && r.store.hash()).toBe(store.hash())
  })
  it('refuses a log written against another base, by the base hash', () => {
    const { registry, store } = history()
    const other = createStore(registry)
    other.run([create('Other')], person)
    const saved = { ...store.save(), base: other.snapshot() }
    expect(replay(registry, saved)).toMatchObject({ ok: false, refusal: { reason: 'replay', issues: [{ message: expect.stringMatching(/base hash differs/) }] } })
  })
  it('refuses a log whose entry was changed, because it reaches another state', () => {
    const { registry, store } = history()
    const saved = store.save()
    const entry = saved.log.find((e) => e.verb === 'box.resize')!
    ;(entry.input as { w: number }).w = 51
    expect(replay(registry, saved)).toMatchObject({ ok: false, refusal: { reason: 'replay', issues: [{ message: expect.stringMatching(/content hash differs/) }] } })
  })
  it('refuses a log entry the vocabulary refuses, naming its place', () => {
    const { registry, store } = history()
    const saved = store.save()
    saved.log[2]!.verb = 'box.explode'
    expect(replay(registry, saved)).toMatchObject({ ok: false, refusal: { reason: 'replay', at: 2 } })
  })
  it('names the place of the second entry of a batch', () => {
    const { registry, store } = history()
    const saved = store.save()
    expect(saved.log[0]!.batch).toBe(saved.log[1]!.batch)
    saved.log[1]!.verb = 'box.explode'
    expect(replay(registry, saved)).toMatchObject({ ok: false, refusal: { reason: 'replay', at: 1 } })
  })
  it('replays under the undo limit the log was written under, for a limit above the default', () => {
    const registry = toyRegistry()
    const store = createStore(registry, { limit: 60 })
    store.run([create('Alpha')], person)
    for (let i = 0; i < 60; i++) store.run([{ verb: 'box.rename', input: { id: 'b1', name: `n${i}` } }], person)
    for (let i = 0; i < 55; i++) expect(store.undo('person').ok).toBe(true)
    const saved = store.save()
    expect(saved.limit).toBe(60)
    const r = replay(registry, saved)
    expect(r.ok && r.store.hash()).toBe(store.hash())
    expect(r.ok && r.store.undoDepth).toBe(store.undoDepth)
    expect(replay(registry, { ...saved, limit: 50 })).toMatchObject({ ok: false, refusal: { reason: 'replay', issues: [{ message: 'there is nothing to undo' }] } })
  })
})

describe('the undo limit', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('is refused by a store made with %s', (limit) => {
    expect(() => createStore(toyRegistry(), { limit })).toThrow('whole number of at least 1')
  })
  it('is refused on replay for each bad limit a saved file may hold, before any call is run', () => {
    const { registry, store } = history()
    const saved = store.save()
    const bad: Array<[string, unknown]> = [['-1', -1], ['0', 0], ['2.5', 2.5], ['null', null], ['nothing', undefined]]
    for (const [name, limit] of bad) {
      const r = replay(registry, { ...saved, limit } as unknown as Saved)
      expect(r, `a saved limit of ${name}`).toMatchObject({ ok: false, refusal: { reason: 'replay', issues: [{ message: expect.stringContaining('whole number of at least 1') }] } })
    }
  })
  it('keeps one step at a limit of 1, and a saved log under that limit replays', () => {
    const registry = toyRegistry()
    const store = createStore(registry, { limit: 1 })
    store.run([create('Alpha')], person)
    const r = store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'X' } }], person)
    expect(r.ok && r.trimmed).toBe(1)
    expect(store.undoDepth).toBe(1)
    const back = replay(registry, store.save())
    expect(back.ok && back.store.hash()).toBe(store.hash())
  })
})

describe('save', () => {
  it('hands out copies, so a change to the saved text does not reach the store', () => {
    const { store } = toyStore()
    const saved = store.save()
    const hash = store.hash()
    ;(saved.base.entities as Record<string, unknown>).box = {}
    saved.log.length = 0
    expect(store.hash()).toBe(hash)
    expect(store.log.length).toBeGreaterThan(0)
    expect(store.save().log.length).toBe(store.log.length)
  })
  it('hashes the entities only, so two stores holding the same content agree whatever counters they carry', () => {
    const registry = toyRegistry()
    const a = createStore(registry)
    const b = createStore(registry, { base: { entities: {}, counters: { box: 40 } } })
    expect(a.hash()).toBe(b.hash())
    a.run([create('x')], person)
    b.run([create('x')], person)
    expect(a.hash()).not.toBe(b.hash())
    expect(a.ids('box')).toEqual(['b1'])
    expect(b.ids('box')).toEqual(['b41'])
  })
})
