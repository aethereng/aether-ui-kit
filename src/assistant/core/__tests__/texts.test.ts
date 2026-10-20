import { describe, expect, it } from 'vitest'
import { fixedLine, proposalLine, termsLine } from '../texts'

// The lines with the noun "viewer", as the kit pins them.
const VIEWER_FIXED =
  'Words by the assistant. A number with a source tag is shown by the viewer from the source its tag names; a number without one was typed by the assistant. The assistant signs nothing. Not attested or warranted by Aether Engineering.'
const VIEWER_PROPOSAL = 'Nothing is loaded until you accept.'
const VIEWER_TERMS =
  "The assistant's text is not Aether Engineering's statement. It is neither attested nor warranted and carries no mark. The record file is yours."

// The lines with the noun "editor", a subject that includes verdicts, and no record.
const EDITOR_FIXED =
  'Words by the assistant. A number or a verdict with a source tag is shown by the editor from the source its tag names; one without a tag was typed by the assistant. The assistant signs nothing. Not attested or warranted by Aether Engineering.'
const EDITOR_PROPOSAL = 'Nothing is changed until you accept.'
const EDITOR_TERMS =
  "The assistant's text is not Aether Engineering's statement. It is neither attested nor warranted and carries no mark."

describe('the shared public texts', () => {
  it('reproduces the viewer fixed line byte for byte, with or without a subject for a number without a tag', () => {
    expect(fixedLine('viewer', 'a number', 'a number without one')).toBe(VIEWER_FIXED)
    expect(fixedLine('viewer', 'a number')).toBe(VIEWER_FIXED)
  })

  it("reproduces the editor fixed line byte for byte, with the subject and the tagless clause as the caller gives them", () => {
    expect(fixedLine('editor', 'a number or a verdict', 'one without a tag')).toBe(EDITOR_FIXED)
  })

  it('does not produce the viewer fixed line for a different noun or subject', () => {
    expect(fixedLine('editor', 'a number')).not.toBe(VIEWER_FIXED)
    expect(fixedLine('viewer', 'a number or a verdict', 'one without a tag')).not.toBe(EDITOR_FIXED)
  })

  it("reproduces each noun's proposal line", () => {
    expect(proposalLine('loaded')).toBe(VIEWER_PROPOSAL)
    expect(proposalLine('changed')).toBe(EDITOR_PROPOSAL)
    expect(proposalLine('changed')).not.toBe(VIEWER_PROPOSAL)
  })

  it('ends the terms line with the record sentence only when the app keeps a record', () => {
    expect(termsLine({ record: true })).toBe(VIEWER_TERMS)
    expect(termsLine({ record: false })).toBe(EDITOR_TERMS)
    expect(termsLine({ record: false })).not.toContain('The record file is yours.')
  })
})
