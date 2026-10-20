import { describe, expect, it } from 'vitest'
import { ReferenceIndex } from '../index'
import { numeralGate } from '../../../controls/core/refs'

/* The index is where an app admits the designations its answer may write bare. A designation of several
 * words goes in as written, and the gate reads it whole. */
describe('ReferenceIndex admits a designation as one phrase', () => {
  it('collapses the whitespace of an admitted identifier, and admits no empty one', () => {
    const index = new ReferenceIndex()
    index.admit(['Table\n3.1', '  EN   1993  ', ''])
    expect([...index.admitted].sort()).toEqual(['EN 1993', 'Table 3.1'])
  })

  it('the gate passes the phrase the index admits, and still flags the same digits elsewhere', () => {
    const index = new ReferenceIndex()
    index.admit(['Table 3.1'])
    const holds = (ref: string) => index.holds(ref)
    expect(numeralGate('See Table 3.1 here', index.admitted, holds)).toEqual([])
    expect(numeralGate('See 3.1 here', index.admitted, holds).map((v) => v.kind)).toEqual(['bare_numeral'])
  })

  it('negative arm: an index that admits nothing flags the phrase digits', () => {
    const index = new ReferenceIndex()
    expect(numeralGate('See Table 3.1 here', index.admitted, (ref) => index.holds(ref)).map((v) => v.kind)).toEqual([
      'bare_numeral',
    ])
  })
})
