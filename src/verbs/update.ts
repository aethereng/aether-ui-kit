import type { Actor, Components, Issue, Json, Reader, Schema, Verb } from './contracts'
import { PROTO_KEY, equal, own } from './json'
import { checkShape } from './schema'

/**
 * The update verb of a kind, generated from one table of its fields: `<kind>.update` takes `{id, set: {field: value}}`.
 * The table is the single source of the verb's input schema (which is also the schema a caller is given), of the
 * checks it makes and of the card line it writes, so a field cannot be offered by one and refused by another.
 */

/** One field of a kind: where it lives, what it may hold, and how the card names it. */
export interface FieldSpec {
  /** The component the field is stored in. */
  component: string
  /** The key inside an object component; absent when the field is the whole component. */
  key?: string
  /**
   * The schema of the value, in the subset schema.ts reads. Every object in it is closed: a key it does not list is
   * refused by name, unless `freeForm` is set.
   */
  schema: Schema
  /** The value is an object whose keys the table does not list, so its schema is used as given and any key is taken. */
  freeForm?: boolean
  /**
   * The field may be absent, and this value, given in a call, removes it (`null` is the usual word). The removal is
   * recorded with the value it took away, so undo puts the value back, and the last key removed from an object
   * component takes the component with it. In the call schema the word is an alternative of the field, which is how a
   * call passes the schema; the field's own check is not run on it. A word the field's schema accepts is refused when
   * the table is read, because that value could never be stored; a field with no word cannot be removed.
   */
  clear?: Json
  /** What the card and the call schema name the field; the field's own name when absent. */
  label?: string
  /** The unit the value is in, shown on the card and in the call schema. */
  unit?: string
  /** A check beyond the schema: the reason the value is refused, or nothing. It reads the store as the batch has it so far. */
  check?(value: Json, reader: Reader, id: string): string | undefined
  /**
   * The value as the component holds it, when that is not the value given (a reference is held as a kind and an id,
   * see refStore). It is given the whole value, so a field holding a list of references converts the list. It may throw
   * a StoreRefusal to refuse a value it cannot hold; the verb runs it while validating and refuses the call there.
   */
  store?(value: Json): Json
}

/** What a store hook throws to refuse a value: `at` is the pointer inside the value (`/2` for its third entry, empty for the value itself). */
export class StoreRefusal extends Error {
  readonly at: string
  constructor(at: string, message: string) {
    super(message)
    this.at = at
  }
}

export type FieldTable = { readonly [field: string]: FieldSpec }

export type UpdateInput = { id: string; set: { [field: string]: Json } }

/** What a rule across fields is given. Values are keyed by the field names of the table. */
export interface UpdateCheck {
  id: string
  /** The fields the call names, as the call gives them: a removal appears as its clear word. */
  set: { readonly [field: string]: Json }
  /** What the entity holds now, as its components hold it; a field it holds nothing for is absent. */
  before: { readonly [field: string]: Json }
  /** What it will hold after the call, as its components will hold it: a removed field is absent. */
  after: { readonly [field: string]: Json }
  /** The store as the batch has it so far. */
  reader: Reader
}

export interface UpdateOptions {
  /** Who may call it; absent means anyone. */
  actors?: readonly Actor[]
  /**
   * A rule across fields, run once the call's fields have passed the schema and their own checks. It returns what it
   * refuses, each naming the field of the table it concerns (a refusal about the call as a whole names none). The
   * field may be one the call does not set, since the rule sees the values the entity holds. A name outside the table
   * is refused as the call's refusal, with the rule's message.
   */
  check?(call: UpdateCheck): Array<{ field?: string; message: string }>
}

/**
 * The store hook of a reference field: an id is held as `{kind, id}`, and a list of ids as a list of those, in the order
 * given. A list names an entity once; one named twice is refused at the entry that repeats it.
 */
export function refStore(kind: string): (value: Json) => Json {
  return (value) => {
    if (!Array.isArray(value)) return { kind, id: value }
    const firstAt = new Map<string, number>()
    value.forEach((id, i) => {
      if (typeof id !== 'string') return
      const first = firstAt.get(id)
      if (first !== undefined) throw new StoreRefusal(`/${i}`, `the list names ${kind} '${id}' twice, as entry ${first} and as entry ${i}`)
      firstAt.set(id, i)
    })
    return value.map((id) => ({ kind, id }))
  }
}

