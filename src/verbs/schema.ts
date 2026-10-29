import type { Issue, Json, Schema } from './contracts'
import { equal, own, plainCopy } from './json'

/**
 * The JSON Schema subset a verb's input may use, keyword by keyword and form by form (FORMS): `type` as one of
 * object, array, string, number, integer, boolean or null; `enum` as a list; `properties` as an object of
 * schemas; `required` as a list of names; `additionalProperties` only as false; `items` as one schema;
 * `minItems` and `maxItems` as whole numbers; `minimum` and `maximum` as numbers; `anyOf` as a list of schemas,
 * read alone (only a title or a description may sit beside it); and `x-ref`, which marks a string as the id of an
 * entity of the named kind and needs `type: 'string'` beside it. A keyword outside this list, one given a value of
 * another form, or one placed where it would not be read is refused when the verb is registered (unreadKeywords),
 * so a schema cannot promise a check this file does not make.
 */
const isObject = (v: Json | undefined): v is { [k: string]: Json } => v !== null && typeof v === 'object' && !Array.isArray(v)
const isText = (v: Json): boolean => typeof v === 'string'
const isCount = (v: Json): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isNumber = (v: Json): boolean => typeof v === 'number' && Number.isFinite(v)
const isAlternatives = (v: Json | undefined): boolean => Array.isArray(v) && v.length > 0
const TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'])

/** The keywords the checker reads, each with the test of the form of value it reads. */
const FORMS: { [keyword: string]: (v: Json) => boolean } = {
  type: (v) => typeof v === 'string' && TYPES.has(v),
  enum: (v) => Array.isArray(v) && v.length > 0,
  properties: isObject,
  required: (v) => Array.isArray(v) && v.every(isText),
  additionalProperties: (v) => v === false,
  items: isObject,
  minItems: isCount,
  maxItems: isCount,
  minimum: isNumber,
  maximum: isNumber,
  anyOf: isAlternatives,
  'x-ref': (v) => typeof v === 'string' && v !== '',
  description: isText,
  title: isText,
}

/** A value as text for a refusal; an undefined value (a key given, holding nothing) reads as `undefined`, and a number that is not finite is named (JSON would print `null`). */
const shown = (v: Json | undefined): string => {
  const text = typeof v === 'number' ? String(v) : (JSON.stringify(v) ?? 'undefined')
  return text.length > 40 ? `${text.slice(0, 40)}...` : text
}

/** What may sit beside an `anyOf`: the checker reads the alternatives alone, so a keyword beside it would never be checked. */
const BESIDE_ANY_OF = new Set(['anyOf', 'title', 'description'])

/**
 * The keywords of a schema (at any depth) this checker does not read, reads only in another form, or would not
 * reach where they are placed (beside an `anyOf`; an `x-ref` without `type: 'string'`), as `path: keyword = value`.
 */
export function unreadKeywords(schema: Json, at = ''): string[] {
  if (!isObject(schema)) return [`${at}: a schema must be an object, found ${shown(schema)}`]
  const out: string[] = []
  const alternatives = isAlternatives(schema.anyOf)
  for (const [k, v] of Object.entries(schema)) {
    const form = Object.prototype.hasOwnProperty.call(FORMS, k) ? FORMS[k] : undefined
    if (form === undefined || !form(v)) {
      out.push(`${at}: ${k} = ${shown(v)}`)
      continue
    }
    if (alternatives && !BESIDE_ANY_OF.has(k)) {
      out.push(`${at}: ${k} = ${shown(v)} sits beside an anyOf, which is read alone; put it inside each alternative`)
      continue
    }
    if (k === 'x-ref' && schema.type !== 'string') {
      out.push(`${at}: x-ref = ${shown(v)} needs type = "string" beside it`)
      continue
    }
    if (k === 'properties' && isObject(v)) {
      for (const [p, sub] of Object.entries(v)) out.push(...unreadKeywords(sub, `${at}/${p}`))
    } else if (k === 'items') {
      out.push(...unreadKeywords(v, `${at}/items`))
    } else if (k === 'anyOf' && Array.isArray(v)) {
      v.forEach((sub, i) => out.push(...unreadKeywords(sub, `${at}/anyOf/${i}`)))
    }
  }
  return out
}

/** The kinds the `x-ref` keywords of a schema name, at any depth. */
export function refKinds(schema: Json): string[] {
  if (!isObject(schema)) return []
  const out: string[] = typeof schema['x-ref'] === 'string' ? [schema['x-ref']] : []
  if (isObject(schema.properties)) for (const sub of Object.values(schema.properties)) out.push(...refKinds(sub))
  out.push(...refKinds(schema.items ?? null))
  if (Array.isArray(schema.anyOf)) for (const sub of schema.anyOf) out.push(...refKinds(sub))
  return out
}

/** The schemas a position can hold, each anyOf replaced by its alternatives. */
function alternatives(schemas: readonly Schema[]): Schema[] {
  return schemas.flatMap((s) => (Array.isArray(s.anyOf) ? alternatives(s.anyOf.filter(isObject)) : [s]))
}

/** The schema of one property, in each of the schemas that has it. */
const propertyOf = (schemas: readonly Schema[], key: string): Schema[] =>
  schemas.flatMap((s) => {
    const sub = isObject(s.properties) && Object.prototype.hasOwnProperty.call(s.properties, key) ? s.properties[key] : undefined
    return isObject(sub) ? [sub] : []
  })

/**
 * A copy of the value in which each `{handle: name}` object that sits where the schema marks an `x-ref` (in any
 * alternative of an anyOf, in a property at any depth, in the items of a list) is replaced by what `lookup` makes of
 * the name. Everywhere else an object with a handle key is data and is copied as it is, also where an alternative of
 * the same position takes an object: such an object matches that alternative by its own type, and an `x-ref` is a string.
 */
