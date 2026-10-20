import { describe, expect, it } from 'vitest'
import { ReferenceIndex } from '../index'
import { DEFAULT_REFERENCE_SCOPES, numeralGate, type ReferenceScopes } from '../../../controls/core/refs'

const SOURCE = { kind: 'model' as const, id: 'm1', hash: 'abcdef0123' }
const SECOND_LIST: ReferenceScopes = { indexed: ['m', 'p', 'r', 'v', 'f'], bare: ['c', 'g'] }

describe('the reference index (2.7)', () => {
  it('mints a reference as written, holds it, and keeps its value', () => {
    const ri = new ReferenceIndex()
    const ref = ri.mint('m1', 'members.count', 1, null, SOURCE, 'read_model')
    expect(ref).toBe('{{m1:members.count}}')
    expect(ri.holds(ref)).toBe(true)
    expect(ri.index.get(ref)?.value).toBe(1)
  })

  it('replaces the entry when the same reference is minted again', () => {
    const ri = new ReferenceIndex()
    ri.mint('m1', 'members.count', 1, null, SOURCE, 'read_model')
    ri.mint('m1', 'members.count', 1, null, SOURCE, 'read_model')
    expect(ri.index.size).toBe(1)
  })

  it('refuses a path the grammar would not read back as one reference', () => {
    const ri = new ReferenceIndex()
    expect(() => ri.mint('m1', 'a b', 1, null, SOURCE, 'read_model')).toThrow(RangeError)
    expect(() => ri.mint('m1', 'a}b', 1, null, SOURCE, 'read_model')).toThrow(RangeError)
    expect(ri.index.size).toBe(0)
  })

  it('refuses a scope the list does not hold, and mints it under a list that does', () => {
    const ri = new ReferenceIndex(DEFAULT_REFERENCE_SCOPES)
    expect(() => ri.mint('v1', 'summary.checked', 4, null, { kind: 'run', id: 'v1', hash: 'x' }, 'read_verification')).toThrow(RangeError)
    const etere = new ReferenceIndex(SECOND_LIST)
    expect(etere.mint('v1', 'summary.checked', 4, null, { kind: 'run', id: 'v1', hash: 'x' }, 'read_verification')).toBe('{{v1:summary.checked}}')
  })

  it('admits identifiers for the gate, and clears both maps', () => {
    const ri = new ReferenceIndex()
    ri.admit(['J12', 'M3'])
    expect(numeralGate('The joint J12 and M3 hold', [...ri.admitted], () => false)).toEqual([])
    ri.mint('m1', 'members.count', 1, null, SOURCE, 'read_model')
    ri.clear()
    expect(ri.admitted.size).toBe(0)
    expect(ri.index.size).toBe(0)
  })
})
