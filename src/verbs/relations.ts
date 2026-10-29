import type { Components, Json, Reader, Relations } from './contracts'
import { own } from './json'

/**
 * The entities that hold a reference to an entity, each once however many places it holds one in, and never the entity
 * itself: the ones a delete that removes its dependants removes. `refs` gives one result for each place, which a refusal
 * needs to say where; a delete that removed each result would remove an entity twice, and remove the target if it points at itself.
 */
export function dependants(reader: Reader, kind: string, id: string): Array<{ kind: string; id: string }> {
  const found = new Map<string, { kind: string; id: string }>()
  for (const place of reader.refs(kind, id)) {
    if (place.kind === kind && place.id === id) continue
    const key = `${place.kind}${String.fromCharCode(0)}${place.id}`
    if (!found.has(key)) found.set(key, { kind: place.kind, id: place.id })
  }
  return [...found.values()]
}

/** One place a relation reaches in an entity, with what is held there. */
export interface RelationTarget {
  /** The key of the relation that reached it, as the kind declares it. */
  relation: string
  /** The component the relation starts in: the first part of its key. */
  component: string
  /** The concrete pointer to the place, a list position standing where the relation has a star (`/Pack/2/box`). */
  at: string
  /** The kinds the relation lists: a reference held here may point at any of them. */
  kinds: readonly string[]
  /** The value held at the place. A value that is no reference is reported as it is, for a check that wants to name it. */
  value: Json
}

const isObject = (v: Json | undefined): v is { [k: string]: Json } => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The kinds a relation lists, as a list. */
export const targetKinds = (declared: string | readonly string[]): readonly string[] => (typeof declared === 'string' ? [declared] : declared)

/** Why a relation is none, or null when it is one: a part of its key that is empty, a star where the component belongs, or no kind to point at. */
export function relationProblem(key: string, declared: string | readonly string[]): string | null {
  const parts = key.split('/')
  if (parts.some((s) => s === '')) return 'has an empty part'
  if (parts[0] === '*') return 'starts with a star, where the name of a component belongs'
  const kinds = targetKinds(declared)
  if (kinds.length === 0 || kinds.some((k) => typeof k !== 'string' || k === '')) return 'lists no kind, or an empty one'
  return null
}

/**
 * Every place the relations reach in one entity's components, in the order of the relations and then of the walk:
 * `refs` reads the references the store holds through it, and a check on a state being loaded reads the same places,
 * so the two cannot disagree about where a reference may sit. A list at the end of a path gives one place for each item.
 * A step that finds nothing (a component the entity lacks, a key an object lacks, a star over something that is no
 * list) ends that walk with no place and no error. Only properties the value holds itself are read, so a name the
 * prototype chain also knows reaches nothing.
 */
export function relationTargets(components: Components, relations: Relations | undefined): RelationTarget[] {
  const out: RelationTarget[] = []
  for (const [relation, declared] of Object.entries(relations ?? {})) {
    const kinds = targetKinds(declared)
    const parts = relation.split('/')
    const component = parts[0]!
    const walk = (value: Json | undefined, depth: number, at: string): void => {
      if (value === undefined) return
      if (depth === parts.length) {
        if (Array.isArray(value)) value.forEach((item, i) => out.push({ relation, component, at: `${at}/${i}`, kinds, value: item }))
        else out.push({ relation, component, at, kinds, value })
        return
      }
      const step = parts[depth]!
      if (step === '*') {
        if (Array.isArray(value)) value.forEach((item, i) => walk(item, depth + 1, `${at}/${i}`))
      } else if (isObject(value)) {
        walk(own(value, step), depth + 1, `${at}/${step}`)
      }
    }
    walk(own(components, component), 1, `/${component}`)
  }
  return out
}