export function resolveRefs(schema: Schema, value: Json, lookup: (name: string) => Json): Json {
  const walk = (at: readonly Schema[], v: Json): Json => {
    if (at.length === 0) return plainCopy(v)
    const here = alternatives(at)
    if (Array.isArray(v)) {
      const items = here.flatMap((s) => (isObject(s.items) ? [s.items] : []))
      return v.map((x) => walk(items, x))
    }
    if (!isObject(v)) return v
    const keys = Object.keys(v)
    const takesObject = here.some((s) => s.type === 'object' || isObject(s.properties))
    if (keys.length === 1 && keys[0] === 'handle' && typeof v.handle === 'string' && !takesObject && here.some((s) => typeof s['x-ref'] === 'string')) return lookup(v.handle)
    return Object.fromEntries(keys.map((k) => [k, walk(propertyOf(here, k), v[k]!)]))
  }
  return walk([schema], value)
}

function typeOk(type: string, v: Json | undefined): boolean {
  switch (type) {
    case 'object': return isObject(v)
    case 'array': return Array.isArray(v)
    case 'string': return typeof v === 'string'
    case 'number': return typeof v === 'number' && Number.isFinite(v)
    case 'integer': return typeof v === 'number' && Number.isInteger(v)
    case 'boolean': return typeof v === 'boolean'
    case 'null': return v === null
    default: return false
  }
}

/**
 * What is wrong with `value` against `schema`, each issue naming the field it concerns as a pointer
 * (`/set/size`). `exists` answers an `x-ref`: whether an entity of that kind has that id.
 */
export function checkShape(schema: Schema, value: Json | undefined, exists: (kind: string, id: string) => boolean, at = ''): Issue[] {
  const where = at === '' ? 'the input' : at
  if (value === undefined) return [{ field: at, message: `${where} is missing` }]
  const issues: Issue[] = []
  const any = schema.anyOf
  if (Array.isArray(any)) {
    const tries = any.map((s) => (isObject(s) ? checkShape(s, value, exists, at) : [{ field: at, message: 'a schema is not an object' }]))
    if (tries.some((t) => t.length === 0)) return []
    // when one alternative has the value's own type, what is wrong is wrong inside that one, and its issues name the place
    const typed = any.flatMap((s, i) => (isObject(s) && typeof s.type === 'string' && typeOk(s.type, value) ? [i] : []))
    if (typed.length === 1) return tries[typed[0]!]!
    return [{ field: at, message: `${where} matches none of the allowed forms: ${tries.map((t) => t[0]?.message ?? '').join('; ')}` }]
  }
  const type = schema.type
  if (typeof type === 'string' && !typeOk(type, value)) return [{ field: at, message: `${where} must be ${type === 'integer' ? 'a whole number' : `of type ${type}`}` }]
  const options = schema.enum
  if (Array.isArray(options) && !options.some((o) => equal(o, value))) {
    return [{ field: at, message: `${where} must be one of ${options.map((o) => JSON.stringify(o)).join(', ')}` }]
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) issues.push({ field: at, message: `${where} is below ${schema.minimum}` })
    if (typeof schema.maximum === 'number' && value > schema.maximum) issues.push({ field: at, message: `${where} is above ${schema.maximum}` })
  }
  const refKind = schema['x-ref']
  if (typeof refKind === 'string' && typeof value === 'string' && !exists(refKind, value)) {
    issues.push({ kind: refKind, id: value, field: at, message: `${where} names no ${refKind} '${value}'` })
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) issues.push({ field: at, message: `${where} needs at least ${schema.minItems} items` })
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) issues.push({ field: at, message: `${where} takes at most ${schema.maxItems} items` })
    const items = schema.items
    if (isObject(items)) value.forEach((v, i) => issues.push(...checkShape(items, v, exists, `${at}/${i}`)))
  } else if (isObject(value)) {
    const props = isObject(schema.properties) ? schema.properties : {}
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const r of required) if (typeof r === 'string' && own(value, r) === undefined) issues.push({ field: `${at}/${r}`, message: `${at}/${r} is missing` })
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue
      const sub = Object.prototype.hasOwnProperty.call(props, k) ? props[k] : undefined
      if (isObject(sub)) issues.push(...checkShape(sub, v, exists, `${at}/${k}`))
      else if (schema.additionalProperties === false) issues.push({ field: `${at}/${k}`, message: `${at}/${k} is not a field of ${where}` })
    }
  }
  return issues
}

/**
 * The schema as a caller outside the app is given it: an `x-ref` string also accepts `{handle}`, the name a call of the
 * same proposal gave an entity it creates. The input is copied; the schema stays as it was registered.
 */
export function toCallSchema(schema: Schema): Schema {
  const walk = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(walk)
    if (!isObject(node)) return node
    const kind = node['x-ref']
    const out: { [k: string]: Json } = {}
    for (const [k, v] of Object.entries(node)) {
      if (k === 'x-ref') continue
      out[k] = k === 'properties' && isObject(v) ? Object.fromEntries(Object.entries(v).map(([p, s]) => [p, walk(s)])) : walk(v)
    }
    if (typeof kind !== 'string') return out
    return {
      anyOf: [
        { ...out, description: `${typeof out.description === 'string' ? `${out.description} ` : ''}The id of a ${kind}.` },
        {
          type: 'object',
          properties: { handle: { type: 'string', description: `The handle a ${kind} made earlier in this proposal was given.` } },
          required: ['handle'],
          additionalProperties: false,
        },
      ],
    }
  }
  return walk(schema) as Schema
}
