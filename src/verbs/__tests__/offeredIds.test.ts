// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, type ProposalItem } from '..'
import { person, proposed, toyRegistry } from './toy'

/** A create that carries its id, as a file being read in does. */
const offered = (id: string): ProposalItem => ({ verb: 'box.create', input: { name: 'a', w: 1, h: 1, id } })

describe('a proposal whose creates carry their ids', () => {
  it('is previewed under those ids when allowOfferedIds is given, and refused without it', () => {
    const store = createStore(toyRegistry())
    const p = proposed(store, [offered('C15x33.9')])
    expect(store.preview(p, { ...person })).toMatchObject({ ok: false, refusal: { reason: 'input', at: 0 } })
    const r = store.preview(p, { ...person, allowOfferedIds: true })
    expect(r.ok && r.records.map((x) => x.id)).toEqual(['C15x33.9'])
    expect(store.ids('box')).toEqual([])
  })

  it('is accepted under those ids when allowOfferedIds is given, and refused without it', () => {
    const store = createStore(toyRegistry())
    const p = proposed(store, [offered('b7')])
    expect(store.accept(p, { ...person })).toMatchObject({ ok: false, refusal: { reason: 'input', at: 0 } })
    expect(store.ids('box')).toEqual([])
    expect(store.accept(p, { ...person, allowOfferedIds: true })).toMatchObject({ ok: true, changed: true })
    expect(store.ids('box')).toEqual(['b7'])
  })

  it('checks each offered id as a run does, on preview and on accept', () => {
    const store = createStore(toyRegistry())
    const refused = { ok: false, refusal: { reason: 'apply', at: 0 } }
    expect(store.run([offered('a~b')], { ...person, allowOfferedIds: true })).toMatchObject(refused)
    const p = proposed(store, [offered('a~b')])
    expect(store.preview(p, { ...person, allowOfferedIds: true })).toMatchObject(refused)
    expect(store.accept(p, { ...person, allowOfferedIds: true })).toMatchObject(refused)
    expect(store.ids('box')).toEqual([])
  })

  it('passes allowOfferedIds to the preview accept makes when the base has moved, so the overlap is named', () => {
    const store = createStore(toyRegistry())
    expect(store.run([{ verb: 'box.create', input: { name: 'z', w: 1, h: 1 } }], person)).toMatchObject({ ok: true })
    const p = proposed(store, [offered('b7'), { verb: 'box.rename', input: { id: 'b1', name: 'Y' } }])
    expect(store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'Q' } }], person)).toMatchObject({ ok: true })
    const r = store.accept(p, { ...person, allowOfferedIds: true })
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'base_changed', changed: [{ kind: 'box', id: 'b1' }], overlapping: [{ kind: 'box', id: 'b1' }] } })
    expect(store.accept(p, { ...person, allowOfferedIds: true, acknowledgeBase: true })).toMatchObject({ ok: true, changed: true })
    expect(store.ids('box')).toEqual(['b1', 'b7'])
    expect(store.get('box', 'b1')?.Name).toBe('Y')
  })
})
