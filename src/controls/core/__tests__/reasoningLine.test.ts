import { describe, expect, it } from 'vitest'
import { reasoningLine } from '../activity'

/* The line the activity shows for the reasoning so far. It is the first sentence of the paragraph the
 * reasoning is on: it changes when a new paragraph starts, not as the same paragraph grows past its
 * first sentence. */
describe('reasoningLine', () => {
  it('is the first sentence of the last paragraph that has text', () => {
    expect(reasoningLine('One. Two.')).toBe('One.')
    expect(reasoningLine('A one.\n\nB two. More')).toBe('B two.')
  })

  it('is the whole paragraph when no sentence has ended yet', () => {
    expect(reasoningLine('Weighing the two readings')).toBe('Weighing the two readings')
  })

  it('holds while the same paragraph grows past its first sentence', () => {
    const first = reasoningLine('Done. Then more')
    expect(first).toBe('Done.')
    expect(reasoningLine('Done. Then more text here and more.')).toBe(first)
  })

  it('shows what there is of an unfinished first sentence, as it grows', () => {
    expect(reasoningLine('Weigh')).toBe('Weigh')
    expect(reasoningLine('Weighing the two')).toBe('Weighing the two')
  })

  it('does not end a sentence at a decimal point, and ends one at a question mark', () => {
    expect(reasoningLine('Load 3.1 mm applies. Next.')).toBe('Load 3.1 mm applies.')
    expect(reasoningLine('Why? Because.')).toBe('Why?')
  })

  it('flattens line breaks and runs of spaces into single spaces', () => {
    expect(reasoningLine('A\n   b.  C')).toBe('A b.')
  })

  it('keeps the last line when a blank break opens a paragraph that has no text yet', () => {
    expect(reasoningLine('One.\n\n')).toBe('One.')
    expect(reasoningLine('One.\n\n   \n')).toBe('One.')
  })

  it('negative arm: nothing, or only blanks, gives no line', () => {
    expect(reasoningLine('')).toBe('')
    expect(reasoningLine('   \n\n  ')).toBe('')
  })
})
