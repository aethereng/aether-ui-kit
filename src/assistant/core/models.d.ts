/** The models the person picks from; the first is the default. */
export declare const MODELS: readonly [{
    readonly id: "claude-opus-5-5";
    readonly label: "Opus 5.5";
}, {
    readonly id: "claude-sonnet-5-5";
    readonly label: "Sonnet 5.5";
}, {
    readonly id: "claude-haiku-5-5";
    readonly label: "Haiku 5.5";
}, {
    readonly id: "claude-fable-5-1";
    readonly label: "Fable 5.1";
}];
export type ModelId = (typeof MODELS)[number]['id'];
/** The effort levels the person picks from, by the names the request's effort setting takes. */
export declare const EFFORTS: readonly ["low", "medium", "high", "xhigh", "max"];
export type Effort = (typeof EFFORTS)[number];
/** The starting effort, set explicitly on every request because the models' own defaults differ. */
export declare const EFFORT: Effort;
export declare const PRICES_READ_ON = "2026-10-20";
/** The line that names the page the prices were read from. The app passes the name of its vendor, so
 *  the kit holds no vendor name of its own. */
export declare function priceSource(vendor: string): string;
/** USD per million tokens. `write5m` and `write1h` are cache writes at the two cache durations. */
export interface PriceRow {
    input: number;
    output: number;
    cacheRead: number;
    write5m: number;
    write1h: number;
}
export interface ModelPrices {
    /** The price of every request, or of a request whose prompt is at most `over.prompt` tokens. */
    base: PriceRow;
    /** Higher prices for a request whose prompt is over `prompt` tokens, counting input, cache reads
     *  and cache writes together. */
    over?: {
        prompt: number;
        row: PriceRow;
    };
}
export declare const PRICES: Record<ModelId, ModelPrices>;
/** The token counts of one response, as its usage reports them. */
export interface Tokens {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    /** The part of `cacheWrite` written for an hour; the rest is written for five minutes. */
    cacheWrite1h: number;
}
export declare const NO_TOKENS: Tokens;
/** The usage fields of a response the cost reads. A count the response leaves null reads 0. */
export interface UsageLike {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number | null;
    cache_creation_input_tokens: number | null;
    cache_creation: {
        ephemeral_1h_input_tokens: number;
        ephemeral_5m_input_tokens: number;
    } | null;
}
export declare function tokensOf(u: UsageLike): Tokens;
export declare function addTokens(a: Tokens, b: Tokens): Tokens;
/** The estimated cost in USD of one response from `model`. The prompt counts input, cache reads and
 *  cache writes together, and selects the over-threshold row only when it is above the threshold. */
export declare function estimateUsd(model: ModelId, t: Tokens): number;
/** A cost as a panel shows it: dollars to four decimal places, under a cent included. */
export declare function formatUsd(usd: number): string;
