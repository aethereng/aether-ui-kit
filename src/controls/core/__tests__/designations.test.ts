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

  it('passes a phrase under bold, emphasis or a code span, as the phrase', () => {
    expect(found('**Table 3.1**', ['Table 3.1'])).toEqual([])
    expect(found('_Table 3.1_', ['Table 3.1'])).toEqual([])
    expect(found('`Table 3.1`', ['Table 3.1'])).toEqual([])
  })

  it('negative arm: a phrase under markup that is not admitted flags its digits, and the markup is not in the span', () => {
    expect(found('**Table 3.1**', [])).toEqual(['3.1'])
    expect(found('_Table 3.1_', [])).toEqual(['3.1'])
  })

  it('negative arm: a phrase with a word glued to its markup is not found, so its digits are flagged', () => {
    expect(found('foo_Table 3.1', ['Table 3.1'])).toEqual(['3.1'])
    expect(found('x*Table 3.1', ['Table 3.1'])).toEqual(['3.1'])
    expect(found('Table 3.1_x', ['Table 3.1'])).toEqual(['3.1_x'])
  })

  it('a phrase followed by a possessive, or by markup and punctuation, stands', () => {
    expect(found("Table 3.1's", ['Table 3.1'])).toEqual([])
    expect(found('_Table 3.1_.', ['Table 3.1'])).toEqual([])
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

describe('an identifier written in markup reads as the identifier', () => {
  it('passes a single-token identifier in a code span, bold, emphasis, underscores or brackets', () => {
    expect(found('`J12`', ['J12'])).toEqual([])
    expect(found('**J12**', ['J12'])).toEqual([])
    expect(found('*J12*', ['J12'])).toEqual([])
    expect(found('_J12_', ['J12'])).toEqual([])
    expect(found('(`J12`)', ['J12'])).toEqual([])
  })

  it('negative arm: the same markup around an identifier that is not admitted flags the identifier', () => {
    expect(found('`J13`', ['J12'])).toEqual(['J13'])
    expect(found('**J13**', ['J12'])).toEqual(['J13'])
    expect(found('_J13_', ['J12'])).toEqual(['J13'])
  })

  it('an identifier admitted as written passes, even where its own edge is a strip character', () => {
    expect(found('see _v2 here', ['_v2'])).toEqual([])
  })

  it('negative arm: the same identifier not admitted is flagged with the identifier as its span', () => {
    expect(found('see _v2 here', [])).toEqual(['v2'])
  })
})

describe('a list marker is read by the parser\'s rule, quotes included', () => {
  it('a numbered item inside a quote is a list marker, not a numeral', () => {
    expect(found('> 1. x', [])).toEqual([])
  })

  it('negative arm: a numeral that is not a marker is flagged inside a quote too', () => {
    expect(found('> 1.5 x', [])).toEqual(['1.5'])
  })

  it('a marker is read after up to eight quote levels; a ninth `>` makes it text', () => {
    expect(found('>'.repeat(8) + ' 1. x', [])).toEqual([])
    expect(found('>'.repeat(9) + ' 1. x', [])).toEqual(['1'])
  })

  it('a marker of nine digits is a list marker, and ten are text', () => {
    expect(found('123456789. x', [])).toEqual([])
    expect(found('1234567890. x', [])).toEqual(['1234567890'])
  })

  it('negative arm: four spaces of indentation is text, not a marker', () => {
    expect(found('    1. x', [])).toEqual(['1'])
  })

  it('a marker whose line ends with a carriage return and a line break is a marker', () => {
    expect(found('1.' + String.fromCharCode(13) + NL + 'x', [])).toEqual([])
  })

  it('negative arm: a marker glued to a reference is not a marker, so its numeral is flagged', () => {
    expect(found('1.{{m1:x}}', [])).toEqual(['1'])
  })

  it('a `>` that opens the line is the quote marker, so the identifier it touches passes', () => {
    expect(found('>J12', ['J12'])).toEqual([])
    expect(found('>>J12', ['J12'])).toEqual([])
    expect(found('>'.repeat(8) + 'J12', ['J12'])).toEqual([])
  })

  it('a marker glued to a quote is read by the marker rule, so `>1. x` is a list item', () => {
    expect(found('>1. x', [])).toEqual([])
  })

  it('negative arm: a ninth `>` is text, so the token it touches is flagged', () => {
    expect(found('>'.repeat(9) + 'J12', ['J12'])).toEqual(['>J12'])
  })

  it('negative arm: a `>` that does not open the line is text, so the identifier glued to it is flagged', () => {
    expect(found('see >J12 here', ['J12'])).toEqual(['>J12'])
  })
})