const isObject = (v: Json | undefined): v is { [k: string]: Json } => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The schema with every object in it closed (additionalProperties false) unless it says otherwise, in its properties, its items and its alternatives. */
function closed(schema: Schema): Schema {
  const out: { [k: string]: Json } = { ...schema }
  if ((schema.type === 'object' || isObject(schema.properties)) && out.additionalProperties === undefined) out.additionalProperties = false
  if (isObject(schema.properties)) out.properties = Object.fromEntries(Object.entries(schema.properties).map(([name, sub]) => [name, isObject(sub) ? closed(sub) : sub]))
  if (isObject(schema.items)) out.items = closed(schema.items)
  if (Array.isArray(schema.anyOf)) out.anyOf = schema.anyOf.map((sub) => (isObject(sub) ? closed(sub) : sub))
  return out
}

/** A value as the card shows it: text in single quotes, anything else as its JSON. */
const shown = (value: Json): string => (typeof value === 'string' ? `'${value}'` : JSON.stringify(value))

const sentence = (text: string): string => `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`

function describeField(name: string, spec: FieldSpec): string | undefined {
  const label = spec.label ?? name
  if (spec.label === undefined && spec.unit === undefined) return undefined
  return spec.unit === undefined ? `${sentence(label)}.` : `${sentence(label)}, in ${spec.unit}.`
}

/** Whether the value is the word that removes the field. */
const clearing = (spec: FieldSpec, value: Json): boolean => spec.clear !== undefined && equal(spec.clear, value)

/** What the components hold for a field: the whole component, or the key of it. */
function heldBy(components: Components | undefined, spec: FieldSpec): Json | undefined {
  const held = components === undefined ? undefined : own(components, spec.component)
  return spec.key === undefined ? held : isObject(held) ? own(held, spec.key) : undefined
}

/**
 * Refuses a table that cannot be one source: no field, a field named __proto__, a field with no place to live or no
 * schema, a clear word its own schema accepts, or two fields writing the same place.
 */
function checkTable(kind: string, table: FieldTable): string[] {
  const names = Object.keys(table)
  if (names.length === 0) throw new Error(`the field table of '${kind}' holds no field`)
  for (const name of names) {
    const spec = table[name]!
    if (name === PROTO_KEY) throw new Error(`a field of '${kind}' is named ${PROTO_KEY}, which stored content cannot hold as a name`)
    if (typeof spec.component !== 'string' || spec.component === '' || (spec.key !== undefined && (typeof spec.key !== 'string' || spec.key === ''))) {
      throw new Error(`the field '${name}' of '${kind}' needs a component, and a key that is text when it has one`)
    }
    if (!isObject(spec.schema)) throw new Error(`the field '${name}' of '${kind}' needs a schema, an object of the subset schema.ts reads`)
    if (spec.clear !== undefined && checkShape(spec.schema, spec.clear, () => true).length === 0) {
      throw new Error(`the clear word of the field '${name}' of '${kind}' is a value its schema accepts, so that value could never be stored; give a word the schema refuses`)
    }
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = table[names[i]!]!
      const b = table[names[j]!]!
      if (a.component === b.component && (a.key === undefined || b.key === undefined || a.key === b.key)) {
        throw new Error(`the fields '${names[i]}' and '${names[j]}' of '${kind}' both write ${a.component}${a.key === undefined || b.key === undefined ? '' : `.${a.key}`}`)
      }
    }
  }
  return names
}

