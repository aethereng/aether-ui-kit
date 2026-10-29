// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkShape, resolveRefs, toCallSchema, unreadKeywords, type Json, type Schema } from '..'

const exists = (kind: string, id: string): boolean => kind === 'box' && id === 'b1'
const schema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'string', 'x-ref': 'box' },
    n: { type: 'integer', minimum: 1, maximum: 9 },
    mode: { type: 'string', enum: ['a', 'b'] },
    list: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'number' } },
    either: { anyOf: [{ type: 'string' }, { type: 'boolean' }] },
  },
  required: ['id'],
  additionalProperties: false,
}
const issuesOf = (v: unknown) => checkShape(schema, v as never, exists)

describe('checkShape', () => {
  it('passes an input that fits', () => {
    expect(issuesOf({ id: 'b1', n: 3, mode: 'a', list: [1], either: true })).toEqual([])
  })
  it('names a missing required field', () => {
    expect(issuesOf({ n: 3 })).toEqual([{ field: '/id', message: '/id is missing' }])
  })
  it('names a field the schema does not list', () => {
    expect(issuesOf({ id: 'b1', extra: 1 }).map((i) => i.field)).toEqual(['/extra'])
  })
  it('refuses a wrong type, a fraction where a whole number is due, and a value outside the enum', () => {
    expect(issuesOf({ id: 'b1', n: 'x' })[0]?.field).toBe('/n')
    expect(issuesOf({ id: 'b1', n: 2.5 })[0]?.message).toMatch(/whole number/)
    expect(issuesOf({ id: 'b1', mode: 'c' })[0]?.message).toMatch(/one of "a", "b"/)
  })
  it('refuses a number outside its range and an array outside its length', () => {
    expect(issuesOf({ id: 'b1', n: 10 })[0]?.message).toMatch(/above 9/)
    expect(issuesOf({ id: 'b1', n: 0 })[0]?.message).toMatch(/below 1/)
    expect(issuesOf({ id: 'b1', list: [] })[0]?.message).toMatch(/at least 1/)
    expect(issuesOf({ id: 'b1', list: [1, 2, 3] })[0]?.message).toMatch(/at most 2/)
  })
  it('refuses a reference to an entity that is not there, naming the kind and id', () => {
    expect(issuesOf({ id: 'b9' })).toEqual([{ kind: 'box', id: 'b9', field: '/id', message: "/id names no box 'b9'" }])
  })
  it('takes any of the forms of an anyOf and names the failure when none fits', () => {
    expect(issuesOf({ id: 'b1', either: 'x' })).toEqual([])
    expect(issuesOf({ id: 'b1', either: 3 })[0]?.message).toMatch(/matches none of the allowed forms/)
  })
  it('reports the issues of the one alternative that has the value\'s type, naming the place, and the generic refusal when none or several have it', () => {
    const optionalList: Schema = { anyOf: [{ type: 'array', items: { type: 'string', 'x-ref': 'box' } }, { type: 'null' }] }
    expect(checkShape(optionalList, ['b1', 'b9'], exists)).toEqual([{ kind: 'box', id: 'b9', field: '/1', message: "/1 names no box 'b9'" }])
    expect(checkShape(optionalList, 5, exists)[0]?.message).toMatch(/matches none of the allowed forms/)
    const twoObjects: Schema = { anyOf: [{ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }, { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] }] }
    expect(checkShape(twoObjects, {}, exists)[0]?.message).toMatch(/matches none of the allowed forms/)
    expect(checkShape(optionalList, null, exists)).toEqual([])
  })
  it('does not mistake a number that is not finite for a number', () => {
    expect(issuesOf({ id: 'b1', n: Number.NaN })).not.toEqual([])
  })
  it('does not take a __proto__ key of the input text for a field the schema lists', () => {
    const issues = issuesOf(JSON.parse('{"id":"b1","__proto__":1}'))
    expect(issues.map((i) => i.field)).toEqual(['/__proto__'])
    expect(issuesOf(JSON.parse('{"id":"b1"}'))).toEqual([])
  })
})

