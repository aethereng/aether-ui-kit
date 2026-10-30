// What an editor keeps beside its store: the records a delete must take with it, the words of each step it can undo or
// redo, and the drafts a form leaves unapplied.

/** A record, by its kind and id. */
export interface Named {
  kind: string
  id: string
}

/**
 * Every record a delete must take with it: the records in its way, and theirs, grown until the delete meets none.
 * `inTheWay` answers which records stand in the way of the delete with a given cascade, as the app's delete plan reads
 * them. Stops after `rounds` rounds, where a plan keeps naming new records.
 */
export function deleteClosure(inTheWay: (cascade: readonly Named[]) => readonly Named[], rounds = 64): Named[] {
  let cascade: Named[] = []
  for (let round = 0; round < rounds; round++) {
    const missing = inTheWay(cascade)
    if (missing.length === 0) return cascade
    const seen = new Set(cascade.map((c) => `${c.kind}/${c.id}`))
    for (const m of missing) {
      if (seen.has(`${m.kind}/${m.id}`)) continue
      seen.add(`${m.kind}/${m.id}`)
      cascade = [...cascade, { kind: m.kind, id: m.id }]
    }
  }
  return cascade
}

/** The depth of a store's undo and redo stacks. */
export interface Depths {
  readonly undoDepth: number
  readonly redoDepth: number
}

/** The words of an editor's steps, against the store's undo and redo stacks. */
export interface StepWords {
  /** A change made through the editor: its words, with the store as it is after the change. */
  changed(store: Depths | null, words: string): void
  /** Runs an undo; the words of the step it took back, where they name it. */
  undo<T extends { ok: boolean }>(store: Depths, run: () => T): { outcome: T; words: string | undefined }
  /** Runs a redo; the words of the step it made again, where they name it. */
  redo<T extends { ok: boolean }>(store: Depths, run: () => T): { outcome: T; words: string | undefined }
  /** Drops every step's words: another store is shown. */
  reset(): void
}

/**
 * The words of each change still on the store's undo stack, and of each undone one on its redo stack. They name a step
 * only while they are as many as the store's steps: a step made elsewhere (another actor, a change not told here) leaves
 * the undo of it unnamed, and the words of the steps before it are dropped at the next change.
 */
export function stepWords(): StepWords {
  const done: string[] = []
  const undone: string[] = []
  const step = <T extends { ok: boolean }>(from: string[], to: string[], depth: number, run: () => T) => {
    const words = from.length === depth ? from.pop() : undefined
    const outcome = run()
    if (words !== undefined) (outcome.ok ? to : from).push(words)
    return { outcome, words }
  }
  return {
    changed(store, words) {
      if (store !== null && done.length !== store.undoDepth - 1) done.length = 0
      done.push(words)
      undone.length = 0
    },
    undo: (store, run) => step(done, undone, store.undoDepth, run),
    redo: (store, run) => step(undone, done, store.redoDepth, run),
    reset() {
      done.length = 0
      undone.length = 0
    },
  }
}

/** A form's unapplied draft: the variant it shows, and the fields it holds. */
export interface Draft {
  variant: string
  fields: Record<string, unknown>
}

/** A store as the drafts read it: the ids it holds, and a call after each change. */
export interface DraftStore {
  ids(kind: string): readonly string[]
  subscribe(listener: () => void): unknown
}

/** The drafts a form left unapplied, kept by the store they were drafted on. */
export interface DraftKeeper {
  /** Keeps a draft for a record (a null id for a new one), in place of one kept for it before. */
  keep(store: DraftStore, kind: string, id: string | null, draft: Draft): void
  /** The draft kept for a record, which is then no longer kept: the form holds it again. */
  take(store: DraftStore, kind: string, id: string | null): Draft | undefined
  /** The records a draft is kept for, in the order they were first kept. */
  kept(store: DraftStore): { kind: string; id: string | null }[]
}

/**
 * Keeps the drafts a form leaves unapplied, given back when the form shows that record again. Another store never sees
 * them. A draft goes with its record: when a change of the store takes the record away, its draft is dropped, so a record
 * made later with the same id starts from its own fields. `onChange` is told each time the kept drafts change.
 */
export function draftKeeper(onChange: () => void = () => {}): DraftKeeper {
  const stores = new WeakMap<DraftStore, Map<string, { kind: string; id: string | null; draft: Draft }>>()
  const key = (kind: string, id: string | null): string => JSON.stringify([kind, id])
  return {
    keep(store, kind, id, draft) {
      let kept = stores.get(store)
      if (kept === undefined) {
        const mine = new Map<string, { kind: string; id: string | null; draft: Draft }>()
        kept = mine
        stores.set(store, mine)
        store.subscribe(() => {
          const before = mine.size
          for (const [k, d] of mine) if (d.id !== null && !store.ids(d.kind).includes(d.id)) mine.delete(k)
          if (mine.size !== before) onChange()
        })
      }
      kept.set(key(kind, id), { kind, id, draft })
      onChange()
    },
    take(store, kind, id) {
      const kept = stores.get(store)
      const found = kept?.get(key(kind, id))
      if (found !== undefined) {
        kept!.delete(key(kind, id))
        onChange()
      }
      return found?.draft
    },
    kept(store) {
      return [...(stores.get(store)?.values() ?? [])].map(({ kind, id }) => ({ kind, id }))
    },
  }
}
