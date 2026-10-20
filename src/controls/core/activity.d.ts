/** After this many seconds without anything from the API, while the API is the one being waited for,
 *  the indicator shows how long it has been. */
export declare const QUIET_AFTER_SECONDS = 20;
/** Seconds, then minutes and seconds: `7 s`, `1 min 05 s`. A negative span reads as zero. */
export declare function formatElapsed(ms: number): string;
/** The whole seconds since the API last sent anything, once that is long enough to show; null before. */
export declare function quietSeconds(heardAt: number, now: number): number | null;
/** The line the activity shows for the reasoning so far: the first sentence of the last paragraph that
 *  has text. A paragraph is the text between blank lines, and a sentence ends at `.`, `!` or `?` followed
 *  by a space or the end of the text. While that sentence is unfinished the line is what is there so far.
 *  Once its end mark is written the line holds, so it changes only when a new paragraph starts. A blank
 *  break that opens an empty paragraph changes nothing until that paragraph has text. */
export declare function reasoningLine(reasoning: string): string;
