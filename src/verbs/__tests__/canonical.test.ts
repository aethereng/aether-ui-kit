// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canonical, createStore, sha256 } from '..'
import { create, person, toyRegistry } from './toy'

/* The canonical text is what every content hash reads, and a saved project holds those hashes, so a project saved
 * before a change to the text would no longer replay after it. These pin the text by its definition: keys in code
 * unit order at every depth, no whitespace, absent keys left out, each value as JSON writes it. */
describe('the canonical text of a value', () => {
  it('lists the keys of an object in code unit order at every depth', () => {
    expect(canonical({ b: 1, a: { d: [true, null], c: 'x' }, B: 2 })).toBe('{"B":2,"a":{"c":"x","d":[true,null]},"b":1}')
  })

  it('keeps the order of a list and leaves out a key whose value is absent', () => {
    expect(canonical([3, 1, { z: undefined as never, y: 0 }])).toBe('[3,1,{"y":0}]')
  })

  it('is the text a store hashes: its entities by kind, a kind with none left out', () => {
    const store = createStore(toyRegistry())
    expect(store.run([create('Alpha', 10, 20)], person)).toMatchObject({ ok: true })
    expect(store.hash()).toBe(sha256('{"box":{"b1":{"Dims":{"h":20,"w":10},"Name":"Alpha"}}}'))
  })
})