describe('unreadKeywords', () => {
  it('finds none in a schema of the readable subset, at any depth', () => {
    expect(unreadKeywords(schema)).toEqual([])
  })
  it('finds none where a title and a description are text, and an array or an enum is as the subset reads it', () => {
    expect(unreadKeywords({ type: 'object', title: 'T', description: 'D', properties: { l: { type: 'array', items: { enum: [1, 'a', null] }, minItems: 0, maxItems: 3 } }, required: [], additionalProperties: false })).toEqual([])
  })
  it('takes a title and a description beside an anyOf, and an x-ref beside the type string', () => {
    expect(unreadKeywords({ title: 'T', description: 'D', anyOf: [{ type: 'string' }, { type: 'null' }] })).toEqual([])
    expect(unreadKeywords({ type: 'string', 'x-ref': 'box', description: 'a box' })).toEqual([])
    expect(unreadKeywords({ anyOf: [{ type: 'string', enum: ['a'] }, { type: 'number', minimum: 1 }] })).toEqual([])
  })
  it('names a keyword the checker does not read, with its value and where it sits', () => {
    expect(unreadKeywords({ type: 'object', properties: { s: { type: 'string', pattern: 'a' } } })).toEqual(['/s: pattern = "a"'])
  })
  it.each<[string, Json, string]>([
    ['additionalProperties as a schema', { type: 'object', additionalProperties: { type: 'number' } }, ': additionalProperties = {"type":"number"}'],
    ['additionalProperties as true', { type: 'object', additionalProperties: true }, ': additionalProperties = true'],
    ['type as a list', { type: 'object', properties: { n: { type: ['string', 'null'] } } }, '/n: type = ["string","null"]'],
    ['type as a name outside the subset', { type: 'text' }, ': type = "text"'],
    ['enum as text', { enum: 'a' }, ': enum = "a"'],
    ['enum as an empty list', { enum: [] }, ': enum = []'],
    ['required as text', { type: 'object', required: 'id' }, ': required = "id"'],
    ['required holding a number', { type: 'object', required: ['id', 3] }, ': required = ["id",3]'],
    ['items as a list of schemas', { type: 'array', items: [{ type: 'string' }] }, ': items = [{"type":"string"}]'],
    ['minimum as text', { type: 'number', minimum: '5' }, ': minimum = "5"'],
    ['maxItems as a fraction', { type: 'array', maxItems: 1.5 }, ': maxItems = 1.5'],
    ['minItems below zero', { type: 'array', minItems: -1 }, ': minItems = -1'],
    ['anyOf as an empty list', { anyOf: [] }, ': anyOf = []'],
    ['anyOf holding text', { anyOf: [{ type: 'string' }, 'x'] }, '/anyOf/1: a schema must be an object, found "x"'],
    ['a property that is not a schema', { type: 'object', properties: { a: true } }, '/a: a schema must be an object, found true'],
    ['properties as a list', { type: 'object', properties: [] }, ': properties = []'],
    ['x-ref as an empty text', { type: 'string', 'x-ref': '' }, ': x-ref = ""'],
    ['description as a number', { type: 'string', description: 4 }, ': description = 4'],
    ['a keyword outside the subset inside an anyOf', { anyOf: [{ type: 'string' }, { type: 'number', multipleOf: 2 }] }, '/anyOf/1: multipleOf = 2'],
    ['a schema that is not an object', 5, ': a schema must be an object, found 5'],
    ['maximum as text', { type: 'number', maximum: '5' }, ': maximum = "5"'],
    ['title as a number', { type: 'string', title: 4 }, ': title = 4'],
    ['minimum as NaN, which JSON would print as null', { type: 'number', minimum: Number.NaN }, ': minimum = NaN'],
    ['maximum as Infinity', { type: 'number', maximum: Number.POSITIVE_INFINITY }, ': maximum = Infinity'],
    ['minimum as minus Infinity', { type: 'number', minimum: Number.NEGATIVE_INFINITY }, ': minimum = -Infinity'],
    ['an enum beside an anyOf', { enum: ['a', 'b'], anyOf: [{ type: 'string' }] }, ': enum = ["a","b"] sits beside an anyOf, which is read alone; put it inside each alternative'],
    ['a type beside an anyOf', { type: 'string', anyOf: [{ enum: ['a'] }] }, ': type = "string" sits beside an anyOf, which is read alone; put it inside each alternative'],
    ['a required list beside an anyOf', { required: ['id'], anyOf: [{ type: 'object' }] }, ': required = ["id"] sits beside an anyOf, which is read alone; put it inside each alternative'],
    ['an x-ref beside an anyOf', { 'x-ref': 'box', anyOf: [{ type: 'string' }] }, ': x-ref = "box" sits beside an anyOf, which is read alone; put it inside each alternative'],
    ['a keyword beside the anyOf of a member', { anyOf: [{ type: 'string' }, { minimum: 1, anyOf: [{ type: 'number' }] }] }, '/anyOf/1: minimum = 1 sits beside an anyOf, which is read alone; put it inside each alternative'],
    ['an x-ref with no type', { 'x-ref': 'box' }, ': x-ref = "box" needs type = "string" beside it'],
    ['an x-ref beside another type', { type: 'object', 'x-ref': 'box' }, ': x-ref = "box" needs type = "string" beside it'],
    ['a key given with no value', { type: 'string', description: undefined } as unknown as Json, ': description = undefined'],
  ])('refuses %s, naming the keyword and its value', (_title, input, expected) => {
    expect(unreadKeywords(input)).toEqual([expected])
  })
})

