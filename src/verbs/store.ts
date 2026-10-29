import type {
  Actor, BatchSoFar, Call, ChangeEvent, ChangeRecord, Components, Draft, Issue, Json, LogEntry, Outcome, Preview,
  Proposal, ProposalItem, ProposeOutcome, Reader, Ref, Refusal, ResolvedCall, Saved, Snapshot,
} from './contracts'
import { PROTO_KEY, canonical, equal, frozenCopy, nonFinite, orderProblem, own, plainCopy, protoKey, sha256 } from './json'
import { isValidId, notAnId } from './path'
import type { Registry } from './registry'
import { relationTargets, targetKinds } from './relations'
import { checkShape, resolveRefs } from './schema'
import { StoreRefusal } from './update'

const isObject = (v: Json | undefined): v is { [k: string]: Json } => v !== null && typeof v === 'object' && !Array.isArray(v)
const isRef = (v: Json | undefined): v is { kind: string; id: string } => isObject(v) && typeof v.kind === 'string' && typeof v.id === 'string'
const isDigits = (s: string): boolean => s.length > 0 && [...s].every((c) => c >= '0' && c <= '9')

/**
 * What a write refuses with: the batch it belongs to changes nothing. A system may throw it to refuse a batch whose end state
 * it checks: the refusal is 'apply', it names the call that wrote the first record the system reacted to, and carries the issues.
 */
export class Refuse extends Error {
  readonly issues: Issue[]
  constructor(issues: Issue[]) {
    super(issues.map((i) => i.message).join('; '))
    this.issues = issues
  }
}

type Key = string
const keyOf = (kind: string, id: string): Key => `${kind}${String.fromCharCode(0)}${id}`

/** A view of a list that only grows: a frozen copy, made again only when the list has grown since the last read. */
function growing<T>(list: readonly T[]): () => readonly T[] {
  let seen: readonly T[] = Object.freeze([])
  return () => (seen.length === list.length ? seen : (seen = Object.freeze(list.slice())))
}

/** The undo limit is a whole number of at least 1: a smaller one would trim a step the moment it is pushed, a fraction or a negative never settles. */
const isLimit = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1

abstract class View implements Reader {
  protected readonly registry: Registry
  constructor(registry: Registry) {
    this.registry = registry
  }
  abstract get(kind: string, id: string): Components | undefined
  abstract ids(kind: string): string[]
  has(kind: string, id: string): boolean {
    return this.get(kind, id) !== undefined
  }
  refs(kind: string, id: string): Array<Ref & { component: string; at: string }> {
    const out: Array<Ref & { component: string; at: string }> = []
    for (const [fromKind, spec] of this.registry.kinds) {
      for (const [relation, declared] of Object.entries(spec.relations ?? {})) {
        if (!targetKinds(declared).includes(kind)) continue
        const only = { [relation]: declared }
        for (const fromId of this.ids(fromKind)) {
          const components = this.get(fromKind, fromId)
          if (components === undefined) continue
          // the reference names the kind it points at, and the relation must list that kind
          for (const place of relationTargets(components, only)) {
            if (isRef(place.value) && place.value.kind === kind && place.value.id === id) out.push({ kind: fromKind, id: fromId, component: place.component, at: place.at })
          }
        }
      }
    }
    return out
  }
}

/** The committed content: entities by kind, and the counters ids are minted from. */
class State extends View {
  readonly entities = new Map<string, Map<string, Components>>()
  readonly counters = new Map<string, number>()
  get(kind: string, id: string): Components | undefined {
    return this.entities.get(kind)?.get(id)
  }
  ids(kind: string): string[] {
    return [...(this.entities.get(kind)?.keys() ?? [])]
  }
  entitiesJson(): { [kind: string]: { [id: string]: Json } } {
    const out: { [kind: string]: { [id: string]: Json } } = {}
    for (const [kind, map] of this.entities) {
      if (map.size === 0) continue
      out[kind] = Object.fromEntries([...map].map(([id, c]) => [id, c as Json]))
    }
    return out
  }
  /** The kinds whose ids an object lists in another order than the store holds them (any id that reads as a list position), each with its ids in the store's order. */
  orderJson(): { [kind: string]: string[] } {
    const out: { [kind: string]: string[] } = {}
    for (const [kind, map] of this.entities) {
      const ids = [...map.keys()]
      const listed = Object.keys(Object.fromEntries(ids.map((id) => [id, null])))
      if (listed.some((id, i) => id !== ids[i])) out[kind] = ids
    }
    return out
  }
}

/** A digest of the counters ids are minted from, a kind with no counter counting as 0: what the content hash does not read. */
function digestOfCounters(counters: Iterable<readonly [string, number]>): string {
  return sha256(canonical(Object.fromEntries([...counters].filter(([, n]) => n !== 0))))
}

/** Whether two sets of counters mint the same ids: a kind a set does not list counts as 0, as mint reads it. */
function sameCounters(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  for (const kind of new Set([...a.keys(), ...b.keys()])) if ((a.get(kind) ?? 0) !== (b.get(kind) ?? 0)) return false
  return true
}

/**
 * What the store lets a draft do, held where a cast of the draft cannot reach it: a verb is handed the draft itself and
 * can write any field of its class, so a permission kept in a field would be the verb's to give itself. These are this
 * module's alone, and the store sets them around the calls they cover.
 *
 * The limit: a cast of the draft still reaches its private fields, among them the committed state (`base`) and the flag
 * that opens writes (`writable`), so a verb that casts can write the committed counters or entities where no commit
 * gate sees it. What is refused is a write through the draft's interface and the permission and counter fields around it.
 * Casts of the draft occur in tests.
 *
 * A counter goes down only by a grant or by `putCounters`. A grant is a permission set here: the replacement of an open, an
 * undo and a redo each lower one by it. `putCounters` puts back the counters a gesture found, before each move of the
 * gesture, at the end of a gesture that left no change and at the cancel of any gesture: the ids it minted were taken back
 * and no commit holds them, which is the case of an undo.
 *
 * An undo gives back the counters its step moved: a step records the counters before and after it, and the undo puts the
 * first back and the redo the second, so the ids an undone batch took are issued again by the next batch. A delete moves
 * no counter, so the id of a deleted entity is not issued again.
 *
 * The grants are set and cleared without try/finally. That is safe because `build` makes a new overlay for each batch and
 * drops it when anything throws, so a grant never outlives the draft it was set on.
 *
 * The rule that an id is not issued twice covers the ids the store mints. `add` takes the id a caller names, which is how
 * an id derived from another entity's is added, and that is not checked against the counters.
 */
const mayMint = new WeakSet<object>()
const mayOpen = new WeakSet<object>()
const mayRestore = new WeakSet<object>()
/** The counters a batch puts in place of the store's, when it replaces them. */
const replacement = new WeakMap<object, ReadonlyMap<string, number>>()
const allow = (grants: WeakSet<object>, draft: object, on: boolean): void => void (on ? grants.add(draft) : grants.delete(draft))

/** A copy-on-write overlay over the committed state: what a verb validates and applies against. */
class Overlay extends View implements Draft {
  readonly records: ChangeRecord[] = []
  /** The records written so far as a frozen list, the same list until another is written: what a caller outside the overlay is handed. */
  readonly frozenRecords = growing(this.records)
  verb = ''
  cause = ''
  private readonly base: State
  private readonly layer = new Map<string, Map<string, Components | null>>()
  private readonly pending = new Map<string, number>()
  /** A kind's ids in order, kept from the first remove, or the first time an id is put at a position, so the kind is rewritten in that order on commit. */
  private readonly order = new Map<string, string[]>()
  private readonly batch: number
  private readonly seqStart: number
  private writable = false
  /** The layer as it stood when a gesture's move had undone the move before it: what the move is measured against. */
  private baseline: Map<string, Map<string, Components | null>> | null = null

