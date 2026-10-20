// The proposal ledger against a fake host: the question an Accept asks, the shelf of replaced models,
// Load again, discard, and what stays in the record. No test loads a real model.
import { describe, expect, it } from 'vitest'
import { Ledger, sameContent, type LedgerHost, type LedgerProposal, type ProposalStatus, type Shown } from '../ledger'

interface Opened {
  name: string
}

/** A host whose shown model the test sets, and whose loads and restores it records. */
function fakeHost(initial: Shown | null) {
  let shown: Shown | null = initial
  const loads: string[] = []
  const restores: string[] = []
  const events: string[] = []
  const host: LedgerHost<Opened> = {
    shown: () => shown,
    describeChange: (s) => s.label,
    keep: () => {
      if (!shown) return null
      const { label, json } = shown
      return { label, json, restore: () => ((restores.push(label), (shown = { key: `restored:${label}`, json, label }))) }
    },
    load: (o) => {
      loads.push(o.name)
      shown = { key: `loaded:${o.name}`, json: { v: o.name }, label: o.name }
    },
    decided: (id, status) => void events.push(`${id} ${status}`),
    shelved: (e) => void events.push(`shelved ${e.label}`),
  }
  return { host, loads, restores, events, current: () => shown }
}

const proposal = (id: string, base: unknown, status: ProposalStatus = 'pending', opened: Opened | null = { name: `${id}-model` }): LedgerProposal<Opened> => ({
  id,
  status,
  decidedBy: null,
  decidedAt: null,
  base,
  opened,
})

const NOW = '2026-10-20T12:00:00.000Z'

describe('the question an Accept asks', () => {
  it('asks before it replaces a model whose content differs from the base, even under the same key', () => {
    const f = fakeHost({ key: 'same', json: { v: 'edited' }, label: 'Shown' })
    const ledger = new Ledger(f.host, () => NOW)
    const p = proposal('p1', { v: 'original' })
    expect(ledger.accept(p)).toEqual({ done: false, ask: { replaces: 'Shown', key: 'same' } })
    expect(f.loads).toEqual([])
    expect(p.status).toBe('pending')
  })

  it('asks no question when the model shown has the same content, under a different key, and with keys in another order', () => {
    const f = fakeHost({ key: 'elsewhere', json: { b: 2, a: 1 }, label: 'Shown' })
    const ledger = new Ledger(f.host, () => NOW)
    expect(ledger.accept(proposal('p1', { a: 1, b: 2 }))).toEqual({ done: true, ask: null })
    expect(f.loads).toEqual(['p1-model'])
  })

  it('loads with no question when no model is shown', () => {
    const f = fakeHost(null)
    const ledger = new Ledger(f.host, () => NOW)
    expect(ledger.accept(proposal('p1', null))).toEqual({ done: true, ask: null })
    expect(f.loads).toEqual(['p1-model'])
  })

  it('loads only after the person confirms the question', () => {
    const f = fakeHost({ key: 'same', json: { v: 'edited' }, label: 'Shown' })
    const ledger = new Ledger(f.host, () => NOW)
    const p = proposal('p1', { v: 'original' })
    ledger.accept(p)
    expect(f.loads).toEqual([])
    expect(ledger.accept(p, true)).toEqual({ done: true, ask: null })
    expect(f.loads).toEqual(['p1-model'])
  })
})

describe('an Accept and what it records', () => {
  it('marks the proposal accepted by the person, at the time the ledger reads', () => {
    const f = fakeHost(null)
    const ledger = new Ledger(f.host, () => NOW)
    const p = proposal('p1', null)
    ledger.accept(p)
    expect(p).toMatchObject({ status: 'accepted', decidedBy: 'person', decidedAt: NOW })
    expect(f.events).toEqual(['p1 accepted'])
  })

  it('refuses a proposal the loader refused, with nothing loaded and no question', () => {
    const f = fakeHost({ key: 'k', json: { v: 'edited' }, label: 'Shown' })
    const ledger = new Ledger(f.host, () => NOW)
    const refused = proposal('p1', { v: 'original' }, 'refused', null)
    expect(ledger.accept(refused)).toEqual({ done: false, ask: null })
    expect(f.loads).toEqual([])
    expect(f.events).toEqual([])
  })

  it('accepts a superseded proposal and a discarded one, as well as a pending one', () => {
    const f = fakeHost(null)
    const ledger = new Ledger(f.host, () => NOW)
    const superseded = proposal('p1', null, 'superseded')
    // the base of the discarded one is the content the first accept leaves shown
    const discarded = proposal('p2', { v: 'p1-model' }, 'discarded')
    expect(ledger.accept(superseded)).toEqual({ done: true, ask: null })
    expect(ledger.accept(discarded)).toEqual({ done: true, ask: null })
    expect([superseded.status, discarded.status]).toEqual(['accepted', 'accepted'])
    expect(f.loads).toEqual(['p1-model', 'p2-model'])
  })
})

