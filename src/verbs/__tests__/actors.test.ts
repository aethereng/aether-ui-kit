// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRegistry, createStore, openVerb, type Actor, type Registry } from '..'
import { create, person, proposed, script, toyRegistry, toyStore } from './toy'

/** A registry of one kind and two verbs: `note.add`, open to anyone, and `note.seal`, open to the script only. */
function notes(actors?: readonly Actor[]): Registry {
  const r = createRegistry(actors === undefined ? {} : { actors })
  r.kind('note', { prefix: 'n' })
  r.verb<{ text: string }>({
    name: 'note.add', target: 'note', mints: true,
    input: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
    apply: (d, i, c) => d.add('note', c.id!, { Text: i.text }),
    describe: (i) => `Add a note '${i.text}'`,
  })
  return r
}

const add = (text: string) => ({ verb: 'note.add', input: { text } })

describe('the actors a registry names', () => {
  it('holds the person alone when none are given', () => {
    expect(createRegistry().actors).toEqual(['person'])
  })

  it('holds the names it is given, in their order', () => {
    expect(createRegistry({ actors: ['script', 'person'] }).actors).toEqual(['script', 'person'])
  })

  it('refuses an empty list, an empty name and a name given twice', () => {
    expect(() => createRegistry({ actors: [] })).toThrow(/actors/)
    expect(() => createRegistry({ actors: ['person', ''] })).toThrow(/actors/)
    expect(() => createRegistry({ actors: ['person', 'person'] })).toThrow(/actors/)
  })

  it('refuses a verb open to an actor it does not hold, and takes one open to an actor it holds', () => {
    const r = notes(['person', 'script'])
    const seal = (actors: readonly Actor[]) => ({
      name: 'note.seal', target: 'note', actors,
      input: { type: 'object', properties: {}, additionalProperties: false },
      apply: () => {},
      describe: () => 'Seal the notes',
    })
    expect(() => r.verb(seal(['robot']))).toThrow("verb 'note.seal' is open to the actor 'robot', which is not registered")
    expect(r.verbs.has('note.seal')).toBe(false)
    r.verb(seal(['script']))
    expect(r.verbs.get('note.seal')?.actors).toEqual(['script'])
  })

  it('gives the schema of a proposal to an actor it holds, and refuses one it does not', () => {
    const r = notes(['person', 'script'])
    expect(r.proposalSchema('script')).toMatchObject({ type: 'object' })
    expect(() => r.proposalSchema('robot')).toThrow("the actor 'robot' is not registered")
  })
})

describe('a call by an actor', () => {
  it('is refused when the registry does not hold the actor, and the store stays as it was', () => {
    const store = createStore(notes(['person', 'script']))
    const before = store.hash()
    expect(store.run([add('a')], { actor: 'robot' })).toEqual({ ok: false, refusal: { reason: 'actor', issues: [{ message: "the actor 'robot' is not registered" }] } })
    expect(store.hash()).toBe(before)
    expect(store.log).toHaveLength(0)
  })

  it('is run for each actor the registry holds, and the log names the actor', () => {
    const store = createStore(notes(['person', 'script']))
    expect(store.run([add('a')], { actor: 'person' })).toMatchObject({ ok: true, changed: true })
    expect(store.run([add('b')], { actor: 'script' })).toMatchObject({ ok: true, changed: true })
    expect(store.log.map((e) => e.actor)).toEqual(['person', 'script'])
  })

  it('opens no gesture for an actor the registry does not hold, and opens one for an actor it holds', () => {
    const store = createStore(notes(['person', 'script']))
    expect(store.gesture({ actor: 'robot' })).toMatchObject({ ok: false, refusal: { reason: 'actor', issues: [{ message: "the actor 'robot' is not registered" }] } })
    const g = store.gesture({ actor: 'script' })
    expect(g.ok).toBe(true)
    if (g.ok) g.gesture.cancel()
  })
})

describe('undo and redo', () => {
  it('are open to the first actor the registry names and to no other', () => {
    const store = createStore(notes(['script', 'person']))
    expect(store.run([add('a')], { actor: 'person' })).toMatchObject({ ok: true })
    expect(store.undo('person')).toMatchObject({ ok: false, refusal: { reason: 'actor', issues: [{ message: 'undo is open to the script only' }] } })
    expect(store.undo('script')).toMatchObject({ ok: true, changed: true })
    expect(store.redo('person')).toMatchObject({ ok: false, refusal: { reason: 'actor', issues: [{ message: 'redo is open to the script only' }] } })
    expect(store.redo('script')).toMatchObject({ ok: true, changed: true })
  })
})

describe('preview and accept', () => {
  it('run the proposal as the actor they are given', () => {
    const { store } = toyStore()
    const p = proposed(store, [{ verb: 'label.delete', input: { id: 'l1' } }])
    expect(store.preview(p, person)).toMatchObject({ ok: true })
    expect(store.preview(p, script)).toMatchObject({ ok: false, refusal: { reason: 'actor', at: 0 } })
    expect(store.accept(p, script)).toMatchObject({ ok: false, refusal: { reason: 'actor', at: 0 } })
    expect(store.accept(p, person)).toMatchObject({ ok: true, changed: true })
    expect(store.log[store.log.length - 1]).toMatchObject({ verb: 'label.delete', actor: 'person' })
  })

  it('name no actor of their own: a caller that gives none is refused', () => {
    const { store } = toyStore()
    const p = proposed(store, [create('Gamma')])
    const before = store.hash()
    const none = { ok: false, refusal: { reason: 'actor', issues: [{ message: 'no actor is named' }] } }
    expect(store.preview(p, {} as never)).toEqual(none)
    expect(store.accept(p, {} as never)).toEqual(none)
    expect(store.hash()).toBe(before)
  })
})

describe('the open verb', () => {
  it('is open to the first actor the registry names when it is given no actors', () => {
    const r = toyRegistry(undefined, { actors: ['script', 'person'] })
    r.kind('project', { prefix: 'p' })
    expect(openVerb(r, 'project').actors).toEqual(['script'])
    expect(openVerb(r, 'project', { actors: ['person', 'script'] }).actors).toEqual(['person', 'script'])
  })
})
