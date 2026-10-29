// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRegistry, createStore, type Schema } from '..'
import { toyRegistry } from './toy'

const noop = { apply: () => {}, describe: () => '' }
const empty = { type: 'object', properties: {}, additionalProperties: false }

describe('registering a vocabulary', () => {
  it('refuses a kind registered twice', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    expect(() => r.kind('box', { prefix: 'x' })).toThrow(/registered twice/)
  })
  it('refuses two kinds that share a prefix in one id space, and accepts the same prefix in another', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b', group: 'stock' })
    expect(() => r.kind('crate', { prefix: 'b', group: 'stock' })).toThrow(/share the prefix/)
    expect(() => r.kind('label', { prefix: 'b' })).not.toThrow()
  })
  it('refuses a kind name or prefix with a reserved character', () => {
    const r = createRegistry()
    expect(() => r.kind('a.b', { prefix: 'a' })).toThrow(/reserved/)
    expect(() => r.kind('ab', { prefix: '#' })).toThrow(/reserved/)
  })
  it('refuses a prefix that holds a dot, which an id may hold, and takes the same prefix without it', () => {
    const r = createRegistry()
    expect(() => r.kind('beam', { prefix: 'C15x33.9' })).toThrow(/reserved/)
    expect(r.kinds.has('beam')).toBe(false)
    r.kind('beam', { prefix: 'C15x33' })
    expect(r.kinds.get('beam')?.prefix).toBe('C15x33')
  })
  it('refuses a verb that targets a kind nobody registered', () => {
    const r = createRegistry()
    expect(() => r.verb({ name: 'box.create', target: 'box', input: empty, ...noop })).toThrow(/not registered/)
  })
  it("refuses a verb not named '<target>.<action>', and the names undo and redo", () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    expect(() => r.verb({ name: 'create', target: 'box', input: empty, ...noop })).toThrow(/not named 'box\.<action>'/)
    expect(() => r.verb({ name: 'box.', target: 'box', input: empty, ...noop })).toThrow(/not named/)
    expect(() => r.verb({ name: 'undo', target: 'box', input: empty, ...noop })).toThrow(/reserved/)
  })
  it('refuses a verb whose schema uses a keyword the checker does not read, and takes one that does not', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    expect(() => r.verb({ name: 'box.a', target: 'box', input: { type: 'object', properties: { s: { type: 'string', pattern: 'x' } } }, ...noop })).toThrow('/s: pattern = "x"')
    expect(() => r.verb({ name: 'box.b', target: 'box', input: empty, ...noop })).not.toThrow()
  })
  it('refuses a verb whose schema gives a keyword it reads a value of another form, naming both', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    const open = { type: 'object', properties: { n: { type: ['string', 'null'] } }, additionalProperties: { type: 'number' } }
    expect(() => r.verb({ name: 'box.a', target: 'box', input: open, ...noop })).toThrow('additionalProperties = {"type":"number"}')
    expect(() => r.verb({ name: 'box.a', target: 'box', input: open, ...noop })).toThrow('/n: type = ["string","null"]')
    expect(() => r.verb({ name: 'box.b', target: 'box', input: { type: 'object', properties: { n: { type: 'string' } }, additionalProperties: false }, ...noop })).not.toThrow()
  })
  it('refuses a verb whose schema puts a keyword beside an anyOf, naming it, and takes the same keyword inside each alternative', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    const beside = { type: 'object', properties: { v: { enum: ['a', 'b'], anyOf: [{ type: 'string' }] } }, required: ['v'] }
    expect(() => r.verb({ name: 'box.a', target: 'box', input: beside, ...noop })).toThrow('/v: enum = ["a","b"] sits beside an anyOf')
    const inside: Schema = { type: 'object', properties: { v: { title: 'V', anyOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }] } }, required: ['v'] }
    expect(() => r.verb({ name: 'box.b', target: 'box', input: inside, ...noop })).not.toThrow()
  })
  it('refuses a verb whose x-ref has no string type beside it, and a schema key given with no value, each by name', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    const bare = { type: 'object', properties: { id: { 'x-ref': 'box' } } }
    expect(() => r.verb({ name: 'box.a', target: 'box', input: bare, ...noop })).toThrow('/id: x-ref = "box" needs type = "string"')
    const hollow = { type: 'object', description: undefined } as never
    expect(() => r.verb({ name: 'box.b', target: 'box', input: hollow, ...noop })).toThrow(': description = undefined')
  })
  it('refuses a verb whose x-ref names a kind nobody registered, and takes one that is registered', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    const ref = (kind: string) => ({ type: 'object', properties: { id: { type: 'string', 'x-ref': kind } }, required: ['id'] })
    expect(() => r.verb({ name: 'box.a', target: 'box', input: ref('boxx'), ...noop })).toThrow("x-ref to the kind 'boxx'")
    expect(() => r.verb({ name: 'box.a', target: 'box', input: { type: 'array', items: ref('boxx') }, ...noop })).toThrow("x-ref to the kind 'boxx'")
    expect(() => r.verb({ name: 'box.b', target: 'box', input: ref('box'), ...noop })).not.toThrow()
  })
  it('refuses a group with a reserved character, and a relation to a kind the vocabulary does not hold when a store is made', () => {
    const r = createRegistry()
    expect(() => r.kind('box', { prefix: 'b', group: 'a.b' })).toThrow(/reserved/)
    expect(() => r.kind('box', { prefix: 'b', group: 'stock' })).not.toThrow()
    r.kind('label', { prefix: 'l', relations: { On: 'boxx' } })
    expect(() => createStore(r)).toThrow("relates 'On' to 'boxx'")
    const ok = createRegistry()
    ok.kind('box', { prefix: 'b' })
    ok.kind('label', { prefix: 'l', relations: { On: 'box' } })
    expect(() => createStore(ok)).not.toThrow()
  })
  it('refuses a verb or a system registered twice', () => {
    const r = createRegistry()
    r.kind('box', { prefix: 'b' })
    r.verb({ name: 'box.a', target: 'box', input: empty, ...noop })
    expect(() => r.verb({ name: 'box.a', target: 'box', input: empty, ...noop })).toThrow(/registered twice/)
    r.system({ name: 's', on: {}, run: () => {} })
    expect(() => r.system({ name: 's', on: {}, run: () => {} })).toThrow(/registered twice/)
  })
})

