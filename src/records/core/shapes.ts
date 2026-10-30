// What a person is told when text cannot be a field's value: an example of the value the field's schema takes, and the
// line that asks for it. A number is 1, a list holds its least count of entries, an object the fields it requires.
import type { Json, Schema } from '../../verbs'

const isSchema = (s: unknown): s is Schema => typeof s === 'object' && s !== null && !Array.isArray(s)

/** A value of the shape a schema takes, for a person to see how to write one: numbers are 1, a list has its least count of items. */
export function exampleOf(schema: Schema): Json {
  if (Array.isArray(schema.anyOf)) return exampleOf(schema.anyOf.filter(isSchema).find((s) => s.type !== 'null') ?? {})
  if (Array.isArray(schema.enum)) return schema.enum[0] as Json
  switch (schema.type) {
    case 'array': {
      const count = typeof schema.minItems === 'number' ? schema.minItems : 1
      const items = isSchema(schema.items) ? exampleOf(schema.items) : null
      return Array.from({ length: count }, () => items)
    }
    case 'object': {
      const props = isSchema(schema.properties) ? (schema.properties as { [k: string]: Schema }) : {}
      const required = Array.isArray(schema.required) ? (schema.required as string[]) : Object.keys(props)
      return Object.fromEntries(required.filter((k) => k in props).map((k) => [k, exampleOf(props[k]!)]))
    }
    case 'number':
      return 1
    case 'boolean':
      return true
    case 'string':
      return typeof schema['x-ref'] === 'string' ? 'id' : 'text'
    default:
      return null
  }
}

/** The line for text that cannot be the number, list or object a schema takes, with an example; undefined where it can. */
export function shapeLine(schema: Schema, text: string): string | undefined {
  const value = Array.isArray(schema.anyOf) ? (schema.anyOf.filter(isSchema).find((s) => s.type !== 'null') ?? schema) : schema
  const example = JSON.stringify(exampleOf(value))
  if (value.type === 'number') return Number.isFinite(Number(text)) ? undefined : `Write a number, such as ${example}`
  if (value.type !== 'array' && value.type !== 'object') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = undefined
  }
  const right = value.type === 'array' ? Array.isArray(parsed) : typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
  if (right) return undefined
  if (value.type === 'array') return `Write a list, such as ${example}`
  // An object that names no keys has no example to follow, so the line says what an object looks like.
  return Object.keys(exampleOf(value) as object).length === 0 ? 'Write an object between braces, with a name and a value for each entry' : `Write an object, such as ${example}`
}
