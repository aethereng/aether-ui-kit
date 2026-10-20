import { describe, expect, it } from 'vitest'
import { fixedLine, proposalLine, termsLine } from '../texts'

// The first consumer's lines, copied byte for byte from its public text module.
const FIRST_FIXED =
  'Words by the assistant. A number with a source tag is shown by the viewer from the source its tag names; a number without one was typed by the assistant. The assistant signs nothing. Not attested or warranted by Aether Engineering.'
const FIRST_PROPOSAL = 'Nothing is loaded until you accept.'
const FIRST_TERMS =
  "The assistant's text is not Aether Engineering's statement. It is neither attested nor warranted and carries no mark. The record file is yours."

// The second consumer's lines, as the assistant panel definition prints them in its section 3.2.
const SECOND_FIXED =
  'Words by the assistant. A number or a verdict with a source tag is shown by the editor from the source its tag names; one without a tag was typed by the assistant. The assistant signs nothing. Not attested or warranted by Aether Engineering.'
const SECOND_PROPOSAL = 'Nothing is changed until you accept.'
const SECOND_TERMS =
  "The assistant's text is not Aether Engineering's statement. It is neither attested nor warranted and carries no mark."

describe('the shared public texts (2.10)', () => {
  it('reproduces the first consumer’s fixed line byte for byte', () => {
    expect(fixedLine('viewer', 'a number', 'a number without one')).toBe(FIRST_FIXED)
    expect(fixedLine('viewer', 'a number')).toBe(FIRST_FIXED)
  })

  it('reproduces the second consumer’s fixed line as the definition prints it', () => {
    expect(fixedLine('editor', 'a number or a verdict', 'one without a tag')).toBe(SECOND_FIXED)
  })

  it('SEEDED: a different noun or subject is not the first line', () => {
    expect(fixedLine('editor', 'a number')).not.toBe(FIRST_FIXED)
    expect(fixedLine('viewer', 'a number or a verdict', 'one without a tag')).not.toBe(SECOND_FIXED)
  })

  it('reproduces each consumer’s proposal line', () => {
    expect(proposalLine('loaded')).toBe(FIRST_PROPOSAL)
    expect(proposalLine('changed')).toBe(SECOND_PROPOSAL)
    expect(proposalLine('changed')).not.toBe(FIRST_PROPOSAL)
  })

  it('ends the terms line with the record sentence only when the app keeps a record', () => {
    expect(termsLine({ record: true })).toBe(FIRST_TERMS)
    expect(termsLine({ record: false })).toBe(SECOND_TERMS)
    expect(termsLine({ record: false })).not.toContain('The record file is yours.')
  })
})
