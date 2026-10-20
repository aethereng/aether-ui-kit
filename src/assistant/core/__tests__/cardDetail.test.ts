import { describe, expect, it } from 'vitest'
import { cardDetail, DETAIL_CAP, NUMBER_WITHHELD, NUMERAL_WITHHELD, withholdBare } from '../cardDetail'

describe('K6: the digit walker on a tool card', () => {
  it('shows a number with no reference as withheld', () => {
    const shown = cardDetail({ count: 5 })
    expect(shown).toContain(NUMBER_WITHHELD)
    expect(shown).not.toContain('5')
  })

  it('shows a value that carries a reference as that reference', () => {
    const shown = cardDetail({ value: { ref: '{{m1:n}}', value: 5 } })
    expect(shown).toContain('{{m1:n}}')
    expect(shown).not.toContain(NUMBER_WITHHELD)
    expect(shown).not.toContain('"value": 5')
  })

  it('withholds a numeral inside a text and keeps an admitted identifier', () => {
    const shown = cardDetail({ text: 'Beam 12 at J12' }, ['J12'])
    expect(shown).toContain(`"Beam ${NUMERAL_WITHHELD} at J12"`)
  })

  it('leaves a field name holding a digit as it is', () => {
    const shown = cardDetail({ v2: { ref: '{{m1:x}}', value: 1 } })
    expect(shown).toContain('"v2"')
    expect(shown).not.toContain(NUMBER_WITHHELD)
  })

  it('leaves a text with no digit exactly as it was', () => {
    expect(cardDetail({ text: 'no digits here' })).toBe(JSON.stringify({ text: 'no digits here' }, null, 2))
  })

  it('cuts a long detail at the cap and leaves a short one whole', () => {
    const long = cardDetail({ text: 'x'.repeat(DETAIL_CAP) })
    expect(long.length).toBeLessThan(DETAIL_CAP + 100)
    expect(long.endsWith('(cut short: the rest is not shown)')).toBe(true)
    expect(cardDetail({ text: 'short' })).toBe(JSON.stringify({ text: 'short' }, null, 2))
  })

  it('withholds a bare numeral and leaves the rest of the text', () => {
    expect(withholdBare('Set 3 supports and J12', ['J12'])).toBe(`Set ${NUMERAL_WITHHELD} supports and J12`)
  })
})
