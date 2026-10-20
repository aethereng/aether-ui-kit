/* The models an assistant panel offers, the efforts it sets, and the price table its cost line reads.
 * Framework-free: no SDK, no Vue, so the table is checked and the arithmetic run outside any panel.
 *
 * Prices are read by hand from the vendor's pricing page and change without this file knowing, so
 * the estimate is labelled with the date they were read and where they came from. The cost is the
 * panel's own arithmetic on the token counts each response reports. It is an estimate; the bill is
 * the vendor's, under the person's own agreement. */

/** The models the person picks from; the first is the default. */
export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
  { id: 'claude-fable-5-1', label: 'Fable 5.1' },
] as const
export type ModelId = (typeof MODELS)[number]['id']

/** The effort levels the person picks from, by the names the request's effort setting takes. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]

/** The starting effort, set explicitly on every request because the models' own defaults differ. */
export const EFFORT: Effort = 'medium'

// ---- prices ------------------------------------------------------------------------------------

export const PRICES_READ_ON = '2026-10-20'
export const PRICES_SOURCE = "the vendor's API pricing page (platform.claude.com)"

/** USD per million tokens. `write5m` and `write1h` are cache writes at the two cache durations. */
export interface PriceRow {
  input: number
  output: number
  cacheRead: number
  write5m: number
  write1h: number
}

export interface ModelPrices {
  /** The price of every request, or of a request whose prompt is at most `over.prompt` tokens. */
  base: PriceRow
  /** Higher prices for a request whose prompt is over `prompt` tokens, counting input, cache reads
   *  and cache writes together. */
  over?: { prompt: number; row: PriceRow }
}

export const PRICES: Record<ModelId, ModelPrices> = {
  'claude-opus-5-5': { base: { input: 4, output: 20, cacheRead: 0.2, write5m: 5, write1h: 8 } },
  'claude-sonnet-5-5': { base: { input: 2, output: 10, cacheRead: 0.1, write5m: 2.5, write1h: 4 } },
  'claude-haiku-5-5': {
    base: { input: 0.1, output: 0.5, cacheRead: 0.01, write5m: 0.125, write1h: 0.2 },
    over: { prompt: 100000, row: { input: 0.5, output: 2.5, cacheRead: 0.05, write5m: 0.625, write1h: 1 } },
  },
  'claude-fable-5-1': { base: { input: 10, output: 50, cacheRead: 0.25, write5m: 12.5, write1h: 20 } },
}

// ---- tokens and cost ---------------------------------------------------------------------------

/** The token counts of one response, as its usage reports them. */
export interface Tokens {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** The part of `cacheWrite` written for an hour; the rest is written for five minutes. */
  cacheWrite1h: number
}

export const NO_TOKENS: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 }

/** The usage fields of a response the cost reads. A count the response leaves null reads 0. */
export interface UsageLike {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number | null
  cache_creation_input_tokens: number | null
  cache_creation: { ephemeral_1h_input_tokens: number; ephemeral_5m_input_tokens: number } | null
}

export function tokensOf(u: UsageLike): Tokens {
  return {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    cacheWrite1h: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
  }
}

export function addTokens(a: Tokens, b: Tokens): Tokens {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
  }
}

/** The estimated cost in USD of one response from `model`. The prompt counts input, cache reads and
 *  cache writes together, and selects the over-threshold row only when it is above the threshold. */
export function estimateUsd(model: ModelId, t: Tokens): number {
  const prices = PRICES[model]
  const prompt = t.input + t.cacheRead + t.cacheWrite
  const row = prices.over && prompt > prices.over.prompt ? prices.over.row : prices.base
  const write5m = t.cacheWrite - t.cacheWrite1h
  return (t.input * row.input + t.output * row.output + t.cacheRead * row.cacheRead + write5m * row.write5m + t.cacheWrite1h * row.write1h) / 1e6
}

/** A cost as a panel shows it: dollars to four decimal places, under a cent included. */
export function formatUsd(usd: number): string {
  return `$${usd.toFixed(4)}`
}