describe('resolveRefs', () => {
  const refs: Schema = {
    type: 'object',
    properties: {
      id: { type: 'string', 'x-ref': 'box' },
      other: { anyOf: [{ type: 'string', 'x-ref': 'box' }, { type: 'null' }] },
      group: { type: 'array', items: { type: 'string', 'x-ref': 'box' } },
      deep: { type: 'object', properties: { at: { type: 'string', 'x-ref': 'box' } } },
      data: { type: 'object' },
      label: { type: 'string' },
    },
  }
  const ids = (name: string): Json => `id-of-${name}`
  it('replaces a handle where the schema marks a reference, in an anyOf, a list and a property at any depth', () => {
    const value = { id: { handle: 'a' }, other: { handle: 'b' }, group: [{ handle: 'c' }, 'b9'], deep: { at: { handle: 'd' } } }
    expect(resolveRefs(refs, value, ids)).toEqual({ id: 'id-of-a', other: 'id-of-b', group: ['id-of-c', 'b9'], deep: { at: 'id-of-d' } })
  })
  it('copies everything else as it is, a handle-shaped value included, and asks nothing of the lookup for it', () => {
    const asked: string[] = []
    const value = { id: 'b1', other: null, data: { handle: 'x', inner: [{ handle: 'y' }] }, label: { handle: 'z' }, extra: { handle: 'w' } }
    const out = resolveRefs(refs, value, (name) => (asked.push(name), name))
    expect(out).toEqual(value)
    expect(asked).toEqual([])
  })
  it('shares no object with the value it copies', () => {
    const value = { id: 'b1', data: { inner: [1] }, group: ['b2'], extra: { n: 1 } }
    const out = resolveRefs(refs, value, ids) as typeof value
    expect([out === value, out.data === value.data, out.data.inner === value.data.inner, out.group === value.group, out.extra === value.extra]).toEqual([false, false, false, false, false])
  })
})

describe('toCallSchema', () => {
  it('lets an x-ref string also take the handle of an entity made earlier in the proposal', () => {
    const out = toCallSchema(schema) as { properties: { id: { anyOf: Array<{ properties?: { handle: unknown }; type: string }> } } }
    expect(out.properties.id.anyOf).toHaveLength(2)
    expect(out.properties.id.anyOf[1]?.properties?.handle).toBeDefined()
    expect(JSON.stringify(out)).not.toContain('x-ref')
  })
  it('leaves the registered schema as it was', () => {
    const before = JSON.stringify(schema)
    toCallSchema(schema)
    expect(JSON.stringify(schema)).toBe(before)
  })
})
