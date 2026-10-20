/** After this many seconds without anything from the API, while the API is the one being waited for,
 *  the indicator shows how long it has been. */
export declare const QUIET_AFTER_SECONDS = 20;
/** Seconds, then minutes and seconds: `7 s`, `1 min 05 s`. A negative span reads as zero. */
export declare function formatElapsed(ms: number): string;
/** The whole seconds since the API last sent anything, once that is long enough to show; null before. */
export declare function quietSeconds(heardAt: number, now: number): number | null;
