import { describe, expect, it } from 'vitest'
import { findBareNumerals, numeralGate } from '../refs'

const NL = String.fromCharCode(10)

/* The text of each bare numeral the finder reports, in order: what the reader would see flagged. */
const found = (text: string, admitted: string[]) => findBareNumerals(text, admitted).map((s) => text.slice(s.start, s.end))

describe('an identifier of several words is read as one phrase', () => {
  it('passes its digits where the whole phrase stands', () => {
    expect(found('See Table 3.1 here', ['Table 3.1'])).toEqual([])
  })

  it('negative arm: the digits alone are still a violation', () => {
    expect(found('See 3.1 here', ['Table 3.1'])).toEqual(['3.1'])
  })

  it('flags a bare 3.1 elsewhere while the phrase passes', () => {
    expect(found('See Table 3.1 and 3.1 here', ['Table 3.1'])).toEqual(['3.1'])
  })

  it('passes a phrase whose words are split by a line break', () => {
    expect(found('See Table' + NL + '3.1 here', ['Table 3.1'])).toEqual([])
  })

  it('passes a phrase that ends a sentence, or sits in brackets', () => {
    expect(found('See Table 3.1.', ['Table 3.1'])).toEqual([])
    expect(found('(Table 3.1)', ['Table 3.1'])).toEqual([])
  })

  it('negative arm: a phrase glued to a letter is not found, and its digits are read as before', () => {
    expect(found('XTable 3.1 here', ['Table 3.1'])).toEqual(['3.1'])
  })

  it('negative arm: a phrase cut by a reference is not read across it', () => {
    expect(found('Table {{r1:x}} 3.1 here', ['Table 3.1'])).toEqual(['3.1'])
  })

  it('negative arm: a bold marker is not an edge, so the phrase under bold is not found', () => {
    expect(found('**Table 3.1**', ['Table 3.1'])).toEqual(['3.1**'])
  })

  it('reads a phrase that is a prefix of a longer one only as far as its own words', () => {
    expect(found('EN 1993-1-1 here', ['EN 1993'])).toEqual(['1993-1-1'])
  })

  it('passes both forms when both are admitted, each as written', () => {
    expect(found('EN 1993-1-1 and EN 1993 here', ['EN 1993', 'EN 1993-1-1'])).toEqual([])
  })

  it('a shorter phrase leaves the rest of a longer run flagged', () => {
    expect(found('EN 1993 1-1 here', ['EN 1993'])).toEqual(['1-1'])
  })

  it('passes a designation of three tokens whole, and flags its parts without it', () => {
    expect(found('Use A572 Gr 50 steel', ['A572 Gr 50'])).toEqual([])
    expect(found('Use A572 Gr 50 steel', [])).toEqual(['A572', '50'])
  })

  it('matches the words of a phrase literally, whatever pattern characters they hold', () => {
    expect(found('Table 3.1 (rev) here', ['Table 3.1 (rev)'])).toEqual([])
    expect(found('Table 3X1 (rev) here', ['Table 3.1 (rev)'])).toEqual(['3X1'])
  })

  it('leaves a single-token identifier as it was', () => {
    expect(found('See J12 and J13 here', ['J12'])).toEqual(['J13'])
  })

  it('the gate reads a phrase with its references, and still reports the unresolved one', () => {
    const violations = numeralGate('See Table 3.1 and {{r9:x}}', ['Table 3.1'], () => false)
    expect(violations.map((v) => v.kind)).toEqual(['unresolved_reference'])
  })
})
