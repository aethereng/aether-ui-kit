// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { deleteClosure, draftKeeper, stepWords, type Named } from '..'

describe('the records a delete must take with it', () => {
  it('grows by the records in the way of each round until the delete meets none', () => {
    // a stock is used by p1 and p2, and p2 by f1
    const uses: Record<string, Named[]> = { 'stocks/s1': [{ kind: 'parts', id: 'p1' }, { kind: 'parts', id: 'p2' }], 'parts/p2': [{ kind: 'fixings', id: 'f1' }] }
    const target = { kind: 'stocks', id: 's1' }
    const inTheWay = (cascade: readonly Named[]): Named[] => {
      const taken = new Set(cascade.map((c) => `${c.kind}/${c.id}`))
      return [target, ...cascade].flatMap((r) => uses[`${r.kind}/${r.id}`] ?? []).filter((r) => !taken.has(`${r.kind}/${r.id}`))
    }
    expect(deleteClosure(inTheWay)).toEqual([
      { kind: 'parts', id: 'p1' },
      { kind: 'parts', id: 'p2' },
      { kind: 'fixings', id: 'f1' },
    ])
    expect(deleteClosure(() => [])).toEqual([])
  })

  it('names a record once, and stops after its rounds where the plan keeps naming new ones', () => {
    let n = 0
    const endless = (): Named[] => [{ kind: 'parts', id: `p${n++}` }, { kind: 'parts', id: 'p0' }]
    expect(deleteClosure(endless, 3).map((r) => r.id)).toEqual(['p0', 'p1', 'p2'])
  })
})

describe('the words of each step', () => {
  const depths = { undoDepth: 0, redoDepth: 0 }
  const ok = (then: () => void) => () => (then(), { ok: true })

  it("names the step an undo takes back and a redo makes again, while the words are as many as the store's steps", () => {
    const words = stepWords()
    depths.undoDepth = 1
    words.changed(depths, 'Size of p1: 1 → 2 mm')
    depths.undoDepth = 2
    words.changed(depths, 'Created part p2')
    const undo = words.undo(depths, ok(() => ((depths.undoDepth = 1), (depths.redoDepth = 1))))
    expect(undo).toEqual({ outcome: { ok: true }, words: 'Created part p2' })
    const redo = words.redo(depths, ok(() => ((depths.undoDepth = 2), (depths.redoDepth = 0))))
    expect(redo.words).toBe('Created part p2')
    expect(words.undo(depths, ok(() => ((depths.undoDepth = 1), (depths.redoDepth = 1)))).words).toBe('Created part p2')
    expect(words.undo(depths, ok(() => ((depths.undoDepth = 0), (depths.redoDepth = 2)))).words).toBe('Size of p1: 1 → 2 mm')
  })

  it('leaves a step made elsewhere unnamed, and drops the words before it at the next change', () => {
    const words = stepWords()
    const store = { undoDepth: 1, redoDepth: 0 }
    words.changed(store, 'mine')
    store.undoDepth = 2 // a step another actor made
    expect(words.undo(store, ok(() => (store.undoDepth = 1))).words).toBeUndefined()
    store.undoDepth = 2
    words.changed(store, 'next')
    expect(words.undo(store, ok(() => (store.undoDepth = 1))).words).toBe('next')
    expect(words.undo(store, ok(() => (store.undoDepth = 0))).words).toBe('mine')
  })

  it('drops the words of the steps before a change made after a step elsewhere, so no undo names a step it does not take back', () => {
    const words = stepWords()
    const store = { undoDepth: 1, redoDepth: 0 }
    words.changed(store, 'a')
    store.undoDepth = 3 // a step another actor made, then this change
    words.changed(store, 'b')
    expect(words.undo(store, ok(() => (store.undoDepth = 2))).words).toBeUndefined()
    expect(words.undo(store, ok(() => (store.undoDepth = 1))).words, "the other actor's step").toBeUndefined()
  })

  it('empties the redo words at a change, and reads the redo stack for a redo', () => {
    const words = stepWords()
    const store = { undoDepth: 1, redoDepth: 0 }
    words.changed(store, 'a')
    store.undoDepth = 2
    words.changed(store, 'b')
    words.undo(store, ok(() => ((store.undoDepth = 1), (store.redoDepth = 1))))
    words.undo(store, ok(() => ((store.undoDepth = 0), (store.redoDepth = 2))))
    store.undoDepth = 1
    store.redoDepth = 0
    words.changed(store, 'c')
    words.undo(store, ok(() => ((store.undoDepth = 0), (store.redoDepth = 1))))
    expect(words.redo(store, ok(() => ((store.undoDepth = 1), (store.redoDepth = 0)))).words).toBe('c')
  })

  it('keeps the words on their stack when the store refuses the undo, and drops them all on reset', () => {
    const words = stepWords()
    const store = { undoDepth: 1, redoDepth: 0 }
    words.changed(store, 'one')
    expect(words.undo(store, () => ({ ok: false })).words).toBe('one')
    expect(words.undo(store, ok(() => (store.undoDepth = 0))).words).toBe('one')
    store.undoDepth = 1
    words.reset()
    words.changed(null, 'two')
    words.reset()
    expect(words.undo(store, ok(() => (store.undoDepth = 0))).words).toBeUndefined()
    const again = stepWords()
    const other = { undoDepth: 1, redoDepth: 0 }
    again.changed(other, 'three')
    again.undo(other, ok(() => ((other.undoDepth = 0), (other.redoDepth = 1))))
    again.reset()
    expect(again.redo(other, ok(() => ((other.undoDepth = 1), (other.redoDepth = 0)))).words, 'the redo words go too').toBeUndefined()
  })
})