  constructor(registry: Registry, base: State, batch: number, seqStart: number) {
    super(registry)
    this.base = base
    this.batch = batch
    this.seqStart = seqStart
  }

  get(kind: string, id: string): Components | undefined {
    const layered = this.layer.get(kind)?.get(id)
    if (layered === null) return undefined
    return layered ?? this.base.get(kind, id)
  }
  ids(kind: string): string[] {
    const kept = this.order.get(kind)
    if (kept !== undefined) return kept.slice()
    const layer = this.layer.get(kind)
    const out = this.base.ids(kind).filter((id) => layer?.get(id) !== null)
    if (layer !== undefined) {
      const seen = new Set(out)
      for (const [id, c] of layer) if (c !== null && !seen.has(id)) out.push(id)
    }
    return out
  }

  put(kind: string, id: string, entity: Components | null): void {
    let layer = this.layer.get(kind)
    if (layer === undefined) this.layer.set(kind, (layer = new Map()))
    layer.set(id, entity)
  }

  /**
   * Whether the overlay leaves the state different from the state under it, decided entity by entity, and by the
   * counters and the order of the ids that a verb which opens another state puts in place of the store's. The content
   * hash reads the entities and nothing else, so the entities' part of this is the hash's own answer without hashing
   * the whole store; counters are content here all the same, because they decide which id the next entity takes, and
   * an open's order is content because `ids` and `entity.list` give it. A batch that is no open and removes an entity
   * and adds it back unchanged leaves no change, though the entity would stand last in its kind.
   */
  changesState(state: State): boolean {
    const replaced = replacement.get(this)
    if (replaced !== undefined) {
      if (!sameCounters(replaced, state.counters)) return true
      for (const [kind, kept] of this.order) {
        const was = state.ids(kind)
        if (kept.length !== was.length || kept.some((id, i) => id !== was[i])) return true
      }
    }
    for (const [kind, layer] of this.layer) {
      for (const [id, entity] of layer) {
        const was = this.was(state, kind, id)
        if (entity === null ? was !== undefined : was === undefined || !equal(entity as Json, was as Json)) return true
      }
    }
    return false
  }

  /** From here on the batch is measured against the layer as it stands, over the state under it. */
  markBaseline(): void {
    this.baseline = new Map([...this.layer].map(([kind, layer]) => [kind, new Map(layer)]))
  }
  /** An entity as the batch is measured against: the baseline's if the baseline holds it, else the state's. */
  private was(state: State, kind: string, id: string): Components | undefined {
    const held = this.baseline?.get(kind)?.get(id)
    if (held === null) return undefined
    return held ?? state.get(kind, id)
  }

  /**
   * Whether the batch so far leaves what this record wrote different from the state under it, at the record's own
   * address (the entity, the component, or the field). A write that a later write of the batch undid changed nothing.
   */
  leavesChange(state: State, r: ChangeRecord): boolean {
    const was = this.was(state, r.kind, r.id)
    const now = this.get(r.kind, r.id)
    if (r.component === undefined) return !equal(was as Json | undefined, now as Json | undefined)
    const before = was === undefined ? undefined : own(was, r.component)
    const after = now === undefined ? undefined : own(now, r.component)
    if (r.field === undefined) return !equal(before, after)
    return !equal(isObject(before) ? own(before, r.field) : undefined, isObject(after) ? own(after, r.field) : undefined)
  }

  /** Runs a verb's apply or a system with writes allowed; at every other time the draft refuses them. */
  writing(run: () => void): void {
    this.writable = true
    try {
      run()
    } finally {
      this.writable = false
    }
  }
  private mayWrite(what: string, kind: string, id: string): void {
    if (!this.writable) throw new Error(`the draft is frozen outside apply: ${what} ${kind} '${id}' was attempted while validating or after the batch ended`)
  }
  /** Refuses a value the store cannot hold as content: a number that is not finite, or a key named __proto__ (the copy and the hash could not agree on it). */
  private sound(kind: string, id: string, where: string, value: Json | undefined): void {
    if (value === undefined) return
    const key = protoKey(value)
    if (key !== null) throw new Refuse([{ kind, id, field: where, message: `${kind} '${id}' ${where}${key} is a key named ${PROTO_KEY}, which stored content cannot hold` }])
    const at = nonFinite(value)
    if (at !== null) throw new Refuse([{ kind, id, field: where, message: `${kind} '${id}' ${where}${at} holds a number that is not finite` }])
  }
  /** Refuses a component or field named __proto__: assigned by key to an object, that name sets the object's prototype and stores no key. */
  private named(kind: string, id: string, ...names: string[]): void {
    if (names.includes(PROTO_KEY)) throw new Refuse([{ kind, id, message: `${kind} '${id}': ${PROTO_KEY} cannot be the name of a component or a field` }])
  }

  commitTo(state: State): void {
    for (const [kind, layer] of this.layer) {
      let map = state.entities.get(kind)
      if (map === undefined) state.entities.set(kind, (map = new Map()))
      for (const [id, entity] of layer) {
        if (entity === null) map.delete(id)
        else map.set(id, entity)
      }
    }
    for (const [kind, ids] of this.order) {
      const map = state.entities.get(kind)!
      state.entities.set(kind, new Map(ids.map((id) => [id, map.get(id)!])))
    }
    const replaced = replacement.get(this)
    if (replaced !== undefined) {
      state.counters.clear()
      for (const [kind, n] of replaced) state.counters.set(kind, n)
    }
    for (const [kind, n] of this.pending) state.counters.set(kind, n)
  }

  /**
   * Throws when the counts this batch minted put a counter below where the state under it holds it. A counter that a run
   * does not lower is what keeps the id of a deleted entity from being issued again; the replacement of an open, an undo and
   * a redo move one down, each by a permission the store grants, and none of them goes through these counts. Nor does the
   * end of a gesture that left no change, or the cancel of any gesture, which puts back the counters of ids no commit holds.
   */
  holdCounters(state: State): void {
    for (const [kind, n] of this.pending) {
      const was = state.counters.get(kind) ?? 0
      if (n < was) throw new Error(`the counter of '${kind}' would go down from ${was} to ${n}: only an open, an undo, a redo, or a gesture that ends with no change or is cancelled, may lower a counter, and ids already passed would be issued again`)
    }
  }

  /** The counters the state holds once this batch is committed to it: those of the open the batch replaces them with, then the counts the batch minted. */
  countersAfter(state: State): Map<string, number> {
    const out = new Map(replacement.get(this) ?? state.counters)
    for (const [kind, n] of this.pending) out.set(kind, n)
    return out
  }
  useCounters(next: { readonly [kind: string]: number }): void {
    if (!this.writable || !mayOpen.has(this)) throw new Error('only a verb that opens another state may replace the counters')
    for (const [kind, n] of Object.entries(next)) {
      this.known(kind)
      if (!Number.isInteger(n) || n < 0) throw new Refuse([{ kind, message: `the counter of '${kind}' must be a whole number of 0 or more, found ${String(n)}` }])
    }
    replacement.set(this, new Map(Object.entries(next)))
  }
  /** Puts counters back as a step held them: what undoing or redoing an open does, and only that. */
  restoreCounters(counters: ReadonlyMap<string, number>): void {
    if (!mayRestore.has(this)) throw new Error('only an undo or a redo may put counters back')
    replacement.set(this, counters)
  }

