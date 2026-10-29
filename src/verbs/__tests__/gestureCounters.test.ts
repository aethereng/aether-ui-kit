// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, replay, type Actor, type Call, type Gesture, type Saved, type Schema, type Store } from '..'
import { create, person, toyRegistry } from './toy'

// A gesture is logged as its last move alone, so the counters it leaves must be the counters that move gives on the state
// the gesture began from: a store reloaded from the log then issues the ids the live one does.

const rename = (id: string, name: string): Call => ({ verb: 'box.rename', input: { id, name } })

function open(store: Store, actor: Actor = 'person'): Gesture {
  const g = store.gesture({ actor })
  if (!g.ok) throw new Error('the gesture was refused')
  return g.gesture
}
const counters = (store: Store): { [kind: string]: number } => store.snapshot().counters
const boxes = (store: Store): string[] => store.ids('box')
const newest = (store: Store): string => {
  const r = store.run([create('n', 1, 1, 'x')], person)
  if (!r.ok) throw new Error('the create was refused')
  return r.ids['x']!
}

/** A store holding b1 and b4, so that the next id is b5 and there is a gap below it. */
function gapped(registry = toyRegistry()): Store {
  const dims = { w: 1, h: 1 }
  return createStore(registry, { base: { entities: { box: { b1: { Name: 'one', Dims: dims }, b4: { Name: 'four', Dims: dims } } }, counters: {} } })
}

const reloaded = (registry: ReturnType<typeof toyRegistry>, store: Store): Store => {
  const back = replay(registry, store.save())
  if (!back.ok) throw new Error(`the log was refused: ${back.refusal.issues.map((i) => i.message).join('; ')}`)
  return back.store
}

describe('the counters a gesture leaves', () => {
  it('are those of the last move alone: a create in an early move that a later rename replaces leaves no counter, live or replayed', () => {
    const registry = toyRegistry()
    const store = gapped(registry)
    const g = open(store)
    g.move([create('x', 1, 1)])
    expect(boxes(store)).toEqual(['b1', 'b4', 'b5'])
    g.move([rename('b1', 'uno')])
    expect(boxes(store)).toEqual(['b1', 'b4'])
    expect(g.end()).toMatchObject({ ok: true, changed: true })
    expect(counters(store)).toEqual({})
    const back = reloaded(registry, store)
    expect(counters(back)).toEqual(counters(store))
    expect(newest(store)).toBe('b5')
    expect(newest(back)).toBe('b5')
  })

  it('number the ids of every move from the counters the gesture began with, so a created entity keeps its id from move to move', () => {
    const registry = toyRegistry()
    const store = gapped(registry)
    const g = open(store)
    g.move([create('x', 1, 1)])
    g.move([create('y', 2, 2)])
    expect(boxes(store)).toEqual(['b1', 'b4', 'b5'])
    expect(store.get('box', 'b5')).toMatchObject({ Name: 'y' })
    g.end()
    expect(counters(store)).toEqual({ box: 5 })
    const back = reloaded(registry, store)
    expect(counters(back)).toEqual({ box: 5 })
    expect(newest(store)).toBe('b6')
    expect(newest(back)).toBe('b6')
  })

  it('stay where the move before left them when a move is refused', () => {
    const store = gapped()
    const g = open(store)
    g.move([create('x', 1, 1)])
    expect(g.move([rename('no such box', 'z')])).toMatchObject({ ok: false })
    expect(boxes(store)).toEqual(['b1', 'b4', 'b5'])
    expect(counters(store)).toEqual({ box: 5 })
    g.end()
    expect(counters(store)).toEqual({ box: 5 })
  })

  it('are given back with the entity at an undo of the gesture and taken again at its redo', () => {
    const store = gapped()
    const g = open(store)
    g.move([create('x', 1, 1)])
    g.move([create('y', 2, 2)])
    g.end()
    expect(store.undo('person').ok).toBe(true)
    expect(counters(store)).toEqual({})
    expect(store.redo('person').ok).toBe(true)
    expect(counters(store)).toEqual({ box: 5 })
  })

  it('are those of the start in a save made while the gesture is open, which replays to the start', () => {
    const registry = toyRegistry()
    const store = gapped(registry)
    const g = open(store)
    g.move([create('x', 1, 1)])
    const back = reloaded(registry, store)
    expect(counters(back)).toEqual({})
    expect(boxes(back)).toEqual(['b1', 'b4'])
    g.cancel()
  })
})

describe('a gesture of a verb that makes entities besides its target', () => {
  const TAG: Schema = { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' }, texts: { type: 'array', items: { type: 'string' } } }, required: ['id', 'texts'], additionalProperties: false }
  const registry = () =>
    toyRegistry((r) => {
      r.verb<{ id: string; texts: string[] }>({
        name: 'box.tag', target: 'box', mintsOther: ['label'],
        input: TAG,
        apply: (d, i, c) => i.texts.forEach((text) => d.add('label', c.mint('label'), { On: { kind: 'box', id: i.id }, Text: text })),
        describe: (i) => `Tag box ${i.id}`,
      })
    })
  const tag = (...texts: string[]): Call => ({ verb: 'box.tag', input: { id: 'b1', texts } })

  it('mints in its last move the ids a replay of the log mints', () => {
    const r = registry()
    const store = gapped(r)
    const g = open(store)
    g.move([tag('a', 'b')])
    g.move([tag('c')])
    g.end()
    expect(store.ids('label')).toEqual(['l1'])
    expect(counters(store)).toEqual({ label: 1 })
    const back = reloaded(r, store)
    expect(back.ids('label')).toEqual(['l1'])
    expect(counters(back)).toEqual({ label: 1 })
  })
})

describe('a replay', () => {
  it('is refused when the log reaches the saved content with other counters', () => {
    const registry = toyRegistry()
    const store = gapped(registry)
    store.run([create('x', 1, 1)], person)
    const saved = store.save()
    expect(replay(registry, saved)).toMatchObject({ ok: true })
    const refused = replay(registry, { ...saved, counters: gapped(registry).save().counters })
    expect(refused).toMatchObject({ ok: false, refusal: { reason: 'replay' } })
    expect(!refused.ok && refused.refusal.issues.map((i) => i.message).join(' ')).toContain('counters')
  })

  it('is refused as a malformed log when the saved log states no counters digest, however it would otherwise replay', () => {
    const registry = toyRegistry()
    const store = gapped(registry)
    store.run([create('x', 1, 1)], person)
    const saved = store.save()
    expect(saved.counters).toEqual(expect.any(String))
    const before: Partial<Saved> = { ...saved }
    delete before.counters
    const refused = replay(registry, before as Saved)
    expect(refused).toMatchObject({ ok: false, refusal: { reason: 'replay' } })
    const said = !refused.ok ? refused.refusal.issues.map((i) => i.message).join(' ') : ''
    expect(said).toBe('the saved counters digest must be a text, found nothing')
    const number = replay(registry, { ...saved, counters: 7 as unknown as string })
    expect(!number.ok && number.refusal.issues.map((i) => i.message)).toEqual(['the saved counters digest must be a text, found 7'])
  })
})
