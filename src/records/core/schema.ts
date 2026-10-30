// The schemas a kind's fields give its verbs. A create's record must give each required field (createSchema); an
// update's set may name any field (fieldsSchema). A null given for an optional field clears it, unless its schema takes
// null as a value: then null is stored.
import type { Json, Schema } from '../../verbs'

/** A kind as its schemas read it: each field's schema, and whether it may be absent. */
export interface FieldTable {
  fields: Readonly<Record<string, { schema: Schema; optional?: true }>>
}

const isSchema = (s: unknown): s is Schema => typeof s === 'object' && s !== null && !Array.isArray(s)

/** Whether a schema takes null as a value: null itself, or one alternative of an anyOf is null. */
export function takesNull(schema: Schema): boolean {
  if (schema.type === 'null') return true
  const alternatives = schema.anyOf
  return Array.isArray(alternatives) && alternatives.some((s) => isSchema(s) && s.type === 'null')
}

/** The alternative of a schema that is not null: the value an optional field holds when it holds one. */
export function valueSchema(schema: Schema): Schema {
  const alternatives = Array.isArray(schema.anyOf) ? schema.anyOf.filter(isSchema) : [schema]
  return alternatives.find((s) => s.type !== 'null') ?? schema
}

/** Whether a null given for the field clears it: the field is optional and its schema does not take null as a value. */
export function clearsField(kind: FieldTable, field: string): boolean {
  const spec = kind.fields[field]
  return spec !== undefined && spec.optional === true && !takesNull(spec.schema)
}

/** Whether a blank is a value of the field: a null clears it, or is stored. */
export function blankTaken(kind: FieldTable, field: string): boolean {
  const spec = kind.fields[field]
  return clearsField(kind, field) || (spec !== undefined && takesNull(spec.schema))
}

/** The object an update's `set` takes: each field, and no other key. A clearable field also takes null, which clears it. */
export function fieldsSchema(kind: FieldTable): Schema {
  const properties: { [name: string]: Json } = {}
  for (const [name, spec] of Object.entries(kind.fields)) {
    properties[name] = spec.optional !== true || takesNull(spec.schema) ? spec.schema : { anyOf: [spec.schema, { type: 'null' }], description: 'Give null to clear it.' }
  }
  return { type: 'object', properties, additionalProperties: false }
}

/** The object a create's `record` takes: the fields of `fieldsSchema`, and each required field must be given. */
export function createSchema(kind: FieldTable): Schema {
  const required = Object.entries(kind.fields)
    .filter(([, spec]) => spec.optional !== true)
    .map(([name]) => name)
  return { ...fieldsSchema(kind), required }
}

/** The record without the fields a null clears: the form a verb stores, which holds no cleared field. */
export function withoutCleared<T extends { readonly [field: string]: unknown }>(kind: FieldTable, record: T): T {
  const out: { [field: string]: unknown } = { ...record }
  for (const [name, value] of Object.entries(record)) if (value === null && clearsField(kind, name)) delete out[name]
  return out as T
}
