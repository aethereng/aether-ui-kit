// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonical, equal, sha256, type Json } from '..'
import { frozenCopy, plainCopy, protoKey } from '../json'

describe('sha256', () => {
  // the lengths either side of a block boundary, where the padding changes shape
  const inputs: Array<[string, string]> = [
    ['empty', ''],
    ['abc', 'abc'],
    ['55 bytes', 'a'.repeat(55)],
    ['56 bytes', 'a'.repeat(56)],
    ['64 bytes', 'b'.repeat(64)],
    ['multi-byte text', 'Träger 12 mm, 梁'],
    ['1000 bytes', 'xyz'.repeat(334).slice(0, 1000)],
  ]
  it.each(inputs)('agrees with the platform hash on %s', (_name, text) => {
    expect(sha256(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'))
  })
})

describe('canonical', () => {
  it('writes the same text whatever the key order', () => {
    expect(canonical({ b: 1, a: { d: [1, 2], c: null } })).toBe(canonical({ a: { c: null, d: [1, 2] }, b: 1 }))
  })
  it('keeps null and absent apart', () => {
    expect(canonical({ a: null })).not.toBe(canonical({}))
    expect(canonical({ a: undefined as unknown as null })).toBe(canonical({}))
  })
  it('refuses a number that is not finite', () => {
    expect(() => canonical(Number.NaN)).toThrow(/not finite/)
  })
})

describe('equal', () => {
  it('compares deeply', () => {
    expect(equal({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
  })
  it('keeps null, absent and an empty object apart', () => {
    expect(equal(null, undefined)).toBe(false)
    expect(equal({}, null)).toBe(false)
    expect(equal(undefined, undefined)).toBe(true)
  })
  it('sees order in an array and a different value', () => {
    expect(equal([1, 2], [2, 1])).toBe(false)
    expect(equal({ a: 1 }, { a: 2 })).toBe(false)
  })
})

describe('a key named __proto__', () => {
  // parsed from text, so the key is a key of the object, as it is in a saved file
  const parsed = (): Json => JSON.parse('{"Name":"x","__proto__":{"Dims":{"w":1,"h":2}},"Deep":{"list":[{"__proto__":1}]}}')
  it.each<[string, <T extends Json>(v: T) => T]>([
    ['frozenCopy', frozenCopy],
    ['plainCopy', plainCopy],
  ])('is copied by %s as a key, and the copy inherits nothing from it', (_name, copy) => {
    const out = copy(parsed()) as { [k: string]: unknown }
    expect(Object.keys(out)).toEqual(['Name', '__proto__', 'Deep'])
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect(out.Dims).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toEqual({ Dims: { w: 1, h: 2 } })
  })
  it('is read by the hash and by equality from the copy as from the original', () => {
    expect(canonical(parsed())).toContain('"__proto__"')
    expect(canonical(frozenCopy(parsed()))).toBe(canonical(parsed()))
    expect(equal(plainCopy(parsed()), parsed())).toBe(true)
  })
  it('is found at any depth by its pointer, and text that only reads __proto__ is no key', () => {
    expect(protoKey(parsed())).toBe('/__proto__')
    expect(protoKey(JSON.parse('{"a":[{"b":{"__proto__":0}}]}'))).toBe('/a/0/b/__proto__')
    expect(protoKey({ a: '__proto__', b: ['__proto__'] })).toBeNull()
    expect(protoKey(5)).toBeNull()
  })
})
