// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { blankTaken, clearsField, createSchema, fieldsSchema, takesNull, valueSchema, withoutCleared } from '..'
import { PARTS } from './toy'

describe('the schemas a kind gives its verbs', () => {
  it('reads null as a value of a schema that is null, or that offers it as one alternative', () => {
    expect(takesNull({ type: 'null' })).toBe(true)
    expect(takesNull({ anyOf: [{ type: 'number' }, { type: 'null' }] })).toBe(true)
    expect(takesNull({ type: 'number' })).toBe(false)
    expect(takesNull({ anyOf: [{ type: 'number' }, { type: 'string' }] })).toBe(false)
    expect(valueSchema({ anyOf: [{ type: 'null' }, { type: 'number' }] })).toEqual({ type: 'number' })
    expect(valueSchema({ type: 'string' })).toEqual({ type: 'string' })
  })

  it('clears an optional field with a null unless its schema stores null; a required field is never cleared', () => {
    expect(clearsField(PARTS, 'finish')).toBe(true)
    expect(clearsField(PARTS, 'at')).toBe(false)
    expect(clearsField(PARTS, 'size')).toBe(false)
    expect(clearsField(PARTS, 'nothing')).toBe(false)
    expect(blankTaken(PARTS, 'finish')).toBe(true)
    expect(blankTaken(PARTS, 'at')).toBe(true)
    expect(blankTaken(PARTS, 'stock')).toBe(false)
  })

  it("gives an update's set every field and no other, a clearable field also taking null", () => {
    const set = fieldsSchema(PARTS)
    expect(set.additionalProperties).toBe(false)
    const properties = set.properties as Record<string, unknown>
    expect(Object.keys(properties)).toEqual(Object.keys(PARTS.fields))
    expect(properties.size).toEqual({ type: 'number' })
    expect(properties.finish).toEqual({ anyOf: [{ enum: ['raw', 'painted'] }, { type: 'null' }], description: 'Give null to clear it.' })
    expect(properties.at).toEqual(PARTS.fields.at!.schema)
  })

  it("requires of a create's record exactly the fields that are not optional", () => {
    const record = createSchema(PARTS)
    expect(record.required).toEqual(['size', 'stock'])
    expect(record.properties).toEqual(fieldsSchema(PARTS).properties)
  })

  it('stores a record without the fields a null clears, and keeps a null its schema stores', () => {
    const out = withoutCleared(PARTS, { size: 1, finish: null, at: null, made: 'x' })
    expect(out).toEqual({ size: 1, at: null, made: 'x' })
    expect('finish' in out).toBe(false)
  })
})