/** The verb `<kind>.update`, with its input schema, its checks and its card line all read from the table. */
export function updateVerb(kind: string, table: FieldTable, options: UpdateOptions = {}): Verb<UpdateInput> {
  const fields = checkTable(kind, table)
  const properties: { [field: string]: Schema } = {}
  for (const name of fields) {
    const spec = table[name]!
    const lead = spec.schema.description === undefined ? describeField(name, spec) : undefined
    const shaped = spec.freeForm === true ? spec.schema : closed(spec.schema)
    if (spec.clear === undefined) {
      properties[name] = lead === undefined ? shaped : { ...shaped, description: lead }
    } else {
      const given = spec.schema.description ?? lead
      properties[name] = {
        anyOf: [shaped, spec.clear === null ? { type: 'null' } : { enum: [spec.clear] }],
        description: `${given === undefined ? '' : `${given} `}Give ${shown(spec.clear)} to clear it.`,
      }
    }
  }
  const input: Schema = {
    type: 'object',
    properties: {
      id: { type: 'string', 'x-ref': kind },
      set: { type: 'object', properties, additionalProperties: false, description: 'The fields to change, each with its new value.' },
    },
    required: ['id', 'set'],
    additionalProperties: false,
  }
  /** The fields a call names, in the order of the table, so the records do not depend on the order the caller wrote them in. */
  const named = (set: { readonly [field: string]: Json }): string[] => fields.filter((f) => own(set, f) !== undefined)
  /** The value of each field of the table that the components hold. */
  const values = (components: Components | undefined): { [field: string]: Json } => {
    const out: { [field: string]: Json } = {}
    for (const f of fields) {
      const held = heldBy(components, table[f]!)
      if (held !== undefined) out[f] = held
    }
    return out
  }
  return {
    name: `${kind}.update`,
    target: kind,
    input,
    ...(options.actors === undefined ? {} : { actors: options.actors }),
    validate: (reader, call) => {
      const names = named(call.set)
      if (names.length === 0) return [{ kind, id: call.id, field: '/set', message: `name at least one field of ${kind} ${call.id} to set` }]
      const issues: Issue[] = []
      for (const name of names) {
        const spec = table[name]!
        const value = own(call.set, name)!
        if (clearing(spec, value)) continue
        const message = spec.check?.(value, reader, call.id)
        if (message !== undefined) {
          issues.push({ kind, id: call.id, field: `/set/${name}`, message })
        } else if (spec.store !== undefined) {
          try {
            spec.store(value)
          } catch (e) {
            if (!(e instanceof StoreRefusal)) throw e
            issues.push({ kind, id: call.id, field: `/set/${name}${e.at}`, message: e.message })
          }
        }
      }
      if (issues.length === 0 && options.check !== undefined) {
        const before = values(reader.get(kind, call.id))
        const after: { [field: string]: Json } = { ...before }
        const set: { [field: string]: Json } = {}
        for (const name of names) {
          const spec = table[name]!
          const value = own(call.set, name)!
          set[name] = value
          if (clearing(spec, value)) delete after[name]
          else after[name] = spec.store === undefined ? value : spec.store(value)
        }
        for (const found of options.check({ id: call.id, set, before, after, reader })) {
          if (found.field !== undefined && !fields.includes(found.field)) {
            issues.push({ kind, id: call.id, field: '/set', message: `the rule of ${kind}.update named '${found.field}', which is not a field of ${kind}: ${found.message}` })
          } else {
            issues.push({ kind, id: call.id, field: found.field === undefined ? '/set' : `/set/${found.field}`, message: found.message })
          }
        }
      }
      return issues
    },
    apply: (draft, call) => {
      for (const name of named(call.set)) {
        const spec = table[name]!
        const value = own(call.set, name)!
        if (clearing(spec, value)) {
          if (spec.key === undefined) {
            draft.set(kind, call.id, spec.component, undefined)
            continue
          }
          // a key of a component the entity does not hold is already absent; the last key of one takes the component with it
          const holder = own(draft.get(kind, call.id) ?? {}, spec.component)
          if (!isObject(holder)) continue
          if (own(holder, spec.key) !== undefined && Object.keys(holder).length === 1) draft.set(kind, call.id, spec.component, undefined)
          else draft.setField(kind, call.id, spec.component, spec.key, undefined)
          continue
        }
        const held = spec.store === undefined ? value : spec.store(value)
        if (spec.key === undefined) draft.set(kind, call.id, spec.component, held)
        else draft.setField(kind, call.id, spec.component, spec.key, held)
      }
    },
    describe: (call) => {
      const sets: string[] = []
      const clears: string[] = []
      for (const name of named(call.set)) {
        const spec = table[name]!
        const value = own(call.set, name)!
        if (clearing(spec, value)) clears.push(spec.label ?? name)
        else sets.push(`${spec.label ?? name} to ${shown(value)}${spec.unit === undefined ? '' : ` ${spec.unit}`}`)
      }
      const parts = [sets.length === 0 ? '' : `set ${sets.join(', ')}`, clears.length === 0 ? '' : `clear ${clears.join(', ')}`].filter((p) => p !== '')
      return `${sentence(parts.join(' and '))} on ${kind} ${call.id}`
    },
  }
}
