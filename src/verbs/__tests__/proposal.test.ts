// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStore, openVerb, type Json, type Proposal, type ProposalItem, type Store } from '..'
import { create, person, proposed, toyRegistry, toyStore } from './toy'

const rename = (id: string, name: string): ProposalItem => ({ verb: 'box.rename', input: { id, name }, basis: { source: 'a hand check' } })
const stripSeq = (records: readonly object[]) => records.map((r) => ({ ...r, seq: 0 }))

describe('a proposal is a pending batch with its base hash', () => {
  it('carries the hash of the store it was made against and changes nothing by existing', () => {
    const { store } = toyStore()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    const p = proposed(store, [rename('b1', 'X')])
    expect(p.baseHash).toBe(before.hash)
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
  })
  it('previews as a card, one line per item and the records, with the store untouched', () => {
    const { store } = toyStore()
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length, name: store.get('box', 'b1')!.Name }
    const v = store.preview(proposed(store, [rename('b1', 'X'), { verb: 'box.resize', input: { id: 'b2', w: 3 } }]))
    expect(v.ok && v.lines).toEqual(["Rename box b1 to 'X'", 'Resize box b2'])
    expect(v.ok && v.records.length).toBeGreaterThan(1)
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length, name: store.get('box', 'b1')!.Name }).toEqual(before)
  })
  it('shows a reader of the store the real model for the whole of a preview', () => {
    const seen: unknown[] = []
    const held: { store: Store | null } = { store: null }
    const peek = (): unknown => held.store!.get('box', 'b1')!.Name
    const reg = toyRegistry((r) => {
      r.verb<{ id: string }>({
        name: 'box.peek', target: 'box',
        input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'] },
        validate: () => (seen.push(peek()), []),
        apply: (d, i) => {
          d.set('box', i.id, 'Name', 'previewed')
          seen.push(peek())
        },
        describe: () => 'Peek',
      })
    })
    const store = createStore(reg)
    held.store = store
    store.run([create('real')], person)
    const v = store.preview(proposed(store, [{ verb: 'box.peek', input: { id: 'b1' } }]))
    expect(v.ok).toBe(true)
    expect(seen).toEqual(['real', 'real'])
    expect(store.get('box', 'b1')!.Name).toBe('real')
  })
  it('refuses a preview that cannot apply, naming the item', () => {
    const { store } = toyStore()
    const v = store.preview(proposed(store, [rename('b1', 'X'), rename('b9', 'Y')]))
    expect(v).toMatchObject({ ok: false, refusal: { reason: 'input', at: 1 } })
  })
})