describe('the call schema generated from the registry', () => {
  const variants = (schema: { properties: { items: { items: { anyOf: Array<{ properties: { verb: { enum: string[] } } }> } } } }): string[] =>
    schema.properties.items.items.anyOf.map((v) => v.properties.verb.enum[0]!)
  it('offers the person every verb the registry holds', () => {
    const r = toyRegistry()
    expect(variants(r.proposalSchema('person') as never).sort()).toEqual([...r.verbs.keys()].sort())
  })
  it('leaves out a verb the actor may not call', () => {
    const r = toyRegistry()
    expect(variants(r.proposalSchema('script') as never)).not.toContain('label.delete')
    expect(variants(r.proposalSchema('person') as never)).toContain('label.delete')
  })
  it('takes a handle where a verb names an entity, and an id for a minted entity from no one', () => {
    const r = toyRegistry()
    const text = JSON.stringify(r.proposalSchema('script'))
    expect(text).toContain('"handle"')
    type Variant = { properties: { verb: { enum: string[] }; input: { properties: Record<string, unknown> } } }
    const schema = r.proposalSchema('script') as unknown as { properties: { items: { items: { anyOf: Variant[] } } } }
    const create = schema.properties.items.items.anyOf.find((v) => v.properties.verb.enum[0] === 'box.create')
    expect(Object.keys(create!.properties.input.properties)).toEqual(['name', 'w', 'h'])
  })
  it('generates the read schema from the read verbs', () => {
    const r = toyRegistry()
    const names = (r.readSchema() as unknown as { anyOf: Array<{ properties: { verb: { enum: string[] } } }> }).anyOf.map((v) => v.properties.verb.enum[0])
    expect(names.sort()).toEqual(['entity.get', 'entity.list', 'entity.refs', 'model.read'])
  })
})
