// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, replay, type Saved, type Store } from '..'
import { create, person, toyRegistry } from './toy'

// An undo gives back the counters its step moved, so the ids an undone batch took are issued again; a delete moves no counter,
// so the id of a deleted entity is not. The counters are read from the snapshot, where a kind with no counter counts as 0.

const counter = (store: Store): number => store.snapshot().counters['box'] ?? 0
const boxes = (store: Store): string[] => store.ids('box')
const newest = (store: Store): string => {
  const r = store.run([create('n', 1, 1, 'x')], person)
  if (!r.ok) throw new Error('the create was refused')
  return r.ids['x']!
}

/** A store holding b1 and b4, so that the next id is b5 and there is a gap below it. */
function gapped(): Store {
  const dims = { w: 1, h: 1 }
  return createStore(toyRegistry(), { base: { entities: { box: { b1: { Name: 'one', Dims: dims }, b4: { Name: 'four', Dims: dims } } }, counters: {} } })
}

describe('the id after an undo', () => {
  it('is the id the undone create took: b1 and b4 held, a create takes b5, an undo, and the next create takes b5 again', () => {
    const store = gapped()
    const before = store.snapshot().counters
    expect(newest(store)).toBe('b5')
    expect(counter(store)).toBe(5)
    expect(store.undo('person').ok).toBe(true)
    expect(store.snapshot().counters).toEqual(before)
    expect(boxes(store)).toEqual(['b1', 'b4'])
    expect(newest(store)).toBe('b5')
  })

  it('goes back one step at a time through several creates', () => {
    const store = createStore(toyRegistry())
    expect([newest(store), newest(store), newest(store)]).toEqual(['b1', 'b2', 'b3'])
    store.undo('person')
    store.undo('person')
    expect(newest(store)).toBe('b2')
    expect(newest(store)).toBe('b3')
  })

  it('is not given back for a delete: five created, the fifth deleted, and the next create takes b6', () => {
    const store = createStore(toyRegistry())
    for (let i = 0; i < 5; i++) newest(store)
    expect(store.run([{ verb: 'box.delete', input: { id: 'b5' } }], person).ok).toBe(true)
    expect(counter(store)).toBe(5)
    expect(newest(store)).toBe('b6')
  })

  it('keeps a deleted id out when a later create is undone: the counter returns to 5, the highest present is b4, and the next create takes b6', () => {
    const store = createStore(toyRegistry())
    for (let i = 0; i < 5; i++) newest(store)
    store.run([{ verb: 'box.delete', input: { id: 'b5' } }], person)
    expect(newest(store)).toBe('b6')
    expect(store.undo('person').ok).toBe(true)
    expect(counter(store)).toBe(5)
    expect(boxes(store)).toEqual(['b1', 'b2', 'b3', 'b4'])
    expect(newest(store)).toBe('b6')
    expect(store.undo('person').ok).toBe(true)
    expect(store.undo('person').ok).toBe(true)
    expect(boxes(store)).toContain('b5')
  })

  it('is untouched by a batch that creates and deletes the same entity, which leaves no step and no counter behind', () => {
    const store = createStore(toyRegistry())
    const r = store.run([create('a', 1, 1, 'x'), { verb: 'box.delete', input: { id: 'b1' } }], person)
    expect(r).toMatchObject({ ok: true, changed: false })
    expect(counter(store)).toBe(0)
    expect(store.undoDepth).toBe(0)
    expect(newest(store)).toBe('b1')
  })
})

describe('a redo after an undo of a create', () => {
  it('takes the same id again and puts the counter where the create left it', () => {
    const store = gapped()
    expect(newest(store)).toBe('b5')
    store.undo('person')
    expect(store.redo('person').ok).toBe(true)
    expect(boxes(store)).toEqual(['b1', 'b4', 'b5'])
    expect(counter(store)).toBe(5)
    expect(newest(store)).toBe('b6')
  })

  it('meets nothing once a new create has taken the id: the run clears the redo branch, so the id is held by one entity only', () => {
    const store = gapped()
    expect(newest(store)).toBe('b5')
    store.undo('person')
    expect(newest(store)).toBe('b5')
    expect(store.redoDepth).toBe(0)
    expect(store.redo('person')).toMatchObject({ ok: false, refusal: { reason: 'nothing_to_redo' } })
    expect(boxes(store)).toEqual(['b1', 'b4', 'b5'])
  })
})

describe('a gesture that creates', () => {
  it('has its undo give the ids back as a batch does', () => {
    const store = createStore(toyRegistry())
    const g = store.gesture({ actor: 'person' })
    if (!g.ok) throw new Error('the gesture was refused')
    expect(g.gesture.move([create('a', 1, 1, 'x')]).ok).toBe(true)
    expect(g.gesture.end()).toMatchObject({ ok: true, changed: true })
    expect(counter(store)).toBe(1)
    store.undo('person')
    expect(counter(store)).toBe(0)
    expect(newest(store)).toBe('b1')
  })
})

describe('the log of a history with an undone create', () => {
  /** Create, undo, create again: the log holds the first create, the undo and the second create. */
  function history(): Store {
    const store = createStore(toyRegistry())
    newest(store)
    store.undo('person')
    newest(store)
    return store
  }

  it('replays to the state and the counters it was saved at, the second create naming the id of the first', () => {
    const store = history()
    expect(store.log.map((e) => e.verb)).toEqual(['box.create', 'undo', 'box.create'])
    expect(store.log.map((e) => (e.verb === 'box.create' ? (e.input as { id?: string }).id : undefined))).toEqual(['b1', undefined, 'b1'])
    const replayed = replay(toyRegistry(), store.save())
    expect(replayed.ok).toBe(true)
    if (!replayed.ok) return
    expect(replayed.store.hash()).toBe(store.hash())
    expect(replayed.store.snapshot().counters).toEqual(store.snapshot().counters)
    expect(replayed.store.undoDepth).toBe(store.undoDepth)
    // and the replayed store goes on from there as the live one does
    expect(newest(replayed.store)).toBe(newest(store))
  })

  it('replays a log in which a create after an undo names an id above the one the undo gave back', () => {
    // the log holds create b1, undo, and a second create that names b2
    const written = createStore(toyRegistry())
    written.run([{ verb: 'box.create', input: { name: 'n', w: 1, h: 1 } }], person)
    written.undo('person')
    written.run([{ verb: 'box.create', input: { name: 'n', w: 1, h: 1, id: 'b2' } }], { actor: 'person', allowOfferedIds: true })
    const saved: Saved = written.save()
    expect(saved.log.map((e) => e.verb)).toEqual(['box.create', 'undo', 'box.create'])
    const replayed = replay(toyRegistry(), saved)
    if (!replayed.ok) throw new Error('the log was refused')
    expect(boxes(replayed.store)).toEqual(['b2'])
  })
})