describe('the shelf and Load again', () => {
  it('keeps the replaced model on the shelf with its edits, and loads it again', () => {
    const f = fakeHost({ key: 'a', json: { v: 'a-edited' }, label: 'A' })
    const ledger = new Ledger(f.host, () => NOW)
    ledger.accept(proposal('p1', { v: 'a' }), true)
    expect(ledger.shelf.map((s) => [s.id, s.label, s.json, s.replacedBy])).toEqual([['k1', 'A', { v: 'a-edited' }, 'p1']])
    expect(ledger.loadAgain('k1')).toBe(true)
    expect(f.restores).toEqual(['A'])
    // the model shown when Load again ran is shelved in its turn, and the replaced one is back
    expect(ledger.shelf.map((s) => s.label)).toEqual(['A', 'p1-model'])
    expect(f.current()?.label).toBe('A')
  })

  it('reports a shelf entry that does not exist as not loaded, and restores nothing', () => {
    const f = fakeHost(null)
    const ledger = new Ledger(f.host, () => NOW)
    expect(ledger.loadAgain('k9')).toBe(false)
    expect(f.restores).toEqual([])
  })

  it('holds no duplicate: a model already on the shelf by content is not shelved again', () => {
    const f = fakeHost({ key: 'a', json: { v: 'a' }, label: 'A' })
    const ledger = new Ledger(f.host, () => NOW)
    ledger.keepReplaced('first')
    ledger.keepReplaced('second')
    expect(ledger.shelf.map((s) => s.replacedBy)).toEqual(['first'])
  })
})

describe('a discard and what stays in the record', () => {
  it('discards only a pending proposal, and keeps it in the record as discarded', () => {
    const f = fakeHost(null)
    const ledger = new Ledger(f.host, () => NOW)
    const p = proposal('p1', null)
    expect(ledger.discard(p)).toBe(true)
    expect(p).toMatchObject({ status: 'discarded', decidedBy: 'person', decidedAt: NOW })
    expect(ledger.discard(p)).toBe(false)
    expect(ledger.discard(proposal('p2', null, 'pending', null))).toBe(false)
    expect(f.events).toEqual(['p1 discarded'])
  })

  it('drops nothing: after an accept, a discard and a load again, every proposal and shelf entry is still there', () => {
    const f = fakeHost({ key: 'a', json: { v: 'a-edited' }, label: 'A' })
    const ledger = new Ledger(f.host, () => NOW)
    // p3's base is the content the first accept leaves shown, so its accept loads with no question
    const proposals = [proposal('p1', { v: 'a' }), proposal('p2', null), proposal('p3', { v: 'p1-model' })]
    ledger.accept(proposals[0]!, true)
    ledger.discard(proposals[1]!)
    ledger.accept(proposals[2]!)
    ledger.loadAgain('k1')
    expect(proposals.map((p) => p.status)).toEqual(['accepted', 'discarded', 'accepted'])
    expect(ledger.shelf.map((s) => s.id)).toEqual(['k1', 'k2', 'k3'])
  })
})

describe('sameContent', () => {
  it('compares JSON-like values by content, with object keys as a set and arrays by position', () => {
    expect(sameContent({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBe(true)
    expect(sameContent({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(sameContent({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
    expect(sameContent({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(sameContent(null, {})).toBe(false)
    expect(sameContent([], {})).toBe(false)
  })
})
