/**
 * The shapes the verb machinery speaks in. This folder imports nothing from the app and names no
 * kind: an app registers its kinds and verbs into a registry (registry.ts) and runs them through a
 * store (store.ts). Whatever a verb writes is a plain JSON value under an entity (a kind and an id).
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** A JSON Schema object, the subset schema.ts reads. */
export type Schema = { [key: string]: Json }

/** Who makes a call: one of the names the registry was given (see createRegistry). */
export type Actor = string

/** The components of one entity, by component name. Frozen once stored. */
export type Components = { readonly [component: string]: Json }

/** A reference from one entity to another: the value of a declared relation component. */
export interface Ref {
  kind: string
  id: string
}

/** One thing a check found: the entity and field it concerns, when it has them. */
export interface Issue {
  message: string
  kind?: string
  id?: string
  field?: string
}

/**
 * One change to the store. An absent `before` means the entity, component or field was not there;
 * an absent `after` means it is not there now. `null` is a value like any other.
 *   add     a whole entity: `after` holds its components.
 *   remove  a whole entity: `before` holds its components.
 *   set     one component, or one field of an object component when `field` is named.
 */
export interface ChangeRecord {
  /**
   * The record's number in the step it belongs to. The records of one batch, one undo and one redo are numbered once
   * each. The event of a gesture's move holds two runs (see ChangeEvent): a record that takes back the move before
   * repeats the number of the record it takes back, so a listener keys by position in the event and reads this number
   * as the record's place in its step.
   */
  readonly seq: number
  readonly batch: number
  readonly verb: string
  readonly op: 'add' | 'set' | 'remove'
  readonly kind: string
  readonly id: string
  readonly component?: string
  readonly field?: string
  readonly before?: Json
  readonly after?: Json
  /**
   * On a remove: the place the entity held among the ids of its kind, so the add that undoes the remove (which
   * carries the same position) puts it back there and `entity.list` reads in the order it had.
   */
  readonly position?: number
  /** The verb that wrote it, or `system:<name>` for a system that reacted inside the same batch. */
  readonly cause: string
}

/** The read side of the store: what a verb's validation sees, and what a reader of the store sees. */
export interface Reader {
  has(kind: string, id: string): boolean
  get(kind: string, id: string): Components | undefined
  /** The ids of a kind, in the order they were added. */
  ids(kind: string): string[]
  /**
   * What points at this entity through a relation the registry declares. Each result is one place that holds the
   * reference: the entity, the component the relation starts in, and `at`, the concrete pointer to the place with list
   * positions in place of stars (`/Pack/2/box`), so a refusal can name where.
   */
  refs(kind: string, id: string): Array<Ref & { component: string; at: string }>
}

/** What a verb's apply writes through. Every write yields its change record; none can be wrong about `before`. */
export interface Draft extends Reader {
  add(kind: string, id: string, components: Components): void
  remove(kind: string, id: string): void
  /** Replaces one component; `undefined` removes it. */
  set(kind: string, id: string, component: string, value: Json | undefined): void
  /** Replaces one field of an object component; `undefined` removes the field. */
  setField(kind: string, id: string, component: string, field: string, value: Json | undefined): void
  /** Replaces the counters ids are minted from, as a verb that opens another state must; any other verb that calls it throws. */
  useCounters(next: { readonly [kind: string]: number }): void
  /**
   * Every record written to the draft so far in the batch: the verbs' and those of the systems that ran before. The `records`
   * a system is handed are the verbs' only, so a system that reads the end state of what the batch touched reads them here.
   */
  readonly records: readonly ChangeRecord[]
}

export interface ResolvedCall {
  verb: string
  input: Json
  actor: Actor
}

/** What validation may read of the batch built so far. */
export interface BatchSoFar {
  calls: readonly ResolvedCall[]
  records: readonly ChangeRecord[]
}

export interface ApplyContext {
  /** The id minted for (or offered to) a verb that declares `mints`. */
  id: string | undefined
  actor: Actor
  /**
   * The next id of a kind, for a verb that declares `mints` and makes entities of kinds beyond its target, or more than one
   * of its target's, and for a verb that declares `mintsOther` and so of the kinds it lists. It is past the counter like the
   * target's id, and a verb that declares neither is refused the call.
   */
  mint(kind: string): string
}

export interface Verb<I extends Json = Json> {
  /** `<target>.<action>`. */
  name: string
  target: string
  /** The verb creates an entity of `target`; the layer supplies its id. */
  mints?: boolean
  /**
   * The kinds besides `target` that the verb makes entities of, for a verb that acts on an entity of its target and makes
   * others as part of it. It takes `context.mint` for these kinds and no other, and no id of the target is taken for it, so a
   * call that makes none moves no counter. A verb that creates an entity of its target declares `mints` instead.
   */
  mintsOther?: readonly string[]
  /** A JSON Schema; the schema a caller is given (toCallSchema) is generated from it. A string property marked `x-ref` names a kind. */
  input: Schema
  /** Who may call it, from the actors the registry names; absent means any of them. */
  actors?: readonly Actor[]
  /**
   * The verb replaces everything in the store with another state (see open.ts). It takes a batch to itself, no system
   * reacts to it, its step holds the counters before and after, and listeners are told with the cause 'open'.
   */
  opens?: boolean
  validate?(reader: Reader, input: I, batch: BatchSoFar): Issue[]
  apply(draft: Draft, input: I, context: ApplyContext): void
  /** One card line. */
  describe(input: I): string
}