  /** Puts an id in its kind's order: at the end, or at the position a remove record carried. Called before the entity is put. */
  private place(kind: string, id: string, position: number | undefined): void {
    const kept = this.order.get(kind)
    if (position === undefined) {
      if (kept === undefined && this.base.get(kind, id) !== undefined) {
        // an id the state held, removed and added again in this batch, goes to the end of its kind like any new one
        const list = this.ids(kind)
        list.push(id)
        this.order.set(kind, list)
        return
      }
      kept?.push(id)
      return
    }
    const list = kept ?? this.ids(kind)
    list.splice(Math.min(position, list.length), 0, id)
    this.order.set(kind, list)
  }
  /** Starts keeping a kind's ids in order, from the order they have now. */
  private keep(kind: string): string[] {
    const list = this.ids(kind)
    this.order.set(kind, list)
    return list
  }
  private unplace(kind: string, id: string): void {
    const kept = this.order.get(kind)
    const at = kept?.indexOf(id) ?? -1
    if (at >= 0) kept!.splice(at, 1)
  }

  private mayTakeIds(): void {
    if (!mayMint.has(this)) throw new Error(`${this.cause} declares no mints, so it may not mint or offer an id`)
  }
  private known(kind: string): void {
    if (!this.registry.kinds.has(kind)) throw new Refuse([{ kind, message: `'${kind}' is not a kind of this vocabulary` }])
  }
  private entity(kind: string, id: string): Components {
    this.known(kind)
    const e = this.get(kind, id)
    if (e === undefined) throw new Refuse([{ kind, id, message: `there is no ${kind} '${id}'` }])
    return e
  }
  private push(r: Omit<ChangeRecord, 'seq' | 'batch' | 'verb' | 'cause'>): void {
    this.records.push(Object.freeze({ seq: this.seqStart + this.records.length, batch: this.batch, verb: this.verb, cause: this.cause, ...r }))
  }

  /** Every kind that shares this kind's id space, this one included. */
  private space(kind: string): string[] {
    const s = this.registry.space(kind)
    return [...this.registry.kinds.keys()].filter((k) => this.registry.space(k) === s)
  }

  /** The id the next entity of this kind takes: past the counter, which a run does not lower, and past every id of the same shape present. */
  mint(kind: string): string {
    this.mayTakeIds()
    this.known(kind)
    const prefix = this.registry.kinds.get(kind)!.prefix
    let n = Math.max(this.pending.get(kind) ?? this.base.counters.get(kind) ?? 0, this.highest(kind))
    while (this.space(kind).some((k) => this.has(k, `${prefix}${n + 1}`))) n++
    this.pending.set(kind, n + 1)
    return `${prefix}${n + 1}`
  }
  /** An id a caller offered: refused when it is malformed or taken; the counter moves past it. */
  offer(kind: string, id: string): void {
    this.mayTakeIds()
    this.known(kind)
    if (!isValidId(id)) throw new Refuse([{ kind, id, message: notAnId(id) }])
    const taken = this.space(kind).find((k) => this.has(k, id))
    if (taken !== undefined) throw new Refuse([{ kind: taken, id, message: `${taken} '${id}' exists already` }])
    this.pending.set(kind, Math.max(this.pending.get(kind) ?? this.base.counters.get(kind) ?? 0, this.suffix(kind, id) ?? 0))
  }
  private suffix(kind: string, id: string): number | null {
    const prefix = this.registry.kinds.get(kind)!.prefix
    return id.startsWith(prefix) && isDigits(id.slice(prefix.length)) ? Number(id.slice(prefix.length)) : null
  }
  private highest(kind: string): number {
    let n = 0
    for (const k of this.space(kind)) for (const id of this.ids(k)) n = Math.max(n, this.suffix(kind, id) ?? 0)
    return n
  }

  add(kind: string, id: string, components: Components): void {
    this.mayWrite('adding', kind, id)
    this.known(kind)
    const taken = this.space(kind).find((k) => this.has(k, id))
    if (taken !== undefined) throw new Refuse([{ kind: taken, id, message: `${taken} '${id}' exists already` }])
    if (!isValidId(id)) throw new Refuse([{ kind, id, message: notAnId(id) }])
    this.sound(kind, id, 'components', components as Json)
    const after = frozenCopy(components as Json) as Components
    this.place(kind, id, undefined)
    this.put(kind, id, after)
    this.push({ op: 'add', kind, id, after: after as Json })
  }
  remove(kind: string, id: string): void {
    this.mayWrite('removing', kind, id)
    const before = this.entity(kind, id)
    // the kind's ids are kept in order from the first remove, so the place the entity held is read from that list
    const kept = this.order.get(kind) ?? this.keep(kind)
    const position = kept.lastIndexOf(id)
    kept.splice(position, 1)
    this.put(kind, id, null)
    this.push({ op: 'remove', kind, id, before: before as Json, position })
  }
  set(kind: string, id: string, component: string, value: Json | undefined): void {
    this.mayWrite('setting', kind, id)
    const e = this.entity(kind, id)
    this.named(kind, id, component)
    this.sound(kind, id, component, value)
    const before = own(e, component)
    const after = value === undefined ? undefined : frozenCopy(value)
    if (equal(before, after)) return
    const next: { [c: string]: Json } = { ...e }
    if (after === undefined) delete next[component]
    else next[component] = after
    this.put(kind, id, Object.freeze(next))
    this.push({ op: 'set', kind, id, component, ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) })
  }
  setField(kind: string, id: string, component: string, field: string, value: Json | undefined): void {
    this.mayWrite('setting', kind, id)
    const e = this.entity(kind, id)
    this.named(kind, id, component, field)
    this.sound(kind, id, `${component}.${field}`, value)
    const holder = own(e, component)
    if (!isObject(holder)) throw new Refuse([{ kind, id, field: component, message: `${kind} '${id}' holds no object under '${component}'; set the component first` }])
    const before = own(holder, field)
    const after = value === undefined ? undefined : frozenCopy(value)
    if (equal(before, after)) return
    const nextHolder: { [f: string]: Json } = { ...holder }
    if (after === undefined) delete nextHolder[field]
    else nextHolder[field] = after
    this.put(kind, id, Object.freeze({ ...e, [component]: Object.freeze(nextHolder) }))
    this.push({ op: 'set', kind, id, component, field, ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) })
  }

  /**
   * Applies a record whose `before` must be what is there now (undo applies inverses, redo the originals).
   * Returns what disagrees when the state is not the one the record was written against; nothing is written then.
   */
  reapply(r: ChangeRecord): Issue | null {
    const where = `${r.kind} '${r.id}'${r.component === undefined ? '' : ` ${r.component}${r.field === undefined ? '' : `.${r.field}`}`}`
    const e = this.get(r.kind, r.id)
    if (r.op === 'add') {
      if (e !== undefined) return { kind: r.kind, id: r.id, message: `${where} exists, but the change expected it absent` }
      this.place(r.kind, r.id, r.position)
      this.put(r.kind, r.id, r.after as Components)
    } else if (r.op === 'remove') {
      if (e === undefined || !equal(e as Json, r.before)) return { kind: r.kind, id: r.id, message: `${where} is not as it was when the change was made` }
      this.unplace(r.kind, r.id)
      this.put(r.kind, r.id, null)
    } else {
      const c = r.component!
      if (e === undefined) return { kind: r.kind, id: r.id, message: `${where} is gone` }
      if (r.field === undefined) {
        if (!equal(own(e, c), r.before)) return { kind: r.kind, id: r.id, field: c, message: `${where} is not as it was when the change was made` }
        const next: { [k: string]: Json } = { ...e }
        if (r.after === undefined) delete next[c]
        else next[c] = r.after
        this.put(r.kind, r.id, Object.freeze(next))
      } else {
        const holder = own(e, c)
        if (!isObject(holder) || !equal(own(holder, r.field), r.before)) return { kind: r.kind, id: r.id, field: c, message: `${where} is not as it was when the change was made` }
        const nextHolder: { [k: string]: Json } = { ...holder }
        if (r.after === undefined) delete nextHolder[r.field]
        else nextHolder[r.field] = r.after
        this.put(r.kind, r.id, Object.freeze({ ...e, [c]: Object.freeze(nextHolder) }))
      }
    }
    return null
  }
}

