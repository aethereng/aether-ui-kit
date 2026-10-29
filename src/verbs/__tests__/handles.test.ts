// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, openVerb, replay, type Call, type Json, type Registry, type Store } from '..'
import { create, person, toyRegistry } from './toy'

const BOX = { type: 'string', 'x-ref': 'box' }

/** The toy vocabulary with the open verb and three verbs that take a handle in different places: free data, a plain string, and references in an anyOf and a list. */
function vocabulary(): { registry: Registry; store: Store } {
  const registry = toyRegistry((r) => {
    r.kind('workspace', { prefix: 'w' })
    r.verb(openVerb(r, 'workspace'))
    r.verb<{ id: string; note: Json }>({
      name: 'box.annotate', target: 'box',
      input: { type: 'object', properties: { id: BOX, note: { type: 'object' } }, required: ['id', 'note'], additionalProperties: false },
      apply: (d, i) => d.set('box', i.id, 'Note', i.note),
      describe: (i) => `Annotate box ${i.id}`,
    })
    r.verb<{ id: string; title: string }>({
      name: 'box.title', target: 'box',
      input: { type: 'object', properties: { id: BOX, title: { type: 'string' } }, required: ['id', 'title'], additionalProperties: false },
      apply: (d, i) => d.set('box', i.id, 'Title', i.title),
      describe: (i) => `Title box ${i.id}`,
    })
    r.verb<{ id: string; other: string | null; group: string[] }>({
      name: 'box.pair', target: 'box',
      input: {
        type: 'object',
        properties: { id: BOX, other: { anyOf: [BOX, { type: 'null' }] }, group: { type: 'array', items: BOX } },
        required: ['id', 'other', 'group'],
        additionalProperties: false,
      },
      apply: (d, i) => d.set('box', i.id, 'Pair', { other: i.other, group: i.group }),
      describe: (i) => `Pair box ${i.id}`,
    })
    r.verb<{ id: string; target: string | { handle: string } }>({
      name: 'box.either', target: 'box',
      input: {
        type: 'object',
        properties: { id: BOX, target: { anyOf: [BOX, { type: 'object', properties: { handle: { type: 'string' } }, required: ['handle'], additionalProperties: false }] } },
        required: ['id', 'target'],
        additionalProperties: false,
      },
      apply: (d, i) => d.set('box', i.id, 'Either', i.target),
      describe: (i) => `Point box ${i.id} somewhere`,
    })
  })
  const store = createStore(registry)
  const made = store.run([create('Alpha', 10, 20), create('Beta', 30, 40)], person)
  expect(made.ok).toBe(true)
  return { registry, store }
}
const made = (name: string): Call => create(name, 1, 1, 'g')
const shape = (store: Store) => ({ hash: store.hash(), undo: store.undoDepth, log: store.log.length })

