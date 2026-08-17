/** Calendar date. `m` is 1-12, NOT the 0-11 that Date uses — the off-by-one between the two is the
 *  single most common bug in date code, so this type never carries the ambiguous form. */
export interface YMD {
    y: number;
    m: number;
    d: number;
}
/** `YYYY-MM-DD` — the value format of `<input type="date">`, which is what this field stores. */
export declare function toISO(v: YMD): string;
/** Strict: anything that is not exactly `YYYY-MM-DD` AND a real calendar day returns null. An empty
 *  date input reports `''`, and 2026-02-30 is not a date however well-formed it looks. */
export declare function parseISO(s: string): YMD | null;
/** Day 0 of month `m` is the last day of month `m-1`; with Date's 0-based months, passing `m`
 *  directly lands on the last day of `m`. Leap years come out of the calendar rather than a rule. */
export declare function daysInMonth(y: number, m: number): number;
/** 0 = Monday. Weeks start Monday here; a locale-aware first day would need locale data the kit
 *  deliberately does not carry. */
export declare function weekdayIndex(v: YMD): number;
export declare function addMonths(y: number, m: number, delta: number): {
    y: number;
    m: number;
};
/** Move by whole days, clamping through month and year boundaries. Used by the grid's arrow keys,
 *  where stepping off the end of a month must land on the next month rather than day 32. */
export declare function addDays(v: YMD, delta: number): YMD;
export declare function sameDay(a: YMD | null, b: YMD | null): boolean;
/** The user's local today — the one place local time is the correct question to ask. */
export declare function today(): YMD;
export interface GridCell extends YMD {
    /** False for the leading/trailing days borrowed from the neighbouring months. */
    inMonth: boolean;
}
/** Always 42 cells (6 rows of 7). Fixed height on purpose: a grid that returns 5 rows for some
 *  months and 6 for others makes the popup change height as you page through it, which moves the
 *  buttons under the user's cursor. */
export declare function monthGrid(y: number, m: number): GridCell[];
export declare const WEEKDAY_LABELS: readonly ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
export declare const MONTH_LABELS: readonly ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