/** The change a record undoes: the same address, before and after exchanged. */
function inverse(r: ChangeRecord, seq: number): ChangeRecord {
  const { before, after, op, ...rest } = r
  return Object.freeze({
    ...rest,
    seq,
    op: op === 'add' ? 'remove' : op === 'remove' ? 'add' : 'set',
    ...(after === undefined ? {} : { before: after }),
    ...(before === undefined ? {} : { after: before }),
  })
}

interface Step {
  batch: number
  actor: Actor
  records: readonly ChangeRecord[]
  /** On a step that moved the counters (it minted an id, or opened another state): the counters before and after, which undo and redo put back. */
  counters?: { before: ReadonlyMap<string, number>; after: ReadonlyMap<string, number> }
}

export interface RunOptions {
  actor: Actor
  /** Take ids the calls carry (an importer's, or a log's) instead of refusing them. */
  allowOfferedIds?: boolean
}

export type ReadOutcome = { ok: true; value: Json } | { ok: false; refusal: Refusal }

/**
 * A run of moves that is one edit to the person (a slider drag): each move is shown to readers at once, and the whole
 * becomes one undo step and one log entry when it ends. While one is open the store takes no other edit, undo or redo.
 */
export interface Gesture {
  /**
   * Replaces what the gesture has done so far with these calls, applied to the state the gesture began from: the move
   * before is undone first, so after a move the content is the start plus that move alone. A refused move leaves the
   * state as the move before it left it, and the gesture goes on. A move numbers its ids from the counters the gesture
   * began with, so a created entity keeps its id from move to move and the counters the gesture leaves are those of its
   * last move alone, which is what the log reproduces. What the moves used of the record numbers and of the list of
   * touched addresses goes back to what the start had only when the gesture ends where it began or is cancelled; in
   * between they stay where the last move left them, and a preview made then numbers its records from there.
   */
  move(calls: readonly Call[]): Outcome
  /**
   * Closes the gesture. Its last move becomes one undo step and one batch of log entries; a gesture that ends where it
   * began leaves none. It is allowed while a lock is held, where a move and a cancel are refused: each move changed
   * the state when it ran, so end changes no content. It records the step and the log entries, or, for a gesture that
   * ends where it began, gives back the counters and sequence numbers the moves used.
   */
  end(): Outcome
  /** Puts the state back as it was when the gesture began and leaves nothing in the history. Refused while a lock is held. */
  cancel(): Outcome
  isOpen(): boolean
}

export type GestureOutcome = { ok: true; gesture: Gesture } | { ok: false; refusal: Refusal }

/** What the store keeps of an open gesture. */
interface GestureState {
  actor: Actor
  /** Where the sequence of records stood: the step of a gesture is numbered from here, as if its last move had run alone. */
  seq: number
  /** The content hash the log reaches: what a save made during the gesture holds. */
  hash: string
  counters: ReadonlyMap<string, number>
  touched: number
  last: { records: readonly ChangeRecord[]; calls: Array<{ verb: string; input: Json; basis?: Json }>; ids: { [handle: string]: string }; changed: boolean } | null
}

type Built =
  | { ok: true; draft: Overlay; calls: Array<{ verb: string; input: Json; basis?: Json }>; ids: { [h: string]: string }; lines: string[]; reversal: readonly ChangeRecord[]; opens: boolean }
  | { ok: false; refusal: Refusal }

const refusal = (reason: Refusal['reason'], issues: Issue[], extra: Partial<Refusal> = {}): { ok: false; refusal: Refusal } => ({
  ok: false,
  refusal: { reason, issues, ...extra },
})

/** The refusal of a call by an actor the registry does not hold, or by a caller that names none. */
const unregistered = (actor: Actor | undefined): { ok: false; refusal: Refusal } =>
  refusal('actor', [{ message: typeof actor === 'string' ? `the actor '${actor}' is not registered` : 'no actor is named' }])

export interface Store extends Reader {
  hash(): string
  snapshot(): Snapshot
  save(): Saved
  readonly log: readonly LogEntry[]
  readonly undoDepth: number
  readonly redoDepth: number
  /** Edits are refused with the reason while any lock is held; reads, previews and proposals go on. */
  lock(reason: string): () => void
  run(calls: readonly Call[], options: RunOptions): Outcome
  undo(actor: Actor): Outcome
  redo(actor: Actor): Outcome
  /** Opens a gesture; refused while a lock is held or another gesture is open. */
  gesture(options: { actor: Actor }): GestureOutcome
  /**
   * Abandons the open gesture as its cancel does, for a caller that is going away or has failed mid-drag and no longer
   * holds the handle. Nothing open is no error. While a lock is held it is refused, like a cancel, and remembered: the
   * release of the last lock cancels the gesture, so a caller that has gone never leaves the store busy.
   */
  abandonGesture(): Outcome
  /** Refused with the reason 'gesture' while a gesture is open. */
  propose(items: readonly ProposalItem[]): ProposeOutcome
  /**
   * The card of a proposal: what it would change, computed on an overlay, the store untouched. It runs as the actor given,
   * which the caller names; `allowOfferedIds` is run's.
   */
  preview(proposal: Proposal, options: { actor: Actor; only?: readonly number[]; allowOfferedIds?: boolean }): Preview
  /**
   * Commits a proposal as the actor given, which the caller names. `allowOfferedIds` is run's: a proposal whose creates
   * carry their ids is accepted under them, each checked as offer checks it.
   */
  accept(proposal: Proposal, options: { actor: Actor; only?: readonly number[]; acknowledgeBase?: boolean; allowOfferedIds?: boolean }): Outcome
  read(name: string, input: Json): ReadOutcome
  subscribe(listener: (event: ChangeEvent) => void, filter?: { kind?: string; component?: string }): () => void
}

class VerbStore implements Store {
  private readonly registry: Registry
  private readonly state: State
  private readonly base: Snapshot
  private readonly baseHash: string
  private readonly limit: number
  private undoStack: Step[] = []
  private redoStack: Step[] = []
  private readonly entries: LogEntry[] = []
  /** The log as a frozen list, made once per change of the log and handed to every reader until the next one. */
  private logView: readonly LogEntry[] | undefined
  private readonly touched: Array<{ seq: number; kind: string; id: string; component?: string }> = []
  private readonly listeners = new Set<{ fn: (e: ChangeEvent) => void; filter?: { kind?: string; component?: string } }>()
  private readonly locks: Array<{ reason: string }> = []
  private nextSeq = 0
  private nextBatch = 1
  private cached: string | undefined
  private gesturing: GestureState | null = null
  /** The gesture whose abandon a lock refused: cancelled when the last lock is released. */
  private abandoning: GestureState | null = null