describe('a handle is a reference only where the input schema marks one', () => {
  it('opens a state whose component holds an object with a handle key as data, and the log replays to the same state', () => {
    const { registry, store } = vocabulary()
    const snapshot = { entities: { box: { b7: { Name: 'Seven', Note: { handle: 'x' } } } }, counters: { box: 7 } }
    expect(store.run([{ verb: 'workspace.open', input: { snapshot } }], person)).toMatchObject({ ok: true, changed: true })
    expect(store.get('box', 'b7')!.Note).toEqual({ handle: 'x' })
    const back = replay(registry, store.save())
    expect(back.ok && back.store.get('box', 'b7')).toEqual(store.get('box', 'b7'))
  })
  it('keeps a handle-shaped value as data where the schema is free, also when a call of the batch made that name, and resolves the reference beside it', () => {
    const { registry, store } = vocabulary()
    const r = store.run([made('G'), { verb: 'box.annotate', input: { id: { handle: 'g' }, note: { handle: 'g' } } }], person)
    expect(r.ok && r.ids).toEqual({ g: 'b3' })
    expect(store.get('box', 'b3')!.Note).toEqual({ handle: 'g' })
    expect(store.log[store.log.length - 1]).toMatchObject({ verb: 'box.annotate', input: { id: 'b3', note: { handle: 'g' } } })
    const back = replay(registry, store.save())
    expect(back.ok && back.store.get('box', 'b3')).toEqual(store.get('box', 'b3'))
  })
  it('takes a handle name that nothing made as data where no reference is marked', () => {
    const { store } = vocabulary()
    expect(store.run([{ verb: 'box.annotate', input: { id: 'b1', note: { handle: 'never-made' } } }], person)).toMatchObject({ ok: true, changed: true })
    expect(store.get('box', 'b1')!.Note).toEqual({ handle: 'never-made' })
  })
  it('does not turn a handle into an id at a string that is no reference, and refuses it by its type', () => {
    const { store } = vocabulary()
    const before = shape(store)
    const r = store.run([made('G'), { verb: 'box.title', input: { id: 'b1', title: { handle: 'g' } } }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'input', at: 1, issues: [{ field: '/title' }] } })
    expect(r.ok === false && r.refusal.issues[0]?.message).toContain('of type string')
    expect(shape(store)).toEqual(before)
  })
  it('resolves a handle at a reference inside an anyOf', () => {
    const { store } = vocabulary()
    expect(store.run([made('G'), { verb: 'box.pair', input: { id: 'b1', other: { handle: 'g' }, group: [] } }], person).ok).toBe(true)
    expect(store.get('box', 'b1')!.Pair).toEqual({ other: 'b3', group: [] })
    expect(store.run([{ verb: 'box.pair', input: { id: 'b2', other: null, group: [] } }], person).ok).toBe(true)
  })
  it('resolves a handle at a reference in each item of a list, beside an id that is given as it is', () => {
    const { store } = vocabulary()
    expect(store.run([made('G'), { verb: 'box.pair', input: { id: 'b1', other: null, group: [{ handle: 'g' }, 'b2'] } }], person).ok).toBe(true)
    expect(store.get('box', 'b1')!.Pair).toEqual({ other: null, group: ['b3', 'b2'] })
  })
  it('keeps a handle-shaped value as data where an alternative of the same position takes an object, whether or not a call made that name', () => {
    const { store } = vocabulary()
    expect(store.run([made('G'), { verb: 'box.either', input: { id: 'b1', target: { handle: 'g' } } }], person).ok).toBe(true)
    expect(store.get('box', 'b1')!.Either).toEqual({ handle: 'g' })
    expect(store.run([{ verb: 'box.either', input: { id: 'b2', target: { handle: 'never-made' } } }], person)).toMatchObject({ ok: true, changed: true })
    expect(store.get('box', 'b2')!.Either).toEqual({ handle: 'never-made' })
  })
  it('takes the other alternative of that position as the reference it is', () => {
    const { store } = vocabulary()
    expect(store.run([{ verb: 'box.either', input: { id: { handle: 'nope' }, target: 'b2' } }], person)).toMatchObject({ ok: false, refusal: { reason: 'handle' } })
    expect(store.run([{ verb: 'box.either', input: { id: 'b1', target: 'b2' } }], person)).toMatchObject({ ok: true, changed: true })
    expect(store.get('box', 'b1')!.Either).toBe('b2')
    expect(store.run([{ verb: 'box.either', input: { id: 'b1', target: 'b9' } }], person)).toMatchObject({ ok: false, refusal: { reason: 'input' } })
  })
  it('still refuses a handle that nothing made where the schema marks a reference, naming it', () => {
    const { store } = vocabulary()
    const before = shape(store)
    const r = store.run([{ verb: 'box.pair', input: { id: 'b1', other: { handle: 'nope' }, group: [] } }], person)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'handle', at: 0 } })
    expect(r.ok === false && r.refusal.issues[0]?.message).toContain("'nope'")
    expect(shape(store)).toEqual(before)
  })
})
