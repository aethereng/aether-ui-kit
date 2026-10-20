/* The proposal ledger: what an Accept does with the model shown, the shelf of models an Accept
 * replaced, and Load again. Framework-free: the app owns the models, the proposals' contents and
 * the load itself. The ledger decides what happens, holds the shelf and records each decision.
 *
 * Nothing is discarded. A superseded or discarded proposal can still be accepted, and a model an
 * Accept replaced stays on the shelf until the person loads it again or the conversation ends. */

export type ProposalStatus = 'pending' | 'accepted' | 'discarded' | 'superseded' | 'refused'

/** A model as the app holds it. The key changes whenever a different model is shown, and the
 *  content is what an Accept compares. */
export interface Shown {
  key: string
  json: unknown
  label: string
}

/** A proposal as the ledger reads and records it. The app's record may hold more. */
export interface LedgerProposal<Opened> {
  id: string
  status: ProposalStatus
  decidedBy: 'person' | null
  decidedAt: string | null
  /** The model shown when the proposal was made, as content. An Accept compares the model shown with it. */
  base: unknown
  /** What an Accept loads; null when the loader refused the proposal. */
  opened: Opened | null
}

/** A model an Accept replaced, held so that it can be loaded again with its edits. */
export interface Shelved {
  id: string
  label: string
  json: unknown
  /** Loads the model back. */
  restore: () => void
  /** The proposal, or the shelved model, whose loading replaced it. */
  replacedBy: string
  at: string
}

/** What the app supplies: the model shown, how a shown model is named, and the loads. */
export interface LedgerHost<Opened> {
  /** The model shown now, or null when none is. */
  shown(): Shown | null
  /** The model shown, named in the words of the Accept question. */
  describeChange(shown: Shown): string
  /** The model shown, as the shelf keeps it, with the means to restore it; null when none is shown. */
  keep(): { label: string; json: unknown; restore: () => void } | null
  /** Loads an opened proposal as the model shown. */
  load(opened: Opened): void
  decided(id: string, status: ProposalStatus): void
  shelved(entry: Shelved): void
}

/** What an Accept did: loaded the proposal (`done`), or held it for the person's answer to the
 *  question `ask` names, because the model shown is not the one the proposal was made against. */
export interface AcceptOutcome {
  done: boolean
  ask: { replaces: string; key: string } | null
}

/** Whether two values hold the same content. Object keys are compared as a set, so their order does
 *  not matter; arrays compare by position. Values are JSON-like. */
export function sameContent(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  const keys = Object.keys(ra)
  if (keys.length !== Object.keys(rb).length) return false
  return keys.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && sameContent(ra[k], rb[k]))
}

export class Ledger<Opened> {
  readonly shelf: Shelved[] = []
  private readonly host: LedgerHost<Opened>
  private readonly now: () => string

  constructor(host: LedgerHost<Opened>, now: () => string = () => new Date().toISOString()) {
    this.host = host
    this.now = now
  }

  /** The person accepted a proposal, pending or earlier. Where the model shown is not the one the
   *  proposal was made against, nothing is loaded until the person answers the question, and
   *  `confirmed` is that answer. The comparison is by content, before anything is loaded. */
  accept(p: LedgerProposal<Opened>, confirmed = false): AcceptOutcome {
    if (!p.opened) return { done: false, ask: null }
    const shown = this.host.shown()
    if (!confirmed && shown && !sameContent(shown.json, p.base)) return { done: false, ask: { replaces: this.host.describeChange(shown), key: shown.key } }
    this.keepReplaced(p.id)
    this.host.load(p.opened)
    p.status = 'accepted'
    p.decidedBy = 'person'
    p.decidedAt = this.now()
    this.host.decided(p.id, 'accepted')
    return { done: true, ask: null }
  }

  /** The person discarded a pending proposal: nothing changes, and it stays in the session. */
  discard(p: LedgerProposal<Opened>): boolean {
    if (p.status !== 'pending' || !p.opened) return false
    p.status = 'discarded'
    p.decidedBy = 'person'
    p.decidedAt = this.now()
    this.host.decided(p.id, 'discarded')
    return true
  }

  /** Load again a model an Accept replaced. The model shown then goes on the shelf in its turn. */
  loadAgain(id: string): boolean {
    const entry = this.shelf.find((s) => s.id === id)
    if (!entry) return false
    this.keepReplaced(entry.label)
    entry.restore()
    return true
  }

  /** Put the model shown on the shelf before something replaces it, named by what replaces it.
   *  Nothing is added where the shelf already holds a model with the same content. */
  keepReplaced(by: string): void {
    const kept = this.host.keep()
    if (!kept || this.shelf.some((s) => sameContent(s.json, kept.json))) return
    const entry: Shelved = { id: `k${this.shelf.length + 1}`, label: kept.label, json: kept.json, restore: kept.restore, replacedBy: by, at: this.now() }
    this.shelf.push(entry)
    this.host.shelved(entry)
  }
}