describe('accept', () => {
  it('applies the batch the preview showed, as one undo step', () => {
    const { store } = toyStore()
    const p = proposed(store, [rename('b1', 'X'), { verb: 'box.resize', input: { id: 'b2', w: 3 } }])
    const v = store.preview(p)
    const depth = store.undoDepth
    const r = store.accept(p)
    expect(r.ok && stripSeq(r.records)).toEqual(v.ok ? stripSeq(v.records) : null)
    expect(store.undoDepth).toBe(depth + 1)
  })
  it('refuses when the model changed under the proposal, naming what was written and what overlaps', () => {
    const { store } = toyStore()
    const p = proposed(store, [rename('b1', 'FromProposal')])
    store.run([{ verb: 'box.rename', input: { id: 'b1', name: 'ByHand' } }, { verb: 'box.rename', input: { id: 'b2', name: 'Elsewhere' } }], person)
    const r = store.accept(p)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'base_changed' } })
    expect(r.ok === false && r.refusal.overlapping).toEqual([{ kind: 'box', id: 'b1', component: 'Name' }])
    expect(r.ok === false && r.refusal.changed).toEqual([{ kind: 'box', id: 'b1', component: 'Name' }, { kind: 'box', id: 'b2', component: 'Name' }])
    expect(store.get('box', 'b1')!.Name).toBe('ByHand')
  })
  it('refuses even when nothing the proposal touches changed, and says nothing overlaps', () => {
    const { store } = toyStore()
    const p = proposed(store, [rename('b1', 'X')])
    store.run([{ verb: 'box.rename', input: { id: 'b2', name: 'Elsewhere' } }], person)
    const r = store.accept(p)
    expect(r.ok === false && r.refusal.overlapping).toEqual([])
    expect(r.ok === false && r.refusal.reason).toBe('base_changed')
  })
  it('commits when the person has acknowledged the change, revalidating against the model as it is', () => {
    const { store } = toyStore()
    const p = proposed(store, [rename('b1', 'X')])
    store.run([{ verb: 'box.rename', input: { id: 'b2', name: 'Elsewhere' } }], person)
    expect(store.accept(p, { acknowledgeBase: true }).ok).toBe(true)
    const gone = proposed(store, [rename('b2', 'Y')])
    store.run([{ verb: 'box.delete', input: { id: 'b2' } }], person)
    expect(store.accept(gone, { acknowledgeBase: true })).toMatchObject({ ok: false, refusal: { reason: 'input' } })
  })
  it('refuses when an open changed only the counters, because the id its card showed may not be the one it would mint', () => {
    const registry = toyRegistry((r) => {
      r.kind('workspace', { prefix: 'w' })
      r.verb(openVerb(r, 'workspace'))
    })
    const store = createStore(registry)
    expect(store.run([create('Alpha'), create('Beta')], person).ok).toBe(true)
    const p = proposed(store, [{ verb: 'box.create', input: { name: 'New', w: 5, h: 5 } }])
    const card = store.preview(p)
    expect(card.ok && card.records.map((x) => x.id)).toEqual(['b3'])
    const kept = store.snapshot()
    const opened = store.run([{ verb: 'workspace.open', input: { snapshot: { entities: kept.entities, counters: { box: 50 } } } }], person)
    expect(opened).toMatchObject({ ok: true, changed: true })
    // the precondition of the case: the content hash cannot tell the two stores apart
    expect(store.hash()).toBe(p.baseHash)
    const before = { hash: store.hash(), snapshot: store.snapshot(), undo: store.undoDepth, redo: store.redoDepth, log: store.log.length }
    const r = store.accept(p)
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'base_changed' } })
    expect(!r.ok && r.refusal.issues.map((i) => i.message)).toEqual(['the counters that ids are minted from changed after this proposal was made, so the ids its card showed may not be the ones it would mint'])
    expect({ hash: store.hash(), snapshot: store.snapshot(), undo: store.undoDepth, redo: store.redoDepth, log: store.log.length }).toEqual(before)
    // acknowledged, accept commits and mints from the counters as they stand
    const again = store.accept(p, { acknowledgeBase: true })
    expect(again.ok && again.records.map((x) => x.id)).toEqual(['b51'])
  })
  it('commits after an open that left the content and the counters as they were', () => {
    const registry = toyRegistry((r) => {
      r.kind('workspace', { prefix: 'w' })
      r.verb(openVerb(r, 'workspace'))
    })
    const store = createStore(registry)
    expect(store.run([create('Alpha'), create('Beta')], person).ok).toBe(true)
    const p = proposed(store, [{ verb: 'box.create', input: { name: 'New', w: 5, h: 5 } }])
    const opened = store.run([{ verb: 'workspace.open', input: { snapshot: store.snapshot() as unknown as Json } }], person)
    expect(opened).toMatchObject({ ok: true, changed: false })
    const r = store.accept(p)
    expect(r.ok && r.records.map((x) => x.id)).toEqual(['b3'])
  })
  it('refuses when a create and its delete left the content as it was and changed the counters', () => {
    const { store } = toyStore()
    const p = proposed(store, [{ verb: 'box.create', input: { name: 'New', w: 5, h: 5 } }])
    expect(store.run([create('Passing', 1, 1, 'x')], person).ok).toBe(true)
    expect(store.run([{ verb: 'box.delete', input: { id: 'b3' } }], person).ok).toBe(true)
    expect(store.hash()).toBe(p.baseHash)
    expect(store.accept(p)).toMatchObject({ ok: false, refusal: { reason: 'base_changed' } })
  })
  it('commits a proposal that mints no id after a create and its delete changed the counters, and refuses one that mints', () => {
    const { store } = toyStore()
    const renaming = proposed(store, [rename('b1', 'X')])
    const minting = proposed(store, [{ verb: 'box.create', input: { name: 'New', w: 5, h: 5 } }])
    expect(store.run([create('Passing', 1, 1, 'x')], person).ok).toBe(true)
    expect(store.run([{ verb: 'box.delete', input: { id: 'b3' } }], person).ok).toBe(true)
    expect(store.hash(), 'the precondition: the content is as it was').toBe(renaming.baseHash)
    expect(store.accept(minting), 'the precondition: the counter digest differs from the base').toMatchObject({ ok: false, refusal: { reason: 'base_changed' } })
    const r = store.accept(renaming)
    expect(r.ok && r.records.map((x) => x.id)).toEqual(['b1'])
    expect(store.get('box', 'b1')!.Name).toBe('X')
  })
  it('compares content, so a change that was undone does not make the base differ', () => {
    const { store } = toyStore()
    const p = proposed(store, [rename('b1', 'X')])
    store.run([rename('b2', 'Elsewhere')], person)
    store.undo('person')
    expect(store.accept(p).ok).toBe(true)
  })
  it('refuses while a lock is held', () => {
    const { store } = toyStore()
    const p = proposed(store, [rename('b1', 'X')])
    store.lock('solving')
    expect(store.accept(p)).toMatchObject({ ok: false, refusal: { reason: 'locked' } })
  })
})