  constructor(registry: Registry, base: Snapshot | undefined, limit: number) {
    this.registry = registry
    this.limit = limit
    for (const [kind, spec] of registry.kinds) {
      for (const [relation, declared] of Object.entries(spec.relations ?? {})) {
        for (const target of targetKinds(declared)) {
          if (!registry.kinds.has(target)) throw new Error(`kind '${kind}' relates '${relation}' to '${target}', which is not a kind of this vocabulary`)
        }
      }
    }
    this.state = new State(registry)
    const keyed = base === undefined ? null : protoKey(base as unknown as Json)
    if (keyed !== null) throw new Error(`the base holds a key named ${PROTO_KEY} at ${keyed}, which stored content cannot hold`)
    if (base?.order !== undefined && !isObject(base.order)) throw new Error('the order of the base must be an object of lists of ids by kind')
    const orders = base?.order ?? {}
    for (const [kind, listed] of Object.entries(orders)) {
      if (!registry.kinds.has(kind)) throw new Error(`the base orders '${kind}', which is not a kind of this vocabulary`)
      const held = own(base?.entities ?? {}, kind)
      const problem = orderProblem(listed, isObject(held) ? Object.keys(held) : [])
      if (problem !== null) throw new Error(`the base's order of ${kind} ${problem}`)
    }
    for (const [kind, entities] of Object.entries(base?.entities ?? {})) {
      if (!registry.kinds.has(kind)) throw new Error(`the base holds '${kind}', which is not a kind of this vocabulary`)
      const map = new Map<string, Components>()
      // a kind the base lists an order for is held in that order: an object lists a key that reads as a list position first
      for (const id of Object.prototype.hasOwnProperty.call(orders, kind) ? orders[kind]! : Object.keys(entities)) {
        const c = entities[id]
        if (!isObject(c)) throw new Error(`the base holds ${kind} '${id}' with no components`)
        const clash = [...registry.kinds.keys()].find((k) => {
          if (k === kind || registry.space(k) !== registry.space(kind)) return false
          const others = base === undefined ? undefined : own(base.entities, k)
          return isObject(others) && own(others, id) !== undefined
        })
        if (clash !== undefined) throw new Error(`the base holds the id '${id}' as a ${kind} and as a ${clash}`)
        map.set(id, frozenCopy(c) as Components)
      }
      this.state.entities.set(kind, map)
    }
    for (const [kind, n] of Object.entries(base?.counters ?? {})) this.state.counters.set(kind, n)
    this.base = this.snapshot()
    this.baseHash = this.hash()
  }

  get(kind: string, id: string): Components | undefined { return this.state.get(kind, id) }
  has(kind: string, id: string): boolean { return this.state.has(kind, id) }
  ids(kind: string): string[] { return this.state.ids(kind) }
  refs(kind: string, id: string): Array<Ref & { component: string; at: string }> { return this.state.refs(kind, id) }

  get log(): readonly LogEntry[] { return (this.logView ??= Object.freeze(this.entries.slice())) }
  get undoDepth(): number { return this.undoStack.length }
  get redoDepth(): number { return this.redoStack.length }

  hash(): string {
    this.cached ??= sha256(canonical(this.state.entitiesJson()))
    return this.cached
  }
  private countersDigest(): string {
    return digestOfCounters(this.state.counters)
  }
  snapshot(): Snapshot {
    const order = this.state.orderJson()
    return { entities: plainCopy(this.state.entitiesJson()), counters: Object.fromEntries(this.state.counters), ...(Object.keys(order).length === 0 ? {} : { order }) }
  }
  save(): Saved {
    return { base: plainCopy(this.base as unknown as Json) as unknown as Snapshot, baseHash: this.baseHash, log: plainCopy(this.entries as unknown as Json) as unknown as LogEntry[], hash: this.gesturing?.hash ?? this.hash(), counters: digestOfCounters(this.gesturing?.counters ?? this.state.counters), limit: this.limit }
  }

  lock(reason: string): () => void {
    const held = { reason }
    this.locks.push(held)
    return () => {
      const i = this.locks.indexOf(held)
      if (i >= 0) this.locks.splice(i, 1)
      if (this.locks.length === 0) this.finishAbandon()
    }
  }
  private locked(): Refusal | null {
    const first = this.locks[0]
    return first === undefined ? null : { reason: 'locked', issues: [{ message: first.reason }] }
  }
  /** What refuses an edit, an undo or a redo: a lock, or a gesture that has not ended. */
  private busy(): Refusal | null {
    return this.locked() ?? (this.gesturing === null ? null : { reason: 'gesture', issues: [{ message: 'a gesture is open: end it or cancel it first' }] })
  }

  subscribe(fn: (e: ChangeEvent) => void, filter?: { kind?: string; component?: string }): () => void {
    const entry = { fn, ...(filter === undefined ? {} : { filter }) }
    this.listeners.add(entry)
    return () => void this.listeners.delete(entry)
  }
  private emit(event: ChangeEvent): void {
    for (const { fn, filter } of this.listeners) {
      const records = filter === undefined
        ? event.records
        : Object.freeze(event.records.filter((r) => (filter.kind === undefined || r.kind === filter.kind) && (filter.component === undefined || r.component === filter.component)))
      if (records.length === 0) continue
      try {
        fn({ ...event, records })
      } catch (e) {
        // a listener's fault must not undo a commit; it surfaces as an unhandled error instead
        queueMicrotask(() => { throw e })
      }
    }
  }

