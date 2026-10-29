import type { Json } from './contracts'
import { PROTO_KEY } from './json'

/** One step of a path: a field name, or the text inside brackets (an id, or a position when the value is a list). */
export type Step = { field: string } | { bracket: string }

const RESERVED = new Set(['.', '[', ']', '{', '}', '~'])
/** The reserved characters an id may not hold: all but the dot, which a path reads inside brackets as part of the id. */
const ID_RESERVED = new Set(['[', ']', '{', '}', '~'])

/**
 * A dotted path of fields with ids and positions in brackets: `box[b1].Size.width`, `box[b1].Tags[0]`, `box[C15x33.9].Size`.
 * An id holds no reserved character but the dot (see isValidId), so every id is addressable. Null when the text
 * does not read as a path; an empty text is the root, which has no steps.
 */
export function parsePath(text: string): Step[] | null {
  const steps: Step[] = []
  let i = 0
  while (i < text.length) {
    const c = text[i]!
    if (c === '[') {
      const end = text.indexOf(']', i + 1)
      if (end < 0) return null
      const inside = text.slice(i + 1, end)
      if (inside === '' || [...inside].some((ch) => ID_RESERVED.has(ch))) return null
      steps.push({ bracket: inside })
      i = end + 1
      continue
    }
    if (c === '.') {
      if (steps.length === 0 || i + 1 >= text.length || text[i + 1] === '.' || text[i + 1] === '[') return null
      i += 1
      continue
    }
    if (RESERVED.has(c)) return null
    let j = i
    while (j < text.length && !RESERVED.has(text[j]!)) j++
    steps.push({ field: text.slice(i, j) })
    i = j
  }
  return steps
}

const isObject = (v: Json | undefined): v is { [k: string]: Json } => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The value at the path, or undefined where the value holds nothing there. */
export function resolvePath(root: Json, steps: readonly Step[]): Json | undefined {
  let at: Json | undefined = root
  for (const s of steps) {
    const key = 'field' in s ? s.field : s.bracket
    if (Array.isArray(at)) {
      if (!/^(0|[1-9][0-9]*)$/.test(key)) return undefined
      at = at[Number(key)]
    } else if (isObject(at)) {
      at = Object.prototype.hasOwnProperty.call(at, key) ? at[key] : undefined
    } else return undefined
    if (at === undefined) return undefined
  }
  return at
}

/**
 * Whether text may be the id of a new entity: it is not empty, holds no reserved character but the dot and no whitespace,
 * does not start with `#`, and is not the key `__proto__`, which stored content cannot hold (see PROTO_KEY), so an id never
 * sets the prototype of an object that is keyed by it. A file's ids may hold a dot, as C15x33.9 does.
 */
export function isValidId(id: string): boolean {
  return id !== '' && id !== PROTO_KEY && !id.startsWith('#') && ![...id].some((ch) => ID_RESERVED.has(ch) || ch.trim() === '')
}

/** Whether text may be the name of a kind, a prefix or a group: an id that holds no dot, since a kind is named as a field of a path. */
export function isValidName(name: string): boolean {
  return isValidId(name) && !name.includes('.')
}

/** The refusal of an id isValidId refuses: what it may not be, in one place for every entry that checks. */
export const notAnId = (id: string): string => `'${id}' cannot be an id: it is empty, holds a reserved character or whitespace, starts with '#', or is named ${PROTO_KEY}`