describe('a card taken in part', () => {
  const items = (): ProposalItem[] => [
    { verb: 'box.create', input: { name: 'New', w: 5, h: 5 }, as: 'n' },
    { verb: 'label.create', input: { on: { handle: 'n' }, text: 'on new' } },
    rename('b2', 'Ticked'),
  ]
  it('applies only the ticked items', () => {
    const { store } = toyStore()
    const p: Proposal = proposed(store, items())
    const r = store.accept(p, { only: [2] })
    expect(r.ok && r.records.map((x) => `${x.kind}.${x.id}`)).toEqual(['box.b2'])
    expect(store.ids('box')).toEqual(['b1', 'b2'])
  })
  it('refuses a ticked item that names the handle of an unticked create, by name', () => {
    const { store } = toyStore()
    const r = store.accept(proposed(store, items()), { only: [1, 2] })
    expect(r).toMatchObject({ ok: false, refusal: { reason: 'handle', at: 0 } })
    expect(r.ok === false && r.refusal.issues[0]?.message).toMatch(/'n' is made by item 1, which is not part of this batch/)
  })
  it('takes the create and its dependant together', () => {
    const { store } = toyStore()
    expect(store.accept(proposed(store, items()), { only: [0, 1] }).ok).toBe(true)
    expect(store.ids('label')).toHaveLength(2)
  })
  it.each<[string, number[]]>([
    ['past the last item', [7]],
    ['below the first', [-1]],
    ['a fraction', [1.5]],
    ['named twice', [0, 0]],
  ])('refuses a ticked item %s, from the preview and from accept, and changes nothing', (_title, only) => {
    const { store } = toyStore()
    const p = proposed(store, items())
    const before = { hash: store.hash(), depth: store.undoDepth, log: store.log.length }
    expect(store.preview(p, { only })).toMatchObject({ ok: false, refusal: { reason: 'input' } })
    expect(store.accept(p, { only })).toMatchObject({ ok: false, refusal: { reason: 'input' } })
    expect({ hash: store.hash(), depth: store.undoDepth, log: store.log.length }).toEqual(before)
  })
})

describe('the basis rides in the proposal and the log', () => {
  it('writes each item\'s basis into its log entry, unread', () => {
    const { store } = toyStore()
    store.accept(proposed(store, [rename('b1', 'X')]))
    expect(store.log[store.log.length - 1]).toMatchObject({ verb: 'box.rename', actor: 'script', basis: { source: 'a hand check' } })
  })
  it('copies the items, so a later edit of the caller\'s objects does not change the proposal', () => {
    const { store } = toyStore()
    const items = [rename('b1', 'X')]
    const p = proposed(store, items)
    ;(items[0]!.input as { name: string }).name = 'Changed'
    store.accept(p)
    expect(store.get('box', 'b1')!.Name).toBe('X')
  })
})

describe('a proposal of a verb that declares the kinds it makes besides its target', () => {
  it('is refused after a create and its delete changed the counters, as a proposal that mints is', () => {
    const store = createStore(
      toyRegistry((r) =>
        r.verb<{ id: string }>({
          name: 'box.tag', target: 'box', mintsOther: ['label'],
          input: { type: 'object', properties: { id: { type: 'string', 'x-ref': 'box' } }, required: ['id'], additionalProperties: false },
          apply: (d, i, c) => d.add('label', c.mint('label'), { On: { kind: 'box', id: i.id }, Text: 'tag' }),
          describe: (i) => `Tag box ${i.id}`,
        }),
      ),
    )
    store.run([create('Alpha')], person)
    const tagging = proposed(store, [{ verb: 'box.tag', input: { id: 'b1' }, basis: { source: 'a hand check' } }])
    expect(store.run([create('Passing', 1, 1, 'x')], person).ok).toBe(true)
    expect(store.run([{ verb: 'box.delete', input: { id: 'b2' } }], person).ok).toBe(true)
    expect(store.hash(), 'the precondition: the content is as it was').toBe(tagging.baseHash)
    expect(store.accept(tagging)).toMatchObject({ ok: false, refusal: { reason: 'base_changed' } })
  })
})