  /** Validates and applies the calls against an overlay. Nothing of the store changes. */
  private build(
    calls: readonly { verb: string; input: Json; as?: string; basis?: Json }[],
    actor: Actor,
    allowOfferedIds: boolean,
    unticked: ReadonlyMap<string, number>,
    again?: { records: readonly ChangeRecord[]; seq: number },
  ): Built {
    if (!this.registry.actors.includes(actor)) return unregistered(actor)
    const draft = new Overlay(this.registry, this.state, this.nextBatch, again?.seq ?? this.nextSeq)
    // a gesture's move first undoes the move before it, and is measured against the state that leaves; a second overlay
    // takes the same reversal and is never written again, so a system can read the state the gesture began from
    const gestureStart = again === undefined || again.records.length === 0 ? null : new Overlay(this.registry, this.state, this.nextBatch, again.seq)
    const reversal: ChangeRecord[] = []
    for (const r of again?.records.slice().reverse() ?? []) {
      const back = inverse(r, r.seq)
      const issue = draft.reapply(back)
      if (issue !== null) return refusal('diverged', [issue])
      gestureStart?.reapply(back)
      reversal.push(back)
    }
    if (again !== undefined) draft.markBaseline()
    let opens = false
    const handles = new Map<string, string>()
    const resolved: ResolvedCall[] = []
    const out: Array<{ verb: string; input: Json; basis?: Json }> = []
    const lines: string[] = []
    const starts: number[] = []
    const callsSoFar = growing(resolved)
    const so = (): BatchSoFar => ({ calls: callsSoFar(), records: draft.frozenRecords() })

    const lookup = (name: string): Json => {
      const id = handles.get(name)
      if (id === undefined) {
        const later = unticked.get(name)
        throw new Refuse([{ message: later === undefined ? `the handle '${name}' names nothing made earlier in this batch` : `the handle '${name}' is made by item ${later + 1}, which is not part of this batch` }])
      }
      return id
    }

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]!
      const fail = (reason: Refusal['reason'], issues: Issue[]): Built => refusal(reason, issues, { at: i })
      const verb = this.registry.verbs.get(call.verb)
      if (verb === undefined) return fail('unknown_verb', [{ message: `there is no verb '${call.verb}'` }])
      if (verb.actors !== undefined && !verb.actors.includes(actor)) return fail('actor', [{ message: `${verb.name} is not open to the ${actor}` }])
      if (verb.opens === true) {
        if (calls.length !== 1) return fail('input', [{ message: `${verb.name} opens another state, so it takes a batch to itself` }])
        opens = true
      }
      draft.verb = verb.name
      draft.cause = verb.name
      allow(mayMint, draft, verb.mints === true || verb.mintsOther !== undefined)
      starts.push(draft.records.length)
      try {
        let input: Json
        try {
          input = resolveRefs(verb.input, call.input, lookup)
        } catch (e) {
          if (e instanceof Refuse) return fail('handle', e.issues)
          throw e
        }
        const named = protoKey(input)
        if (named !== null) return fail('input', [{ field: named, message: `${verb.name} was given a key named ${PROTO_KEY} at ${named}, which stored content cannot hold` }])
        const basisKey = call.basis === undefined ? null : protoKey(call.basis, '/basis')
        if (basisKey !== null) return fail('input', [{ field: basisKey, message: `${verb.name} was given a key named ${PROTO_KEY} at ${basisKey}, which stored content cannot hold` }])
        if (call.as !== undefined && (!verb.mints || handles.has(call.as))) {
          return fail('handle', [{ message: verb.mints ? `the handle '${call.as}' is used twice in this batch` : `${verb.name} makes no entity, so it cannot carry the handle '${call.as}'` }])
        }
        let offered: string | undefined
        if (verb.mints && isObject(input) && input.id !== undefined) {
          if (!allowOfferedIds) return fail('input', [{ field: '/id', message: `${verb.name} takes no id: the store names a new entity itself` }])
          if (typeof input.id !== 'string') return fail('input', [{ field: '/id', message: 'an id is text' }])
          offered = input.id
          input = Object.fromEntries(Object.entries(input).filter(([k]) => k !== 'id'))
        }
        const shape = checkShape(verb.input, input, (k, id) => draft.has(k, id))
        if (shape.length > 0) return fail('input', shape)
        const found = verb.validate?.(draft, input, so()) ?? []
        if (found.length > 0) return fail('validation', found)
        let id: string | undefined
        if (verb.mints) {
          if (offered !== undefined) draft.offer(verb.target, offered)
          id = offered ?? draft.mint(verb.target)
          if (call.as !== undefined) handles.set(call.as, id)
        }
        allow(mayOpen, draft, verb.opens === true)
        const mint = (kind: string): string => {
          if (verb.mints !== true && verb.mintsOther !== undefined && !verb.mintsOther.includes(kind)) throw new Error(`${verb.name} does not declare that it mints '${kind}'`)
          return draft.mint(kind)
        }
        draft.writing(() => verb.apply(draft, input, { id, actor, mint }))
        allow(mayOpen, draft, false)
        const logged = verb.mints && isObject(input) ? { ...input, id: id! } : input
        const kept = frozenCopy(logged)
        resolved.push({ verb: verb.name, input: kept, actor })
        out.push({ verb: verb.name, input: kept, ...(call.basis === undefined ? {} : { basis: frozenCopy(call.basis) }) })
        lines.push(verb.describe(input))
      } catch (e) {
        if (e instanceof Refuse) return fail('apply', e.issues)
        if (e instanceof StoreRefusal) return fail('apply', [{ kind: verb.target, field: e.at, message: e.message }])
        throw e
      }
    }

    // a system reacts to what the verbs' writes left, so a write that a later write of the batch undid triggers nothing
    const fromVerbs = opens ? [] : draft.records.filter((r) => draft.leavesChange(this.state, r))
    const before = this.reader(gestureStart ?? this.state)
    for (const system of this.registry.systems) {
      const matched = fromVerbs.filter((r) => (system.on.kind === undefined || r.kind === system.on.kind) && (system.on.component === undefined || r.component === system.on.component))
      if (matched.length === 0) continue
      draft.verb = matched[0]!.verb
      draft.cause = `system:${system.name}`
      allow(mayMint, draft, false)
      try {
        draft.writing(() => system.run(draft, matched, before))
      } catch (e) {
        // the call that wrote the first record the system reacted to is the place the refusal names
        if (e instanceof Refuse) return refusal('apply', e.issues, { at: starts.filter((s) => s <= draft.records.indexOf(matched[0]!)).length - 1 })
        throw e
      }
    }
    // checked before the batch is committed: commit writes the undo step and the log entry ahead of commitTo, so a throw from commitTo would leave both with no change behind them
    draft.holdCounters(this.state)
    return { ok: true, draft, calls: out, ids: Object.fromEntries(handles), lines, reversal: Object.freeze(reversal), opens }
  }

  private append(entry: LogEntry): void {
    this.entries.push(Object.freeze(entry))
    this.logView = undefined
  }

  private touch(records: readonly ChangeRecord[]): void {
    for (const r of records) this.touched.push({ seq: r.seq, kind: r.kind, id: r.id, ...(r.component === undefined ? {} : { component: r.component }) })
  }

  /** Writes an overlay that passed every check into the committed state, then tells the listeners what the records say changed. */
  private settle(draft: Overlay, records: readonly ChangeRecord[], batch: number, actor: Actor, cause: ChangeEvent['cause']): void {
    draft.commitTo(this.state)
    this.nextSeq += records.length
    this.touch(records)
    this.cached = undefined
    this.emit({ batch, cause, actor, records })
  }

  run(calls: readonly Call[], options: RunOptions): Outcome {
    return this.commit(calls, options.actor, options.allowOfferedIds === true, new Map())
  }

  private commit(calls: readonly Call[], actor: Actor, allowOfferedIds: boolean, unticked: ReadonlyMap<string, number>): Outcome {
    const lock = this.busy()
    if (lock !== null) return { ok: false, refusal: lock }
    const built = this.build(calls, actor, allowOfferedIds, unticked)
    if (!built.ok) return built
    const { draft } = built
    // a batch whose writes cancel is no change: no step, no log entry, no event, no batch number, and the redo tail stays
    if (!draft.changesState(this.state)) return { ok: true, changed: false, records: [], ids: {}, trimmed: 0 }
    const before = new Map(this.state.counters)
    const after = draft.countersAfter(this.state)
    const step: Step = { batch: this.nextBatch++, actor, records: draft.frozenRecords(), ...(sameCounters(before, after) ? {} : { counters: { before, after } }) }
    for (const c of built.calls) {
      this.append({ seq: this.entries.length, batch: step.batch, verb: c.verb, input: frozenCopy(c.input), actor, ...(c.basis === undefined ? {} : { basis: c.basis }) })
    }
    this.undoStack.push(step)
    this.redoStack = []
    let trimmed = 0
    while (this.undoStack.length > this.limit) {
      this.undoStack.shift()
      trimmed++
    }
    this.settle(draft, step.records, step.batch, actor, built.opens ? 'open' : 'verb')
    return { ok: true, changed: true, batch: step.batch, records: step.records, ids: built.ids, trimmed }
  }

  private travel(actor: Actor, from: 'undo' | 'redo'): Outcome {
    const lock = this.busy()
    if (lock !== null) return { ok: false, refusal: lock }
    const first = this.registry.actors[0]!
    if (actor !== first) return refusal('actor', [{ message: `${from} is open to the ${first} only` }])
    const stack = from === 'undo' ? this.undoStack : this.redoStack
    const step = stack[stack.length - 1]
    if (step === undefined) return refusal(from === 'undo' ? 'nothing_to_undo' : 'nothing_to_redo', [{ message: `there is nothing to ${from}` }])
    const draft = new Overlay(this.registry, this.state, step.batch, this.nextSeq)
    const originals = from === 'undo' ? step.records.slice().reverse() : step.records
    const applied: ChangeRecord[] = []
    for (const r of originals) {
      const record = from === 'undo' ? inverse(r, this.nextSeq + applied.length) : Object.freeze({ ...r, seq: this.nextSeq + applied.length })
      const issue = draft.reapply(record)
      if (issue !== null) return refusal('diverged', [issue])
      applied.push(record)
    }
    if (step.counters !== undefined) {
      allow(mayRestore, draft, true)
      draft.restoreCounters(from === 'undo' ? step.counters.before : step.counters.after)
      allow(mayRestore, draft, false)
    }
    stack.pop()
    ;(from === 'undo' ? this.redoStack : this.undoStack).push(step)
    this.append({ seq: this.entries.length, batch: step.batch, verb: from, input: Object.freeze({}), actor })
    const records = Object.freeze(applied)
    this.settle(draft, records, step.batch, actor, from)
    return { ok: true, changed: true, batch: step.batch, records, ids: {}, trimmed: 0 }
  }
  undo(actor: Actor): Outcome { return this.travel(actor, 'undo') }
  redo(actor: Actor): Outcome { return this.travel(actor, 'redo') }

  gesture(options: { actor: Actor }): GestureOutcome {
    const busy = this.busy()
    if (busy !== null) return { ok: false, refusal: busy }
    if (!this.registry.actors.includes(options.actor)) return unregistered(options.actor)
    const open: GestureState = { actor: options.actor, seq: this.nextSeq, hash: this.hash(), counters: new Map(this.state.counters), touched: this.touched.length, last: null }
    this.gesturing = open
    return {
      ok: true,
      gesture: {
        move: (calls) => this.moveGesture(open, calls),
        end: () => this.endGesture(open),
        cancel: () => this.cancelGesture(open),
        isOpen: () => this.gesturing === open,
      },
    }
  }

  private moveGesture(open: GestureState, calls: readonly Call[]): Outcome {
    if (this.gesturing !== open) return refusal('gesture', [{ message: 'this gesture has ended' }])
    const lock = this.locked()
    if (lock !== null) return { ok: false, refusal: lock }
    // a move is built over the counters the gesture began with, as it is over the state it began from, so the ids it takes are
    // the ones a replay of the logged move takes; a refused move leaves the counters where the move before it left them
    const held = new Map(this.state.counters)
    this.putCounters(open.counters)
    let built: Built
    try {
      built = this.build(calls, open.actor, false, new Map(), { records: open.last?.records ?? [], seq: open.seq })
    } catch (e) {
      this.putCounters(held)
      throw e
    }
    if (!built.ok) {
      this.putCounters(held)
      return built
    }
    if (built.opens) {
      this.putCounters(held)
      return refusal('input', [{ message: 'a gesture cannot open another state' }], { at: 0 })
    }
    const { draft } = built
    if (!draft.changesState(this.state)) {
      // a move that leaves the state as the gesture began it takes the move before it back and writes nothing else,
      // so the state is the one the gesture began from, the order of its ids included
      const back = this.takeBack(open)
      if (!back.ok) return back
      open.last = { records: [], calls: [], ids: {}, changed: false }
      if (back.records.length > 0) this.emit({ batch: this.nextBatch, cause: 'verb', actor: open.actor, records: back.records })
      return { ok: true, changed: false, records: [], ids: {}, trimmed: 0 }
    }
    const records = draft.frozenRecords()
    draft.commitTo(this.state)
    this.nextSeq = open.seq + records.length
    this.touched.length = open.touched
    this.touch(records)
    this.cached = undefined
    open.last = { records, calls: built.calls, ids: built.ids, changed: true }
    this.emit({ batch: this.nextBatch, cause: 'verb', actor: open.actor, records: Object.freeze([...built.reversal, ...records]) })
    return { ok: true, changed: true, records, ids: built.ids, trimmed: 0 }
  }

  /** Takes back the last move the gesture made, leaving the state it began from; returns the records that did it. */
  private takeBack(open: GestureState): { ok: true; records: readonly ChangeRecord[] } | { ok: false; refusal: Refusal } {
    const made = open.last?.records ?? []
    if (made.length === 0) return { ok: true, records: [] }
    const draft = new Overlay(this.registry, this.state, this.nextBatch, open.seq)
    const back: ChangeRecord[] = []
    for (const r of made.slice().reverse()) {
      const record = inverse(r, r.seq)
      const issue = draft.reapply(record)
      if (issue !== null) return refusal('diverged', [issue])
      back.push(record)
    }
    draft.commitTo(this.state)
    this.cached = undefined
    return { ok: true, records: Object.freeze(back) }
  }

  /** Puts the counters, the sequence and the list of touched addresses back as the gesture found them. */
  private leaveNoTrace(open: GestureState): void {
    this.putCounters(open.counters)
    this.nextSeq = open.seq
    this.touched.length = open.touched
  }

  private putCounters(counters: ReadonlyMap<string, number>): void {
    this.state.counters.clear()
    for (const [kind, n] of counters) this.state.counters.set(kind, n)
  }

  private endGesture(open: GestureState): Outcome {
    if (this.gesturing !== open) return refusal('gesture', [{ message: 'this gesture has ended' }])
    this.gesturing = null
    const last = open.last
    if (last === null || !last.changed) {
      this.leaveNoTrace(open)
      return { ok: true, changed: false, records: [], ids: {}, trimmed: 0 }
    }
    const after = new Map(this.state.counters)
    const step: Step = { batch: this.nextBatch++, actor: open.actor, records: last.records, ...(sameCounters(open.counters, after) ? {} : { counters: { before: open.counters, after } }) }
    for (const c of last.calls) {
      this.append({ seq: this.entries.length, batch: step.batch, verb: c.verb, input: frozenCopy(c.input), actor: open.actor, ...(c.basis === undefined ? {} : { basis: c.basis }) })
    }
    this.undoStack.push(step)
    this.redoStack = []
    let trimmed = 0
    while (this.undoStack.length > this.limit) {
      this.undoStack.shift()
      trimmed++
    }
    return { ok: true, changed: true, batch: step.batch, records: step.records, ids: last.ids, trimmed }
  }

  private cancelGesture(open: GestureState): Outcome {
    if (this.gesturing !== open) return refusal('gesture', [{ message: 'this gesture has ended' }])
    const lock = this.locked()
    if (lock !== null) return { ok: false, refusal: lock }
    const back = this.takeBack(open)
    if (!back.ok) return back
    // closed and restored before the listeners hear of it, so one that edits finds the store free
    this.gesturing = null
    this.leaveNoTrace(open)
    if (back.records.length > 0) this.emit({ batch: this.nextBatch, cause: 'cancel', actor: open.actor, records: back.records })
    return { ok: true, changed: false, records: [], ids: {}, trimmed: 0 }
  }

  abandonGesture(): Outcome {
    const open = this.gesturing
    if (open === null) return { ok: true, changed: false, records: [], ids: {}, trimmed: 0 }
    const outcome = this.cancelGesture(open)
    // refused under a lock: the release of the last lock runs it, as the caller that is going away will not ask again
    if (!outcome.ok && outcome.refusal.reason === 'locked') this.abandoning = open
    return outcome
  }

  /** Runs the abandon a lock refused, once no lock is left; a gesture that has ended since refuses the cancel and is left as it ended. */
  private finishAbandon(): void {
    const open = this.abandoning
    this.abandoning = null
    if (open !== null) this.cancelGesture(open)
  }

  propose(items: readonly ProposalItem[]): ProposeOutcome {
    if (this.gesturing !== null) return refusal('gesture', [{ message: 'a gesture is open: a proposal made now would rest on a state that is still moving; end it or cancel it first' }])
    return { ok: true, proposal: { items: plainCopy(items as unknown as Json) as unknown as ProposalItem[], baseHash: this.hash(), baseCounters: this.countersDigest(), baseSeq: this.nextSeq } }
  }

  private subset(proposal: Proposal, only: readonly number[] | undefined): { ok: true; items: ProposalItem[]; unticked: Map<string, number> } | { ok: false; refusal: Refusal } {
    const picked = only === undefined ? proposal.items.map((_, i) => i) : [...only].sort((a, b) => a - b)
    const bad = picked.find((i, k) => !Number.isInteger(i) || i < 0 || i >= proposal.items.length || picked[k - 1] === i)
    if (bad !== undefined) return refusal('input', [{ message: `item ${bad} is out of range or named twice: the proposal has ${proposal.items.length} items, numbered from 0` }])
    const unticked = new Map<string, number>()
    proposal.items.forEach((item, i) => {
      if (item.as !== undefined && !picked.includes(i)) unticked.set(item.as, i)
    })
    return { ok: true, items: picked.map((i) => proposal.items[i]!), unticked }
  }

  preview(proposal: Proposal, options: { actor: Actor; only?: readonly number[]; allowOfferedIds?: boolean }): Preview {
    const sub = this.subset(proposal, options.only)
    if (!sub.ok) return sub
    const built = this.build(sub.items, options.actor, options.allowOfferedIds === true, sub.unticked)
    if (!built.ok) return built
    return { ok: true, lines: built.lines, records: built.draft.frozenRecords(), ids: built.ids }
  }

  accept(proposal: Proposal, options: { actor: Actor; only?: readonly number[]; acknowledgeBase?: boolean; allowOfferedIds?: boolean }): Outcome {
    const lock = this.busy()
    if (lock !== null) return { ok: false, refusal: lock }
    const actor = options.actor
    const sub = this.subset(proposal, options.only)
    if (!sub.ok) return sub
    const contentMoved = proposal.baseHash !== this.hash()
    // the counters matter to a batch that mints an id, whose card showed the ids it would take
    const mints = sub.items.some((item) => {
      const verb = this.registry.verbs.get(item.verb)
      return verb?.mints === true || verb?.mintsOther !== undefined
    })
    if ((contentMoved || (mints && proposal.baseCounters !== this.countersDigest())) && options.acknowledgeBase !== true) {
      const seen = new Set<string>()
      const changed = this.touched
        .filter((t) => t.seq >= proposal.baseSeq)
        .filter((t) => {
          const k = `${keyOf(t.kind, t.id)}${t.component ?? ''}`
          return seen.has(k) ? false : (seen.add(k), true)
        })
        .map(({ kind, id, component }) => ({ kind, id, ...(component === undefined ? {} : { component }) }))
      const now = this.preview(proposal, { actor, allowOfferedIds: options.allowOfferedIds === true, ...(options.only === undefined ? {} : { only: options.only }) })
      const hit = new Set(now.ok ? now.records.map((r) => keyOf(r.kind, r.id)) : [])
      const overlapping = changed.filter((c) => hit.has(keyOf(c.kind, c.id)))
      const message = contentMoved ? 'the model changed after this proposal was made' : 'the counters that ids are minted from changed after this proposal was made, so the ids its card showed may not be the ones it would mint'
      return refusal('base_changed', [{ message }], { changed, overlapping })
    }
    return this.commit(sub.items, actor, options.allowOfferedIds === true, sub.unticked)
  }

  read(name: string, input: Json): ReadOutcome {
    const verb = this.registry.reads.get(name)
    if (verb === undefined) return refusal('unknown_verb', [{ message: `there is no read '${name}'` }])
    const named = protoKey(input)
    if (named !== null) return refusal('input', [{ field: named, message: `${name} was given a key named ${PROTO_KEY} at ${named}, which a read cannot take` }])
    const shape = checkShape(verb.input, input, () => true)
    if (shape.length > 0) return refusal('input', shape)
    return { ok: true, value: verb.run(this.reader(), input, [...this.registry.kinds.keys()]) }
  }

  /**
   * What a read verb, the projection hook and a system (as the state before the batch) are handed: the four reads of the
   * committed state, and no handle on the maps behind them. A gesture's move hands a system the same reads of the state
   * the gesture began from, which is the state its logged calls replay on.
   */
  private reader(state: Reader = this.state): Reader {
    return {
      has: (kind, id) => state.has(kind, id),
      get: (kind, id) => state.get(kind, id),
      ids: (kind) => state.ids(kind),
      refs: (kind, id) => state.refs(kind, id),
    }
  }
}