/** A reaction to records inside the batch that caused them; its writes are tagged `system:<name>`. */
export interface System {
  name: string
  on: { kind?: string; component?: string }
  /**
   * `before` reads the state the batch started from: the committed state, which no write of the batch has reached, whatever
   * the draft holds. It is the same state when the log is replayed: a replay builds its own store, so a system that needs the
   * state before the batch reads it here.
   */
  run(draft: Draft, records: readonly ChangeRecord[], before: Reader): void
}

export interface ReadVerb {
  name: string
  input: Schema
  run(reader: Reader, input: Json, kinds: readonly string[]): Json
}

/**
 * Where an entity holds references, and the kinds they may point at. A key names a component, or a path into one:
 * parts joined by slashes, the first the component, each next either a key of an object or a star, which stands for
 * every item of a list. The key made of `Pack`, a star and `box` reaches the `box` of each item of the list in `Pack`.
 * The value found at the end of the path is a Ref (a kind and an id) or a list of them. A target is a kind, or a list
 * of kinds where the reference may point at either; the Ref names the kind it points at, and one that names a kind
 * the list does not hold is not read as a reference to it.
 */
export type Relations = { readonly [path: string]: string | readonly string[] }

export interface KindSpec {
  /** The text a minted id of this kind starts with. */
  prefix: string
  /** Kinds of one group share one id space. */
  group?: string
  /** Where the entity holds references to other entities. */
  relations?: Relations
}

export interface Call {
  verb: string
  input: Json
  /** A name a later call of the same batch writes as `{handle: name}` where its input schema marks a reference (an `x-ref`); anywhere else such an object is data. */
  as?: string
  basis?: Json
}

export interface Refusal {
  reason:
    | 'locked'
    | 'gesture'
    | 'unknown_verb'
    | 'actor'
    | 'handle'
    | 'input'
    | 'validation'
    | 'apply'
    | 'nothing_to_undo'
    | 'nothing_to_redo'
    | 'diverged'
    | 'base_changed'
    | 'replay'
  /** The call that refused, when one did. */
  at?: number
  issues: Issue[]
  /** For base_changed: what was written since the proposal was made, and which of it the proposal also touches. */
  changed?: Array<{ kind: string; id: string; component?: string }>
  overlapping?: Array<{ kind: string; id: string; component?: string }>
}

export interface ChangeEvent {
  batch: number
  /** `cancel`: the moves of a gesture were taken back, by its cancel or by the abandon of the store. */
  cause: 'verb' | 'undo' | 'redo' | 'open' | 'cancel'
  actor: Actor
  /**
   * What took the readers from the state before to the state after. For a move of a gesture these are the records
   * that take back the move before, then the move's own; see ChangeRecord.seq for their numbers.
   */
  records: readonly ChangeRecord[]
}

export interface LogEntry {
  seq: number
  batch: number
  /** A verb name, or `undo` or `redo`. */
  verb: string
  /** Handles already resolved and every minted id already present. */
  input: Json
  actor: Actor
  basis?: Json
}

export type Outcome =
  | { ok: true; changed: boolean; batch?: number; records: readonly ChangeRecord[]; ids: { [handle: string]: string }; trimmed: number }
  | { ok: false; refusal: Refusal }

export interface ProposalItem {
  verb: string
  input: Json
  as?: string
  basis?: Json
}

/** A pending batch, with the content hash of the store it was made against. */
export interface Proposal {
  items: ProposalItem[]
  baseHash: string
  /** A digest of the counters ids are minted from, which the hash does not read: the ids a card showed are the ones the batch mints only while the counters are as they were. */
  baseCounters: string
  /** The store's change counter when it was made; what was written since is named when the hash differs. */
  baseSeq: number
}

/** A proposal, or the refusal to make one: while a gesture is open a proposal would be based on a state that is still moving. */
export type ProposeOutcome = { ok: true; proposal: Proposal } | { ok: false; refusal: Refusal }

export type Preview =
  | { ok: true; lines: string[]; records: readonly ChangeRecord[]; ids: { [handle: string]: string } }
  | { ok: false; refusal: Refusal }

export interface Snapshot {
  entities: { [kind: string]: { [id: string]: Json } }
  counters: { [kind: string]: number }
  /**
   * The ids of a kind in the order the store holds them, for a kind whose entities an object cannot list in that order:
   * an object lists the keys that read as a list position (a whole number up to 2^32 - 2) ahead of the others, in number
   * order. A kind whose keys already come in the store's order is not listed, and a kind not listed is read in its keys' order.
   * The content hash reads no order, so replay does not verify it: a log that reaches the same entities in another order replays without a refusal.
   */
  order?: { [kind: string]: string[] }
}

/**
 * What a project stores: the base, the base's hash, the log since the base, the hash the log must reach, a digest of the counters
 * the log must reach, and the undo limit the log was written under. Both hashes read the entities only, so replay does not verify
 * the order of the ids (see Snapshot); the counters digest is what tells a replay that would issue other ids from the live store.
 */
export interface Saved {
  base: Snapshot
  baseHash: string
  log: LogEntry[]
  hash: string
  counters: string
  limit: number
}