describe('the drafts a form leaves unapplied', () => {
  const storeOf = (ids: Record<string, string[]>) => {
    const listeners: (() => void)[] = []
    return {
      ids: (kind: string) => ids[kind] ?? [],
      subscribe: (l: () => void) => listeners.push(l),
      change(next: Record<string, string[]>) {
        for (const k of Object.keys(ids)) delete ids[k]
        Object.assign(ids, next)
        for (const l of listeners) l()
      },
    }
  }

  it('gives a draft back once, for its record of its store only', () => {
    let changes = 0
    const keeper = draftKeeper(() => changes++)
    const a = storeOf({ fixings: ['f1'] })
    const b = storeOf({ fixings: ['f1'] })
    keeper.keep(a, 'fixings', 'f1', { variant: 'weld', fields: { by: 'weld' } })
    keeper.keep(a, 'fixings', null, { variant: 'glue', fields: {} })
    expect(keeper.kept(a)).toEqual([
      { kind: 'fixings', id: 'f1' },
      { kind: 'fixings', id: null },
    ])
    expect(keeper.take(b, 'fixings', 'f1')).toBeUndefined()
    expect(keeper.take(a, 'fixings', 'f1')).toEqual({ variant: 'weld', fields: { by: 'weld' } })
    expect(keeper.take(a, 'fixings', 'f1')).toBeUndefined()
    expect(keeper.kept(a)).toEqual([{ kind: 'fixings', id: null }])
    expect(changes).toBe(3)
  })

  it('drops a draft with its record, so a record made later with the same id starts from its own fields; a new one stays', () => {
    let changes = 0
    const keeper = draftKeeper(() => changes++)
    const store = storeOf({ fixings: ['f1', 'f2'] })
    keeper.keep(store, 'fixings', 'f1', { variant: 'weld', fields: {} })
    keeper.keep(store, 'fixings', 'f2', { variant: 'bolt', fields: {} })
    keeper.keep(store, 'fixings', null, { variant: 'glue', fields: {} })
    expect(changes).toBe(3)
    store.change({ fixings: ['f2'] })
    expect(changes, 'the drop is told').toBe(4)
    expect(keeper.kept(store)).toEqual([
      { kind: 'fixings', id: 'f2' },
      { kind: 'fixings', id: null },
    ])
    store.change({ fixings: ['f1', 'f2'] })
    expect(keeper.take(store, 'fixings', 'f1')).toBeUndefined()
  })
})