/** A store over a registry, from a base snapshot or empty. `limit` is the number of undo steps kept. */
export function createStore(registry: Registry, options: { base?: Snapshot; limit?: number } = {}): Store {
  const limit = options.limit ?? 50
  if (!isLimit(limit)) throw new Error(`the undo limit must be a whole number of at least 1, found ${String(limit)}`)
  return new VerbStore(registry, options.base, limit)
}

/**
 * Replays a saved log over its base. Refused when the base is not the one the log was written against, when
 * a logged call is refused, or when the state reached is not the state that was saved.
 */
export function replay(registry: Registry, saved: Saved): { ok: true; store: Store } | { ok: false; refusal: Refusal } {
  if (!isLimit(saved.limit)) return refusal('replay', [{ message: `the saved undo limit must be a whole number of at least 1, found ${JSON.stringify(saved.limit) ?? 'nothing'}` }])
  if (typeof saved.counters !== 'string') return refusal('replay', [{ message: `the saved counters digest must be a text, found ${JSON.stringify(saved.counters) ?? 'nothing'}` }])
  const store = createStore(registry, { base: saved.base, limit: saved.limit })
  if (store.hash() !== saved.baseHash) return refusal('replay', [{ message: 'the log was written against another base: the base hash differs' }])
  const entries = saved.log
  for (let i = 0; i < entries.length; ) {
    const e = entries[i]!
    if (e.verb === 'undo' || e.verb === 'redo') {
      const r = e.verb === 'undo' ? store.undo(e.actor) : store.redo(e.actor)
      if (!r.ok) return refusal('replay', r.refusal.issues, { at: i })
      i++
      continue
    }
    let j = i
    while (j < entries.length && entries[j]!.batch === e.batch && entries[j]!.verb !== 'undo' && entries[j]!.verb !== 'redo') j++
    const calls: Call[] = entries.slice(i, j).map((x) => ({ verb: x.verb, input: x.input, ...(x.basis === undefined ? {} : { basis: x.basis }) }))
    const r = store.run(calls, { actor: e.actor, allowOfferedIds: true })
    if (!r.ok) return refusal('replay', r.refusal.issues, { at: i + (r.refusal.at ?? 0) })
    i = j
  }
  if (store.hash() !== saved.hash) return refusal('replay', [{ message: 'the log reached a state other than the one saved: the content hash differs' }])
  if (digestOfCounters(Object.entries(store.snapshot().counters)) !== saved.counters) return refusal('replay', [{ message: 'the log reached counters other than the ones saved, so the next id a create takes would differ: the counters digest differs' }])
  return { ok: true, store }
}
