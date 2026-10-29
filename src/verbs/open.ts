import type { Actor, Components, Issue, Json, Verb } from './contracts'
import { isValidId, notAnId } from './path'
import { PROTO_KEY, orderProblem, protoKey } from './json'
import type { Registry } from './registry'

/**
 * The verb that opens another state in place of the one in the store: `<kind>.open`, for the kind that stands for the
 * whole state. It removes every entity and adds those of the saved state, so its records hold the state it replaced
 * (each removed entity with what it held and the place it held in its kind) and undo puts that state back, in order.
 * It takes the saved state's counters and its step remembers the replaced ones, so undo gives them back.
 *
 * A state is the same state when its content, its counters and the order of its ids in each kind are the same. The
 * content hash reads none of the order, but `ids` and `entity.list` give it, so an open whose snapshot differs from the
 * open state only in the order of the ids is one step that takes the snapshot's order, and undo gives the old order back.
 * The counters, which ids are minted from, count as content too, a kind the snapshot does not list counting as 0: an open
 * that holds the entities of the open state and other counters is one step that replaces the counters, and undo gives
 * them back.
 *
 * The ids of a kind come in the order the snapshot's object lists them, unless the snapshot gives an `order` for the kind: an
 * object lists the keys that read as a list position first, so a store that holds the ids `wall`, `2` and `1` writes that
 * order beside its entities (see Snapshot). An order that names an id the kind does not hold, leaves one out or names one twice is refused.
 */

export type OpenInput = { snapshot: Json }

interface Opened {
  entities: Array<{ kind: string; id: string; components: Components }>
  counters: { [kind: string]: number }
}

const isObject = (v: Json | undefined): v is { [k: string]: Json } => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Reads a saved state against the vocabulary, or says what in it cannot be opened. */
function read(registry: Registry, value: Json | undefined): { ok: true; opened: Opened } | { ok: false; issues: Issue[] } {
  if (!isObject(value)) return { ok: false, issues: [{ field: '/snapshot', message: 'the state to open must be an object' }] }
  const keyed = protoKey(value, '/snapshot')
  if (keyed !== null) return { ok: false, issues: [{ field: keyed, message: `the state to open holds a key named ${PROTO_KEY} at ${keyed}, which stored content cannot hold` }] }
  if (!isObject(value.entities)) return { ok: false, issues: [{ field: '/snapshot/entities', message: 'the state to open needs its entities, by kind and id' }] }
  const issues: Issue[] = []
  const entities: Opened['entities'] = []
  const held = new Map<string, string>()
  for (const [kind, byId] of Object.entries(value.entities)) {
    if (!registry.kinds.has(kind)) {
      issues.push({ kind, field: `/snapshot/entities/${kind}`, message: `'${kind}' is not a kind of this vocabulary` })
    } else if (!isObject(byId)) {
      issues.push({ kind, field: `/snapshot/entities/${kind}`, message: `the ${kind} entities must be an object of components by id` })
    } else {
      for (const [id, components] of Object.entries(byId)) {
        const where = `/snapshot/entities/${kind}/${id}`
        const key = `${registry.space(kind)}${String.fromCharCode(0)}${id}`
        if (!isValidId(id)) issues.push({ kind, id, field: where, message: notAnId(id) })
        else if (!isObject(components)) issues.push({ kind, id, field: where, message: `${kind} '${id}' holds no components` })
        else if (held.has(key)) issues.push({ kind, id, field: where, message: `the id '${id}' is held as a ${held.get(key)} and as a ${kind}` })
        else {
          held.set(key, kind)
          entities.push({ kind, id, components })
        }
      }
    }
  }
  // the order of a kind whose ids an object cannot list in order, which the snapshot gives beside its entities
  const orders = new Map<string, string[]>()
  if (value.order !== undefined && !isObject(value.order)) issues.push({ field: '/snapshot/order', message: 'the order must be an object of lists of ids by kind' })
  else {
    for (const [kind, listed] of Object.entries(value.order ?? {})) {
      const field = `/snapshot/order/${kind}`
      if (!registry.kinds.has(kind)) {
        issues.push({ kind, field, message: `the order names '${kind}', which is not a kind of this vocabulary` })
        continue
      }
      const problem = orderProblem(listed, entities.filter((e) => e.kind === kind).map((e) => e.id))
      if (problem === null) orders.set(kind, listed as string[])
      else issues.push({ kind, field, message: `the order of ${kind} ${problem}` })
    }
  }
  const counters = value.counters ?? {}
  if (!isObject(counters)) {
    issues.push({ field: '/snapshot/counters', message: 'the counters must be an object of whole numbers by kind' })
  } else {
    for (const [kind, n] of Object.entries(counters)) {
      if (!registry.kinds.has(kind)) issues.push({ kind, field: `/snapshot/counters/${kind}`, message: `'${kind}' is not a kind of this vocabulary` })
      else if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) issues.push({ kind, field: `/snapshot/counters/${kind}`, message: `the counter of '${kind}' must be a whole number of 0 or more` })
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, opened: { entities: inOrder(entities, orders), counters: counters as { [kind: string]: number } } }
}

/** The entities with each kind that has an order listed in that order, and every other kind as it came. */
function inOrder(entities: Opened['entities'], orders: ReadonlyMap<string, string[]>): Opened['entities'] {
  if (orders.size === 0) return entities
  const byKind = new Map<string, Opened['entities']>()
  for (const e of entities) {
    const list = byKind.get(e.kind) ?? []
    byKind.set(e.kind, list)
    list.push(e)
  }
  const placed: Opened['entities'] = []
  for (const [kind, list] of byKind) {
    const ids = orders.get(kind)
    const byId = new Map(list.map((e) => [e.id, e]))
    for (const e of ids === undefined ? list : ids.map((id) => byId.get(id)!)) placed.push(e)
  }
  return placed
}

/** The verb `<kind>.open`. `kind` is a registered kind that stands for the whole state; the verb is open to the first actor the registry names unless `actors` says otherwise. */
export function openVerb(registry: Registry, kind: string, options: { actors?: readonly Actor[] } = {}): Verb<OpenInput> {
  return {
    name: `${kind}.open`,
    target: kind,
    opens: true,
    actors: options.actors ?? [registry.actors[0]!],
    input: {
      type: 'object',
      properties: { snapshot: { type: 'object', description: 'The saved state to open: its entities by kind and id, and the counters ids are minted from.' } },
      required: ['snapshot'],
      additionalProperties: false,
    },
    validate: (_reader, call) => {
      const r = read(registry, call.snapshot)
      return r.ok ? [] : r.issues
    },
    apply: (draft, call) => {
      const r = read(registry, call.snapshot)
      if (!r.ok) throw new Error('the state to open was not checked before it was applied')
      // last to first, so each removal records the index the entity holds and undo adds them back in order
      for (const k of registry.kinds.keys()) {
        const ids = draft.ids(k)
        for (let i = ids.length - 1; i >= 0; i--) draft.remove(k, ids[i]!)
      }
      for (const e of r.opened.entities) draft.add(e.kind, e.id, e.components)
      draft.useCounters(r.opened.counters)
    },
    describe: (call) => {
      const r = read(registry, call.snapshot)
      return `Open a state of ${r.ok ? r.opened.entities.length : 0} entities in place of the one open`
    },
  }
}
