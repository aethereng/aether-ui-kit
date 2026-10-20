import { describe, expect, it } from 'vitest'
import { addTokens, estimateUsd, formatUsd, MODELS, NO_TOKENS, PRICES, PRICES_READ_ON, PRICES_SOURCE, tokensOf, type ModelId, type Tokens } from '../models'

const t = (input: number, output = 0, cacheRead = 0, cacheWrite = 0, cacheWrite1h = 0): Tokens => ({ input, output, cacheRead, cacheWrite, cacheWrite1h })

describe('K4: the price table and the model list', () => {
  it('has a price row for every selectable model and no row for any other', () => {
    expect(Object.keys(PRICES).sort()).toEqual(MODELS.map((m) => m.id).sort())
  })

  it('SEEDED: a row for a model the panel cannot select is caught by the same comparison', () => {
    const seeded: Record<string, unknown> = { ...PRICES, 'claude-unlisted-0-0': PRICES['claude-opus-5-5'] }
    expect(Object.keys(seeded).sort()).not.toEqual(MODELS.map((m) => m.id).sort())
  })

  it('labels the prices with the date they were read and where they came from', () => {
    expect(PRICES_READ_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(PRICES_SOURCE).toContain('pricing page')
  })

  it('prices each count at its own rate, and an hour-long cache write at the hour rate', () => {
    expect(estimateUsd('claude-fable-5-1', t(1e6))).toBeCloseTo(10, 12)
    expect(estimateUsd('claude-fable-5-1', t(0, 1e6))).toBeCloseTo(50, 12)
    expect(estimateUsd('claude-fable-5-1', t(0, 0, 1e6))).toBeCloseTo(0.25, 12)
    expect(estimateUsd('claude-opus-5-5', t(0, 0, 0, 1e6))).toBeCloseTo(5, 12)
    expect(estimateUsd('claude-opus-5-5', t(0, 0, 0, 1e6, 1e6))).toBeCloseTo(8, 12)
  })

  it('applies the Haiku long-prompt row over the threshold, and the base row at it', () => {
    const atThreshold = estimateUsd('claude-haiku-5-5', t(100000, 1e6))
    expect(atThreshold).toBeCloseTo(0.01 + 0.5, 12)
    const over = estimateUsd('claude-haiku-5-5', t(100001, 1e6))
    expect(over).toBeCloseTo((100001 * 0.5) / 1e6 + 2.5, 12)
    expect(over).not.toBeCloseTo((100001 * 0.1) / 1e6 + 0.5, 12)
  })

  it('counts cache reads and writes in the prompt that selects the Haiku row', () => {
    expect(estimateUsd('claude-haiku-5-5', t(50000, 1e6, 50001))).toBeCloseTo(0.025 + 2.5 + (50001 * 0.05) / 1e6, 12)
  })

  it('reads a null count as none', () => {
    expect(tokensOf({ input_tokens: 3, output_tokens: 4, cache_read_input_tokens: null, cache_creation_input_tokens: null, cache_creation: null })).toEqual(t(3, 4))
  })

  it('adds token counts field by field from the zero value', () => {
    expect(addTokens(NO_TOKENS, t(1, 2, 3, 4, 1))).toEqual(t(1, 2, 3, 4, 1))
    expect(addTokens(t(1, 0, 0, 0, 0), t(0, 0, 0, 2, 2))).toEqual(t(1, 0, 0, 2, 2))
  })

  it('formats a cost to four decimal places, with a cent-scale figure included', () => {
    expect(formatUsd(1.5)).toBe('$1.5000')
    expect(formatUsd(0.00123)).toBe('$0.0012')
  })

  it('keeps the first listed model as the default', () => {
    const first: ModelId = MODELS[0].id
    expect(first).toBe('claude-opus-5-5')
  })
})
